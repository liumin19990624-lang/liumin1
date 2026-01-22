
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ 
      error: { code: 401, message: "Unauthorized", status: "UNAUTHENTICATED" } 
    }, { status: 401 });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return NextResponse.json({ 
      error: { code: 500, message: "Server configuration error: API_KEY is missing.", status: "INTERNAL" } 
    }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { prompt, config, systemInstruction, stream: shouldStream, model: requestedModel } = body;

    // Use Gemini API client with required named parameter
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const modelName = requestedModel || 'gemini-3-flash-preview';

    // 图像生成逻辑
    if (modelName.includes('image')) {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config: { ...config, systemInstruction },
      });
      
      let base64Image = "";
      const candidates = response.candidates || [];
      const parts = candidates[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
      return NextResponse.json({ image: base64Image ? `data:image/png;base64,${base64Image}` : "" });
    }

    // 流式响应逻辑
    if (shouldStream) {
      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config: { ...config, systemInstruction },
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
            console.error("Stream reader error:", e);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readableStream, { 
        headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
      });
    } else {
      // 静态响应逻辑
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ parts: [{ text: prompt }] }],
        config: { ...config, systemInstruction },
      });
      // Extract text from GenerateContentResponse using the .text property
      return NextResponse.json({ text: response.text });
    }
  } catch (error: any) {
    console.error("Chat API Critical Error:", error);
    
    let message = error.message || "An error occurred with the AI service.";
    return NextResponse.json({ 
      error: {
        code: 500,
        message: message,
        status: "INTERNAL"
      }
    }, { status: 500 });
  }
}
