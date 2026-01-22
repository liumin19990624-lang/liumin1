import React, { useState, useMemo, useEffect } from 'react';
import { ICONS } from '../constants.tsx';
import { ScriptBlock, KBFile, Category, ModelType } from '../types.ts';
import { GeminiService } from '../services/geminiService.ts';

interface ShotEntry {
  id: string;
  duration: string;
  technical: string;
  visual: string;
  dialogue: string;
  prompt: string;
  sourceText: string;
  previewUrl?: string;
  videoUrl?: string;
  isGenerating?: boolean;
}

interface ShotsPanelProps {
  sourceBlocks: any[];
  files: KBFile[];
  onSaveToKB: (f: KBFile) => void;
}

const ShotsPanel: React.FC<ShotsPanelProps> = ({ sourceBlocks, files, onSaveToKB }) => {
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [refFileId, setRefFileId] = useState<string>('');
  const [isGeneratingList, setIsGeneratingList] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [shotList, setShotList] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState(false);
  const [renderedShots, setRenderedShots] = useState<Record<string, Partial<ShotEntry>>>({});

  const gemini = useMemo(() => new GeminiService(), []);

  const handleGenerateShots = async () => {
    const block = sourceBlocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    setIsGeneratingList(true);
    setStreamingText('');
    setShotList('');
    setSaveStatus(false);
    setRenderedShots({});

    let full = '';
    try {
      const refFile = files.find(f => f.id === refFileId);
      const stream = gemini.generateTechnicalShotListStream(block.content, refFile?.content || '');
      for await (const chunk of stream) {
        full += chunk;
        setStreamingText(full);
      }
      setShotList(full);
    } catch (e) {
      alert("解析失败，请检查 API 配置或网络状况。");
    } finally {
      setIsGeneratingList(false);
    }
  };

  const parsedShots = useMemo((): ShotEntry[] => {
    const content = streamingText || shotList;
    if (!content) return [];
    
    return content.split('\n')
      .map(line => line.trim())
      .filter(line => line.includes('|') && !line.includes('镜号'))
      .map(line => {
        const parts = line.split('|').map(s => s.trim());
        const id = parts[0] || '?';
        return { 
          id, 
          duration: parts[1] || '3s', 
          technical: parts[2] || '常规镜头', 
          visual: parts[3] || '（画面内容缺失）', 
          dialogue: parts[4] || '（无）',
          prompt: parts[5] || '',
          sourceText: parts[6] || '（未关联原文）',
          ...renderedShots[id]
        };
      });
  }, [streamingText, shotList, renderedShots]);

  const generateShotPreview = async (shot: ShotEntry) => {
    setRenderedShots(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], isGenerating: true } }));
    try {
      const targetPrompt = shot.prompt || shot.visual;
      const img = await gemini.generateShotImage(targetPrompt, shot.technical);
      setRenderedShots(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], previewUrl: img, isGenerating: false } }));
    } catch (e) {
      setRenderedShots(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], isGenerating: false } }));
    }
  };

  const generateShotVideo = async (shot: ShotEntry) => {
    if (!shot.previewUrl) return;
    setRenderedShots(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], isGenerating: true } }));
    try {
      const opId = await gemini.triggerVideoGeneration(shot.previewUrl, shot.prompt || shot.visual);
      const poll = setInterval(async () => {
        const status = await gemini.pollVideoStatus(opId);
        if (status.done && status.videoUrl) {
          setRenderedShots(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], videoUrl: status.videoUrl, isGenerating: false } }));
          clearInterval(poll);
        }
      }, 5000);
    } catch (e) {
      setRenderedShots(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], isGenerating: false } }));
    }
  };

  const handleSaveToKB = () => {
    const finalContent = shotList || streamingText;
    if (!finalContent) return;
    const block = sourceBlocks.find(b => b.id === selectedBlockId);
    onSaveToKB({
      id: Math.random().toString(36).substr(2, 9),
      name: `[分镜脚本] ${block?.episodes || '待定集数'}`,
      category: Category.REFERENCE,
      content: finalContent,
      uploadDate: new Date().toISOString()
    });
    setSaveStatus(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#000000] overflow-hidden text-white/90">
      <div className="h-28 px-10 border-b border-white/10 flex items-center justify-between bg-black/80 backdrop-blur-3xl shrink-0">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-[#2062ee] uppercase tracking-[0.2em] mb-1 italic">Industrial Visualization Lab</span>
          <h2 className="text-2xl font-black italic tracking-tighter uppercase">工业分镜导演控制台 Pro</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-white/30 uppercase ml-2 tracking-widest">选择待拆解剧集</span>
            <select value={selectedBlockId} onChange={e => setSelectedBlockId(e.target.value)} className="input-neo w-64">
              <option value="">指向待拆解剧本单元...</option>
              {sourceBlocks.map(b => <option key={b.id} value={b.id}>{b.episodes}</option>)}
            </select>
          </div>
          <button 
            disabled={isGeneratingList || !selectedBlockId} 
            onClick={handleGenerateShots} 
            className="bg-[#2062ee] hover:bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-3 transition-all active:scale-95 shadow-lg mt-4 shadow-blue-900/40"
          >
            {isGeneratingList ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Play}
            启动分镜自动化解析
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        {!shotList && !streamingText ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 gap-4">
            <div className="scale-[3]">{ICONS.Camera}</div>
            <p className="text-xs font-black uppercase tracking-[0.4em] italic text-white/40">请在控制台上方指定剧本单元</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto space-y-12 pb-32">
            {parsedShots.map((shot, idx) => (
              <div key={idx} className="card-neo overflow-hidden border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all animate-fade-up">
                <div className="grid grid-cols-12">
                  {/* 镜号与时长区块 */}
                  <div className="col-span-1 border-r border-white/5 p-6 flex flex-col items-center justify-center bg-white/[0.02]">
                    <div className="text-4xl font-black italic text-[#2062ee]">#{shot.id}</div>
                    <div className="text-[10px] font-black text-white/30 mt-4 flex items-center gap-1 uppercase tracking-widest">
                      {ICONS.Clock} {shot.duration}
                    </div>
                  </div>

                  {/* 核心导演指令区块 */}
                  <div className="col-span-7 p-10 space-y-8">
                    {/* 关联原文 (Industrial traceability) */}
                    <div className="space-y-2">
                       <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] flex items-center gap-2">
                         {ICONS.FileText} 关联原著上下文 (Source Reference)
                       </label>
                       <div className="bg-black/40 p-5 rounded-2xl border border-white/5 shadow-inner">
                         <p className="text-xs text-white/40 italic leading-relaxed font-medium">
                           “{shot.sourceText}”
                         </p>
                       </div>
                    </div>

                    {/* 技术参数与台词分布 */}
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-[#2062ee] uppercase tracking-[0.3em] block">镜头技术指令 (Director Spec)</label>
                        <div className="flex flex-wrap gap-2">
                          {shot.technical.split(/[、,，\s]/).filter(Boolean).map((t, ti) => (
                            <span key={ti} className="px-3 py-1 bg-[#2062ee]/10 border border-[#2062ee]/20 text-[#2062ee] text-[10px] font-black rounded-lg italic">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-rose-500 uppercase tracking-[0.3em] block">同步角色台词 (Dialogue)</label>
                        <p className="text-sm font-bold text-white italic tracking-tight">“{shot.dialogue}”</p>
                      </div>
                    </div>

                    {/* 视觉详细描写 */}
                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.3em] block">分镜可视化描写 (Visual Narrative)</label>
                      <p className="text-sm font-medium leading-relaxed italic text-white/90 bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10 shadow-inner">
                        {shot.visual}
                      </p>
                    </div>

                    {/* AI提示词 (Engineering bridge) */}
                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-blue-400/50 uppercase tracking-[0.3em] block flex items-center gap-2">
                        {ICONS.Sparkles} 工业绘图底层指令 (Prompt Engine)
                      </label>
                      <div className="bg-blue-600/5 border border-blue-500/10 p-5 rounded-2xl">
                        <p className="text-[10px] font-mono text-blue-300/60 leading-relaxed break-all">
                          {shot.prompt || "Pending engineering..."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 预览与生成区 */}
                  <div className="col-span-4 border-l border-white/5 p-8 bg-black/40 flex flex-col gap-6">
                    <div className="aspect-video bg-slate-950 rounded-[2.5rem] border border-white/10 overflow-hidden relative shadow-2xl group">
                      {shot.videoUrl ? (
                        <video src={shot.videoUrl} autoPlay loop muted className="w-full h-full object-cover" />
                      ) : shot.previewUrl ? (
                        <img src={shot.previewUrl} className="w-full h-full object-cover" alt="shot preview" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 opacity-20">
                           <div className="scale-[2]">{ICONS.Image}</div>
                           <span className="text-[9px] font-black uppercase tracking-[0.3em]">Frame Pending</span>
                        </div>
                      )}
                      
                      {shot.isGenerating && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-10">
                          <div className="flex flex-col items-center gap-4">
                             <div className="w-10 h-10 border-2 border-[#2062ee] border-t-transparent rounded-full animate-spin"></div>
                             <span className="text-[8px] font-black uppercase tracking-widest text-[#2062ee] animate-pulse">Rendering Pipeline...</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <button 
                         onClick={() => generateShotPreview(shot)} 
                         disabled={shot.isGenerating} 
                         className="py-4 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-[10px] font-black uppercase rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-2 active:scale-95"
                       >
                         {ICONS.Image} 渲染样图
                       </button>
                       <button 
                         onClick={() => generateShotVideo(shot)} 
                         disabled={shot.isGenerating || !shot.previewUrl} 
                         className={`py-4 text-[10px] font-black uppercase rounded-2xl border transition-all flex items-center justify-center gap-2 active:scale-95 ${
                           !shot.previewUrl ? 'bg-white/5 text-white/10 border-white/5 cursor-not-allowed' : 'bg-[#2062ee]/10 hover:bg-[#2062ee] text-blue-400 hover:text-white border-[#2062ee]/20'
                         }`}
                       >
                         {ICONS.Play} 动态视频
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="py-24 flex justify-center gap-8">
               <button 
                 onClick={handleSaveToKB} 
                 disabled={saveStatus || (!shotList && !streamingText)} 
                 className={`px-16 py-6 rounded-[2.5rem] font-black text-sm uppercase shadow-2xl transition-all flex items-center gap-4 active:scale-95 ${
                   saveStatus ? 'bg-emerald-600 text-white shadow-emerald-900/40' : 'bg-[#2062ee] text-white hover:bg-blue-600 shadow-blue-900/40'
                 }`}
               >
                  {saveStatus ? "✓ 分镜脚本全案已归档" : (
                    <>
                      {ICONS.Check} 导出工业分镜全案报告
                    </>
                  )}
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShotsPanel;