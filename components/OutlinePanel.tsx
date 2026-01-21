
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
  const [charName, setCharName] = useState('');

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
        stream = gemini.generateCharacterBioStream(charName || "主角", "根据原著生成深度小传", sourceFile?.content || '', refFile?.content || '');
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
      alert("任务失败，请检查 API Key");
    } finally { setIsLoading(false); }
  };

  const handleSaveToKB = () => {
    if (!result) return;
    let category = Category.PLOT;
    if (analysisMode === 'CHARACTERS' || analysisMode === 'CAST_BIO') category = Category.CHARACTER;
    if (analysisMode === 'REF_SCRIPT') category = Category.REFERENCE;

    const typeLabel = analysisMode === 'REF_SCRIPT' ? '模板' : analysisMode === 'CAST_BIO' ? '小传' : analysisMode === 'CHARACTERS' ? '简档' : '大纲';
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[${typeLabel}] ${files.find(f => f.id === targetId)?.name || '未命名'}`,
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
                <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white">
                  {ICONS.Sparkles}
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white italic tracking-tighter">工业全案策划中心</h2>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Deep Story Pre-Production</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">选择内容原著</label>
                    <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full p-5 bg-black/40 border border-white/10 text-white rounded-2xl outline-none font-bold text-xs">
                      <option value="">选择知识库原著...</option>
                      {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-violet-500 uppercase ml-2 tracking-widest">参考文件模板</label>
                    <select value={refTemplateId} onChange={e => setRefTemplateId(e.target.value)} className="w-full p-5 bg-black/40 border border-violet-500/20 text-violet-400 rounded-2xl outline-none font-bold text-xs">
                      <option value="">选择参考文件模板...</option>
                      {files.filter(f => f.category === Category.REFERENCE || f.category === Category.CHARACTER).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">策划模式</label>
                    <div className="flex bg-black/40 p-1 rounded-2xl border border-white/5">
                        <button onClick={() => setAnalysisMode('PLOT_OUTLINE')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${analysisMode === 'PLOT_OUTLINE' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>连载大纲</button>
                        <button onClick={() => setAnalysisMode('CHARACTERS')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${analysisMode === 'CHARACTERS' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>提取人物</button>
                        <button onClick={() => setAnalysisMode('CAST_BIO')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${analysisMode === 'CAST_BIO' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>角色小传</button>
                    </div>
                </div>

                {analysisMode === 'CAST_BIO' && (
                  <div className="animate-fade-up">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest mb-2 block">指定人物姓名 (选填)</label>
                    <input value={charName} onChange={e => setCharName(e.target.value)} placeholder="输入角色姓名..." className="w-full p-5 bg-black/40 border border-white/10 text-white rounded-2xl outline-none text-xs" />
                  </div>
                )}

                <div className="p-6 bg-blue-600/10 border border-blue-500/20 rounded-3xl flex items-center justify-between">
                   <div className="flex flex-col">
                     <span className="text-white text-xs font-black italic uppercase tracking-tighter">无限制深度输出模式</span>
                     <span className="text-slate-500 text-[9px] font-bold uppercase">自动适配长篇工业标准</span>
                   </div>
                   <div className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${isDeepExtraction ? 'bg-blue-600' : 'bg-slate-800'}`} onClick={() => setIsDeepExtraction(!isDeepExtraction)}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDeepExtraction ? 'left-7' : 'left-1'}`}></div>
                   </div>
                </div>

                <button disabled={isLoading || !targetId} onClick={handleStart} className="w-full bg-blue-600 hover:bg-blue-500 text-white p-6 rounded-3xl font-black text-sm uppercase transition-all shadow-2xl flex items-center justify-center gap-3">
                  {isLoading ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Play}
                  {isLoading ? "深度解析中..." : "启动全案内容生成"}
                </button>
              </div>
           </div>
        </div>
      )}

      {(result || streamingText) && (
        <div className="flex-1 flex flex-col min-h-0 animate-fade-up">
           <div className="h-20 px-10 border-b border-white/5 bg-black/40 backdrop-blur-xl flex justify-between items-center z-10">
              <button onClick={() => {setResult(''); setStreamingText('');}} className="text-xs font-black text-slate-500 hover:text-white uppercase flex items-center gap-2">
                {ICONS.ArrowLeft} 返回控制台
              </button>
              <div className="flex gap-4">
                 <button onClick={handleStart} disabled={!!streamingText} className="px-6 py-3 rounded-2xl bg-rose-600/10 text-rose-500 border border-rose-600/20 text-[11px] font-black uppercase hover:bg-rose-600/20 transition-all">
                    不满意重新生成
                 </button>
                 <button onClick={handleSaveToKB} disabled={!!streamingText || saveStatus} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase transition-all ${saveStatus ? 'bg-emerald-500 text-white' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
                    {saveStatus ? "✓ 已存入资料库" : "存入资料库"}
                 </button>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-black">
              <div className="max-w-4xl mx-auto">
                <div className="bg-white/[0.02] border border-white/5 rounded-[4rem] p-16 shadow-2xl">
                  <div className="whitespace-pre-wrap font-sans text-white/90 leading-[2.2] text-base font-light italic">
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
