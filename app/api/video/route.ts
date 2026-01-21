import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";
import { auth } from "@clerk/nextjs/server";
import { supabase, supabaseHelpers } from "../../../lib/supabase";
import { z } from 'zod';

// ============================
// 核心配置（直接集成你的 API 密钥）
// ============================
const CONFIG = {
  // 你的 DMXAPI 密钥（安全存储在后端，前端不可见）
  API_KEY: "sk-56iBqzyCSBRB17iQSW2MILO0d1P2UgC8miT6BbvoEvPYI5Nw",
  // 视频生成配置
  VIDEO_GENERATION_COST: 5,
  GOOGLE_VEO_MODEL: 'veo-3.1-fast-generate-preview',
  DEFAULT_VIDEO_CONFIG: {
    numberOfVideos: 1,
    resolution: '720p' as const,
    aspectRatio: '16:9' as const,
  },
  MAX_PROMPT_LENGTH: 1000,
  MIN_PROMPT_LENGTH: 10,
};

// 校验 API 密钥是否配置
if (!CONFIG.API_KEY) {
  console.error("❌ API 密钥未配置，请检查 CONFIG.API_KEY");
}

// ============================
// 类型定义与请求验证 Schema
// ============================
const VideoGenerationSchema = z.object({
  image: z.string().min(1, "图片数据不能为空（请提供 base64 编码）"),
  prompt: z.string()
    .min(CONFIG.MIN_PROMPT_LENGTH, `提示词不能少于 ${CONFIG.MIN_PROMPT_LENGTH} 个字符`)
    .max(CONFIG.MAX_PROMPT_LENGTH, `提示词不能超过 ${CONFIG.MAX_PROMPT_LENGTH} 个字符`),
});

// 统一响应工具
const ApiResponse = {
  success: <T>(data: T) => NextResponse.json({ success: true, data }, { status: 200 }),
  error: (message: string, status: number = 500) => 
    NextResponse.json({ success: false, error: message }, { status }),
  unauthorized: () => ApiResponse.error("未授权访问，请先登录", 401),
  badRequest: (message: string) => ApiResponse.error(message, 400),
  forbidden: (message: string) => ApiResponse.error(message, 403),
  serviceUnavailable: () => ApiResponse.error("视频生成服务暂不可用", 503),
};

// ============================
// 工具函数：初始化 Google GenAI 客户端（强制使用你的密钥）
// ============================
const getGoogleGenAIClient = (): GoogleGenAI | null => {
  if (!CONFIG.API_KEY) return null;
  return new GoogleGenAI({ apiKey: CONFIG.API_KEY });
};

// ============================
// API 处理函数
// ============================

