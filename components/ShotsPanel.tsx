import React, { useState, useMemo, useEffect } from 'react';
import { ICONS } from '../constants.tsx';
import { ScriptBlock, KBFile, Category, ModelType } from '../types.ts';
import { GeminiService } from '../services/geminiService.ts';
import { DocGenerator } from '../services/docGenerator.ts';

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
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
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

  const stats = useMemo(() => {
    const count = parsedShots.length;
    const durationSum = parsedShots.reduce((acc, curr) => {
      const d = parseInt(curr.duration.replace(/[^\d]/g, '')) || 0;
      return acc + d;
    }, 0);
    return { count, durationSum };
  }, [parsedShots]);

  const generateShotPreview = async (shot: ShotEntry) => {
    setRenderedShots(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], isGenerating: true } }));
    try {
      const targetPrompt = shot.prompt || shot.visual;
      const img = await gemini.generateShotImage(targetPrompt, shot.technical);
      setRenderedShots(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], previewUrl: img, isGenerating: false } }));
      return img;
    } catch (e) {
      setRenderedShots(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], isGenerating: false } }));
      return null;
    }
  };

  const generateShotVideo = async (shot: ShotEntry) => {
    let currentPreview = shot.previewUrl;
    if (!currentPreview) {
      currentPreview = await generateShotPreview(shot) || undefined;
    }
    if (!currentPreview) return;

    setRenderedShots(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], isGenerating: true } }));
    try {
      const opId = await gemini.triggerVideoGeneration(currentPreview, shot.prompt || shot.visual);
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

  const handleBatchGeneratePreviews = async () => {
    if (isBatchProcessing || parsedShots.length === 0) return;
    setIsBatchProcessing(true);
    for (const shot of parsedShots) {
      if (!shot.previewUrl) {
        await generateShotPreview(shot);
      }
    }
    setIsBatchProcessing(false);
  };

  const downloadShotImage = (shot: ShotEntry) => {
    if (!shot.previewUrl) return;
    const link = document.createElement('a');
    link.href = shot.previewUrl;
    link.download = `Shot_${shot.id}_Viz.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadShotVideo = (shot: ShotEntry) => {
    if (!shot.videoUrl) return;
    const link = document.createElement('a');
    link.href = shot.videoUrl;
    link.download = `Shot_${shot.id}_Anim.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    if (parsedShots.length === 0) return;
    const headers = ['镜号', '时长', '镜头技术', '画面描述', '角色台词', 'AI提示词', '关联原文'];
    const rows = parsedShots.map(s => [
      s.id, s.duration, s.technical, s.visual, s.dialogue, s.prompt, s.sourceText
    ].map(v => `"${v.replace(/"/g, '""')}"`).join(','));
    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    DocGenerator.downloadBlob(blob, `Anime_Storyboard_${Date.now()}.csv`);
  };

  const handleExportJSON = () => {
    if (parsedShots.length === 0) return;
    const blob = new Blob([JSON.stringify(parsedShots, null, 2)], { type: 'application/json' });
    DocGenerator.downloadBlob(blob, `Storyboard_${Date.now()}.json`);
  };

  const handleSaveToKB = () => {
    const finalContent = shotList || streamingText;
    if (!finalContent) return;
    const block = sourceBlocks.find(b => b.id === selectedBlockId);
    onSaveToKB({
      id: Math.random().toString(36).substr(2, 9),
      name: `[高颗粒分镜] ${block?.episodes || '剧本单元'}`,
      category: Category.REFERENCE,
      content: finalContent,
      uploadDate: new Date().toISOString()
    });
    setSaveStatus(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#000000] overflow-hidden text-white/90">
      <div className="h-28 px-10 border-b border-white/10 flex items-center justify-between bg-black/80 backdrop-blur-3xl shrink-0 z-20">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-[#2062ee] uppercase tracking-[0.2em] mb-1 italic">Industrial Visualization Lab</span>
          <h2 className="text-2xl font-black italic tracking-tighter uppercase">工业分镜导演控制台 Pro</h2>
        </div>

        <div className="flex items-center gap-8 px-10 border-x border-white/5 h-full">
           <div className="flex flex-col items-center">
             <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">分镜规模</span>
             <span className={`text-xl font-black italic ${stats.count >= 48 ? 'text-emerald-500' : 'text-blue-500'}`}>
               {stats.count} <small className="text-[10px] not-italic opacity-40">/ 48+</small>
             </span>
           </div>
           <div className="flex flex-col items-center">
             <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">总预计时长</span>
             <span className={`text-xl font-black italic ${stats.durationSum >= 130 ? 'text-emerald-500' : 'text-[#2062ee]'}`}>
               {stats.durationSum}s <small className="text-[10px] not-italic opacity-40">/ 130s+</small>
             </span>
           </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
             <select value={selectedBlockId} onChange={e => setSelectedBlockId(e.target.value)} className="input-neo w-48 py-1.5 text-[10px]">
               <option value="">指向待拆解剧本...</option>
               {sourceBlocks.map(b => <option key={b.id} value={b.id}>{b.episodes}</option>)}
             </select>
             <select value={refFileId} onChange={e => setRefFileId(e.target.value)} className="input-neo w-48 py-1.5 text-[10px] border-white/10 opacity-60">
               <option value="">分镜风格参考文件...</option>
               {files.filter(f => f.category === Category.REFERENCE || f.category === Category.CHARACTER).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
             </select>
          </div>
          <button 
            disabled={isGeneratingList || !selectedBlockId} 
            onClick={handleGenerateShots} 
            className="bg-[#2062ee] hover:bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-blue-900/40"
          >
            {isGeneratingList ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Play}
            启动自动化拆解
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
            <div className="flex justify-end gap-4 px-4">
               <button onClick={handleBatchGeneratePreviews} disabled={isBatchProcessing} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                 {ICONS.Image} 一键批量渲染样图
               </button>
               <button onClick={handleExportCSV} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                 {ICONS.FileDown} 导出 CSV
               </button>
               <button onClick={handleExportJSON} className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                 {ICONS.Layers} 导出 JSON
               </button>
            </div>

            {parsedShots.map((shot, idx) => (
              <div key={idx} className="card-neo overflow-hidden border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all animate-fade-up">
                <div className="grid grid-cols-12">
                  <div className="col-span-1 border-r border-white/5 p-6 flex flex-col items-center justify-center bg-white/[0.02]">
                    <div className="text-4xl font-black italic text-[#2062ee]">#{shot.id}</div>
                    <div className="text-[10px] font-black text-white/30 mt-4 flex items-center gap-1 uppercase tracking-widest">
                      {ICONS.Clock} {shot.duration}
                    </div>
                  </div>

                  <div className="col-span-7 p-10 space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-[#2062ee] uppercase tracking-[0.3em] block">镜头技术与运镜 (Technical)</label>
                        <div className="flex flex-wrap gap-2">
                          {shot.technical.split(/[、,，\s\+]/).filter(Boolean).map((t, ti) => (
                            <span key={ti} className={`px-3 py-1 border rounded-lg text-[10px] font-black italic ${
                              t.includes('镜') || t.includes('推') || t.includes('拉') || t.includes('摇')
                              ? 'bg-[#2062ee] border-[#2062ee] text-white' 
                              : 'bg-[#2062ee]/10 border-[#2062ee]/20 text-[#2062ee]'
                            }`}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[9px] font-black text-rose-500 uppercase tracking-[0.3em] block">角色对白 (Audio)</label>
                        <p className="text-sm font-bold text-white italic tracking-tight">“{shot.dialogue}”</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.3em] block">画面详细描述 (Visual Narrative)</label>
                      <p className="text-sm font-medium leading-relaxed italic text-white/90 bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10">
                        {shot.visual}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-blue-400/50 uppercase tracking-[0.3em] block">AI 绘画提示词 (SD Prompt)</label>
                      <div className="bg-blue-600/5 border border-blue-500/10 p-5 rounded-2xl">
                        <p className="text-[10px] font-mono text-blue-300/60 leading-relaxed break-all">
                          {shot.prompt || "Pending generation..."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-4 border-l border-white/5 p-8 bg-black/40 flex flex-col gap-6">
                    <div className="aspect-video bg-slate-950 rounded-[2.5rem] border border-white/10 overflow-hidden relative shadow-2xl group">
                      {shot.videoUrl ? (
                        <video src={shot.videoUrl} autoPlay loop muted className="w-full h-full object-cover" />
                      ) : shot.previewUrl ? (
                        <img src={shot.previewUrl} className="w-full h-full object-cover" alt="shot preview" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 opacity-20">
                           <div className="scale-[2]">{ICONS.Image}</div>
                           <span className="text-[9px] font-black uppercase tracking-[0.3em]">待渲染 16:9 预览</span>
                        </div>
                      )}
                      
                      {shot.isGenerating && (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-10">
                          <div className="flex flex-col items-center gap-4">
                             <div className="w-10 h-10 border-2 border-[#2062ee] border-t-transparent rounded-full animate-spin"></div>
                             <span className="text-[8px] font-black text-[#2062ee] uppercase animate-pulse">Rendering Engine...</span>
                          </div>
                        </div>
                      )}

                      <div className="absolute top-4 right-4 flex gap-2 z-20">
                        {shot.previewUrl && !shot.isGenerating && (
                          <button onClick={() => downloadShotImage(shot)} className="bg-black/60 hover:bg-white text-white hover:text-black p-2.5 rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all shadow-xl">
                            {ICONS.Download}
                          </button>
                        )}
                        {shot.videoUrl && !shot.isGenerating && (
                          <button onClick={() => downloadShotVideo(shot)} className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all shadow-xl">
                            {ICONS.FileDown}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={() => generateShotPreview(shot)} disabled={shot.isGenerating} className="py-4 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white text-[10px] font-black uppercase rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-2">
                         {ICONS.Image} 渲染样图
                       </button>
                       <button onClick={() => generateShotVideo(shot)} disabled={shot.isGenerating || !shot.previewUrl} className={`py-4 text-[10px] font-black uppercase rounded-2xl border transition-all flex items-center justify-center gap-2 ${!shot.previewUrl ? 'opacity-20 cursor-not-allowed' : 'bg-[#2062ee]/10 hover:bg-[#2062ee] text-blue-400 hover:text-white border-[#2062ee]/20'}`}>
                         {ICONS.Play} 生成视频
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="py-24 flex flex-col items-center gap-10">
               <button 
                 onClick={handleSaveToKB} 
                 disabled={saveStatus || (!shotList && !streamingText)} 
                 className={`px-24 py-7 rounded-[3rem] font-black text-sm uppercase shadow-2xl transition-all flex items-center gap-4 active:scale-95 ${
                   saveStatus ? 'bg-emerald-600 text-white shadow-emerald-900/40' : 'bg-[#2062ee] text-white hover:bg-blue-600 shadow-blue-900/40'
                 }`}
               >
                  {saveStatus ? "✓ 全案已成功归档至资料库" : (
                    <>
                      {ICONS.Check} 导出高颗粒分镜报告并入库
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