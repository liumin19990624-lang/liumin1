import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import { supabase, supabaseHelpers } from "../../../lib/supabase";
import { z } from 'zod';

// ============================
// 核心配置（DMXAPI 地址+密钥，直接集成）
// ============================
const DMXAPI_CONFIG = {
  BASE_URL: "https://www.dmxapi.cn", // 你的 DMXAPI 基础地址
  API_KEY: "sk-56iBqzyCSBRB17iQSW2MILO0d1P2UgC8miT6BbvoEvPYI5Nw", // 你的密钥
  TTS_ENDPOINT: "/v1/tts/generate", // DMXAPI TTS 接口路径（根据平台文档调整）
};

const APP_CONFIG = {
  TTS_COST: 1, // 每次 TTS 消耗 1 额度
  MAX_PROMPT_LENGTH: 2000, // 最大文本长度
  MIN_PROMPT_LENGTH: 1, // 最小文本长度
  DEFAULT_VOICE_NAME: "Kore", // 默认语音
  // DMXAPI 支持的语音列表（根据平台实际支持调整）
  SUPPORTED_VOICES: [
    "Kore", "Alex", "Aria", "Damian", "Ella", "Giovanni",
    "Isabella", "James", "Joanna", "John", "Julia", "Justin"
  ],
  AUDIO_FORMAT: "pcm", // 音频格式（支持：pcm/mp3/ogg）
};

// 校验配置有效性
if (!DMXAPI_CONFIG.BASE_URL || !DMXAPI_CONFIG.API_KEY) {
  console.error("❌ DMXAPI 配置不完整（基础地址或密钥缺失）");
}

// ============================
// 类型定义与请求验证 Schema
// ============================
const TTSRequestSchema = z.object({
  prompt: z.string()
    .min(APP_CONFIG.MIN_PROMPT_LENGTH, "文本不能为空")
    .max(APP_CONFIG.MAX_PROMPT_LENGTH, `文本不能超过 ${APP_CONFIG.MAX_PROMPT_LENGTH} 个字符`),
  voiceName: z.string()
    .optional()
    .refine(
      (voice) => !voice || APP_CONFIG.SUPPORTED_VOICES.includes(voice),
      `不支持该语音名称，请选择：${APP_CONFIG.SUPPORTED_VOICES.join(', ')}`
    )
});

// 统一响应工具
const ApiResponse = {
  success: <T>(data: T) => NextResponse.json({ success: true, data }, { status: 200 }),
  error: (message: string, status: number = 500) => 
    NextResponse.json({ success: false, error: message }, { status }),
  unauthorized: () => ApiResponse.error("未授权访问，请先登录", 401),
  badRequest: (message: string) => ApiResponse.error(message, 400),
  forbidden: (message: string) => ApiResponse.error(message, 403),
  serviceUnavailable: () => ApiResponse.error("TTS 服务暂不可用", 503),
};

// ============================
// API 处理函数（POST /api/tts）
// ============================
export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const { userId } = auth();
    if (!userId) return ApiResponse.unauthorized();

    // 2. 验证 Supabase 可用性
    if (!supabaseHelpers.isClientAvailable()) {
      return ApiResponse.serviceUnavailable();
    }

    // 3. 解析并验证请求体
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (err) {
      return ApiResponse.badRequest("请求体格式错误，请提供有效的 JSON");
    }

    const validationResult = TTSRequestSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map(issue => `${issue.path.join('.')}：${issue.message}`)
        .join('，');
      return ApiResponse.badRequest(`参数验证失败：${errorMsg}`);
    }

    const { prompt, voiceName } = validationResult.data;
    const finalVoice = voiceName || APP_CONFIG.DEFAULT_VOICE_NAME;

    // 4. 额度扣减（原子操作）
    const { data: creditResult, error: creditError } = await supabase.rpc(
      'decrement_credits_safe',
      { target_user_id: userId, amount: APP_CONFIG.TTS_COST }
    );

    if (creditError) {
      console.error("[额度扣减失败]", creditError);
      return ApiResponse.error("额度扣减失败，请稍后重试");
    }

    const creditCheck = creditResult?.[0];
    if (!creditCheck?.success) {
      return ApiResponse.forbidden(
        `额度不足（需 ${APP_CONFIG.TTS_COST} 点，剩余 ${creditCheck?.remaining_credits || 0} 点）`
      );
    }

    // 5. 调用 DMXAPI 生成语音（直接 HTTP 请求，兼容 DMXAPI）
    let dmxResponse;
    try {
      const ttsUrl = `${DMXAPI_CONFIG.BASE_URL}${DMXAPI_CONFIG.TTS_ENDPOINT}`;
      
      dmxResponse = await fetch(ttsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DMXAPI_CONFIG.API_KEY}`, // 你的密钥安全传递
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash-preview-tts", // DMXAPI 支持的 TTS 模型
          prompt: prompt.trim(),
          voice: finalVoice,
          format: APP_CONFIG.AUDIO_FORMAT, // 音频格式
          speaking_rate: 1.0, // 语速
          pitch: 0.0, // 音调
        }),
      });

      // 解析 DMXAPI 响应
      const dmxData = await dmxResponse.json().catch(() => ({}));

      // 处理 DMXAPI 错误
      if (!dmxResponse.ok) {
        throw new Error(dmxData.error?.message || `DMXAPI 响应失败（状态码：${dmxResponse.status}）`);
      }

      // 验证音频数据
      if (!dmxData.base64_audio) {
        throw new Error("DMXAPI 未返回有效音频数据");
      }

      // 6. 构建音频 Data URL
      const mimeTypeMap: Record<string, string> = {
        pcm: "audio/pcm",
        mp3: "audio/mpeg",
        ogg: "audio/ogg"
      };
      const mimeType = mimeTypeMap[APP_CONFIG.AUDIO_FORMAT];
      const audioDataUrl = `data:${mimeType};base64,${dmxData.base64_audio}`;

      // 7. 返回成功响应
      return ApiResponse.success({
        audio: audioDataUrl,
        voiceName: finalVoice,
        creditsRemaining: creditCheck.remaining_credits,
        audioFormat: APP_CONFIG.AUDIO_FORMAT,
      });

    } catch (error: any) {
      console.error("[DMXAPI TTS 生成失败]", error);
      
      // 生成失败，自动退还额度
      await supabase.rpc('increment_credits_safe', {
        target_user_id: userId,
        amount: APP_CONFIG.TTS_COST
      }).catch(e => console.error("[额度退还失败]", e));

      return ApiResponse.error(`语音生成失败：${error.message || '服务异常'}`);
    }

  } catch (error: any) {
    console.error("[TTS POST 全局错误]", error);
    return ApiResponse.error("语音生成请求异常，请联系管理员");
  }
}

// ============================
// 跨域预检支持
// ============================
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
