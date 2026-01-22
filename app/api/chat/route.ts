
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  // Clerk 鉴权保护
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ 
      error: { code: 401, message: "Unauthorized", status: "UNAUTHENTICATED" } 
    }, { status: 401 });
  }

  // 获取 API KEY
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return NextResponse.json({ 
      error: { code: 500, message: "请先通过上方 [Configure Key] 按钮配置您的 Gemini API Key。", status: "INTERNAL" } 
    }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { prompt, config, systemInstruction, stream: shouldStream, model: requestedModel } = body;

    // 每次请求动态实例化，确保使用最新的 API KEY
    const ai = new GoogleGenAI({ apiKey });

    // 模型名称映射与默认值
    let modelName = requestedModel || 'gemini-3-flash-preview';
    if (modelName === 'gemini-flash' || modelName === 'gemini-flash-latest') modelName = 'gemini-3-flash-preview';
    if (modelName === 'gemini-pro' || modelName === 'gemini-3-pro-preview') modelName = 'gemini-3-pro-preview';

    // 图像生成逻辑 (gemini-2.5-flash-image)
    if (modelName.includes('image')) {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: [{ text: prompt }] }, // 修正为对象结构
        config: { ...config, systemInstruction },
      });
      
      let base64Image = "";
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
      
      if (!base64Image) {
        throw new Error("模型未返回图像数据，请尝试更换提示词。");
      }

      return NextResponse.json({ image: `data:image/png;base64,${base64Image}` });
    }

    // 文本/剧本生成逻辑
    if (shouldStream) {
      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents: { parts: [{ text: prompt }] }, // 修正为对象结构
        config: { 
          ...config, 
          systemInstruction,
          // 对于 Gemini 3 系列，默认开启一定的思考预算以提高改编质量
          thinkingConfig: { thinkingBudget: 4000 } 
        },
      });

      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of responseStream) {
              const text = chunk.text;
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            }
          } catch (e: any) {
            console.error("Stream delivery error:", e);
            controller.enqueue(encoder.encode(`\n[Error: ${e.message}]`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readableStream, { 
        headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
      });
    } else {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: [{ text: prompt }] },
        config: { ...config, systemInstruction },
      });
      return NextResponse.json({ text: response.text || "" });
    }
  } catch (error: any) {
    console.error("Critical API Error:", error);
    return NextResponse.json({ 
      error: {
        code: 500,
        message: error.message || "AI 服务响应异常，请检查 API Key 权限或稍后重试。",
        status: "INTERNAL"
      }
    }, { status: 500 });
  }
}
