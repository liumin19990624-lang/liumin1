import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { AppState, KBFile, ScriptBlock, Outline, ShotList, CharacterAsset } from '@/types';

// ============================
// 1. 增强型数据库类型定义（严格类型约束）
// ============================
export type Database = {
  public: {
    Tables: {
      kb_files: {
        Row: KBFile & { 
          user_id: string;
          created_at: string; // 数据库自动生成的创建时间
          updated_at: string; // 数据库自动更新的修改时间
        };
        Insert: Omit<KBFile, 'id' | 'uploadDate' | 'created_at' | 'updated_at'> & { 
          user_id: string;
        };
        Update: Partial<Omit<KBFile, 'id' | 'uploadDate'>> & {
          updated_at?: string; // 允许手动更新修改时间
        };
      };
      script_blocks: {
        Row: ScriptBlock & { 
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<ScriptBlock, 'id' | 'created_at' | 'updated_at'> & { 
          user_id: string;
        };
        Update: Partial<ScriptBlock> & {
          updated_at?: string;
        };
      };
      outlines: {
        Row: Outline & { 
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Outline, 'id' | 'created_at' | 'updated_at'> & { 
          user_id: string;
        };
        Update: Partial<Outline> & {
          updated_at?: string;
        };
      };
      shot_lists: {
        Row: ShotList & { 
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<ShotList, 'id' | 'created_at' | 'updated_at'> & { 
          user_id: string;
        };
        Update: Partial<ShotList> & {
          updated_at?: string;
        };
      };
      character_assets: {
        Row: CharacterAsset & { 
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<CharacterAsset, 'id' | 'created_at' | 'updated_at'> & { 
          user_id: string;
        };
        Update: Partial<CharacterAsset> & {
          updated_at?: string;
        };
      };
      app_states: {
        Row: AppState & { 
          user_id: string;
          lastAccessedAt: string; // 统一为 ISO 字符串格式
        };
        Insert: Omit<AppState, 'lastAccessedAt'> & { 
          user_id: string;
          lastAccessedAt?: string; // 可选，默认使用当前时间
        };
        Update: Partial<AppState> & {
          lastAccessedAt?: string;
        };
      };
    };
    Views: {}; // 扩展视图类型支持（如需）
    Functions: {}; // 扩展存储函数类型支持（如需）
  };
};

// ============================
// 2. 环境变量配置与验证（增强容错性）
// ============================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// 配置验证（分环境处理，提供更友好的错误提示）
const validateConfig = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    const missingVars = [];
    if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
    if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');
    
    const errorMsg = `Supabase 配置缺失：${missingVars.join(', ')}`;
    
    // 生产环境强制要求配置，开发环境仅警告
    if (import.meta.env.MODE === 'production') {
      console.error(`[Supabase Error] ${errorMsg}，云同步功能无法使用`);
      // 生产环境可选择抛出错误或返回 false，根据业务需求调整
      return false;
    } else {
      console.warn(`[Supabase Warning] ${errorMsg}，云同步、数据备份等功能将不可用`);
      return false;
    }
  }
  return true;
};

const isConfigValid = validateConfig();

// ============================
// 3. Supabase 客户端创建（优化配置与类型安全）
// ============================
export const supabase: SupabaseClient<Database> = isConfigValid
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true, // 持久化会话（localStorage）
        autoRefreshToken: true, // 自动刷新 JWT Token
        detectSessionInUrl: true, // 支持 OAuth 回调登录
        storageKey: 'anime-engine-supabase-session', // 自定义存储键（避免冲突）
      },
      global: {
        fetch,
        headers: {
          'x-client-info': `anime-engine-v3.8; env=${import.meta.env.MODE};`,
          'x-app-version': import.meta.env.VITE_APP_VERSION || 'unknown', // 应用版本（便于问题排查）
        },
        timeout: 10000, // 请求超时时间（10秒）
      },
      realtime: {
        enabled: false, // 默认禁用实时订阅（按需启用）
        timeout: 5000,
      },
    })
  : ({} as SupabaseClient<Database>); // 配置无效时返回空对象（避免类型报错）

