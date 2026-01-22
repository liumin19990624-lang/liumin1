import React, { useState, useEffect, useMemo } from 'react';
import { KBFile, Category, AudienceMode, ScriptBlock, ModelType, DirectorStyle, TropeType } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { GeminiService } from '../services/geminiService.ts';

interface ScriptPanelProps {
  files: KBFile[];
  mode: AudienceMode;
  modelType: ModelType;
  onSaveToKB?: (f: KBFile) => void;
}

const ScriptPanel: React.FC<ScriptPanelProps> = ({ files, mode, modelType, onSaveToKB }) => {
  const [sourceId, setSourceId] = useState<string>('');
  const [refFileId, setRefFileId] = useState<string>('');
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const [trope, setTrope] = useState<TropeType>(TropeType.FACE_SLAP);
  const [directorStyle, setDirectorStyle] = useState<DirectorStyle>(DirectorStyle.UFOTABLE);
  
  const [blocks, setBlocks] = useState<ScriptBlock[]>([]);
  const [batchCount, setBatchCount] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGeneratingIdx, setCurrentGeneratingIdx] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  
  const gemini = useMemo(() => new GeminiService(), []);

  useEffect(() => {
    if (sourceId) {
      const saved = localStorage.getItem(`script_blocks_v12_${sourceId}`);
      if (saved) {
        try {
          setBlocks(JSON.parse(saved));
        } catch (e) {
          setBlocks([]);
        }
      } else setBlocks([]);
    }
  }, [sourceId]);

  useEffect(() => {
    if (sourceId) {
      localStorage.setItem(`script_blocks_v12_${sourceId}`, JSON.stringify(blocks));
    }
  }, [blocks, sourceId]);

  const executeGeneration = async (existingBlocks: ScriptBlock[], targetIdx?: number) => {
    const isRegen = targetIdx !== undefined;
    const currentIdx = isRegen ? targetIdx : existingBlocks.length + 1;
    
    setCurrentGeneratingIdx(currentIdx);
    setStreamingText('');

    try {
      const source = files.find(f => f.id === sourceId);
      const refFile = files.find(f => f.id === refFileId);
      if (!source) throw new Error("Source missing");

      let fullContent = '';
      const stream = gemini.generateScriptBlockStream(
        mode, 
        source.content, 
        existingBlocks.slice(0, currentIdx - 1), 
        currentIdx, 
        modelType, 
        directorStyle, 
        trope, 
        refFile?.content || ''
      );

      for await (const chunk of stream) {
        fullContent += chunk;
        setStreamingText(GeminiService.cleanText(fullContent)); 
      }
      
      const cleaned = GeminiService.cleanText(fullContent);
      const result: ScriptBlock = {
        id: isRegen ? existingBlocks[targetIdx - 1].id : Math.random().toString(36).substr(2, 9),
        sourceId: sourceId,
        episodes: `第 ${currentIdx} 集`,
        content: cleaned,
        continuityStatus: `改编完成 | ${cleaned.length} 字`,
        style: directorStyle,
        trope: trope
      };
      return result;
    } catch (e) {
      console.error(e);
      alert("生成中断: " + (e as Error).message);
      return null;
    } finally {
      setStreamingText('');
      setCurrentGeneratingIdx(null);
    }
  };

  const handleGenerateNext = async (targetIdx?: number) => {
    if (!sourceId) return;
    setIsGenerating(true);
    const result = await executeGeneration(blocks, targetIdx);
    if (result) {
      if (targetIdx !== undefined) {
        setBlocks(prev => {
          const next = [...prev];
          next[targetIdx - 1] = result;
          return next;
        });
        setSavedStatus(prev => ({ ...prev, [result.id]: false }));
      } else {
        setBlocks(prev => [...prev, result]);
      }
    }
    setIsGenerating(false);
  };

  const handleBatchGenerate = async () => {
    if (!sourceId) return;
    setIsGenerating(true);
    let currentBlocks = [...blocks];
    for (let i = 0; i < batchCount; i++) {
      const result = await executeGeneration(currentBlocks);
      if (result) {
        currentBlocks = [...currentBlocks, result];
        setBlocks(currentBlocks);
      } else break;
    }
    setIsGenerating(false);
  };

  const saveBlockToKB = (block: ScriptBlock) => {
    if (savedStatus[block.id]) return;
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[改编] ${block.episodes} - ${files.find(f => f.id === sourceId)?.name}`,
      category: Category.PLOT,
      content: block.content,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB?.(newFile);
    setSavedStatus(prev => ({ ...prev, [block.id]: true }));
  };

  return (
    <div className="flex-1 flex flex-col bg-[#000000] overflow-hidden">
      {!sourceId || isSelectionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 animate-fade-up bg-[#000000]">
          <div className="card-neo max-w-2xl w-full p-16 space-y-10 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,1)]">
            <div className="text-center">
               <div className="w-20 h-20 bg-[#2062ee] rounded-[2rem] flex items-center justify-center text-white mx-auto shadow-2xl mb-8">
                 {ICONS.Zap}
               </div>
               <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">AI 剧本适配中心</h2>
               <p className="text-white/40 text-sm mt-4 font-bold tracking-widest leading-relaxed">
                 请选择原著，系统将自动进行工业级漫剧改编。
               </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[#2062ee] uppercase tracking-widest ml-4">改编原著源</label>
                  <select value={sourceId} onChange={e => setSourceId(e.target.value)} className="input-neo w-full">
                    <option value="">指向待改编原著...</option>
                    {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-4">参考文件 (可选)</label>
                  <select value={refFileId} onChange={e => setRefFileId(e.target.value)} className="input-neo w-full text-white/60 border-white/10">
                    <option value="">选择风格参考资料...</option>
                    {files.filter(f => f.id !== sourceId).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">导演风格</label>
                  <select value={directorStyle} onChange={e => setDirectorStyle(e.target.value as DirectorStyle)} className="input-neo w-full">
                    {Object.values(DirectorStyle).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-4">核心爽点</label>
                  <select value={trope} onChange={e => setTrope(e.target.value as TropeType)} className="input-neo w-full">
                    {Object.values(TropeType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <button 
              disabled={!sourceId}
              onClick={() => { setIsSelectionActive(false); if(blocks.length === 0) handleGenerateNext(); }}
              className="w-full bg-[#2062ee] hover:bg-blue-600 text-white py-6 rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 shadow-blue-900/40"
            >
              启动创意引擎
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-shrink-0 mx-8 mt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="card-neo p-6 flex items-center gap-5 border-white/10">
              <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-[#2062ee]">{ICONS.List}</div>
              <div>
                <p className="text-[9px] font-black text-white/40 uppercase tracking-tighter">当前生成集数</p>
                <p className="text-xl font-black text-white italic">{blocks.length}</p>
              </div>
            </div>

            <div className="card-neo p-6 flex flex-col justify-center border-white/10">
               <div className="flex justify-between mb-1">
                 <span className="text-[9px] font-black text-white/40 uppercase">批量生成集数</span>
                 <span className="text-[#2062ee] font-mono text-xs">{batchCount}</span>
               </div>
               <input type="range" min="1" max="5" value={batchCount} onChange={e => setBatchCount(parseInt(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-[#2062ee] cursor-pointer" />
            </div>

            <div className="card-neo p-4 flex items-center gap-3 border-white/10">
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[9px] font-black text-white/40 uppercase truncate">参考：{files.find(f => f.id === refFileId)?.name || '无'}</span>
                <button onClick={() => setIsSelectionActive(true)} className="text-[#2062ee] text-[10px] font-bold text-left hover:underline">修改配置</button>
              </div>
            </div>

            <button 
              disabled={isGenerating} 
              onClick={handleBatchGenerate} 
              className="bg-[#2062ee] hover:bg-blue-600 text-white rounded-3xl font-black text-xs uppercase shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 shadow-blue-900/40"
            >
              {isGenerating ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Plus}
              生成剧本单元
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pt-6 pb-40 bg-[#000000]">
            <div className="max-w-5xl mx-auto space-y-12">
              {blocks.map((block, idx) => (
                <div key={block.id} className="card-neo p-12 transition-all animate-fade-up relative overflow-hidden group border-white/10 bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-8 relative z-10">
                       <div className="flex items-center gap-6">
                          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#2062ee] font-mono font-black italic">{idx + 1}</div>
                          <div>
                            <span className="text-2xl font-black text-white italic tracking-tighter uppercase">{block.episodes}</span>
                            <p className="text-[9px] text-white/40 font-black uppercase tracking-widest mt-1">INDUSTRIAL ADAPTATION | {block.continuityStatus}</p>
                          </div>
                       </div>
                       <div className="flex gap-3">
                         <button onClick={() => saveBlockToKB(block)} disabled={savedStatus[block.id]} className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${savedStatus[block.id] ? 'bg-emerald-600/20 text-emerald-500' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
                            {savedStatus[block.id] ? "✓ 已存入" : "存入资料库"}
                         </button>
                         <button onClick={() => handleGenerateNext(idx + 1)} disabled={isGenerating} className="bg-rose-600/10 text-rose-500 px-6 py-3 rounded-2xl text-[9px] font-black uppercase hover:bg-rose-600/20 transition-all border border-rose-600/10">
                            重写
                         </button>
                       </div>
                    </div>
                    <div className="w-full bg-black/80 border border-white/10 rounded-[2.5rem] p-12 font-sans text-base text-white/90 whitespace-pre-wrap leading-relaxed italic relative z-10 shadow-inner">
                      {isGenerating && currentGeneratingIdx === idx + 1 ? streamingText : block.content}
                      {isGenerating && currentGeneratingIdx === idx + 1 && <span className="inline-block w-2.5 h-5 bg-[#2062ee] ml-2 animate-pulse shadow-[0_0_10px_rgba(32,98,238,0.8)]" />}
                    </div>
                </div>
              ))}

              {isGenerating && currentGeneratingIdx === blocks.length + 1 && (
                <div className="card-neo p-16 animate-pulse border-blue-500/20 bg-blue-600/5">
                   <div className="flex items-center gap-4 mb-8">
                     <div className="w-10 h-10 border-2 border-white/10 border-t-[#2062ee] rounded-full animate-spin"></div>
                     <span className="text-xs font-black text-[#2062ee] uppercase tracking-widest">正在改编第 {blocks.length + 1} 集...</span>
                   </div>
                  <div className="text-white/60 whitespace-pre-wrap leading-relaxed font-sans text-base italic">
                    {streamingText}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ScriptPanel;