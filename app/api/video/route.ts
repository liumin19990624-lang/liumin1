import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import { supabase, supabaseHelpers } from "../../../lib/supabase";
import { z } from 'zod';

// ============================
// 核心配置（DMXAPI 地址+密钥，强制集成）
// ============================
const DMXAPI_CONFIG = {
  BASE_URL: "https://www.dmxapi.cn", // 你的 DMXAPI 基础地址（从截图提取）
  API_KEY: "sk-56iBqzyCSBRB17iQSW2MILO0d1P2UgC8miT6BbvoEvPYI5Nw", // 你的密钥
  VIDEO_GENERATE_ENDPOINT: "/v1/videos/generate", // DMXAPI 视频生成接口
  VIDEO_STATUS_ENDPOINT: "/v1/videos/status", // DMXAPI 视频状态查询接口
};

const APP_CONFIG = {
  VIDEO_GENERATION_COST: 5, // 每次生成消耗 5 积分
  MAX_PROMPT_LENGTH: 1000, // 最大提示词长度
  MIN_PROMPT_LENGTH: 10, // 最小提示词长度
  DEFAULT_VIDEO_CONFIG: {
    resolution: "720p",
    aspectRatio: "16:9",
    numberOfVideos: 1,
  },
};

// 校验配置有效性
if (!DMXAPI_CONFIG.BASE_URL || !DMXAPI_CONFIG.API_KEY) {
  console.error("❌ DMXAPI 配置不完整（基础地址或密钥缺失）");
}

