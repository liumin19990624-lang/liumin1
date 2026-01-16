
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScriptBlock, SceneImage, CharacterAsset } from '../types';
import { ICONS } from '../constants';
import { GeminiService } from '../services/geminiService';

// PCM Audio Decoding Utilities
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

interface CinematicPreviewProps {
  block: ScriptBlock;
  characterAssets: CharacterAsset[];
  onClose: () => void;
}

const CinematicPreview: React.FC<CinematicPreviewProps> = ({ block, characterAssets, onClose }) => {
  const [currentShotIndex, setCurrentShotIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gemini = new GeminiService();

  const shots = useMemo(() => {
    const lines = block.content.split('\n');
    const result: any[] = [];
    let current: any = null;

    lines.forEach(line => {
      if (line.trim().startsWith('[Shot:')) {
        if (current) result.push(current);
        const shotId = line.match(/\[Shot:(.*?)\]/)?.[1] || '';
        const visual = line.split(']').slice(2).join(']').trim();
        const durationStr = line.match(/\[Duration:(.*?)\]/)?.[1] || '3s';
        const duration = parseInt(durationStr) || 3;
        
        current = {
          id: shotId,
          visual,
          duration: duration * 1000,
          audio: [],
          image: block.sceneImages?.find(img => img.shotDescription.includes(visual.substring(0, 15)))?.imageUrl
        };
      } else if (line.trim().startsWith('[角色:') && current) {
        current.audio.push({
          name: line.match(/\[角色:(.*?)\]/)?.[1] || '',
          text: line.split('台词:').slice(1).join('台词:').replace(/\]$/, '').trim()
        });
      }
    });
    if (current) result.push(current);
    return result;
  }, [block]);

  useEffect(() => {
    let timer: any;
    if (isPlaying && currentShotIndex < shots.length) {
      const currentShot = shots[currentShotIndex];
      timer = setTimeout(() => {
        if (currentShotIndex < shots.length - 1) {
          setCurrentShotIndex(prev => prev + 1);
        } else {
          setIsPlaying(false);
        }
      }, currentShot.duration);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentShotIndex, shots]);

  const playAudio = async (name: string, text: string) => {
    try {
      const asset = characterAssets.find(a => a.name === name);
      const audioDataUri = await gemini.generateDialogueAudio(name, text, asset?.voice_id);
      const base64Data = audioDataUri.split('base64,')[1];
      if (!base64Data) return;
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const ctx = audioContextRef.current;
      const audioBuffer = await decodeAudioData(decodeBase64(base64Data), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) {
      console.error("Playback failed", e);
    }
  };

  const currentShot = shots[currentShotIndex];

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-10 animate-in fade-in duration-700">
      <div className="absolute top-10 left-10 flex items-center gap-4">
        <div className="bg-blue-600 p-2 rounded-xl text-white">{ICONS.Video}</div>
        <div>
          <h2 className="text-white text-lg font-black italic tracking-tight">PRE-PRODUCTION PREVIEW</h2>
          <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest">Master Studio Engine v2.5</p>
        </div>
      </div>

      <button onClick={onClose} className="absolute top-10 right-10 text-white/40 hover:text-white transition-colors">
        <div className="scale-150">{ICONS.Trash}</div>
      </button>

      <div className="w-full max-w-6xl aspect-video bg-slate-900 rounded-[3rem] overflow-hidden shadow-[0_0_120px_rgba(59,130,246,0.4)] relative group border border-white/10">
        {currentShot?.image ? (
          <img key={currentShotIndex} src={currentShot.image} className="w-full h-full object-cover animate-in zoom-in-105 fade-in duration-[1500ms]" alt="shot" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 gap-4 bg-[#0a0a0c]">
            <div className="scale-[3] opacity-10">{ICONS.Image}</div>
            <p className="text-xs font-black uppercase tracking-[0.4em] opacity-30">Waiting for Shot Visualization...</p>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>

        <div className="absolute bottom-12 left-12 right-12 space-y-6">
           <div className="flex items-center gap-4">
             <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black font-mono">SHOT #{currentShot?.id}</span>
             <p className="text-white/60 text-sm font-bold italic truncate max-w-2xl">{currentShot?.visual}</p>
           </div>
           
           <div className="space-y-4">
             {currentShot?.audio.map((a: any, i: number) => (
               <div key={i} className="flex items-start gap-4 animate-in slide-in-from-left fade-in duration-500" style={{ animationDelay: `${i * 300}ms` }}>
                 <button onClick={() => playAudio(a.name, a.text)} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-full text-white transition-all active:scale-90 border border-white/5 shadow-xl">
                   {ICONS.Chat}
                 </button>
                 <div>
                   <span className="text-blue-400 text-[10px] font-black uppercase tracking-widest leading-none">{a.name}</span>
                   <p className="text-white text-2xl font-medium tracking-tight mt-1 leading-tight">“{a.text}”</p>
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>

      <div className="mt-12 flex items-center gap-12">
        <button onClick={() => setCurrentShotIndex(Math.max(0, currentShotIndex - 1))} className="text-white/20 hover:text-white transition-all scale-150 active:scale-125">
          {ICONS.ChevronLeft}
        </button>
        <button onClick={() => setIsPlaying(!isPlaying)} className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-2xl ${isPlaying ? 'bg-white text-black scale-110' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
          <div className="scale-150">{isPlaying ? <div className="w-6 h-6 bg-current rounded-sm" /> : ICONS.Play}</div>
        </button>
        <button onClick={() => setCurrentShotIndex(Math.min(shots.length - 1, currentShotIndex + 1))} className="text-white/20 hover:text-white transition-all scale-150 active:scale-125">
          {ICONS.ChevronRight}
        </button>
      </div>

      <div className="mt-14 w-full max-w-4xl px-8 flex justify-center gap-1.5 overflow-x-auto no-scrollbar pb-4">
        {shots.map((shot, i) => (
          <button 
            key={i} 
            onClick={() => { setCurrentShotIndex(i); setIsPlaying(false); }}
            className={`group relative h-16 transition-all rounded-xl border-2 shrink-0 ${i === currentShotIndex ? 'w-28 border-blue-500 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'w-12 border-white/5 bg-white/5 hover:border-white/20 hover:w-16'}`}
          >
            {shot.image ? (
              <img src={shot.image} className="w-full h-full object-cover opacity-60 rounded-lg" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] font-mono text-white/20 font-black">#{shot.id}</div>
            )}
            <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-800 text-white text-[8px] rounded opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap`}>
              Shot {shot.id}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CinematicPreview;
