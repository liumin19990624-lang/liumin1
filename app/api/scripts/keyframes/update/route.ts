import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import { supabase, supabaseHelpers } from "../../../../../lib/supabase";
import { z } from 'zod';
import { isUUID } from 'class-validator'; // 用于 UUID 校验（或使用 uuid 库）

// ============================
// 核心类型定义
// ============================
// 单张场景图片类型（确保数组中每个元素格式合法）
interface SceneImage {
  id: string; // 唯一标识（UUID 或自定义唯一 ID）
  shotDescription: string; // 镜头描述
  imageUrl: string; // 图片 URL
  created_at: string; // 创建时间戳（ISO 格式）
}

// ============================
// 请求验证 Schema（严格校验批量图片数据）
// ============================
// 单张图片的验证规则
const SceneImageSchema = z.object({
  id: z.string().min(3, "图片 ID 不能为空且长度不能少于 3 个字符"),
  shotDescription: z.string()
    .min(5, "镜头描述不能少于 5 个字符")
    .max(500, "镜头描述不能超过 500 个字符"),
  imageUrl: z.string().url("图片 URL 格式无效，请提供合法的 HTTP/HTTPS 链接"),
  created_at: z.string().iso("创建时间戳格式无效，请提供 ISO 格式（如：2024-01-01T00:00:00.000Z）")
});

// 批量更新请求的整体验证
const BatchUpdateImagesSchema = z.object({
  blockId: z.string().refine(
    (val) => isUUID(val), // 校验 blockId 为 UUID 格式
    { message: "剧本块 ID 必须是 UUID 格式" }
  ),
  images: z.array(SceneImageSchema) // 数组中每个元素都需符合单张图片规则
    .max(20, "单次最多只能更新 20 张图片，避免数据过大")
    .refine(
      (arr) => {
        // 校验图片 ID 唯一（避免数组中存在重复 ID）
        const ids = arr.map(item => item.id);
        return new Set(ids).size === ids.length;
      },
      { message: "图片数组中存在重复 ID，请确保每个图片 ID 唯一" }
    )
});

// 统一响应工具
const ApiResponse = {
  success: <T>(data: T) => NextResponse.json({ success: true, data }, { status: 200 }),
  error: (message: string, status: number = 500) => 
    NextResponse.json({ success: false, error: message }, { status }),
  unauthorized: () => ApiResponse.error("未授权访问，请先登录", 401),
  badRequest: (message: string) => ApiResponse.error(message, 400),
  notFound: () => ApiResponse.error("请求的剧本块不存在或无权访问", 404),
  serviceUnavailable: () => ApiResponse.error("服务暂不可用，请稍后重试", 503),
};

// ============================
// API 处理函数（PUT /api/scripts/blocks/scene-images/batch）
// ============================
export async function PUT(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const { userId } = auth();
    if (!userId) return ApiResponse.unauthorized();

    // 2. 验证 Supabase 客户端可用性
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

    // 严格校验参数格式
    const validationResult = BatchUpdateImagesSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map(issue => `${issue.path.join('.')}：${issue.message}`)
        .join('，');
      return ApiResponse.badRequest(`参数验证失败：${errorMsg}`);
    }

    const { blockId, images } = validationResult.data;

    // 4. 验证剧本块所有权（防止越权更新）
    const { data: existBlock, error: fetchError } = await supabase
      .from('scripts')
      .select('id')
      .eq('id', blockId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error("[查询剧本块失败]", fetchError);
      // 区分「未找到」和其他数据库错误
      return fetchError.code === 'PGRST116' ? ApiResponse.notFound() : ApiResponse.error("查询剧本块失败");
    }

    // 5. 执行批量更新（同步更新修改时间戳）
    const { data: updatedBlock, error: updateError } = await supabase
      .from('scripts')
      .update({
        scene_images: images, // 覆盖原有图片数组
        updated_at: new Date().toISOString() // 同步更新修改时间
      })
      .eq('id', blockId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (updateError) {
      console.error("[批量更新图片失败]", updateError);
      throw new Error("更新场景图片失败，请稍后重试");
    }

    // 6. 格式化返回数据（下划线转驼峰，兼容前端）
    const formattedResponse = {
      ...updatedBlock,
      sceneImages: updatedBlock.scene_images, // 驼峰命名供前端使用
      scene_images: undefined // 移除冗余字段
    };

    return ApiResponse.success(formattedResponse);

  } catch (error: any) {
    console.error("[Batch Update Images PUT 全局错误]", error);
    return ApiResponse.error(error.message || "批量更新场景图片异常");
  }
}

/**
 * 支持 OPTIONS 请求（跨域预检）
 */
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
      "Access-Control-Allow-Methods": "PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
