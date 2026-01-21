import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import { supabase, supabaseHelpers } from "../../../../lib/supabase";
import { z } from 'zod'; // 需安装：npm install zod

// ============================
// 1. 类型定义与请求验证 Schema
// ============================
// 角色视觉资源更新后返回的类型（与数据库表结构对齐）
interface CharacterVisual {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  image_url: string;
  voice_id: string | null; // 新增的语音 ID 字段
  created_at: string;
  updated_at: string;
}

// 更新语音 ID 的请求体验证 Schema（严格校验输入）
const UpdateVoiceIdSchema = z.object({
  id: z.string().uuid("请提供有效的角色资源 ID（UUID 格式）"), // 校验 UUID 格式
  voiceId: z.string().min(1, "语音 ID 不能为空").max(100, "语音 ID 不能超过 100 个字符"), // 校验语音 ID
});

// ============================
// 2. 通用响应工具（统一 API 响应格式）
// ============================
const ApiResponse = {
  /** 成功响应 */
  success: <T>(data: T) => NextResponse.json({ success: true, data }, { status: 200 }),
  /** 错误响应 */
  error: (message: string, status: number = 500) => 
    NextResponse.json({ success: false, error: message }, { status }),
  /** 未授权响应 */
  unauthorized: () => ApiResponse.error("未授权访问，请先登录", 401),
  /** 参数错误响应 */
  badRequest: (message: string) => ApiResponse.error(message, 400),
  /** 资源不存在响应 */
  notFound: () => ApiResponse.error("请求的角色资源不存在或无权访问", 404),
};

// ============================
// 3. API 处理函数（PUT /api/character-visuals/voice）
// ============================
export async function PUT(req: NextRequest) {
  try {
    // 1. 验证用户身份（Clerk 认证）
    const { userId } = auth();
    if (!userId) return ApiResponse.unauthorized();

    // 2. 验证 Supabase 客户端可用性
    if (!supabaseHelpers.isClientAvailable()) {
      return ApiResponse.error("服务暂不可用，请稍后重试");
    }

    // 3. 解析并验证请求体
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (err) {
      return ApiResponse.badRequest("请求体格式错误，请提供有效的 JSON");
    }

    // 4. 校验请求参数（Zod 验证）
    const validationResult = UpdateVoiceIdSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map(issue => `${issue.path.join('.')}：${issue.message}`)
        .join('，');
      return ApiResponse.badRequest(`参数验证失败：${errorMsg}`);
    }

    const { id: characterId, voiceId } = validationResult.data;

    // 5. 验证资源所有权（防止越权更新）
    const { data: existingCharacter, error: fetchError } = await supabase
      .from('character_visuals')
      .select('id')
      .eq('id', characterId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingCharacter) {
      return ApiResponse.notFound();
    }

    // 6. 执行更新操作（更新语音 ID 和更新时间）
    const { data, error } = await supabase
      .from('character_visuals')
      .update({
        voice_id: voiceId,
        updated_at: new Date().toISOString(), // 显式更新时间戳
      })
      .eq('id', characterId)
      .eq('user_id', userId)
      .select()
      .single(); // 确保返回更新后的完整数据

    if (error) throw error;

    // 7. 返回标准化成功响应
    return ApiResponse.success<CharacterVisual>(data);
  } catch (error: any) {
    console.error("[CharacterVisuals Voice PUT] 错误:", error);
    return ApiResponse.error(error.message || "更新角色语音 ID 失败");
  }
}

// ============================
// 4. 支持 OPTIONS 请求（解决跨域预检）
// ============================
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
      "Access-Control-Allow-Methods": "PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
