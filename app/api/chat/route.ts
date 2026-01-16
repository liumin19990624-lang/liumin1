
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "../../../lib/supabase";

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { prompt, config, systemInstruction } = await req.json();
    
    // 1. 额度预判 (图像 2 额度，文本 1 额度)
    const isImageTask = config?.model?.includes('image');
    const creditCost = isImageTask ? 2 : 1;

    const { data: creditCheck } = await supabase.rpc('decrement_credits_safe', {
      target_user_id: userId,
      amount: creditCost
    });

    if (!creditCheck?.[0]?.success) {
      return NextResponse.json({ error: "算力点数不足，请及时补充", code: "NO_CREDITS" }, { status: 403 });
    }

    // 2. 初始化 AI
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = config?.model || 'gemini-3-pro-preview';

    // 自动配置思考预算 (仅限 3 和 2.5 系列)
    const thinkingConfig = modelName.includes('pro') ? { thinkingBudget: 16384 } : undefined;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        ...config,
        systemInstruction: systemInstruction || "你是一个资深的漫剧导演。",
        thinkingConfig
      },
    });

    // 3. 多模态内容解析
    let text = response.text || "";
    let image = null;

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
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
