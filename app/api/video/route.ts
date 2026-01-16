
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from "@google/genai";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "../../../lib/supabase";

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { image, prompt } = await req.json();

    // 1. Credit check (Video generation costs 5 credits)
    const { data: creditCheck } = await supabase.rpc('decrement_credits_safe', {
      target_user_id: userId,
      amount: 5
    });

    if (!creditCheck?.[0]?.success) {
      return NextResponse.json({ error: "算力点数不足以支撑 4K 视频渲染" }, { status: 403 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      image: {
        imageBytes: image,
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    return NextResponse.json({ operationId: operation.id });
  } catch (error: any) {
    console.error("Veo Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const operation = await ai.operations.getVideosOperation({ operation: { id } });

    if (operation.done) {
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      return NextResponse.json({ done: true, videoUrl: `${downloadLink}&key=${process.env.API_KEY}` });
    }

    return NextResponse.json({ done: false });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
