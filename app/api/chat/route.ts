
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { prompt, config, systemInstruction, stream: shouldStream, model: requestedModel } = await req.json();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Dynamically use the requested model or default to flash
    const modelName = requestedModel || 'gemini-3-flash-preview';

    // Handle Image Generation Models (Nano Banana series)
    if (modelName === 'gemini-2.5-flash-image' || modelName === 'gemini-3-pro-image-preview') {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { ...config, systemInstruction },
      });
      
      let base64Image = "";
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          // Find the image part in the response parts
          if (part.inlineData) {
            base64Image = part.inlineData.data;
            break;
          }
        }
      }
      return NextResponse.json({ image: base64Image ? `data:image/png;base64,${base64Image}` : "" });
    }

    if (shouldStream) {
      const response = await ai.models.generateContentStream({
        model: modelName,
        contents: prompt,
        config: {
          ...config,
          systemInstruction,
        },
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of response) {
              // Access .text property directly
              const text = chunk.text;
              if (text) controller.enqueue(encoder.encode(text));
            }
          } catch (e: any) {
            console.error("Stream generation internal error:", e);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    } else {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { 
          ...config, 
          systemInstruction, 
        },
      });
      return NextResponse.json({ text: response.text });
    }
  } catch (error: any) {
    console.error("Chat API Error:", error);
    // Return a clean JSON error response that matches the user's reported format
    return NextResponse.json({ 
      error: {
        code: 500,
        message: error.message || "Gemini API failure",
        status: "INTERNAL"
      }
    }, { status: 500 });
  }
}
