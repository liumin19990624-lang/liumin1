
import React, { useState, useMemo } from 'react';
import { KBFile, AudienceMode, Category } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { GeminiService } from '../services/geminiService.ts';
import { DocGenerator } from '../services/docGenerator.ts';

const OutlinePanel: React.FC<{ files: KBFile[], onSaveToKB: (f: KBFile) => void }> = ({ files, onSaveToKB }) => {
  const [targetId, setTargetId] = useState<string>('');
  const [refTemplateId, setRefTemplateId] = useState<string>('');
  const [analysisMode, setAnalysisMode] = useState<'CHARACTERS' | 'PLOT_OUTLINE' | 'REF_SCRIPT' | 'CAST_BIO'>('PLOT_OUTLINE');
  const [isDeepExtraction, setIsDeepExtraction] = useState(true);
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
      const sourceFile = files.find(f => f.id === targetId);
      const refFile = files.find(f => f.id === refTemplateId);
      let fullContent = '';
      
      let stream;
      if (analysisMode === 'CHARACTERS') {
        stream = gemini.extractCharactersStream(sourceFile?.content || '', refFile?.content || '');
      } else if (analysisMode === 'REF_SCRIPT') {
        stream = gemini.extractReferenceScriptStream(sourceFile?.content || '');
      } else if (analysisMode === 'CAST_BIO') {
        stream = gemini.generateCharacterBioStream(sourceFile?.content || '', refFile?.content || '');
      } else {
        stream = gemini.generateFullOutlineStream(AudienceMode.MALE, sourceFile?.content || '', isDeepExtraction, refFile?.content || '');
      }

      for await (const chunk of stream) {
        fullContent += chunk;
        setStreamingText(GeminiService.cleanText(fullContent));
      }
      setResult(GeminiService.cleanText(fullContent));
      setStreamingText('');
    } catch (err: any) {
      console.error(err);
      alert("提取任务失败，请检查网络: " + (err.message || "未知错误"));
    } finally { setIsLoading(false); }
  };

  const handleSaveToKB = () => {
    if (!result) return;
    let category = Category.PLOT;
    if (analysisMode === 'CHARACTERS' || analysisMode === 'CAST_BIO') category = Category.CHARACTER;
    if (analysisMode === 'REF_SCRIPT') category = Category.REFERENCE;

    const typeLabel = analysisMode === 'REF_SCRIPT' ? '脚本模板' : analysisMode === 'CAST_BIO' ? '人物小传' : analysisMode === 'CHARACTERS' ? '角色简档' : '大纲';
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[提取${typeLabel}] ${files.find(f => f.id === targetId)?.name || '未命名'}`,
      category: category,
      content: result,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB(newFile);
    setSaveStatus(true);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0c]">
      {!result && !streamingText && (
        <div className="flex-1 flex flex-col items-center justify-center p-10 animate-fade-up">
           <div className="max-w-2xl w-full bg-white/[0.03] border border-white/10 rounded-[3rem] p-12 backdrop-blur-3xl shadow-2xl">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-900/40">
                  {ICONS.Sparkles}
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white italic tracking-tighter">深度改编工作流</h2>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Advanced Story Processing</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">选择待改编原著</label>
                    <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full p-5 bg-black/40 border border-white/10 text-white rounded-2xl outline-none font-bold text-xs focus:border-blue-500 transition-all">
                      <option value="">点击浏览知识库...</option>
                      {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">参考风格模板 (可选)</label>
                    <select value={refTemplateId} onChange={e => setRefTemplateId(e.target.value)} className="w-full p-5 bg-black/40 border border-white/10 text-white rounded-2xl outline-none font-bold text-xs focus:border-blue-500 transition-all">
                      <option value="">保持 AI 默认风格...</option>
                      {files.filter(f => f.category === Category.REFERENCE).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'PLOT_OUTLINE', label: '剧情大纲', icon: ICONS.FileText },
                    { id: 'CAST_BIO', label: '人物小传', icon: ICONS.Users },
                    { id: 'CHARACTERS', label: '角色简档', icon: ICONS.Users },
                    { id: 'REF_SCRIPT', label: '脚本风格模板提取', icon: ICONS.Settings },
                  ].map(mode => (
                    <button key={mode.id} onClick={() => setAnalysisMode(mode.id as any)} className={`flex items-center gap-4 p-5 rounded-2xl border transition-all ${analysisMode === mode.id ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'}`}>
                      {mode.icon}
                      <span className="text-[11px] font-black uppercase tracking-tighter">{mode.label}</span>
                    </button>
                  ))}
                </div>

                <button disabled={isLoading || !targetId} onClick={handleStart} className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white p-6 rounded-3xl font-black text-sm uppercase transition-all shadow-2xl flex items-center justify-center gap-3">
                  {isLoading ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Play}
                  {isLoading ? "正在全力分析..." : "开始执行任务"}
                </button>
              </div>
           </div>
        </div>
      )}

      {(result || streamingText) && (
        <div className="flex-1 flex flex-col min-h-0">
           <div className="h-20 px-10 border-b border-white/5 bg-black/40 backdrop-blur-xl flex justify-between items-center z-10">
              <button onClick={() => {setResult(''); setStreamingText('');}} className="text-xs font-black text-slate-500 hover:text-white uppercase tracking-widest flex items-center gap-2 transition-all">
                {ICONS.ArrowLeft} 返回配置
              </button>
              <div className="flex gap-4">
                 <button onClick={handleStart} disabled={!!streamingText} className="px-6 py-3 rounded-2xl text-[11px] font-black uppercase transition-all bg-white/5 text-white hover:bg-white/10 border border-white/10 flex items-center gap-2">
                    {ICONS.Refresh} 重新生成 (不满意)
                 </button>
                 <button onClick={handleSaveToKB} disabled={!!streamingText || saveStatus} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase transition-all ${saveStatus ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
                    {saveStatus ? "✓ 已同步资料库" : "存入资料库"}
                 </button>
                 <button onClick={() => DocGenerator.downloadBlob(new Blob([result]), "改编成果.txt")} className="bg-blue-600 text-white px-8 py-3 rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-blue-900/20">
                    导出文本
                 </button>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-black">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white/[0.02] border border-white/5 rounded-[4rem] p-16 shadow-2xl relative overflow-hidden">
                  <div className="whitespace-pre-wrap font-sans text-white/90 leading-[2] text-base tracking-tight font-light selection:bg-blue-500/30">
                    {streamingText || result}
                    {streamingText && <span className="inline-block w-2 h-5 bg-blue-600 ml-2 animate-pulse" />}
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
