
import React, { useState, useMemo, useEffect } from 'react';
import { ICONS } from '../constants.tsx';
import { ScriptBlock, KBFile, Category, ModelType, SceneImage } from '../types.ts';
import { GeminiService } from '../services/geminiService.ts';

interface ShotEntry {
  id: string;
  duration: string;
  technical: string;
  visual: string;
  dialogue: string;
  prompt: string;
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
  const [expandedShot, setExpandedShot] = useState<string | null>(null);
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
      alert("分镜生成中断");
    } finally {
      setIsGeneratingList(false);
    }
  };

  const parsedShots = useMemo((): ShotEntry[] => {
    const content = streamingText || shotList;
    if (!content) return [];
    
    return content.split('\n')
      .map(line => line.trim())
      .filter(line => line.includes('|') && !line.includes('镜号') && !line.includes('---'))
      .map(line => {
        const parts = line.split('|').map(s => s.trim());
        const id = parts[0] || '?';
        return { 
          id, 
          duration: parts[1] || '3s', 
          technical: parts[2] || '常规镜头', 
          visual: parts[3] || '画面描述缺失', 
          dialogue: parts[4] || '（无）',
          prompt: parts[5] || '',
          ...renderedShots[id]
        };
      });
  }, [streamingText, shotList, renderedShots]);

  const generateShotPreview = async (shot: ShotEntry) => {
    setRenderedShots(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], isGenerating: true } }));
    try {
      const img = await gemini.generateShotImage(shot.visual, shot.technical);
      setRenderedShots(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], previewUrl: img, isGenerating: false } }));
    } catch (e) {
      setRenderedShots(prev => ({ ...prev, [shot.id]: { ...prev[shot.id], isGenerating: false } }));
    }
  };

  const generateShotVideo = async (shot: ShotEntry) => {
    if (!shot.previewUrl) {
      alert("请先生成样图，视频生成需要起始帧图片。");
      return;
    }
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
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[分镜] ${block?.episodes || '未命名'}`,
      category: Category.REFERENCE,
      content: finalContent,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB(newFile);
    setSaveStatus(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#020203] overflow-hidden text-slate-300">
      <div className="h-28 px-10 border-b border-white/5 flex items-center justify-between bg-black/60 backdrop-blur-3xl shrink-0">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic mb-1">Cine-Industrial Workflow</span>
          <h2 className="text-2xl font-black text-white italic tracking-tighter">工业分镜实验室</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-widest">选择剧本单元</span>
            <select value={selectedBlockId} onChange={e => setSelectedBlockId(e.target.value)} className="bg-slate-900 border border-white/10 text-white rounded-xl px-4 py-3 text-xs font-bold outline-none w-64">
              <option value="">指向待拆解剧本单元...</option>
              {sourceBlocks.map(b => <option key={b.id} value={b.id}>{b.episodes}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black text-violet-400 uppercase ml-2 tracking-widest">风格参考资料 (可选)</span>
            <select value={refFileId} onChange={e => setRefFileId(e.target.value)} className="bg-slate-900 border border-violet-500/20 text-violet-400 rounded-xl px-4 py-3 text-xs font-bold outline-none w-64">
              <option value="">选择分镜风格参考...</option>
              {files.filter(f => f.category === Category.REFERENCE).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <button disabled={isGeneratingList || !selectedBlockId} onClick={handleGenerateShots} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-3 transition-all active:scale-95 shadow-lg mt-4">
            {isGeneratingList ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Play}
            开始拆解
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
        {!shotList && !streamingText ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 gap-4">
            <div className="scale-[3]">{ICONS.Camera}</div>
            <p className="text-xs font-black uppercase tracking-widest">请在上方选择单元以生成分镜表</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-6">
            {parsedShots.map((shot, idx) => (
              <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden group hover:border-white/10 transition-all">
                <div className="grid grid-cols-12 gap-6 p-8">
                  <div className="col-span-1">
                    <div className="text-2xl font-black italic text-blue-500/40">#{shot.id}</div>
                    <div className="text-[10px] font-black text-slate-500 mt-2">{shot.duration}</div>
                  </div>
                  <div className="col-span-3">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {shot.technical.split('、').map((t, ti) => (
                        <span key={ti} className="px-2 py-1 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-[9px] font-black rounded italic uppercase">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-4">
                    <p className="text-sm font-medium leading-relaxed italic text-white/90">{shot.visual}</p>
                    <div className="mt-4 p-4 bg-black/40 rounded-2xl border border-white/5">
                      <p className="text-xs text-slate-400 font-sans italic">{shot.dialogue}</p>
                    </div>
                  </div>
                  <div className="col-span-4 flex flex-col gap-3">
                    <div className="aspect-video bg-black/60 rounded-2xl border border-white/10 overflow-hidden relative group/frame">
                      {shot.videoUrl ? (
                        <video src={shot.videoUrl} autoPlay loop muted className="w-full h-full object-cover" />
                      ) : shot.previewUrl ? (
                        <img src={shot.previewUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] font-black uppercase tracking-widest text-slate-700">Frame Not Rendered</div>
                      )}
                      {shot.isGenerating && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
                          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => generateShotPreview(shot)} disabled={shot.isGenerating} className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase rounded-xl border border-white/5 transition-all">渲染样图</button>
                       <button onClick={() => generateShotVideo(shot)} disabled={shot.isGenerating || !shot.previewUrl} className="flex-1 py-2 bg-blue-600/10 hover:bg-blue-600 text-[9px] font-black uppercase rounded-xl border border-blue-600/20 transition-all">生成 3S 动态</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="py-20 flex justify-center gap-6">
               <button onClick={handleGenerateShots} disabled={isGeneratingList} className="px-12 py-4 rounded-3xl font-black text-xs uppercase shadow-xl transition-all bg-rose-600/10 text-rose-500 border border-rose-500/20 hover:bg-rose-600/20">
                  不满意重新生成
               </button>
               <button onClick={handleSaveToKB} disabled={saveStatus} className={`px-12 py-4 rounded-3xl font-black text-xs uppercase shadow-2xl transition-all ${saveStatus ? 'bg-emerald-600 text-white' : 'bg-white text-black hover:bg-blue-600 hover:text-white'}`}>
                  {saveStatus ? "✓ 已存入影视库" : "保存全案分镜表"}
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShotsPanel;
