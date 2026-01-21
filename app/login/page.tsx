import { SignIn } from "@clerk/nextjs";
import { ICONS } from "../../constants";
import { useEffect } from "react";

export default function LoginPage() {
  // 页面加载时设置深色模式（确保与应用整体风格一致）
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 sm:p-6 md:p-8">
      {/* 背景装饰元素（增强视觉层次） */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full filter blur-3xl"></div>
      </div>

      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-center relative z-10">
        {/* 左侧：品牌展示（优化响应式和视觉效果） */}
        <div className="hidden lg:flex flex-col gap-8 text-white px-4">
          {/* 品牌图标 */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/30 transform transition-transform hover:scale-105">
            <div className="text-white text-2xl">
              {ICONS.Library}
            </div>
          </div>

          {/* 品牌标题与描述 */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
              漫剧适配大师{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                Enterprise
              </span>
            </h1>
            <p className="text-slate-400 text-lg md:text-xl leading-relaxed max-w-xl">
              针对 2025 漫剧市场深度优化的 AI 创作引擎。
              <br />通过因果律锚定技术，将网文瞬间转化为爆款剧本。
            </p>
          </div>

          {/* 核心优势卡片（优化样式和交互） */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:bg-white/8 hover:border-white/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="text-blue-400 mb-3 text-xl">{ICONS.Zap}</div>
              <div className="font-bold text-lg">极速改编</div>
              <div className="text-xs text-slate-500 mt-1">3分钟产出精修剧集</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:bg-white/8 hover:border-white/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="text-rose-400 mb-3 text-xl">{ICONS.Heart}</div>
              <div className="font-bold text-lg">情感对齐</div>
              <div className="text-xs text-slate-500 mt-1">适配男女频爽点节奏</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:bg-white/8 hover:border-white/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="text-emerald-400 mb-3 text-xl">{ICONS.Layers}</div>
              <div className="font-bold text-lg">全流程支持</div>
              <div className="text-xs text-slate-500 mt-1">剧本/分镜/角色一体化</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl hover:bg-white/8 hover:border-white/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="text-amber-400 mb-3 text-xl">{ICONS.Cloud}</div>
              <div className="font-bold text-lg">云端同步</div>
              <div className="text-xs text-slate-500 mt-1">多设备无缝协作</div>
            </div>
          </div>

          {/* 底部版权信息 */}
          <div className="mt-auto text-slate-600 text-xs">
            © 2025 漫剧智能科技. 保留所有权利.
          </div>
        </div>

        {/* 移动端品牌展示（新增，优化小屏幕体验） */}
        <div className="lg:hidden flex flex-col gap-6 text-white mb-8">
          <div className="flex justify-center">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/30">
              <div className="text-white text-xl">
                {ICONS.Library}
              </div>
            </div>
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black tracking-tight">
              漫剧适配大师{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                Enterprise
              </span>
            </h1>
            <p className="text-slate-400 text-base">
              AI 驱动的漫剧创作全流程解决方案
            </p>
          </div>
        </div>

        {/* 右侧：登录卡片（优化样式、阴影和响应式） */}
        <div className="flex justify-center lg:justify-end w-full">
          <div className="w-full max-w-md">
            <SignIn
              appearance={{
                baseTheme: "dark", // 强制深色主题，与应用风格一致
                variables: {
                  colorPrimary: "#3b82f6",
                  colorPrimaryForeground: "#ffffff",
                  colorBackground: "#1e1e1e",
                  colorInputBackground: "#2d2d2d",
                  colorBorder: "#374151",
                  colorText: "#f9fafb",
                  colorTextSecondary: "#9ca3af",
                },
                elements: {
                  // 卡片样式优化
                  card: "shadow-2xl shadow-black/30 border border-slate-800 rounded-3xl overflow-hidden bg-slate-900/80 backdrop-blur-sm",
                  // 标题样式
                  title: "text-2xl font-bold text-white mb-6",
                  // 表单组间距
                  formFieldset: "space-y-5",
                  // 输入框样式
                  formControl: "h-12 bg-slate-800 border-slate-700 rounded-xl text-white",
                  // 按钮样式优化
                  formButtonPrimary:
                    "bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold py-6 rounded-xl transition-all duration-300 shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40",
                  // 分隔线样式
                  divider: "my-6 bg-slate-800",
                  // 分隔线文本
                  dividerText: "text-slate-500 font-medium",
                  // 社交媒体按钮
                  socialButton:
                    "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl py-6 transition-all",
                  // 链接样式
                  link: "text-blue-400 hover:text-blue-300 font-medium",
                  // 辅助文本
                  helpText: "text-slate-500 text-sm",
                },
              }}
              // 自定义登录标题和描述
              title="欢迎回来"
              subtitle="登录您的账号，继续漫剧创作之旅"
              // 隐藏不需要的登录方式（根据实际需求调整）
              options={{
                socialProviders: ["google", "github", "apple"], // 保留常用社交登录
                emailLinkSignIn: true, // 支持邮箱链接登录
                smsLogin: false, // 隐藏短信登录（如需可开启）
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
