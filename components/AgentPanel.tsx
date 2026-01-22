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
      <div className="bg-white/[0.04] border border-white/15 rounded-[2.5rem] p-12 shadow-2xl relative overflow-hidden animate-fade-up">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-[#2062ee] shadow-[0_0_20px_rgba(32,98,238,0.7)]"></div>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="text-[#2062ee]">{ICONS.Target}</div>
            <span className="text-[11px] font-black text-white uppercase tracking-[0.2em]">智能改编全案报告</span>
          </div>
          {!streamingText && (
            <div className="flex gap-4">
              <button 
                onClick={handleStartAnalysis}
                className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border border-rose-500/30 btn-neo"
              >
                {ICONS.Refresh} 不满意重析
              </button>
              <button 
                onClick={() => onNavigate(WorkspaceTab.OUTLINE)}
                className="bg-[#2062ee]/20 hover:bg-[#2062ee] text-blue-200 hover:text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border-[#2062ee]/30 btn-neo"
              >
                {ICONS.List} 生成连载大纲
              </button>
              <button 
                onClick={() => onNavigate(WorkspaceTab.SCRIPT)}
                className="bg-[#2062ee]/20 hover:bg-[#2062ee] text-blue-200 hover:text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border-[#2062ee]/30 btn-neo"
              >
                {ICONS.Zap} 开始剧本创作
              </button>
            </div>
          )}
        </div>
        <div className="whitespace-pre-wrap font-sans text-white/90 leading-[2.2] text-lg font-medium tracking-wide">
          {text}
          {streamingText && <span className="inline-block w-2.5 h-6 bg-[#2062ee] ml-2 animate-pulse shadow-[0_0_15px_rgba(32,98,238,0.8)]" />}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#000000] overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
        <div className="max-w-5xl mx-auto space-y-12 pb-24">
          <div className="relative p-16 bg-white/[0.03] border border-white/15 rounded-[3.5rem] overflow-hidden shadow-2xl animate-fade-up">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#2062ee]/15 blur-[100px] rounded-full -mr-32 -mt-32"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-6 mb-10">
                <div className="w-16 h-16 bg-[#2062ee] rounded-[1.8rem] flex items-center justify-center text-white shadow-2xl shadow-blue-900/50">
                  <div className="scale-125">{ICONS.Brain}</div>
                </div>
                <div>
                  <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-tight">AI 改编策划分身</h1>
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mt-1">Industrial Adaptation Agent v2.5</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
                <div className="space-y-6">
                  <p className="text-white/80 text-sm font-medium leading-relaxed italic">
                    我是您的漫剧首席策划官。请指定一部原著作品，我将为您深度拆解其商业价值、视觉愿景及连载策略。
                  </p>
                  <div className="grid grid-cols-1 gap-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-4">
                        <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">选择目标原著</label>
                        {files.length > 0 && <span className="text-[9px] text-[#2062ee] font-bold uppercase tracking-widest italic animate-pulse">最近使用优先</span>}
                      </div>
                      <select 
                        value={selectedFileId} 
                        onChange={e => setSelectedFileId(e.target.value)}
                        className="w-full bg-black border border-white/20 text-white rounded-[1.5rem] px-8 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-[#2062ee] shadow-inner transition-all appearance-none cursor-pointer"
                      >
                        <option value="">指向待分析原著文件...</option>
                        {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-4">参考文件 (风格对标)</label>
                      <select 
                        value={refFileId} 
                        onChange={e => setRefFileId(e.target.value)}
                        className="w-full bg-black border border-white/10 text-white/60 rounded-[1.5rem] px-8 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-[#2062ee] shadow-inner transition-all appearance-none cursor-pointer"
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
                    className={`w-full py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 btn-neo ${
                      !selectedFileId ? 'bg-slate-800 text-white/30 cursor-not-allowed border-transparent opacity-50' : 'bg-[#2062ee] hover:bg-blue-600 text-white shadow-blue-900/40'
                    }`}
                  >
                    {isAnalyzing ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Play}
                    {isAnalyzing ? "正在进行多维解析..." : (selectedFileId ? "执行改编可行性报告" : "请先在上方选择原著")}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {renderAnalysisContent()}
        </div>
      </div>
    </div>
  );
};

export default AgentPanel;