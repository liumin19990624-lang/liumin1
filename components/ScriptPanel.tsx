
import React, { useState, useEffect, useMemo } from 'react';
import { KBFile, Category, AudienceMode, ScriptBlock, ModelType, DirectorStyle, SceneImage } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { GeminiService } from '../services/geminiService.ts';
import CinematicPreview from './CinematicPreview.tsx';

interface ScriptPanelProps {
  files: KBFile[];
  mode: AudienceMode;
  modelType: ModelType;
  onSaveToKB?: (f: KBFile) => void;
}

const ScriptPanel: React.FC<ScriptPanelProps> = ({ files, mode, modelType, onSaveToKB }) => {
  const [sourceId, setSourceId] = useState<string>('');
  const [referenceId, setReferenceId] = useState<string>('');
  const [outlineId, setOutlineId] = useState<string>('');
  const [blocks, setBlocks] = useState<ScriptBlock[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingShot, setIsGeneratingShot] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [previewBlockId, setPreviewBlockId] = useState<string | null>(null);
  const [directorStyle, setDirectorStyle] = useState<DirectorStyle>(DirectorStyle.UFOTABLE);

  const [proofreadingId, setProofreadingId] = useState<string | null>(null);
  const [proofreadResult, setProofreadResult] = useState('');
  const [isProofreading, setIsProofreading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(false);
  
  const gemini = useMemo(() => new GeminiService(), []);
  const nextBlockIndex = blocks.length + 1;

  useEffect(() => {
    if (sourceId) {
      const saved = localStorage.getItem(`script_blocks_v5_${sourceId}`);
      if (saved) setBlocks(JSON.parse(saved));
      else setBlocks([]);
      setSaveStatus(false);
    }
  }, [sourceId]);

  useEffect(() => {
    if (sourceId) {
      localStorage.setItem(`script_blocks_v5_${sourceId}`, JSON.stringify(blocks));
    }
  }, [blocks, sourceId]);

  const handleGenerate = async (targetIdx?: number) => {
    if (!sourceId) return;
    setIsGenerating(true);
    setSaveStatus(false);
    
    const isRegen = targetIdx !== undefined;
    const currentIdx = isRegen ? targetIdx : nextBlockIndex;
    const startEp = (currentIdx - 1) * 3 + 1;
    const endEp = currentIdx * 3;
    
    setLoadingStep(`AI 正在深度阅读并改编第 ${startEp}-${endEp} 集...`);
    setStreamingText('');

    try {
      const source = files.find(f => f.id === sourceId);
      const reference = files.find(f => f.id === referenceId);
      const outline = files.find(f => f.id === outlineId);

      let fullContent = '';
      const previousContext = blocks.slice(0, currentIdx - 1);
      
      const stream = gemini.generateScriptBlockStream(
        mode, 
        source?.content || '', 
        previousContext, 
        currentIdx, 
        modelType, 
        directorStyle,
        reference?.content || '',
        outline?.content || ''
      );

      for await (const chunk of stream) {
        fullContent += chunk;
        setStreamingText(GeminiService.cleanText(fullContent)); 
      }
      
      const newBlock: ScriptBlock = {
        id: isRegen ? blocks[targetIdx - 1].id : Math.random().toString(36).substr(2, 9),
        sourceId: sourceId,
        episodes: `第 ${startEp}-${endEp} 集`,
        content: GeminiService.cleanText(fullContent),
        sceneImages: isRegen ? blocks[targetIdx - 1].sceneImages : [],
        continuityStatus: isRegen ? '逻辑重塑完成' : '剧情平稳推进'
      };

      if (isRegen) {
        const newBlocks = [...blocks];
        newBlocks[targetIdx - 1] = newBlock;
        setBlocks(newBlocks);
      } else {
        setBlocks(prev => [...prev, newBlock]);
      }
      setStreamingText('');
    } catch (err: any) {
      console.error(err);
      alert(err.message || "生成中断。");
    } finally {
      setIsGenerating(false);
      setLoadingStep('');
    }
  };

  const handleSaveToKB = () => {
    if (blocks.length === 0 || !onSaveToKB) return;
    const fullScript = blocks.map(b => `${b.episodes}\n${b.content}`).join('\n\n---\n\n');
    const source = files.find(f => f.id === sourceId);
    
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[改编剧本] ${source?.name || '未命名'}`,
      category: Category.PLOT,
      content: fullScript,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB(newFile);
    setSaveStatus(true);
  };

  const handleProofread = async (block: ScriptBlock) => {
    if (isProofreading) return;
    setProofreadingId(block.id);
    setIsProofreading(true);
    setProofreadResult('');
    
    let full = '';
    try {
      const stream = gemini.aiProofreadStream(block.content);
      for await (const chunk of stream) {
        full += chunk;
        setProofreadResult(full);
      }
    } catch (e) {
      alert("校对任务失败，请检查网络");
    } finally {
      setIsProofreading(false);
    }
  };

  const applyProofread = (blockId: string) => {
    const parts = proofreadResult.split(/精修剧本[：:]/);
    const refinedContent = parts.length > 1 ? parts[1].trim() : proofreadResult;
    
    setBlocks(prev => prev.map(b => 
      b.id === blockId ? { ...b, content: GeminiService.cleanText(refinedContent), continuityStatus: 'AI 精修校对' } : b
    ));
    setProofreadingId(null);
    setProofreadResult('');
  };

  const handleVisualizeShot = async (blockId: string, shotLine: string) => {
    setIsGeneratingShot(true);
    try {
      const cleanShot = shotLine.replace(/（镜头：/g, '').replace(/[）]/g, '').trim();
      const imageUrl = await gemini.generateShotImage(cleanShot, mode, "16:9", directorStyle);
      if (imageUrl) {
        setBlocks(prev => prev.map(b => {
          if (b.id === blockId) {
            const newImg: SceneImage = {
              id: Math.random().toString(36).substr(2, 5),
              shotDescription: cleanShot,
              imageUrl,
              duration: 3
            };
            return { ...b, sceneImages: [...(b.sceneImages || []), newImg] };
          }
          return b;
        }));
      }
    } finally { setIsGeneratingShot(false); }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#050508] min-h-0 overflow-hidden">
      <div className="flex-shrink-0 mx-8 mt-6 p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/10 backdrop-blur-3xl flex flex-col gap-4 shadow-2xl relative">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              改编工作流：3集单元
            </span>
            <div className="flex items-center gap-4">
              <span className="text-3xl font-mono font-black text-white italic tracking-tighter uppercase">
                {blocks.length * 3} <span className="text-xs text-slate-500">已成稿集数</span>
              </span>
            </div>
          </div>

          <div className="flex gap-3">
             <div className="flex flex-col gap-1">
               <label className="text-[8px] font-black text-slate-500 uppercase ml-2">原著小说</label>
               <select value={sourceId} onChange={e => setSourceId(e.target.value)} className="bg-slate-900 border border-white/10 text-white rounded-xl px-4 py-2 text-[10px] font-bold outline-none w-40">
                  <option value="">选择原著...</option>
                  {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
               </select>
             </div>
             <div className="flex flex-col gap-1">
               <label className="text-[8px] font-black text-slate-500 uppercase ml-2">剧本模板</label>
               <select value={referenceId} onChange={e => setReferenceId(e.target.value)} className="bg-slate-900 border border-white/10 text-white rounded-xl px-4 py-2 text-[10px] font-bold outline-none w-40">
                  <option value="">默认模板...</option>
                  {files.filter(f => f.category === Category.REFERENCE).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
               </select>
             </div>
             <div className="flex flex-col justify-end gap-2">
               <div className="flex gap-2">
                 <button disabled={isGenerating || !sourceId} onClick={() => handleGenerate()} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-2xl px-6 py-2.5 font-black text-[10px] uppercase transition-all flex items-center gap-2 shadow-xl shadow-blue-900/40">
                   {isGenerating ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Sparkles}
                   {isGenerating ? "改编中..." : blocks.length === 0 ? "开始改编" : "续写单元"}
                 </button>
                 {blocks.length > 0 && (
                   <button 
                     onClick={handleSaveToKB} 
                     disabled={saveStatus}
                     className={`rounded-2xl px-6 py-2.5 font-black text-[10px] uppercase transition-all shadow-xl border ${saveStatus ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                   >
                     {saveStatus ? "✓ 已同步资料库" : "保存剧本全案"}
                   </button>
                 )}
               </div>
             </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pt-6 pb-40">
        <div className="max-w-5xl mx-auto space-y-12">
          {isGenerating && streamingText && (
            <div className="bg-blue-500/[0.05] rounded-[3.5rem] border border-blue-500/20 p-10 animate-pulse">
              <div className="w-full min-h-[400px] bg-black/40 border border-blue-500/10 rounded-3xl p-8 font-sans text-[13px] text-blue-100/90 whitespace-pre-wrap leading-relaxed">
                {streamingText}
                <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
              </div>
            </div>
          )}

          {blocks.map((block, idx) => (
            <div key={block.id} className="group/block bg-white/[0.02] rounded-[3.5rem] border border-white/5 p-10 hover:border-white/10 transition-all relative">
                <div className="flex items-center justify-between mb-8">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 font-mono text-xs border border-white/5">{idx + 1}</div>
                      <span className="text-xl font-black text-white italic uppercase tracking-tighter">{block.episodes}</span>
                      <span className="text-[9px] text-blue-400 font-black uppercase tracking-widest px-3 py-1 bg-blue-500/10 rounded-full">{block.continuityStatus}</span>
                   </div>
                   <div className="flex gap-2 opacity-0 group-hover/block:opacity-100 transition-all">
                     <button onClick={() => handleGenerate(idx + 1)} className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase text-slate-400 flex items-center gap-2">
                        {ICONS.Refresh} 重新生成 (不满意)
                     </button>
                     <button onClick={() => handleProofread(block)} className="bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/20 px-4 py-2 rounded-xl text-[9px] font-black uppercase text-emerald-400 flex items-center gap-2">
                        {ICONS.Refine} AI 校对
                     </button>
                     <button onClick={() => setPreviewBlockId(block.id)} className="bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/20 px-5 py-2 rounded-xl text-[10px] font-black uppercase text-blue-400">预演</button>
                   </div>
                </div>

                <div className="w-full bg-black/40 border border-white/5 rounded-3xl p-8 font-sans text-[13px] text-slate-300 whitespace-pre-wrap leading-relaxed shadow-inner">
                  {block.content}
                </div>

                {proofreadingId === block.id && (
                  <div className="mt-8 bg-emerald-950/20 border border-emerald-500/20 rounded-3xl p-8 animate-fade-up">
                    <div className="flex justify-between items-center mb-6">
                       <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                         {ICONS.Sparkles} AI 校对报告 & 建议修改
                       </span>
                       {!isProofreading && (
                         <div className="flex gap-3">
                            <button onClick={() => setProofreadingId(null)} className="text-[10px] font-black text-slate-500 uppercase">放弃修改</button>
                            <button onClick={() => applyProofread(block.id)} className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-lg shadow-emerald-900/20">应用精修版本</button>
                         </div>
                       )}
                    </div>
                    <div className="text-[12px] text-slate-400 italic whitespace-pre-wrap leading-relaxed">
                      {proofreadResult || "正在深度扫描文本逻辑与语法错误..."}
                      {isProofreading && <span className="inline-block w-2 h-4 bg-emerald-500 animate-pulse ml-1 align-middle" />}
                    </div>
                  </div>
                )}

                <div className="mt-8 flex flex-wrap gap-2">
                  {block.content.split('\n').filter(l => l.includes('（镜头：')).map((line, sIdx) => (
                    <button key={sIdx} disabled={isGeneratingShot} onClick={() => handleVisualizeShot(block.id, line)} className="bg-white/5 hover:bg-blue-600/20 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black text-slate-400 hover:text-blue-400 transition-all">
                      绘制分镜 {sIdx + 1}
                    </button>
                  ))}
                </div>

                {block.sceneImages && block.sceneImages.length > 0 && (
                  <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-up">
                    {block.sceneImages.map((img) => (
                      <div key={img.id} className="aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 group/img relative shadow-2xl">
                         <img src={img.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110" />
                         <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm p-4 text-center">
                            <p className="text-[10px] text-white/80 line-clamp-3 italic leading-relaxed">{img.shotDescription}</p>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>
      {previewBlockId && (
        <CinematicPreview block={blocks.find(b => b.id === previewBlockId)!} characterAssets={[]} onClose={() => setPreviewBlockId(null)} />
      )}
    </div>
  );
};

export default ScriptPanel;
