
import React, { useState, useMemo } from 'react';
import { KBFile, AudienceMode, Category } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { GeminiService } from '../services/geminiService.ts';
import { DocGenerator } from '../services/docGenerator.ts';

const OutlinePanel: React.FC<{ files: KBFile[], onSaveToKB: (f: KBFile) => void }> = ({ files, onSaveToKB }) => {
  const [targetId, setTargetId] = useState<string>('');
  const [refId, setRefId] = useState<string>('');
  const [analysisMode, setAnalysisMode] = useState<'CHARACTERS' | 'PLOT_OUTLINE'>('PLOT_OUTLINE');
  const [result, setResult] = useState<string>('');
  const [streamingText, setStreamingText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(false);

  const gemini = useMemo(() => new GeminiService(), []);
  
  const handleStart = async () => {
    if (!targetId) return;
    setIsLoading(true);
    setResult('');
    setStreamingText('');
    setSaveStatus(false);
    
    try {
      const file = files.find(f => f.id === targetId);
      const refFile = files.find(f => f.id === refId);
      let fullContent = '';
      
      const stream = analysisMode === 'CHARACTERS' 
        ? gemini.extractCharactersStream(file?.content || '')
        : gemini.generateFullOutlineStream(AudienceMode.MALE, file?.content || '', refFile?.content || '');

      for await (const chunk of stream) {
        fullContent += chunk;
        setStreamingText(GeminiService.cleanText(fullContent));
      }
      setResult(GeminiService.cleanText(fullContent));
      setStreamingText('');
    } catch (err) {
      alert("提取失败，请检查网络连接");
    } finally { setIsLoading(false); }
  };

  const handleSaveToKB = () => {
    if (!result) return;
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[提取大纲] ${files.find(f => f.id === targetId)?.name || '未命名'}`,
      category: Category.PLOT,
      content: result,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB(newFile);
    setSaveStatus(true);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {!result && !streamingText && (
        <div className="p-10 max-w-2xl mx-auto space-y-8 animate-fade-up">
           <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-200">{ICONS.FileText}</div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter">超长原著深度提取</h2>
                <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-widest">Story Structure Processor</p>
              </div>
           </div>

           <div className="space-y-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">选择待处理小说</label>
                <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm text-slate-700">
                  <option value="">请指向知识库原著...</option>
                  {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">参考大纲风格 (可选)</label>
                <select value={refId} onChange={e => setRefId(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none font-bold text-sm text-slate-700">
                  <option value="">智能默认风格...</option>
                  {files.filter(f => f.category === Category.REFERENCE || f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setAnalysisMode('CHARACTERS')} className={`flex-1 p-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 ${analysisMode === 'CHARACTERS' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                  {ICONS.Users} 角色深度画像
                </button>
                <button onClick={() => setAnalysisMode('PLOT_OUTLINE')} className={`flex-1 p-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 ${analysisMode === 'PLOT_OUTLINE' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                  {ICONS.Zap} 3000字精细大纲
                </button>
              </div>

              <button disabled={isLoading || !targetId} onClick={handleStart} className="w-full bg-slate-900 text-white p-5 rounded-[1.5rem] font-black text-sm shadow-2xl disabled:bg-slate-200 hover:bg-slate-800 transition-all flex items-center justify-center gap-3">
                {isLoading ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Sparkles}
                {isLoading ? "深度分析中 (大约需要 60 秒)..." : "启动提取任务"}
              </button>
           </div>
        </div>
      )}

      {(result || streamingText) && (
        <div className="flex-1 flex flex-col min-h-0">
           <div className="p-6 border-b bg-white flex justify-between items-center shadow-sm relative z-10">
              <button onClick={() => {setResult(''); setStreamingText('');}} className="text-xs font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest flex items-center gap-2">
                {ICONS.ArrowLeft} 返回配置
              </button>
              <div className="flex gap-3">
                 <button onClick={handleSaveToKB} disabled={!!streamingText || saveStatus} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${saveStatus ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {saveStatus ? "✓ 已同步到库" : "存入知识库"}
                 </button>
                 <button onClick={() => DocGenerator.downloadBlob(new Blob([result]), "精细大纲.txt")} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-900/20">
                    导出 TXT
                 </button>
              </div>
           </div>
           <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-white">
              <div className="max-w-4xl mx-auto">
                <div className="flex flex-col items-center mb-10 text-center">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-2">Analysis Result</span>
                  <h3 className="text-3xl font-black text-slate-900 italic tracking-tighter">深度改编大纲 (约 {((streamingText || result).length / 2).toFixed(0)} 字)</h3>
                </div>
                <div className="bg-slate-50 rounded-[3rem] p-16 shadow-inner border border-slate-100">
                  <div className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed text-base">
                    {streamingText || result}
                    {streamingText && <span className="inline-block w-2 h-5 bg-indigo-500 ml-1 animate-pulse" />}
                  </div>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default OutlinePanel;
