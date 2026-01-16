
import React from 'react';
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/nextjs';
import LoginPage from './login/page';
import './globals.css';

export const metadata = {
  title: '漫剧剧本智能适配大师 Pro',
  description: '专业级网文改编2D动漫剧本智能体',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="zh-CN">
        <body className="bg-slate-50 antialiased font-sans">
          {/* 未登录状态：显示统一登录界面 */}
          <SignedOut>
            <LoginPage />
          </SignedOut>
          
          {/* 已登录状态：渲染应用主内容 */}
          <SignedIn>
            {children}
          </SignedIn>
        </body>
      </html>
    </ClerkProvider>
  );
}
