
// 注意：当前项目已迁移至 Next.js 架构。
// 此文件在 Vercel 部署环境下会自动映射至 app/page.tsx。
// 在本地预览环境中，我们保持其存在以兼容热更新。

import React from 'react';
import ReactDOM from 'react-dom/client';
import Home from './app/page';
import './app/globals.css';
import { ClerkProvider } from '@clerk/nextjs';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      {/* 生产环境由 app/layout.tsx 提供 Provider，此处仅为预览兼容 */}
      <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
        <Home />
      </ClerkProvider>
    </React.StrictMode>
  );
}
