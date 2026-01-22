import React, { useState, useMemo } from 'react';
import { KBFile, AudienceMode, Category } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { GeminiService } from '../services/geminiService.ts';

const OutlinePanel: React.FC<{ files: KBFile[], onSaveToKB: (f: KBFile) => void }> = ({ files, onSaveToKB }) => {
  const [targetId, setTargetId] = useState<string>('');
  const [refFileId, setRefFileId] = useState<string>('');
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
      const refFile = files.find(f => f.id === refFileId);
      let fullContent = '';
      
      let stream;
      if (analysisMode === 'CHARACTERS') {
        stream = gemini.extractCharactersStream(sourceFile?.content || '', refFile?.content || '');
      } else if (analysisMode === 'REF_SCRIPT') {
        stream = gemini.extractReferenceScriptStream(sourceFile?.content || '');
      } else if (analysisMode === 'CAST_BIO') {
        stream = gemini.generateCharacterBioStream(charName || "核心角色", "基于原著深度建模", sourceFile?.content || '', refFile?.content || '');
      } else {
        stream = gemini.generateFullOutlineStream(AudienceMode.MALE, sourceFile?.content || '', isDeepExtraction, refFile?.content || '');
      }

      for await (const chunk of stream) {
        fullContent += chunk;
        setStreamingText(fullContent);
      }
      const cleaned = GeminiService.cleanText(fullContent);
      setResult(cleaned);
      setStreamingText('');
    } catch (err: any) {
      console.error(err);
      alert("分析异常中止，请重试");
    } finally { setIsLoading(false); }
  };

  const handleSaveToKB = () => {
    if (!result) return;
    let category = Category.PLOT;
    if (analysisMode === 'CHARACTERS' || analysisMode === 'CAST_BIO') category = Category.CHARACTER;
    if (analysisMode === 'REF_SCRIPT') category = Category.REFERENCE;

    const typeLabel = analysisMode === 'REF_SCRIPT' ? '模板' : analysisMode === 'CAST_BIO' ? '小传' : analysisMode === 'CHARACTERS' ? '设定' : '大纲';
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[${typeLabel}] ${files.find(f => f.id === targetId)?.name}`,
      category: category,
      content: result,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB(newFile);
    setSaveStatus(true);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#000000]">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
        <div className="max-w-5xl mx-auto space-y-12 pb-24">
          <div className="card-neo p-12 shadow-2xl animate-fade-up relative overflow-hidden border border-white/10">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#2062ee]/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
            
            <div className="flex items-center gap-6 mb-12 relative z-10">
              <div className="w-16 h-16 bg-[#2062ee] rounded-3xl flex items-center justify-center text-white shadow-2xl">
                {ICONS.List}
              </div>
              <div>
                <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">全案大纲提取中心</h1>
                <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mt-1">Industrial Content Abstraction</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 relative z-10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/70 uppercase tracking-widest ml-2">目标原著内容</label>
                <select value={targetId} onChange={e => setTargetId(e.target.value)} className="input-neo w-full cursor-pointer">
                  <option value="">选择待提取原著...</option>
                  {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/70 uppercase tracking-widest ml-2">参考模板资料 (可选)</label>
                <select value={refFileId} onChange={e => setRefFileId(e.target.value)} className="input-neo w-full cursor-pointer">
                  <option value="">选择风格/大纲参考资料...</option>
                  {files.filter(f => f.id !== targetId).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 mb-10 relative z-10">
              <div className="flex items-center justify-between mb-6 px-2">
                <label className="text-[10px] font-black text-white/50 uppercase tracking-widest">提取任务模式</label>
                <div className="flex items-center gap-2">
                   <span className="text-[9px] font-bold text-white/60 uppercase">深度模式</span>
                   <button onClick={() => setIsDeepExtraction(!isDeepExtraction)} className={`w-10 h-5 rounded-full transition-all relative ${isDeepExtraction ? 'bg-[#2062ee]' : 'bg-slate-800'}`}>
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isDeepExtraction ? 'right-1' : 'left-1'}`} />
                   </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { id: 'PLOT_OUTLINE', label: '连载大纲', icon: ICONS.List },
                  { id: 'CHARACTERS', label: '提取人物', icon: ICONS.Users },
                  { id: 'REF_SCRIPT', label: '风格模板', icon: ICONS.Settings },
                  { id: 'CAST_BIO', label: '角色小传', icon: ICONS.Brain },
                ].map(mode => (
                  <button 
                    key={mode.id} 
                    onClick={() => setAnalysisMode(mode.id as any)}
                    className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] border transition-all ${analysisMode === mode.id ? 'bg-[#2062ee]/20 border-[#2062ee]/50 text-white shadow-xl' : 'bg-white/5 border-white/5 text-white/40 hover:border-white/20 hover:text-white'}`}
                  >
                    {mode.icon}
                    <span className="text-[10px] font-black uppercase tracking-widest">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button 
              disabled={isLoading || !targetId} 
              onClick={handleStart} 
              className={`w-full py-6 rounded-3xl font-black text-sm uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-4 ${
                isLoading ? 'bg-slate-800 text-white/30' : (targetId ? 'bg-[#2062ee] hover:bg-blue-600 text-white shadow-blue-900/40' : 'bg-slate-800 text-white/20')
              }`}
            >
              {isLoading ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Sparkles}
              {isLoading ? "正在进行神经网络运算..." : (targetId ? "启动全量内容生成" : "请先选择目标原著")}
            </button>
          </div>

          {(result || streamingText) && (
            <div className="card-neo overflow-hidden flex flex-col shadow-2xl animate-fade-up border border-white/10">
              <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#2062ee] animate-pulse"></div>
                  <span className="text-[11px] font-black text-white/80 uppercase tracking-widest italic">Industrial Generation Result</span>
                </div>
                <div className="flex gap-4">
                  <button onClick={handleStart} disabled={!!streamingText} className="bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all border border-rose-500/20">
                    {ICONS.Refresh} 重新生成
                  </button>
                  <button onClick={handleSaveToKB} disabled={saveStatus || !!streamingText} className={`px-10 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-2xl transition-all ${saveStatus ? 'bg-emerald-600 text-white' : 'bg-[#2062ee] text-white hover:bg-blue-600 shadow-blue-900/40'}`}>
                    {saveStatus ? "✓ 已存入库" : "存入资料库"}
                  </button>
                </div>
              </div>
              <div className="p-16 whitespace-pre-wrap font-sans text-white/90 leading-[2.2] text-lg font-medium italic tracking-wide h-[650px] overflow-y-auto custom-scrollbar bg-black/60 shadow-inner">
                {streamingText || result}
                {streamingText && <span className="inline-block w-3 h-7 bg-[#2062ee] ml-2 animate-pulse" />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutlinePanel;