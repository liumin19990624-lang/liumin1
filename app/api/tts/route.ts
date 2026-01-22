
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Modality } from "@google/genai";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "../../../lib/supabase";

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { prompt, voiceName } = await req.json();

    // 扣费逻辑 (TTS 消耗 1 额度)
    const { data: creditResult } = await supabase.rpc('decrement_credits_safe', {
      target_user_id: userId,
      amount: 1
    });

    if (!creditResult?.[0]?.success) {
      return NextResponse.json({ error: "额度不足" }, { status: 403 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: prompt,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("TTS Engine No Data");

    return NextResponse.json({ 
      audio: `data:audio/pcm;base64,${base64Audio}`,
      creditsRemaining: creditResult[0].remaining_credits
    });

  } catch (error: any) {
    console.error("TTS API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
