import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// 初始化应用函数（集中处理启动逻辑）
const initApp = () => {
  try {
    // 获取根容器
    const rootElement = document.getElementById('root');
    
    // 检查根容器是否存在
    if (!rootElement) {
      throw new Error("Root element not found: #root");
    }

    // 创建根节点并渲染应用
    const root = ReactDOM.createRoot(rootElement);
    
    // 渲染应用（保留 StrictMode 用于开发环境错误检测）
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );

    // 启动成功日志（便于调试）
    console.log('ANIME ENGINE v3.8 initialized successfully');

  } catch (error) {
    // 错误处理：显示友好的启动失败提示
    console.error('Failed to initialize ANIME ENGINE:', error);
    
    // 获取根容器并显示错误信息
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div class="h-screen flex flex-col items-center justify-center p-8 bg-[#0a0a0c] text-white">
          <div class="w-16 h-16 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mb-6"></div>
          <h2 class="text-xl font-bold text-red-400 mb-2">应用启动失败</h2>
          <p class="text-slate-400 text-sm mb-6 text-center max-w-md">
            ${error instanceof Error ? error.message : '未知错误导致应用无法启动，请尝试刷新页面或检查浏览器兼容性'}
          </p>
          <button 
            onclick="window.location.reload()"
            class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold text-xs transition-all shadow-lg"
          >
            刷新页面重试
          </button>
        </div>
      `;
    }
  }
};

// 确保 DOM 完全加载后再初始化（避免根容器未渲染完成）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM 已加载完成，直接初始化
  initApp();
}

// 导出 initApp 供调试使用（可选）
export default initApp;
