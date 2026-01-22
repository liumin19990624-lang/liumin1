import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScriptBlock, SceneImage, CharacterAsset, AmbientAtmosphere } from '../types';
import { ICONS } from '../constants';

interface CinematicPreviewProps {
  block: ScriptBlock;
  characterAssets: CharacterAsset[];
  onClose: () => void;
}

const CinematicPreview: React.FC<CinematicPreviewProps> = ({ block, characterAssets, onClose }) => {
  const [currentShotIndex, setCurrentShotIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [atmosphere, setAtmosphere] = useState<AmbientAtmosphere>(AmbientAtmosphere.QUIET);
  const [shotDurations, setShotDurations] = useState<Record<number, number>>({});

  const shots = useMemo(() => {
    const lines = block.content.split('\n');
    const result: any[] = [];
    let current: any = null;

    lines.forEach((line, i) => {
      if (line.trim().startsWith('[Shot:')) {
        if (current) result.push(current);
        const visual = line.split(']').slice(2).join(']').trim();
        const baseDuration = parseInt(line.match(/\[Duration:(.*?)\]/)?.[1] || '3');
        
        current = {
          id: i,
          visual,
          duration: (shotDurations[i] || baseDuration) * 1000,
          audio: [],
          image: block.sceneImages?.find(img => img.shotDescription.includes(visual.substring(0, 10)))?.imageUrl,
          video: block.sceneImages?.find(img => img.shotDescription.includes(visual.substring(0, 10)))?.videoUrl,
        };
      } else if (line.trim().startsWith('[角色:') && current) {
        current.audio.push({
          name: line.match(/\[角色:(.*?)\]/)?.[1],
          text: line.split('台词:').slice(1).join('台词:').replace(/\]$/, '').trim()
        });
      }
    });
    if (current) result.push(current);
    return result;
  }, [block, shotDurations]);

  const totalDuration = useMemo(() => shots.reduce((acc, s) => acc + s.duration, 0) / 1000, [shots]);

  useEffect(() => {
    let timer: any;
    if (isPlaying && currentShotIndex < shots.length) {
      timer = setTimeout(() => {
        if (currentShotIndex < shots.length - 1) {
          setCurrentShotIndex(prev => prev + 1);
        } else {
          setIsPlaying(false);
        }
      }, shots[currentShotIndex].duration);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentShotIndex, shots]);

  const adjustDuration = (idx: number, delta: number) => {
    const shot = shots[idx];
    const currentD = (shotDurations[shot.id] || (shot.duration / 1000));
    setShotDurations(prev => ({ ...prev, [shot.id]: Math.max(1, currentD + delta) }));
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-10 select-none">
      <div className="absolute top-10 left-10 flex items-center gap-6">
        <div className="flex flex-col">
          <h2 className="text-white text-lg font-black italic tracking-tighter uppercase">Cinematic Pre-viz</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-black text-[#2062ee] uppercase tracking-widest">Est. Length: {totalDuration}s</span>
            <div className="w-1 h-1 rounded-full bg-white/20"></div>
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{shots.length} Shots</span>
          </div>
        </div>
      </div>

      <button onClick={onClose} className="absolute top-10 right-10 text-white/40 hover:text-white transition-all bg-white/5 p-4 rounded-full border border-white/10 hover:scale-110 active:scale-90">
        {ICONS.Trash}
      </button>

      <div className="w-full max-w-5xl aspect-video bg-black rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(32,98,238,0.1)] relative border-4 border-white/10">
        {shots[currentShotIndex]?.video ? (
          <video key={currentShotIndex} src={shots[currentShotIndex].video} autoPlay loop muted className="w-full h-full object-cover animate-in fade-in duration-500" />
        ) : shots[currentShotIndex]?.image ? (
          <img key={currentShotIndex} src={shots[currentShotIndex].image} className="w-full h-full object-cover animate-in zoom-in-105 fade-in duration-1000" alt="shot" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/10 text-[10px] font-black uppercase tracking-widest">Rendering Frame...</div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
        <div className="absolute bottom-10 left-10 right-10">
          {shots[currentShotIndex]?.audio.map((a: any, i: number) => (
            <div key={i} className="animate-in slide-in-from-left fade-in duration-500">
               <span className="text-[#2062ee] text-[9px] font-black uppercase tracking-widest block mb-1">{a.name}</span>
               <p className="text-white text-3xl font-medium tracking-tighter italic leading-tight">“{a.text}”</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 flex items-center gap-12">
        <button onClick={() => setCurrentShotIndex(Math.max(0, currentShotIndex - 1))} className="text-white/20 hover:text-white transition-all scale-150">{ICONS.ChevronLeft}</button>
        <button onClick={() => setIsPlaying(!isPlaying)} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${isPlaying ? 'bg-white text-black' : 'bg-[#2062ee] text-white'}`}>
          <div className="scale-[2]">{isPlaying ? <div className="w-4 h-4 bg-current" /> : ICONS.Play}</div>
        </button>
        <button onClick={() => setCurrentShotIndex(Math.min(shots.length - 1, currentShotIndex + 1))} className="text-white/20 hover:text-white transition-all scale-150">{ICONS.ChevronRight}</button>
      </div>

      <div className="mt-12 w-full max-w-5xl bg-white/5 border border-white/10 rounded-3xl p-6 overflow-hidden flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-[9px] font-black text-white/40 uppercase tracking-widest italic">Production Timeline 编辑器</span>
          <div className="flex gap-4">
             <button onClick={() => adjustDuration(currentShotIndex, -0.5)} className="text-white/60 hover:text-[#2062ee] text-[10px] font-black uppercase">缩短镜头 -0.5s</button>
             <button onClick={() => adjustDuration(currentShotIndex, 0.5)} className="text-white/60 hover:text-[#2062ee] text-[10px] font-black uppercase">延长镜头 +0.5s</button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {shots.map((shot, i) => (
            <div 
              key={i} 
              onClick={() => setCurrentShotIndex(i)}
              className={`h-12 rounded-xl transition-all cursor-pointer border flex items-center justify-center text-[10px] font-mono ${i === currentShotIndex ? 'bg-[#2062ee] border-white/20 text-white shadow-lg' : 'bg-white/5 border-white/5 text-white/20'}`}
              style={{ minWidth: `${(shot.duration / 1000) * 15}px`, flexShrink: 0 }}
            >
              {shot.duration / 1000}s
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CinematicPreview;