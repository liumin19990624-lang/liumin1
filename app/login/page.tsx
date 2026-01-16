
import { SignIn } from "@clerk/nextjs";
import { ICONS } from "../../constants";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* 左侧：品牌展示 */}
        <div className="hidden lg:flex flex-col gap-8 text-white">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl">
            {ICONS.Library}
          </div>
          <div>
            <h1 className="text-5xl font-black tracking-tight mb-4">漫剧适配大师 <span className="text-blue-500">Enterprise</span></h1>
            <p className="text-slate-400 text-xl leading-relaxed">
              针对 2025 漫剧市场深度优化的 AI 创作引擎。
              <br />通过因果律锚定技术，将网文瞬间转化为爆款剧本。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
              <div className="text-blue-400 mb-2">{ICONS.Zap}</div>
              <div className="font-bold">极速改编</div>
              <div className="text-xs text-slate-500">3分钟产出精修剧集</div>
            </div>
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
              <div className="text-rose-400 mb-2">{ICONS.Heart}</div>
              <div className="font-bold">情感对齐</div>
              <div className="text-xs text-slate-500">适配男女频爽点节奏</div>
            </div>
          </div>
        </div>

        {/* 右侧：登录卡片 */}
        <div className="flex justify-center lg:justify-end">
          <SignIn 
            appearance={{
              elements: {
                formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-sm normal-case",
                card: "shadow-2xl border border-slate-200 rounded-3xl"
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
