import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState, KBFile, ScriptBlock, Outline, ShotList, CharacterAsset } from '@/types';

// 定义 Supabase 数据库类型（增强类型提示）
export type Database = {
  public: {
    Tables: {
      kb_files: {
        Row: KBFile & { user_id: string };
        Insert: Omit<KBFile, 'id' | 'uploadDate'> & { user_id: string };
        Update: Partial<KBFile>;
      };
      script_blocks: {
        Row: ScriptBlock & { user_id: string };
        Insert: Omit<ScriptBlock, 'id' | 'created_at' | 'updated_at'> & { user_id: string };
        Update: Partial<ScriptBlock>;
      };
      outlines: {
        Row: Outline & { user_id: string };
        Insert: Omit<Outline, 'id' | 'created_at' | 'updated_at'> & { user_id: string };
        Update: Partial<Outline>;
      };
      shot_lists: {
        Row: ShotList & { user_id: string };
        Insert: Omit<ShotList, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<ShotList>;
      };
      character_assets: {
        Row: CharacterAsset & { user_id: string };
        Insert: Omit<CharacterAsset, 'id'> & { user_id: string };
        Update: Partial<CharacterAsset>;
      };
      app_states: {
        Row: AppState & { user_id: string };
        Insert: Omit<AppState, 'lastAccessedAt'> & { user_id: string };
        Update: Partial<AppState>;
      };
    };
  };
};

// 从 Vite 环境变量获取配置（适配 Vite 规范）
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// 验证配置（生产环境强制要求配置，开发环境给出警告）
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = "Supabase 环境变量未配置（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）";
  if (import.meta.env.MODE === 'production') {
    throw new Error(`${errorMsg}，生产环境无法启动`);
  } else {
    console.warn(`${errorMsg}，云同步、数据备份等功能将不可用`);
  }
}

// 创建 Supabase 客户端（带类型增强）
export const supabase: SupabaseClient<Database> = supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      // 客户端配置优化
      auth: {
        persistSession: true, // 持久化会话（刷新页面不丢失登录状态）
        autoRefreshToken: true, // 自动刷新 Token
        detectSessionInUrl: true, // 支持通过 URL 回调登录
      },
      global: {
        fetch, // 使用浏览器原生 fetch
        headers: {
          'x-client-info': 'anime-engine-v3.8', // 自定义客户端标识（便于 Supabase 日志排查）
        },
      },
    })
  : ({} as SupabaseClient<Database>); // 配置缺失时返回空对象（避免类型报错）

// 封装常用工具函数（提升开发效率）
export const supabaseHelpers = {
  /** 检查 Supabase 客户端是否可用 */
  isClientAvailable: (): boolean => !!supabaseUrl && !!supabaseAnonKey,

  /** 获取当前登录用户 ID */
  getCurrentUserId: async (): Promise<string | null> => {
    if (!supabaseHelpers.isClientAvailable()) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user.id || null;
  },

  /** 确保用户已登录（未登录则抛出错误） */
  ensureAuthenticated: async (): Promise<string> => {
    const userId = await supabaseHelpers.getCurrentUserId();
    if (!userId) {
      throw new Error("请先登录以使用云同步功能");
    }
    return userId;
  },

  /** 为用户数据添加 user_id 关联（确保数据隔离） */
  withUserId: async <T extends Record<string, any>>(data: T): Promise<T & { user_id: string }> => {
    const userId = await supabaseHelpers.ensureAuthenticated();
    return { ...data, user_id: userId };
  },
};

// 导出类型（便于外部使用）
export type SupabaseTableNames = keyof Database['public']['Tables'];
export type SupabaseTableRow<T extends SupabaseTableNames> = Database['public']['Tables'][T]['Row'];
export type SupabaseTableInsert<T extends SupabaseTableNames> = Database['public']['Tables'][T]['Insert'];
export type SupabaseTableUpdate<T extends SupabaseTableNames> = Database['public']['Tables'][T]['Update'];
