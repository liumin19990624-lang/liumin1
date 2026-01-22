
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

  // 加载持久化数据
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

  // 同步本地存储
  useEffect(() => {
    if (sourceId && blocks.length >= 0) {
      localStorage.setItem(`script_blocks_v12_${sourceId}`, JSON.stringify(blocks));
    }
  }, [blocks, sourceId]);

  // 单集生成逻辑封装
  const executeSingleGeneration = async (existingBlocks: ScriptBlock[], targetIdx?: number) => {
    const isRegen = targetIdx !== undefined;
    const currentIdx = isRegen ? targetIdx : existingBlocks.length + 1;
    
    setCurrentGeneratingIdx(currentIdx);
    setStreamingText('');

    try {
      const source = files.find(f => f.id === sourceId);
      const refFile = files.find(f => f.id === refFileId);
      if (!source) throw new Error("Missing Source");

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
        episodes: `第 ${currentIdx} 集剧本`,
        content: cleaned,
        continuityStatus: `改编完成 | ${cleaned.length} 字`,
        style: directorStyle,
        trope: trope
      };
      return result;
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setStreamingText('');
      setCurrentGeneratingIdx(null);
    }
  };

  const handleGenerateNext = async (targetIdx?: number) => {
    if (!sourceId) { alert("请先选择原著"); return; }
    setIsGenerating(true);
    
    const result = await executeSingleGeneration(blocks, targetIdx);
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
    if (!sourceId) { alert("请先选择原著"); return; }
    setIsGenerating(true);
    
    let currentBlocks = [...blocks];
    for (let i = 0; i < batchCount; i++) {
      const result = await executeSingleGeneration(currentBlocks);
      if (result) {
        currentBlocks = [...currentBlocks, result];
        setBlocks(currentBlocks);
      } else {
        alert(`第 ${currentBlocks.length + 1} 集生成中断`);
        break;
      }
    }
    setIsGenerating(false);
    setBatchCount(1);
  };

  const saveBlockToKB = (block: ScriptBlock) => {
    if (savedStatus[block.id]) return;
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[改编剧本] ${block.episodes} - ${files.find(f => f.id === sourceId)?.name}`,
      category: Category.PLOT,
      content: block.content,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB?.(newFile);
    setSavedStatus(prev => ({ ...prev, [block.id]: true }));
  };

  const saveAllUnsaved = () => {
    const unsaved = blocks.filter(b => !savedStatus[b.id]);
    if (unsaved.length === 0) { alert("所有内容均已同步"); return; }
    unsaved.forEach(b => saveBlockToKB(b));
    alert(`成功同步 ${unsaved.length} 集剧本到库`);
  };

  const unsavedCount = blocks.filter(b => !savedStatus[b.id]).length;

  return (
    <div className="flex-1 flex flex-col bg-[#050508] overflow-hidden">
      {!sourceId || isSelectionActive ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 animate-fade-up">
          <div className="max-w-2xl w-full bg-white/[0.02] border border-white/10 rounded-[4rem] p-16 space-y-12 shadow-2xl backdrop-blur-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
            
            <div className="text-center space-y-4">
               <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white mx-auto shadow-2xl mb-6">
                 {ICONS.Zap}
               </div>
               <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">剧本智能适配 Pro</h2>
               <p className="text-slate-500 text-sm font-bold uppercase tracking-widest leading-relaxed">
                 请选择原著及参考文件，系统将基于 industrial 工业标准进行分镜化剧本改编。
               </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-4 italic">改编原著源</label>
                <select 
                  value={sourceId} 
                  onChange={e => setSourceId(e.target.value)} 
                  className="w-full bg-black border border-white/10 text-white rounded-[1.5rem] px-6 py-4 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                >
                  <option value="">指向待改编小说...</option>
                  {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-violet-500 uppercase tracking-widest ml-4 italic">参考文件 (对标风格)</label>
                <select 
                  value={refFileId} 
                  onChange={e => setRefFileId(e.target.value)} 
                  className="w-full bg-black border border-white/10 text-white rounded-[1.5rem] px-6 py-4 text-xs font-bold outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                >
                  <option value="">可选：指向风格参考...</option>
                  {files.filter(f => f.id !== sourceId).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-4">
               <button 
                 disabled={!sourceId}
                 onClick={() => { setIsSelectionActive(false); if(blocks.length === 0) handleGenerateNext(); }}
                 className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95"
               >
                 确认配置并启动导演系统
               </button>
               {sourceId && <button onClick={() => setIsSelectionActive(false)} className="text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">取消修改</button>}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 控制台面板 */}
          <div className="flex-shrink-0 mx-8 mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-6 flex items-center gap-5 group hover:bg-white/[0.05] transition-all">
              <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-all">{ICONS.List}</div>
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">当前总集数</p>
                <p className="text-lg font-black text-white italic">{blocks.length} <span className="text-[10px] text-slate-700 not-italic">EPS</span></p>
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-6 flex flex-col justify-center">
               <div className="flex justify-between items-center mb-1">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">批量生成步进</span>
                 <span className="text-blue-500 font-mono text-xs font-bold">{batchCount} 集</span>
               </div>
               <input 
                type="range" min="1" max="5" value={batchCount} 
                onChange={e => setBatchCount(parseInt(e.target.value))}
                className="w-full h-1 bg-white/5 rounded-full appearance-none accent-blue-600 cursor-pointer"
               />
            </div>

            <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-4 flex items-center gap-4 col-span-2">
               <div className="flex-1 flex flex-col gap-1 pl-4">
                 <span className="text-[9px] font-black text-slate-500 uppercase truncate max-w-[200px]">原著: {files.find(f => f.id === sourceId)?.name}</span>
                 <div className="flex gap-4">
                    <button onClick={() => setIsSelectionActive(true)} className="text-[8px] font-black text-blue-500 hover:text-white uppercase transition-colors flex items-center gap-1">
                      {ICONS.Settings} 更改指向
                    </button>
                    {unsavedCount > 0 && (
                      <button onClick={saveAllUnsaved} className="text-[8px] font-black text-emerald-500 hover:text-white uppercase transition-colors flex items-center gap-1 animate-pulse">
                        {ICONS.Check} 一键保存全部 ({unsavedCount})
                      </button>
                    )}
                 </div>
               </div>
               <button 
                 disabled={isGenerating} 
                 onClick={handleBatchGenerate} 
                 className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase shadow-xl transition-all active:scale-95 flex items-center gap-3"
               >
                 {isGenerating ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Plus}
                 {batchCount > 1 ? `批量生产 ${batchCount} 集` : "生成下一集"}
               </button>
            </div>
          </div>

          {/* 剧本流 */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pt-6 pb-40">
            <div className="max-w-5xl mx-auto space-y-12">
              {blocks.map((block, idx) => (
                <div key={block.id} className="bg-white/[0.02] rounded-[3.5rem] border border-white/5 p-12 hover:border-white/10 transition-all animate-fade-up relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-[60px] rounded-full group-hover:bg-blue-600/10 transition-all"></div>
                    <div className="flex items-center justify-between mb-8 relative z-10">
                       <div className="flex items-center gap-6">
                          <div className="w-14 h-14 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-center text-blue-500 font-mono font-black italic shadow-inner group-hover:border-blue-500/30 transition-all">{idx + 1}</div>
                          <div>
                            <span className="text-2xl font-black text-white italic tracking-tighter uppercase">{block.episodes}</span>
                            <p className="text-[9px] text-slate-700 font-black uppercase tracking-widest mt-1">DIRECTED PRODUCTION | {block.continuityStatus}</p>
                          </div>
                       </div>
                       <div className="flex gap-3">
                         <button onClick={() => saveBlockToKB(block)} disabled={savedStatus[block.id]} className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase transition-all shadow-lg ${savedStatus[block.id] ? 'bg-emerald-600/20 text-emerald-500 border border-emerald-500/20' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
                            {savedStatus[block.id] ? "✓ 已同步" : "存入库"}
                         </button>
                         <button onClick={() => handleGenerateNext(idx + 1)} disabled={isGenerating} className="bg-rose-600/10 text-rose-500 px-6 py-3 rounded-2xl text-[9px] font-black uppercase hover:bg-rose-600/20 transition-all border border-rose-600/10 flex items-center gap-2">
                            {ICONS.Refresh} 不满意请重写
                         </button>
                       </div>
                    </div>
                    <div className="w-full bg-black/60 border border-white/5 rounded-[3rem] p-12 font-sans text-base text-slate-300 whitespace-pre-wrap leading-[2.2] italic shadow-inner tracking-wide relative z-10">
                      {isGenerating && currentGeneratingIdx === idx + 1 ? streamingText : block.content}
                      {isGenerating && currentGeneratingIdx === idx + 1 && <span className="inline-block w-2.5 h-5 bg-blue-600 ml-2 animate-pulse shadow-[0_0_10px_rgba(37,99,235,0.8)]" />}
                    </div>
                </div>
              ))}

              {isGenerating && currentGeneratingIdx === blocks.length + 1 && (
                <div className="bg-blue-600/[0.04] rounded-[4rem] border border-blue-500/10 p-16 animate-pulse">
                   <div className="flex items-center gap-4 mb-8">
                     <div className="w-10 h-10 border-2 border-white/5 border-t-blue-500 rounded-full animate-spin"></div>
                     <span className="text-xs font-black text-blue-400 uppercase tracking-widest">正在进行第 {blocks.length + 1} 集工业级改编...</span>
                   </div>
                  <div className="text-blue-100/60 whitespace-pre-wrap leading-[2.2] font-sans text-base italic">
                    {streamingText}
                    <span className="inline-block w-2.5 h-5 bg-blue-600 ml-2 shadow-[0_0_15px_rgba(37,99,235,1)]" />
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
