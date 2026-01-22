
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase 环境变量未配置，数据库功能将受限");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