// ============================
// 4. 增强型工具函数（完善错误处理与类型支持）
// ============================
export const supabaseHelpers = {
  /**
   * 检查 Supabase 客户端是否可用（配置有效 + 客户端实例正常）
   */
  isClientAvailable: (): boolean => {
    return isConfigValid && !!supabase?.auth;
  },

  /**
   * 获取当前登录用户信息（包含 Session 和 User 完整信息）
   */
  getCurrentUser: async (): Promise<{ 
    user: User | null; 
    session: Session | null 
  }> => {
    if (!supabaseHelpers.isClientAvailable()) {
      return { user: null, session: null };
    }
    
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      const session = data.session;
      return {
        user: session?.user || null,
        session,
      };
    } catch (error) {
      console.error('[Supabase Helpers] 获取用户信息失败：', error);
      return { user: null, session: null };
    }
  },

  /**
   * 获取当前登录用户 ID（简洁版）
   */
  getCurrentUserId: async (): Promise<string | null> => {
    const { user } = await supabaseHelpers.getCurrentUser();
    return user?.id || null;
  },

  /**
   * 确保用户已登录（未登录则抛出明确错误）
   * @throws {Error} 未登录或客户端不可用错误
   */
  ensureAuthenticated: async (): Promise<string> => {
    if (!supabaseHelpers.isClientAvailable()) {
      throw new Error("Supabase 配置未初始化，无法使用云同步功能");
    }

    const { user } = await supabaseHelpers.getCurrentUser();
    if (!user) {
      throw new Error("请先登录账号，以启用数据云同步、备份和跨设备访问功能");
    }

    return user.id;
  },

  /**
   * 为用户数据添加 user_id 关联（确保数据隔离）
   * @param data 要存储的原始数据
   * @returns 包含 user_id 的数据对象
   */
  withUserId: async <T extends Record<string, any>>(data: T): Promise<T & { user_id: string }> => {
    const userId = await supabaseHelpers.ensureAuthenticated();
    return { ...data, user_id: userId };
  },

  /**
   * 格式化数据库时间戳（统一为 ISO 字符串）
   */
  formatTimestamp: (date?: Date): string => {
    return date ? date.toISOString() : new Date().toISOString();
  },

  /**
   * 处理 Supabase 响应错误（统一错误处理逻辑）
   * @param error Supabase 错误对象
   * @param defaultMsg 默认错误提示
   * @returns 格式化后的错误信息
   */
  handleError: (error: any, defaultMsg: string): string => {
    console.error('[Supabase Error]', error);
    return error?.message || defaultMsg;
  },

  /**
   * 清除本地会话（退出登录）
   */
  signOut: async (): Promise<boolean> => {
    if (!supabaseHelpers.isClientAvailable()) {
      return false;
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[Supabase Helpers] 退出登录失败：', error);
      return false;
    }
  },
};

// ============================
// 5. 类型导出（便于外部模块使用）
// ============================
export type SupabaseTableNames = keyof Database['public']['Tables'];
export type SupabaseTableRow<T extends SupabaseTableNames> = Database['public']['Tables'][T]['Row'];
export type SupabaseTableInsert<T extends SupabaseTableNames> = Database['public']['Tables'][T]['Insert'];
export type SupabaseTableUpdate<T extends SupabaseTableNames> = Database['public']['Tables'][T]['Update'];

// 导出客户端可用性标记（便于外部判断）
export const isSupabaseAvailable = supabaseHelpers.isClientAvailable();

// ============================
// 6. 初始化时的额外配置（可选）
// ============================
// 监听认证状态变化（如需全局响应登录/退出事件）
if (isSupabaseAvailable) {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log(`[Supabase Auth] 状态变化：${event}`, session ? '已登录' : '未登录');
    // 可在此添加全局状态更新逻辑（如更新用户上下文、刷新数据等）
  });
}
