
import React, { useState, useMemo } from 'react';
import { KBFile, Category, WorkspaceTab } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { GeminiService } from '../services/geminiService.ts';

interface AgentPanelProps {
  files: KBFile[];
  onNavigate: (tab: WorkspaceTab) => void;
}

const AgentPanel: React.FC<AgentPanelProps> = ({ files, onNavigate }) => {
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [refFileId, setRefFileId] = useState<string>('');
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const gemini = useMemo(() => new GeminiService(), []);

  const handleStartAnalysis = async () => {
    if (!selectedFileId) return;
    setIsAnalyzing(true);
    setAnalysis('');
    setStreamingText('');
    
    try {
      const file = files.find(f => f.id === selectedFileId);
      const refFile = files.find(f => f.id === refFileId);
      if (!file) return;

      let full = '';
      const stream = gemini.analyzeProjectStream(file.content, refFile?.content || '');
      for await (const chunk of stream) {
        full += chunk;
        setStreamingText(GeminiService.cleanText(full));
      }
      setAnalysis(GeminiService.cleanText(full));
    } catch (e) {
      alert("分析失败: " + (e as Error).message);
    } finally {
      setIsAnalyzing(false);
      setStreamingText('');
    }
  };

  const renderAnalysisContent = () => {
    const text = streamingText || analysis;
    if (!text) return null;

    return (
      <div className="bg-white/[0.03] border border-white/10 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden animate-fade-up">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.5)]"></div>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="text-indigo-400">{ICONS.Target}</div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">智能改编全案报告</span>
          </div>
          {!streamingText && (
            <div className="flex gap-4">
              <button 
                onClick={handleStartAnalysis}
                className="bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border border-rose-500/30"
              >
                {ICONS.Refresh} 不满意重析
              </button>
              <button 
                onClick={() => onNavigate(WorkspaceTab.OUTLINE)}
                className="bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border border-indigo-500/30"
              >
                {ICONS.List} 生成连载大纲
              </button>
              <button 
                onClick={() => onNavigate(WorkspaceTab.SCRIPT)}
                className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border border-blue-500/30"
              >
                {ICONS.Zap} 开始剧本创作
              </button>
            </div>
          )}
        </div>
        <div className="whitespace-pre-wrap font-sans text-slate-200 leading-[2.2] text-lg font-medium italic tracking-wide">
          {text}
          {streamingText && <span className="inline-block w-2.5 h-6 bg-indigo-500 ml-2 animate-pulse shadow-[0_0_10px_rgba(79,70,229,0.8)]" />}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#050508] overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
        <div className="max-w-5xl mx-auto space-y-12 pb-24">
          {/* Hero Section */}
          <div className="relative p-16 bg-gradient-to-br from-indigo-900/40 to-blue-900/20 border border-white/10 rounded-[4rem] overflow-hidden shadow-2xl animate-fade-up">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 blur-[100px] rounded-full -mr-48 -mt-48"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-20 h-20 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-indigo-600/40">
                  <div className="scale-150">{ICONS.Brain}</div>
                </div>
                <div>
                  <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-tight">AI 改编策划分身</h1>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mt-2">Adaptation Agent Engine v2.0</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
                <div className="space-y-6">
                  <p className="text-slate-400 text-sm font-bold leading-relaxed italic">
                    我是您的漫剧首席策划官。请指定一部原著作品，我将为您深度拆解其商业价值、视觉愿景及连载策略。
                  </p>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-indigo-500 uppercase ml-4 tracking-widest">选择目标原著</label>
                      <select 
                        value={selectedFileId} 
                        onChange={e => setSelectedFileId(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 text-white rounded-[2rem] px-8 py-5 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                      >
                        <option value="">指向待分析原著文件...</option>
                        {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-violet-400 uppercase ml-4 tracking-widest">风格参考资料 (可选)</label>
                      <select 
                        value={refFileId} 
                        onChange={e => setRefFileId(e.target.value)}
                        className="w-full bg-black/60 border border-violet-500/20 text-violet-300 rounded-[2rem] px-8 py-5 text-xs font-bold outline-none focus:ring-1 focus:ring-violet-500 shadow-inner"
                      >
                        <option value="">指向对比参考资料...</option>
                        {files.filter(f => f.id !== selectedFileId).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-4">
                  <button 
                    disabled={!selectedFileId || isAnalyzing}
                    onClick={handleStartAnalysis}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 text-white py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3"
                  >
                    {isAnalyzing ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Play}
                    {isAnalyzing ? "正在进行多维解析..." : "执行改编可行性报告"}
                  </button>
                  <div className="flex items-center justify-center gap-6 text-slate-600">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                      <span className="text-[9px] font-black uppercase tracking-tighter italic">视觉概念锚定</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="text-[9px] font-black uppercase tracking-tighter italic">商业爆点识别</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Result */}
          {renderAnalysisContent()}

          {/* Quick Guidance (Empty State) */}
          {!analysis && !streamingText && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-40">
              {[
                { icon: ICONS.Rocket, label: "确定风格倾向", desc: "分析最适配的动漫导演视觉风格" },
                { icon: ICONS.Compass, label: "对齐爽点节奏", desc: "提取网文核心受众的爽点标签" },
                { icon: ICONS.Target, label: "视觉形象提取", desc: "构建核心角色在动漫中的记忆点" },
              ].map((item, idx) => (
                <div key={idx} className="p-8 border border-white/5 rounded-[2.5rem] bg-white/[0.01]">
                  <div className="text-indigo-500 mb-4">{item.icon}</div>
                  <h3 className="text-xs font-black text-white uppercase mb-2 italic">{item.label}</h3>
                  <p className="text-[10px] text-slate-500 leading-relaxed italic">{item.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentPanel;
