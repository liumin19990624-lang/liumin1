import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import { supabase, supabaseHelpers } from "../../../../lib/supabase";
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid'; // 用于生成唯一图片 ID（替代随机字符串）

// ============================
// 核心类型定义
// ============================
// 场景图片类型
interface SceneImage {
  id: string; // UUID 唯一标识
  shotDescription: string; // 镜头描述
  imageUrl: string; // 图片 URL
  created_at: string; // 创建时间戳
}

// 剧本表返回类型（仅包含需要的字段）
interface ScriptBlock {
  id: string;
  user_id: string;
  scene_images: SceneImage[] | null;
  // 其他字段按需保留
}

// ============================
// 请求验证 Schema
// ============================
const AddSceneImageSchema = z.object({
  blockId: z.string().uuid("剧本块 ID 必须是 UUID 格式"), // 校验 UUID 合法性
  shotDescription: z.string()
    .min(5, "镜头描述不能少于 5 个字符")
    .max(500, "镜头描述不能超过 500 个字符"),
  imageUrl: z.string()
    .url("图片 URL 格式无效，请提供合法的 HTTP/HTTPS 链接")
    .min(10, "图片 URL 不能为空"),
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
// API 处理函数（POST /api/scripts/blocks/scene-image）
// ============================
export async function POST(req: NextRequest) {
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

    const validationResult = AddSceneImageSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map(issue => `${issue.path.join('.')}：${issue.message}`)
        .join('，');
      return ApiResponse.badRequest(`参数验证失败：${errorMsg}`);
    }

    const { blockId, shotDescription, imageUrl } = validationResult.data;

    // 4. 查询目标剧本块（验证所有权和存在性）
    const { data: block, error: fetchError } = await supabase
      .from('scripts')
      .select('id, user_id, scene_images')
      .eq('id', blockId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error("[查询剧本块失败]", fetchError);
      // 区分 "未找到" 和其他错误
      if (fetchError.code === 'PGRST116') {
        return ApiResponse.notFound();
      }
      throw new Error("查询剧本块失败，请稍后重试");
    }

    // 5. 构建新的场景图片数据（使用 UUID 确保 ID 唯一）
    const newSceneImage: SceneImage = {
      id: uuidv4(), // 替代 Math.random()，生成标准 UUID，避免重复
      shotDescription: shotDescription.trim(), // 去除首尾空格
      imageUrl: imageUrl.trim(),
      created_at: new Date().toISOString(), // 标准 ISO 时间戳
    };

    // 6. 追加图片数据（处理 null 情况）
    const currentImages = block.scene_images || [];
    const updatedSceneImages = [...currentImages, newSceneImage];

    // 7. 限制图片数量（可选：防止无限追加，例如最多 20 张）
    const MAX_IMAGES_PER_BLOCK = 20;
    if (updatedSceneImages.length > MAX_IMAGES_PER_BLOCK) {
      return ApiResponse.badRequest(`每个剧本块最多只能添加 ${MAX_IMAGES_PER_BLOCK} 张场景图片`);
    }

    // 8. 写回数据库并更新时间戳
    const { data: updatedBlock, error: updateError } = await supabase
      .from('scripts')
      .update({
        scene_images: updatedSceneImages,
        updated_at: new Date().toISOString() // 同步更新剧本块的修改时间
      })
      .eq('id', blockId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (updateError) {
      console.error("[更新场景图片失败]", updateError);
      throw new Error("更新场景图片失败，请稍后重试");
    }

    // 9. 格式化返回数据（下划线转驼峰，兼容前端）
    const formattedResponse = {
      ...updatedBlock,
      sceneImages: updatedBlock.scene_images, // 驼峰命名供前端使用
      scene_images: undefined, // 移除下划线字段，避免歧义
    };

    return ApiResponse.success(formattedResponse);

  } catch (error: any) {
    console.error("[Scene Image POST 全局错误]", error);
    return ApiResponse.error(error.message || "追加场景图片异常，请联系管理员");
  }
}

/**
 * 支持 OPTIONS 请求（跨域预检）
 */
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
