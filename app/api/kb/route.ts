import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import { supabase, supabaseHelpers } from "../../../lib/supabase";
import { z } from 'zod';

// ============================
// 核心类型定义
// ============================
interface KbFile {
  id: string;
  user_id: string;
  name: string;
  category: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

// ============================
// 请求验证 Schema
// ============================
// POST 新增文件验证
const CreateKbFileSchema = z.object({
  name: z.string()
    .min(2, "文件名不能少于 2 个字符")
    .max(100, "文件名不能超过 100 个字符")
    .trim(),
  category: z.string()
    .min(1, "文件分类不能为空")
    .max(50, "文件分类不能超过 50 个字符")
    .trim(),
  content: z.string()
    .min(10, "文件内容不能少于 10 个字符")
    .max(50000, "文件内容不能超过 50000 个字符")
});

// 删除文件 ID 验证（UUID 格式）
const DeleteKbFileSchema = z.object({
  id: z.string().uuid("文件 ID 必须是 UUID 格式")
});

// 统一响应工具
const ApiResponse = {
  success: <T>(data: T) => NextResponse.json({ success: true, data }, { status: 200 }),
  error: (message: string, status: number = 500) => 
    NextResponse.json({ success: false, error: message }, { status }),
  unauthorized: () => ApiResponse.error("未授权访问，请先登录", 401),
  badRequest: (message: string) => ApiResponse.error(message, 400),
  notFound: () => ApiResponse.error("请求的文件不存在或无权访问", 404),
  serviceUnavailable: () => ApiResponse.error("服务暂不可用，请稍后重试", 503),
};

// ============================
// API 处理函数
// ============================

/**
 * 查询当前用户的所有知识库文件（按创建时间倒序）
 * GET /api/kb-files
 */
export async function GET() {
  try {
    // 1. 验证用户身份
    const { userId } = auth();
    if (!userId) return ApiResponse.unauthorized();

    // 2. 验证 Supabase 可用性
    if (!supabaseHelpers.isClientAvailable()) {
      return ApiResponse.serviceUnavailable();
    }

    // 3. 查询用户专属文件
    const { data, error } = await supabase
      .from('kb_files')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("[查询知识库文件失败]", error);
      throw new Error("查询文件失败，请稍后重试");
    }

    // 4. 返回格式化结果
    return ApiResponse.success<KbFile[]>(data as KbFile[]);

  } catch (error: any) {
    console.error("[KbFiles GET 全局错误]", error);
    return ApiResponse.error(error.message || "查询文件异常");
  }
}

/**
 * 新增知识库文件
 * POST /api/kb-files
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

    const validationResult = CreateKbFileSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map(issue => `${issue.path.join('.')}：${issue.message}`)
        .join('，');
      return ApiResponse.badRequest(`参数验证失败：${errorMsg}`);
    }

    const { name, category, content } = validationResult.data;

    // 4. 插入数据库（显式设置时间戳）
    const { data, error } = await supabase
      .from('kb_files')
      .insert({
        user_id: userId,
        name: name,
        category: category,
        content: content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("[新增知识库文件失败]", error);
      throw new Error("新增文件失败，请稍后重试");
    }

    // 5. 返回新增文件数据
    return ApiResponse.success<KbFile>(data as KbFile);

  } catch (error: any) {
    console.error("[KbFiles POST 全局错误]", error);
    return ApiResponse.error(error.message || "新增文件异常");
  }
}

/**
 * 删除指定 ID 的知识库文件
 * DELETE /api/kb-files?id=xxx
 */
export async function DELETE(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const { userId } = auth();
    if (!userId) return ApiResponse.unauthorized();

    // 2. 验证 Supabase 可用性
    if (!supabaseHelpers.isClientAvailable()) {
      return ApiResponse.serviceUnavailable();
    }

    // 3. 获取并验证文件 ID
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    const validationResult = DeleteKbFileSchema.safeParse({ id });
    if (!validationResult.success) {
      const errorMsg = validationResult.error.issues
        .map(issue => `${issue.path.join('.')}：${issue.message}`)
        .join('，');
      return ApiResponse.badRequest(`参数验证失败：${errorMsg}`);
    }

    // 4. 验证文件所有权（防止越权删除）
    const { data: existFile, error: fetchError } = await supabase
      .from('kb_files')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error("[查询待删除文件失败]", fetchError);
      return fetchError.code === 'PGRST116' ? ApiResponse.notFound() : ApiResponse.error("查询文件失败");
    }

    // 5. 执行删除操作
    const { error } = await supabase
      .from('kb_files')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error("[删除知识库文件失败]", error);
      throw new Error("删除文件失败，请稍后重试");
    }

    // 6. 返回删除成功响应
    return ApiResponse.success({ message: "文件删除成功", id });

  } catch (error: any) {
    console.error("[KbFiles DELETE 全局错误]", error);
    return ApiResponse.error(error.message || "删除文件异常");
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