// ============================
// 类型定义与请求验证 Schema
// ============================
// 视频生成请求体校验
const VideoGenerationSchema = z.object({
  image: z.string().min(1, "图片数据不能为空（请提供 base64 编码）"),
  prompt: z.string()
    .min(APP_CONFIG.MIN_PROMPT_LENGTH, `提示词不能少于 ${APP_CONFIG.MIN_PROMPT_LENGTH} 个字符`)
    .max(APP_CONFIG.MAX_PROMPT_LENGTH, `提示词不能超过 ${APP_CONFIG.MAX_PROMPT_LENGTH} 个字符`),
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
// 工具函数：DMXAPI 请求封装
// ============================
const requestDMXAPI = async <T>(
  endpoint: string,
  method: "POST" | "GET",
  data?: Record<string, any>
): Promise<T> => {
  const url = `${DMXAPI_CONFIG.BASE_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DMXAPI_CONFIG.API_KEY}`, // 你的密钥安全传递
    },
  };

  // GET 请求拼接参数，POST 请求传 body
  if (method === "POST" && data) {
    options.body = JSON.stringify(data);
  } else if (method === "GET" && data) {
    const params = new URLSearchParams(data as Record<string, string>);
    url += `?${params.toString()}`;
  }

  const response = await fetch(url, options);
  const responseData = await response.json().catch(() => ({}));

  // 处理 DMXAPI 错误
  if (!response.ok) {
    throw new Error(
      responseData.error?.message || 
      `DMXAPI 请求失败（状态码：${response.status}）`
    );
  }

  return responseData as T;
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

    const validationResult = VideoGenerationSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map(issue => `${issue.path.join('.')}：${issue.message}`)
        .join('，');
      return ApiResponse.badRequest(`参数验证失败：${errorMsg}`);
    }

    const { image: imageBase64, prompt } = validationResult.data;

    // 4. 积分扣减（原子操作）
    const { data: creditResult, error: creditError } = await supabase.rpc(
      'decrement_credits_safe',
      { target_user_id: userId, amount: APP_CONFIG.VIDEO_GENERATION_COST }
    );

    if (creditError) {
      console.error("[积分扣减失败]", creditError);
      return ApiResponse.error("积分扣减失败，请稍后重试");
    }

    const creditCheck = creditResult?.[0];
    if (!creditCheck?.success) {
      return ApiResponse.forbidden(
        `算力点数不足（需要 ${APP_CONFIG.VIDEO_GENERATION_COST} 点，当前剩余 ${creditCheck?.remaining || 0} 点）`
      );
    }

    // 5. 处理图片数据（保留 base64 格式，适配 DMXAPI）
    let pureBase64: string;
    try {
      // 移除 base64 前缀（如果有）
      pureBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      // 验证 base64 有效性
      atob(pureBase64);
    } catch (err) {
      console.error("[图片解析失败]", err);
      // 解析失败，退还积分
      await supabase.rpc('increment_credits_safe', {
        target_user_id: userId,
        amount: APP_CONFIG.VIDEO_GENERATION_COST
      }).catch(e => console.error("[积分退还失败]", e));
      return ApiResponse.badRequest("图片数据无效，请提供标准 base64 编码");
    }

    // 6. 调用 DMXAPI 发起视频生成
    try {
      const dmxResponse = await requestDMXAPI<{ task_id: string }>(
        DMXAPI_CONFIG.VIDEO_GENERATE_ENDPOINT,
        "POST",
        {
          prompt: prompt.trim(),
          image_base64: pureBase64, // DMXAPI 接收 base64 图片
          resolution: APP_CONFIG.DEFAULT_VIDEO_CONFIG.resolution,
          aspect_ratio: APP_CONFIG.DEFAULT_VIDEO_CONFIG.aspectRatio,
          number_of_videos: APP_CONFIG.DEFAULT_VIDEO_CONFIG.numberOfVideos,
        }
      );

      // DMXAPI 返回任务 ID（用于查询状态）
      if (!dmxResponse.task_id) {
        throw new Error("DMXAPI 未返回有效任务 ID");
      }

      // 7. 返回成功响应
      return ApiResponse.success({
        operationId: dmxResponse.task_id, // 与原接口返回字段一致，兼容前端
        message: `视频生成任务已提交，消耗 ${APP_CONFIG.VIDEO_GENERATION_COST} 算力点数`,
        creditsRemaining: creditCheck.remaining || 0,
      });

    } catch (error: any) {
      console.error("[DMXAPI 视频生成失败]", error);
      // 生成失败，自动退还积分
      await supabase.rpc('increment_credits_safe', {
        target_user_id: userId,
        amount: APP_CONFIG.VIDEO_GENERATION_COST
      }).catch(e => console.error("[积分退还失败]", e));
      return ApiResponse.error(`视频生成失败：${error.message || "未知错误"}`);
    }

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
    // 1. 获取并验证任务 ID
    const { searchParams } = new URL(req.url);
    const operationId = searchParams.get('id');

    if (!operationId) {
      return ApiResponse.badRequest("缺少必要参数：id（任务 ID）");
    }

    // 2. 调用 DMXAPI 查询状态
    try {
      const dmxResponse = await requestDMXAPI<{
        done: boolean;
        video_url?: string;
        progress?: number;
        duration_ms?: number;
        error?: string;
      }>(
        DMXAPI_CONFIG.VIDEO_STATUS_ENDPOINT,
        "GET",
        { task_id: operationId } // DMXAPI 接收任务 ID 参数
      );

      // 处理 DMXAPI 返回的错误
      if (dmxResponse.error) {
        throw new Error(dmxResponse.error);
      }

      if (dmxResponse.done) {
        // 生成完成：验证视频 URL
        if (!dmxResponse.video_url) {
          return ApiResponse.error("视频生成完成，但未返回有效视频链接");
        }

        // 构建带密钥的视频 URL（如果 DMXAPI 需要）
        const videoUrl = new URL(dmxResponse.video_url);
        videoUrl.searchParams.set('key', DMXAPI_CONFIG.API_KEY);

        return ApiResponse.success({
          done: true,
          videoUrl: videoUrl.toString(),
          metadata: {
            resolution: APP_CONFIG.DEFAULT_VIDEO_CONFIG.resolution,
            aspectRatio: APP_CONFIG.DEFAULT_VIDEO_CONFIG.aspectRatio,
            duration: dmxResponse.duration_ms 
              ? `${(dmxResponse.duration_ms / 1000).toFixed(1)}s` 
              : "未知时长",
          },
        });
      } else {
        // 生成中：返回进度
        return ApiResponse.success({
          done: false,
          progress: dmxResponse.progress || 0, // 0-100 进度百分比
          message: "视频正在渲染中，请稍后再查",
        });
      }

    } catch (error: any) {
      console.error("[DMXAPI 状态查询失败]", error);
      return ApiResponse.error(`查询失败：${error.message || "任务 ID 无效"}`);
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
