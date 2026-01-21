import React, { useEffect, useState } from 'react';
import { ClerkProvider, SignedIn, SignedOut, useAuth, useClerk } from '@clerk/nextjs';
import { Metadata } from 'next';
import LoginPage from './login/page';
import './globals.css';
import { Toaster } from '@/components/ui/toaster'; // 导入 Toast 组件（需自行实现或使用第三方）
import LoadingScreen from '@/components/LoadingScreen'; // 导入加载组件（需自行实现）
import { isSupabaseAvailable, supabaseHelpers } from '@/lib/supabase';

// 扩展元数据配置（符合 Next.js 13+ 规范）
export const metadata: Metadata = {
  title: {
    default: '漫剧剧本智能适配大师 Pro',
    template: '%s - 漫剧剧本智能适配大师 Pro', // 页面标题模板
  },
  description: '专业级网文改编2D动漫剧本智能体，一键生成剧本、分镜、角色设定，高效完成漫剧制作全流程',
  keywords: ['漫剧制作', '网文改编', '动漫剧本', '智能剧本生成', '分镜设计', '角色设定'],
  authors: [{ name: '漫剧智能团队', url: 'https://your-domain.com' }],
  creator: '漫剧智能团队',
  publisher: '漫剧智能团队',
  openGraph: {
    title: '漫剧剧本智能适配大师 Pro',
    description: '专业级网文改编2D动漫剧本智能体，高效完成漫剧制作全流程',
    type: 'website',
    url: 'https://your-domain.com',
    images: ['https://your-domain.com/og-image.jpg'], // 社交媒体预览图
  },
  twitter: {
    card: 'summary_large_image',
    title: '漫剧剧本智能适配大师 Pro',
    description: '专业级网文改编2D动漫剧本智能体，高效完成漫剧制作全流程',
    images: ['https://your-domain.com/twitter-image.jpg'],
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/shortcut-icon.ico',
    apple: '/apple-touch-icon.png',
  },
  themeColor: '#0f0f0f', // 深色主题主色
  colorScheme: 'dark', // 优先深色主题
};

// 身份验证状态同步组件（同步 Clerk 登录状态到 Supabase）
const AuthSync = () => {
  const { user, isLoaded } = useAuth();
  const { signOut } = useClerk();
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // 仅在 Clerk 加载完成且用户已登录时执行
    if (isLoaded && user && isSupabaseAvailable) {
      const syncAuth = async () => {
        setIsSyncing(true);
        try {
          // 1. 获取 Clerk 用户的 JWT
          const { session } = await supabaseHelpers.getCurrentUser();
          
          // 2. 如果 Supabase 未登录，使用 Clerk JWT 进行登录
          if (!session) {
            const { data: { session: newSession }, error } = await supabase.auth.signInWithIdToken({
              provider: 'clerk',
              token: user.getToken(),
            });

            if (error) throw error;
            console.log('[Auth Sync] Supabase 登录成功', newSession);
          }
        } catch (error) {
          console.error('[Auth Sync] 同步登录状态失败', error);
          // 同步失败时退出登录，避免状态不一致
          await signOut();
        } finally {
          setIsSyncing(false);
        }
      };

      syncAuth();
    }

    // 登出时同步退出 Supabase
    return () => {
      if (isSupabaseAvailable) {
        supabaseHelpers.signOut().catch(err => console.error('[Auth Sync] Supabase 退出失败', err));
      }
    };
  }, [user, isLoaded, signOut]);

  // 同步中显示加载状态
  if (isSyncing) {
    return <LoadingScreen message="同步账号信息中..." />;
  }

  return null;
};

// 主布局组件
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);

  // 初始化完成后关闭加载状态
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 500); // 确保加载动画至少显示 500ms，提升体验

    return () => clearTimeout(timer);
  }, []);

  // 初始化中显示全局加载
  if (isInitializing) {
    return (
      <ClerkProvider>
        <html lang="zh-CN">
          <body className="bg-[rgb(var(--background-start-rgb))] h-full flex items-center justify-center">
            <LoadingScreen message="应用初始化中..." />
          </body>
        </html>
      </ClerkProvider>
    );
  }

  return (
    <ClerkProvider 
      publishableKey={import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as string}
      // 配置 Clerk 主题（适配深色主题）
      appearance={{
        baseTheme: 'dark',
        variables: {
          colorPrimary: '#60a5fa',
          colorBackground: '#0f0f0f',
          colorText: '#f8fafc',
          colorBorder: '#2d3748',
        },
      }}
    >
      <html lang="zh-CN" className="scroll-smooth">
        <body className="bg-[rgb(var(--background-start-rgb))] antialiased font-sans h-full">
          {/* 全局 Toast 通知组件 */}
          <Toaster position="bottom-right" />

          {/* 未登录状态：显示登录界面 */}
          <SignedOut>
            <div className="h-full flex items-center justify-center p-4">
              <LoginPage />
            </div>
          </SignedOut>

          {/* 已登录状态：渲染应用主内容 + 身份验证同步 */}
          <SignedIn>
            <AuthSync />
            <div className="h-full flex flex-col">
              {children}
            </div>
          </SignedIn>

          {/* 全局样式修复：确保页面高度 100% */}
          <style>{`
            html, body, #__next {
              height: 100%;
              overflow: hidden;
            }
          `}</style>
        </body>
      </html>
    </ClerkProvider>
  );
}
