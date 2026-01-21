import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import { supabase, supabaseHelpers } from "../../../lib/supabase";
import { z } from 'zod';

// ============================
// 核心常量与类型定义
// ============================
// 剧本连续性状态枚举（限制合法值）
const ContinuityStatusEnum = z.enum(['draft', 'continuous', 'discontinuous', 'completed'], {
  errorMap: () => ({ message: '连续性状态必须是：draft、continuous、discontinuous、completed' })
});

// 剧本数据类型（与数据库表结构对齐）
interface Script {
  id: string;
  user_id: string;
  source_id: string;
  episodes: number;
  content: string;
  continuity_status: 'draft' | 'continuous' | 'discontinuous' | 'completed';
  created_at: string;
  updated_at: string;
}

// ============================
// 请求验证 Schema
// ============================
// POST 新增剧本验证
const CreateScriptSchema = z.object({
  sourceId: z.string().min(1, "sourceId 不能为空"),
  episodes: z.number().int().min(1, "集数必须是大于等于 1 的整数"),
  content: z.string().min(10, "剧本内容不能少于 10 个字符").max(10000, "剧本内容不能超过 10000 个字符"),
  continuityStatus: ContinuityStatusEnum.optional().default('draft') // 默认草稿状态
});

// PUT 更新剧本验证
const UpdateScriptSchema = z.object({
  id: z.string().uuid("剧本 ID 必须是 UUID 格式"),
  content: z.string().min(10, "剧本内容不能少于 10 个字符").max(10000, "剧本内容不能超过 10000 个字符"),
  continuityStatus: ContinuityStatusEnum
});

// 统一响应工具
const ApiResponse = {
  success: <T>(data: T) => NextResponse.json({ success: true, data }, { status: 200 }),
  error: (message: string, status: number = 500) => 
    NextResponse.json({ success: false, error: message }, { status }),
  unauthorized: () => ApiResponse.error("未授权访问，请先登录", 401),
  badRequest: (message: string) => ApiResponse.error(message, 400),
  notFound: () => ApiResponse.error("请求的剧本不存在或无权访问", 404),
  serviceUnavailable: () => ApiResponse.error("服务暂不可用，请稍后重试", 503),
};

// ============================
// API 处理函数
// ============================

/**
 * 查询指定 sourceId 的剧本列表（按创建时间升序）
 * GET /api/scripts?sourceId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const { userId } = auth();
    if (!userId) return ApiResponse.unauthorized();

    // 2. 验证 Supabase 可用性
    if (!supabaseHelpers.isClientAvailable()) {
      return ApiResponse.serviceUnavailable();
    }

    // 3. 获取并验证 sourceId 参数
    const { searchParams } = new URL(req.url);
    const sourceId = searchParams.get('sourceId');

    if (!sourceId) {
      return ApiResponse.badRequest("缺少必要参数：sourceId");
    }

    // 4. 查询剧本（仅查询当前用户的数据）
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('user_id', userId)
      .eq('source_id', sourceId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("[查询剧本失败]", error);
      throw new Error("查询剧本失败，请稍后重试");
    }

    // 5. 返回结果（空数组时也返回成功，前端统一处理）
    return ApiResponse.success<Script[]>(data as Script[]);

  } catch (error: any) {
    console.error("[Scripts GET 全局错误]", error);
    return ApiResponse.error(error.message || "查询剧本异常");
  }
}

/**
 * 新增剧本
 * POST /api/scripts
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

    const validationResult = CreateScriptSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map(issue => `${issue.path.join('.')}：${issue.message}`)
        .join('，');
      return ApiResponse.badRequest(`参数验证失败：${errorMsg}`);
    }

    const { sourceId, episodes, content, continuityStatus } = validationResult.data;

    // 4. 插入数据库（自动填充 created_at/updated_at，需数据库字段设置默认值）
    const { data, error } = await supabase
      .from('scripts')
      .insert({
        user_id: userId,
        source_id: sourceId,
        episodes,
        content,
        continuity_status: continuityStatus,
        created_at: new Date().toISOString(), // 显式设置，确保时间准确
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("[新增剧本失败]", error);
      throw new Error("新增剧本失败，请稍后重试");
    }

    // 5. 返回新增的剧本数据
    return ApiResponse.success<Script>(data as Script);

  } catch (error: any) {
    console.error("[Scripts POST 全局错误]", error);
    return ApiResponse.error(error.message || "新增剧本异常");
  }
}

/**
 * 更新剧本内容和连续性状态
 * PUT /api/scripts
 */
export async function PUT(req: NextRequest) {
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

    const validationResult = UpdateScriptSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map(issue => `${issue.path.join('.')}：${issue.message}`)
        .join('，');
      return ApiResponse.badRequest(`参数验证失败：${errorMsg}`);
    }

    const { id, content, continuityStatus } = validationResult.data;

    // 4. 验证剧本所有权（防止越权更新）
    const { data: existScript, error: fetchError } = await supabase
      .from('scripts')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existScript) {
      return ApiResponse.notFound();
    }

    // 5. 执行更新（更新内容、状态和更新时间）
    const { data, error } = await supabase
      .from('scripts')
      .update({
        content,
        continuity_status: continuityStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error("[更新剧本失败]", error);
      throw new Error("更新剧本失败，请稍后重试");
    }

    // 6. 返回更新后的剧本数据
    return ApiResponse.success<Script>(data as Script);

  } catch (error: any) {
    console.error("[Scripts PUT 全局错误]", error);
    return ApiResponse.error(error.message || "更新剧本异常");
  }
}

/**
 * 支持 OPTIONS 请求（跨域预检）
 */
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
