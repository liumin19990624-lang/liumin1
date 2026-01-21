
import React, { useState, useEffect, useMemo } from 'react';
import { KBFile, Category, AudienceMode, ScriptBlock, ModelType, DirectorStyle, TropeType } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { GeminiService } from '../services/geminiService.ts';
import { DocGenerator } from '../services/docGenerator.ts';

interface ScriptPanelProps {
  files: KBFile[];
  mode: AudienceMode;
  modelType: ModelType;
  onSaveToKB?: (f: KBFile) => void;
}

const ScriptPanel: React.FC<ScriptPanelProps> = ({ files, mode, modelType, onSaveToKB }) => {
  const [sourceId, setSourceId] = useState<string>('');
  const [refTemplateId, setRefTemplateId] = useState<string>('');
  const [trope, setTrope] = useState<TropeType>(TropeType.FACE_SLAP);
  const [directorStyle, setDirectorStyle] = useState<DirectorStyle>(DirectorStyle.UFOTABLE);
  
  const [blocks, setBlocks] = useState<ScriptBlock[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  
  const gemini = useMemo(() => new GeminiService(), []);

  useEffect(() => {
    if (sourceId) {
      const saved = localStorage.getItem(`script_blocks_v12_${sourceId}`);
      if (saved) setBlocks(JSON.parse(saved));
      else setBlocks([]);
    }
  }, [sourceId]);

  useEffect(() => {
    if (sourceId) {
      localStorage.setItem(`script_blocks_v12_${sourceId}`, JSON.stringify(blocks));
    }
  }, [blocks, sourceId]);

  const totalWords = blocks.reduce((acc, b) => acc + b.content.length, 0);

  const handleGenerateNext = async (targetIdx?: number) => {
    if (!sourceId) { alert("请先指向小说原著文件"); return; }
    setIsGenerating(true);
    setStreamingText('');

    const isRegen = targetIdx !== undefined;
    const currentIdx = isRegen ? targetIdx : blocks.length + 1;

    try {
      const source = files.find(f => f.id === sourceId);
      const refTemplate = files.find(f => f.id === refTemplateId);
      let fullContent = '';
      
      const stream = gemini.generateScriptBlockStream(
        mode, source?.content || '', blocks.slice(0, currentIdx - 1), 
        currentIdx, modelType, directorStyle, trope, refTemplate?.content || ''
      );

      for await (const chunk of stream) {
        fullContent += chunk;
        setStreamingText(GeminiService.cleanText(fullContent)); 
      }
      
      const cleaned = GeminiService.cleanText(fullContent);
      const newBlock: ScriptBlock = {
        id: isRegen ? blocks[targetIdx - 1].id : Math.random().toString(36).substr(2, 9),
        sourceId: sourceId,
        episodes: `第 ${currentIdx} 集剧本`,
        content: cleaned,
        continuityStatus: `深度适配 | 长度 ${cleaned.length} 字`,
        style: directorStyle,
        trope: trope
      };

      if (isRegen) {
        const newBlocks = [...blocks];
        newBlocks[targetIdx - 1] = newBlock;
        setBlocks(newBlocks);
        setSavedStatus(prev => ({ ...prev, [newBlock.id]: false }));
      } else {
        setBlocks(prev => [...prev, newBlock]);
      }
      setStreamingText('');
    } finally { setIsGenerating(false); }
  };

  const saveBlockToKB = (block: ScriptBlock) => {
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[适配剧本] ${block.episodes}`,
      category: Category.PLOT,
      content: block.content,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB?.(newFile);
    setSavedStatus(prev => ({ ...prev, [block.id]: true }));
  };

  return (
    <div className="flex-1 flex flex-col bg-[#050508] overflow-hidden">
      {/* 顶部状态汇总 */}
      {!sourceId ? (
        <div className="flex-1 flex flex-col items-center justify-center p-20 animate-fade-up">
          <div className="max-w-xl w-full bg-white/[0.03] border border-white/10 rounded-[4rem] p-16 text-center space-y-10 shadow-2xl backdrop-blur-3xl">
            <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white mx-auto shadow-xl">
               {ICONS.Zap}
            </div>
            <div>
               <h2 className="text-3xl font-black text-white italic italic uppercase tracking-tighter mb-4">开始分集生成</h2>
               <p className="text-slate-500 text-sm font-bold uppercase tracking-widest leading-relaxed">
                 导演已就绪。请在下方选择知识库中的小说原著，系统将自动锚定剧情逻辑并启动 2D 动漫改编流。
               </p>
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] block">小说原著源</label>
              <select 
                value={sourceId} 
                onChange={e => setSourceId(e.target.value)} 
                className="w-full bg-black/60 border border-white/10 text-white rounded-[2rem] px-8 py-5 text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-inner"
              >
                <option value="">点击选择库中小说...</option>
                {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-shrink-0 mx-8 mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 flex flex-col justify-center">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-black text-slate-500 uppercase">当前连载</span>
                <span className="text-blue-500 font-mono text-xs font-bold">{blocks.length} 集</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600" style={{ width: `${Math.min(100, blocks.length * 5)}%` }}></div>
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center text-blue-500">{ICONS.FileText}</div>
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase">累计改编字数</p>
                <p className="text-lg font-black text-white italic">{totalWords.toLocaleString()} <span className="text-[9px] text-slate-600">字</span></p>
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 flex items-center gap-4 col-span-2">
               <div className="flex-1 flex flex-col gap-1">
                 <span className="text-[9px] font-black text-slate-500 uppercase ml-2">正在改编: {files.find(f => f.id === sourceId)?.name}</span>
                 <button onClick={() => setSourceId('')} className="text-[9px] font-black text-blue-500 hover:text-white uppercase ml-2 transition-colors">重新指向小说源</button>
               </div>
               <button 
                 disabled={isGenerating} 
                 onClick={() => handleGenerateNext()} 
                 className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase shadow-xl transition-all"
               >
                 {isGenerating ? "重构中..." : "分集生成：下一集"}
               </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-10 pt-6 pb-40">
            <div className="max-w-5xl mx-auto space-y-12">
              {blocks.map((block, idx) => (
                <div key={block.id} className="bg-white/[0.02] rounded-[3rem] border border-white/5 p-12 hover:border-white/10 transition-all animate-fade-up">
                    <div className="flex items-center justify-between mb-8">
                       <div className="flex items-center gap-6">
                          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 font-mono font-black italic">{idx + 1}</div>
                          <div>
                            <span className="text-xl font-black text-white italic uppercase tracking-tighter">{block.episodes}</span>
                            <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-1">{block.continuityStatus}</p>
                          </div>
                       </div>
                       <div className="flex gap-3">
                         <button onClick={() => saveBlockToKB(block)} disabled={savedStatus[block.id]} className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all shadow-lg ${savedStatus[block.id] ? 'bg-emerald-600/20 text-emerald-500' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
                            {savedStatus[block.id] ? "✓ 已同步库" : "存入库"}
                         </button>
                         <button onClick={() => handleGenerateNext(idx + 1)} disabled={isGenerating} className="bg-rose-600/10 text-rose-500 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase hover:bg-rose-600/20 transition-all border border-rose-600/10">
                            重刷此集
                         </button>
                       </div>
                    </div>
                    <div className="w-full bg-black/40 border border-white/5 rounded-[2.5rem] p-12 font-sans text-base text-slate-300 whitespace-pre-wrap leading-[2.2] italic shadow-inner">
                      {block.content}
                    </div>
                </div>
              ))}

              {isGenerating && streamingText && (
                <div className="bg-blue-600/[0.03] rounded-[3.5rem] border border-blue-500/10 p-16 animate-pulse">
                  <div className="text-blue-100/70 whitespace-pre-wrap leading-[2.2] font-sans text-base italic">
                    {streamingText}
                    <span className="inline-block w-2.5 h-5 bg-blue-600 ml-2 shadow-[0_0_10px_rgba(37,99,235,1)]" />
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
