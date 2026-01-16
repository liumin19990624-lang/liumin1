
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "../../../lib/supabase";

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { prompt, config, systemInstruction } = await req.json();
    
    // 智能计费：图像 3 额度，视频 5 额度，文本 1 额度
    const modelName = config?.model || 'gemini-3-pro-preview';
    const isImageTask = modelName.includes('image');
    const creditCost = isImageTask ? 3 : 1;

    const { data: creditCheck } = await supabase.rpc('decrement_credits_safe', {
      target_user_id: userId,
      amount: creditCost
    });

    if (!creditCheck?.[0]?.success) {
      return NextResponse.json({ error: "算力点数枯竭，无法驱动高维模型", code: "NO_CREDITS" }, { status: 403 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // 为 Pro 级别模型自动启用 16K 思考预算，增强剧本逻辑
    const thinkingConfig = modelName.includes('pro') ? { thinkingBudget: 16384 } : undefined;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        ...config,
        systemInstruction: systemInstruction || "你是一个顶级 2D 动漫剧本导演，专注于爽文改编。",
        thinkingConfig
      },
    });

    let text = response.text || "";
    let image = null;

    // 解析多模态返回（支持 inlineData 图像）
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    return NextResponse.json({ 
      text, 
      image,
      creditsRemaining: creditCheck[0].remaining_credits 
    });

  } catch (error: any) {
    console.error("Gemini API Engine Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
