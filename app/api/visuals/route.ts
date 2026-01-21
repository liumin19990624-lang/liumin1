import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import { supabase, supabaseHelpers } from "../../../lib/supabase";
import { z } from 'zod';

// ============================
// 核心配置（你的 DMXAPI 密钥直接集成）
// ============================
const DMXAPI_CONFIG = {
  API_KEY: "sk-56iBqzyCSBRB17iQSW2MILO0d1P2UgC8miT6BbvoEvPYI5Nw", // 你的密钥
  BASE_URL: "https://www.dmxapi.cn/v1",
  DEFAULT_IMAGE_SIZE: "1024x1024",
  DEFAULT_STYLE: "2D动漫风格，细节丰富，高清画质，漫剧主角级别，色彩鲜明",
};

// 验证 DMXAPI 配置是否有效
if (!DMXAPI_CONFIG.API_KEY || !DMXAPI_CONFIG.BASE_URL) {
  console.error("❌ DMXAPI 配置无效，请检查密钥和基础URL");
}

// ============================
// 类型定义与验证 Schema
// ============================
interface CharacterVisual {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  image_url: string;
  created_at: string;
  updated_at: string;
}

// 直接上传图片的请求体 Schema
const UploadCharacterSchema = z.object({
  name: z.string().min(1, "角色名称不能为空").max(50, "角色名称不能超过50个字符"),
  description: z.string().max(500, "角色描述不能超过500个字符").optional().nullable(),
  imageUrl: z.string().url("请提供有效的图片URL").min(1, "图片URL不能为空"),
});

// 通过 DMXAPI 生成图片的请求体 Schema
const GenerateCharacterSchema = z.object({
  name: z.string().min(1, "角色名称不能为空").max(50, "角色名称不能超过50个字符"),
  prompt: z.string().min(10, "角色描述不能少于10个字符").max(500, "角色描述不能超过500个字符"),
  style: z.string().optional().default(DMXAPI_CONFIG.DEFAULT_STYLE),
});

// ============================
// 统一响应工具
// ============================
const ApiResponse = {
  success: <T>(data: T) => NextResponse.json({ success: true, data }, { status: 200 }),
  error: (message: string, status: number = 500) => 
    NextResponse.json({ success: false, error: message }, { status }),
  unauthorized: () => ApiResponse.error("未授权访问，请先登录", 401),
  badRequest: (message: string) => ApiResponse.error(message, 400),
  notFound: () => ApiResponse.error("请求的角色资源不存在", 404),
  serviceUnavailable: () => ApiResponse.error("DMXAPI 服务暂不可用", 503),
};

// ============================
// 工具函数：调用 DMXAPI 生成角色图
// ============================
const generateImageByDMXAPI = async (prompt: string): Promise<string> => {
  try {
    // 验证 DMXAPI 配置
    if (!DMXAPI_CONFIG.API_KEY || !DMXAPI_CONFIG.BASE_URL) {
      throw new Error("DMXAPI 配置无效");
    }

    // 调用 DMXAPI 生成图片
    const response = await fetch(`${DMXAPI_CONFIG.BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DMXAPI_CONFIG.API_KEY}`, // 密钥安全传递
      },
      body: JSON.stringify({
        prompt,
        n: 1,
        size: DMXAPI_CONFIG.DEFAULT_IMAGE_SIZE,
        response_format: "url",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `DMXAPI 响应失败（状态码：${response.status}）`);
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error("DMXAPI 未返回有效图片URL");
    }

    return imageUrl;
  } catch (error: any) {
    console.error("[DMXAPI 生成图片失败]:", error.message);
    throw new Error(`生成角色图失败：${error.message}`);
  }
};

// ============================
// API 处理函数
// ============================

/**
 * 获取当前用户的所有角色视觉资源
 * GET /api/character-visuals
 */
export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) return ApiResponse.unauthorized();

    if (!supabaseHelpers.isClientAvailable()) {
      return ApiResponse.error("服务暂不可用，请稍后重试");
    }

    const { data, error } = await supabase
      .from('character_visuals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { descending: true });

    if (error) throw error;
    return ApiResponse.success<CharacterVisual[]>(data || []);
  } catch (error: any) {
    console.error("[CharacterVisuals GET] 错误:", error);
    return ApiResponse.error(error.message || "获取角色资源失败");
  }
}

/**
 * 新增角色视觉资源（支持：直接上传图片 / 通过 DMXAPI 生成图片）
 * POST /api/character-visuals
 * 两种调用方式：
 * 1. 直接上传：{ name, description, imageUrl }
 * 2. 生成图片：{ name, prompt, style? }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) return ApiResponse.unauthorized();

    if (!supabaseHelpers.isClientAvailable()) {
      return ApiResponse.error("服务暂不可用，请稍后重试");
    }

    // 解析请求体
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (err) {
      return ApiResponse.badRequest("请求体格式错误，请提供有效的 JSON");
    }

    // 区分是「直接上传」还是「生成图片」
    let name: string, description: string | null, imageUrl: string;

    // 检查是否是「生成图片」的请求
    if ('prompt' in requestBody) {
      const validationResult = GenerateCharacterSchema.safeParse(requestBody);
      if (!validationResult.success) {
        const errorMsg = validationResult.error.issues
          .map(issue => `${issue.path.join('.')}：${issue.message}`)
          .join('，');
        return ApiResponse.badRequest(`参数验证失败：${errorMsg}`);
      }

      const { name: charName, prompt, style } = validationResult.data;
      name = charName;
      description = prompt;

      // 调用 DMXAPI 生成图片
      imageUrl = await generateImageByDMXAPI(`${prompt}，${style}`);
    } 
    // 否则是「直接上传图片」的请求
    else {
      const validationResult = UploadCharacterSchema.safeParse(requestBody);
      if (!validationResult.success) {
        const errorMsg = validationResult.error.issues
          .map(issue => `${issue.path.join('.')}：${issue.message}`)
          .join('，');
        return ApiResponse.badRequest(`参数验证失败：${errorMsg}`);
      }

      const { name: charName, description: charDesc, imageUrl: charImageUrl } = validationResult.data;
      name = charName;
      description = charDesc;
      imageUrl = charImageUrl;
    }

    // 保存到数据库
    const { data, error } = await supabase
      .from('character_visuals')
      .insert({
        user_id: userId,
        name,
        description,
        image_url: imageUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return ApiResponse.success<CharacterVisual>(data);
  } catch (error: any) {
    console.error("[CharacterVisuals POST] 错误:", error);
    return ApiResponse.error(error.message || "新增角色资源失败");
  }
}

/**
 * 删除指定的角色视觉资源
 * DELETE /api/character-visuals?id=xxx
 */
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) return ApiResponse.unauthorized();

    if (!supabaseHelpers.isClientAvailable()) {
      return ApiResponse.error("服务暂不可用，请稍后重试");
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      return ApiResponse.badRequest("请提供有效的角色资源 ID");
    }

    // 验证资源所有权
    const { data: existingResource, error: fetchError } = await supabase
      .from('character_visuals')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingResource) {
      return ApiResponse.notFound();
    }

    // 执行删除
    const { error } = await supabase
      .from('character_visuals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return ApiResponse.success({ id, message: "角色资源已成功删除" });
  } catch (error: any) {
    console.error("[CharacterVisuals DELETE] 错误:", error);
    return ApiResponse.error(error.message || "删除角色资源失败");
  }
}

/**
 * 支持 OPTIONS 请求（跨域预检）
 */
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
