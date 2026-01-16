
import React, { useState, useEffect, useMemo } from 'react';
import { KBFile, Category, AudienceMode, ScriptBlock, ModelType, CharacterAsset, DirectorStyle, SceneImage } from '../types';
import { ICONS } from '../constants';
import { GeminiService } from '../services/geminiService';
import CinematicPreview from './CinematicPreview';

const MIXER_OPTIONS = [
  { id: 'cyberpunk', label: '赛博霓虹', icon: '🌃' },
  { id: 'vintage', label: '90s赛璐珞', icon: '📺' },
  { id: 'ink', label: '东方水墨', icon: '🖌️' },
  { id: 'dark', label: '克苏鲁压抑', icon: '🌑' },
];

interface ScriptPanelProps {
  files: KBFile[];
  mode: AudienceMode;
  modelType: ModelType;
}

const ScriptPanel: React.FC<ScriptPanelProps> = ({ files, mode, modelType }) => {
  const [sourceId, setSourceId] = useState<string>('');
  const [blocks, setBlocks] = useState<ScriptBlock[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingShot, setIsGeneratingShot] = useState(false);
  const [targetEpisodes, setTargetEpisodes] = useState('1');
  const [characterAssets, setCharacterAssets] = useState<CharacterAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [previewBlockId, setPreviewBlockId] = useState<string | null>(null);
  const [directorStyle, setDirectorStyle] = useState<DirectorStyle>(DirectorStyle.SHINKAI);
  const [styleMixer, setStyleMixer] = useState<string[]>([]);
  
  const gemini = new GeminiService();

  useEffect(() => {
    fetchVisualAssets();
    if (sourceId) {
      fetch(`/api/scripts?sourceId=${sourceId}`).then(res => res.json()).then(data => setBlocks(data));
    }
  }, [sourceId]);

  const fetchVisualAssets = async () => {
    const res = await fetch('/api/visuals');
    if (res.ok) setCharacterAssets(await res.json());
  };

  const metrics = useMemo(() => {
    const shotsCount = blocks.reduce((acc, b) => acc + (b.content.split('\n').filter(l => l.startsWith('[Shot:')).length), 0);
    const imagesCount = blocks.reduce((acc, b) => acc + (b.sceneImages?.length || 0), 0);
    const totalDuration = blocks.reduce((acc, b) => {
      const lineDurations = b.content.split('\n')
        .map(l => parseInt(l.match(/\[Duration:(.*?)\]/)?.[1] || '0'))
        .reduce((sum, d) => sum + d, 0);
      return acc + lineDurations;
    }, 0);
    return { shotsCount, imagesCount, totalDuration, progress: shotsCount ? Math.round((imagesCount / shotsCount) * 100) : 0 };
  }, [blocks]);

  const handleGenerate = async () => {
    if (!sourceId) return;
    setIsGenerating(true);
    try {
      const source = files.find(f => f.id === sourceId);
      const content = await gemini.generateScriptBlock(mode, source?.content || '', blocks, targetEpisodes, modelType, directorStyle);
      const res = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, episodes: targetEpisodes, content, style: directorStyle })
      });
      if (res.ok) {
        const newBlock = await res.json();
        setBlocks(prev => [...prev, newBlock]);
        setTargetEpisodes((parseInt(targetEpisodes) + 1).toString());
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVisualizeShot = async (blockId: string, shotText: string) => {
    setIsGeneratingShot(true);
    try {
      const asset = characterAssets.find(a => a.id === selectedAssetId);
      const imageUrl = await gemini.generateShotImage(shotText, mode, asset?.description, directorStyle, styleMixer);
      const res = await fetch('/api/scripts/keyframes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, shotDescription: shotText, imageUrl })
      });
      if (res.ok) {
        const updated = await res.json();
        setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, sceneImages: updated.sceneImages } : b));
      }
    } finally {
      setIsGeneratingShot(false);
    }
  };

  const handleAnimateShot = async (blockId: string, image: SceneImage) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? {
      ...b,
      sceneImages: b.sceneImages?.map(img => img.id === image.id ? { ...img, isGeneratingVideo: true } : img)
    } : b));

    try {
      const { operationId } = await gemini.generateCinematicVideo(image.imageUrl, image.shotDescription, directorStyle);
      const interval = setInterval(async () => {
        const { done, videoUrl } = await gemini.pollVideoStatus(operationId);
        if (done) {
          clearInterval(interval);
          setBlocks(prev => prev.map(b => b.id === blockId ? {
            ...b,
            sceneImages: b.sceneImages?.map(img => img.id === image.id ? { ...img, videoUrl, isGeneratingVideo: false } : img)
          } : b));
          // 持久化到 DB
          await fetch('/api/scripts/keyframes/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blockId, images: blocks.find(b => b.id === blockId)?.sceneImages })
          });
        }
      }, 5000);
    } catch (e) {
      alert("视频生成失败");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
      {/* 工业级 HUD 面板 */}
      <div className="mx-8 mt-6 p-5 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-10">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">总预计时长</span>
            <span className="text-xl font-mono font-black text-white">{Math.floor(metrics.totalDuration / 60)}m {metrics.totalDuration % 60}s</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">视觉完成度</span>
            <div className="flex items-center gap-3">
              <span className="text-xl font-black text-blue-400">{metrics.progress}%</span>
              <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${metrics.progress}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {MIXER_OPTIONS.map(opt => (
            <button 
              key={opt.id}
              onClick={() => setStyleMixer(prev => prev.includes(opt.id) ? prev.filter(x => x !== opt.id) : [...prev, opt.id])}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border ${styleMixer.includes(opt.id) ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'}`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/50 border-b border-white/5 p-8 flex flex-col gap-6 mt-4">
        <div className="flex items-center gap-6">
          <div className="flex-1 grid grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">改编核心源</label>
              <select value={sourceId} onChange={e => setSourceId(e.target.value)} className="w-full bg-white/5 border border-white/10 text-white rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:border-blue-500/50">
                <option value="" className="bg-slate-900">选择内容源...</option>
                {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id} className="bg-slate-900">{f.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">视听导演风格</label>
              <select value={directorStyle} onChange={e => setDirectorStyle(e.target.value as DirectorStyle)} className="w-full bg-white/5 border border-white/10 text-white rounded-2xl px-4 py-3 text-xs font-bold outline-none">
                {Object.values(DirectorStyle).map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">第 {targetEpisodes} 集改编</label>
              <button disabled={isGenerating || !sourceId} onClick={handleGenerate} className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-3 font-black text-xs uppercase tracking-widest transition-all">
                {isGenerating ? "正在解析时空锚点..." : "立即启动改编引擎"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
        <div className="max-w-6xl mx-auto space-y-20">
          {blocks.map(block => (
            <div key={block.id} className="animate-fade-up">
              <div className="bg-slate-800/40 rounded-[3rem] border border-white/5 p-10 relative overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-600 px-3 py-1 rounded-lg text-[10px] font-black">EPISODE {block.episodes}</span>
                    <span className="text-white/20 text-[10px] font-black uppercase tracking-widest italic">{block.style || directorStyle}</span>
                  </div>
                  <button onClick={() => setPreviewBlockId(block.id)} className="bg-white text-black px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">全剧联播预览</button>
                </div>
                
                <div className="space-y-4 font-mono text-xs text-slate-300 leading-relaxed max-h-96 overflow-y-auto custom-scrollbar pr-4">
                  {block.content.split('\n').map((line, idx) => {
                    const isShot = line.startsWith('[Shot:');
                    return (
                      <div key={idx} className={`p-3 rounded-xl border transition-all ${isShot ? 'bg-blue-500/10 border-blue-500/20 group flex justify-between items-center' : 'bg-white/5 border-white/5'}`}>
                        <span>{line}</span>
                        {isShot && (
                          <button 
                            disabled={isGeneratingShot}
                            onClick={() => handleVisualizeShot(block.id, line.split(']').slice(2).join(']').trim())}
                            className="bg-blue-600 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                          >
                            {isGeneratingShot ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Image}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-10 grid grid-cols-4 gap-6">
                  {block.sceneImages?.map(img => (
                    <div key={img.id} className="group relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/10">
                      {img.videoUrl ? <video src={img.videoUrl} autoPlay loop muted className="w-full h-full object-cover" /> : <img src={img.imageUrl} className="w-full h-full object-cover" />}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3 p-4">
                        <p className="text-[8px] font-bold text-white text-center italic line-clamp-2">{img.shotDescription}</p>
                        <button 
                          disabled={img.isGeneratingVideo || !!img.videoUrl}
                          onClick={() => handleAnimateShot(block.id, img)}
                          className="w-full bg-white text-black py-2 rounded-lg text-[8px] font-black uppercase tracking-widest"
                        >
                          {img.isGeneratingVideo ? 'Rendering...' : img.videoUrl ? 'Cinematic Ready' : 'AI Animate (Veo)'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {previewBlockId && (
        <CinematicPreview 
          block={blocks.find(b => b.id === previewBlockId)!} 
          characterAssets={characterAssets} 
          onClose={() => setPreviewBlockId(null)}
        />
      )}
    </div>
  );
};

export default ScriptPanel;