/**
 * 发起视频生成请求（消耗 5 积分）
 * POST /api/video/generate
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const { userId } = auth();
    if (!userId) return ApiResponse.unauthorized();

    // 2. 验证 Supabase 客户端可用性
    if (!supabaseHelpers.isClientAvailable()) {
      return ApiResponse.serviceUnavailable();
    }

    // 3. 初始化 AI 客户端（使用你的密钥）
    const ai = getGoogleGenAIClient();
    if (!ai) {
      return ApiResponse.error("API 密钥配置错误，无法初始化 AI 客户端");
    }

    // 4. 解析并验证请求体
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (err) {
      return ApiResponse.badRequest("请求体格式错误，请提供有效的 JSON");
    }

    const validationResult = VideoGenerationSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map(issue => `${issue.path.join('.')}：${issue.message}`)
        .join('，');
      return ApiResponse.badRequest(`参数验证失败：${errorMsg}`);
    }

    const { image: imageBase64, prompt } = validationResult.data;

    // 5. 积分扣减（原子操作）
    const { data: creditResult, error: creditError } = await supabase.rpc(
      'decrement_credits_safe',
      { target_user_id: userId, amount: CONFIG.VIDEO_GENERATION_COST }
    );

    if (creditError) {
      console.error("[积分扣减失败]", creditError);
      return ApiResponse.error("积分扣减失败，请稍后重试");
    }

    const creditCheck = creditResult?.[0];
    if (!creditCheck?.success) {
      return ApiResponse.forbidden(
        `算力点数不足（需要 ${CONFIG.VIDEO_GENERATION_COST} 点，当前剩余 ${creditCheck?.remaining || 0} 点）`
      );
    }

    // 6. Base64 转 Uint8Array（图片数据处理）
    let imageBytes: Uint8Array;
    try {
      // 移除 base64 前缀（如果有）
      const pureBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      imageBytes = Uint8Array.from(atob(pureBase64), c => c.charCodeAt(0));
    } catch (err) {
      console.error("[图片解析失败]", err);
      // 解析失败，退还积分
      await supabase.rpc('increment_credits_safe', {
        target_user_id: userId,
        amount: CONFIG.VIDEO_GENERATION_COST
      }).catch(e => console.error("[积分退还失败]", e));
      return ApiResponse.badRequest("图片数据无效，请提供标准 base64 编码");
    }

    // 7. 调用 Google Veo 生成视频（使用你的 API 密钥）
    let operation: GenerateVideosOperation;
    try {
      operation = await ai.models.generateVideos({
        model: CONFIG.GOOGLE_VEO_MODEL,
        prompt: prompt.trim(),
        image: {
          imageBytes: imageBytes,
          mimeType: 'image/png',
        },
        config: CONFIG.DEFAULT_VIDEO_CONFIG,
      });
    } catch (error: any) {
      console.error("[视频生成失败]", error);
      // 生成失败，自动退还积分
      await supabase.rpc('increment_credits_safe', {
        target_user_id: userId,
        amount: CONFIG.VIDEO_GENERATION_COST
      }).catch(e => console.error("[积分退还失败]", e));
      return ApiResponse.error(`视频生成失败：${error.message || "未知错误"}`);
    }

    // 8. 返回操作 ID（用于查询状态）
    return ApiResponse.success({
      operationId: operation.name,
      message: `视频生成任务已提交，消耗 ${CONFIG.VIDEO_GENERATION_COST} 算力点数`,
    });

  } catch (error: any) {
    console.error("[Video POST 全局错误]", error);
    return ApiResponse.error("视频生成请求异常，请联系管理员");
  }
}

/**
 * 查询视频生成状态
 * GET /api/video/generate?id=操作ID
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 获取并验证操作 ID
    const { searchParams } = new URL(req.url);
    const operationId = searchParams.get('id');

    if (!operationId) {
      return ApiResponse.badRequest("缺少必要参数：id（操作 ID）");
    }

    // 2. 初始化 AI 客户端（使用你的密钥）
    const ai = getGoogleGenAIClient();
    if (!ai) {
      return ApiResponse.error("API 密钥配置错误，无法查询视频状态");
    }

    // 3. 查询任务状态
    let operation: GenerateVideosOperation;
    try {
      operation = await ai.operations.getVideosOperation({
        operation: { name: operationId },
      });
    } catch (error: any) {
      console.error("[状态查询失败]", error);
      return ApiResponse.error(`查询失败：${error.message || "操作 ID 无效"}`);
    }

    // 4. 处理查询结果
    if (operation.done) {
      const generatedVideo = operation.response?.generatedVideos?.[0];
      
      if (!generatedVideo || !generatedVideo.video?.uri) {
        return ApiResponse.error("视频生成完成，但未返回有效视频链接");
      }

      // 构建带密钥的视频 URL（直接使用你的 API 密钥）
      const videoUrl = new URL(generatedVideo.video.uri);
      videoUrl.searchParams.set('key', CONFIG.API_KEY);

      return ApiResponse.success({
        done: true,
        videoUrl: videoUrl.toString(),
        metadata: {
          resolution: CONFIG.DEFAULT_VIDEO_CONFIG.resolution,
          aspectRatio: CONFIG.DEFAULT_VIDEO_CONFIG.aspectRatio,
          duration: generatedVideo.video.durationMs 
            ? `${(generatedVideo.video.durationMs / 1000).toFixed(1)}s` 
            : "未知时长",
        },
      });
    } else {
      // 返回生成进度（0-100）
      return ApiResponse.success({
        done: false,
        progress: operation.metadata?.progress || 0,
        message: "视频正在渲染中，请稍后再查",
      });
    }

  } catch (error: any) {
    console.error("[Video GET 全局错误]", error);
    return ApiResponse.error("查询视频状态异常，请联系管理员");
  }
}

/**
 * 跨域预检支持
 */
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
