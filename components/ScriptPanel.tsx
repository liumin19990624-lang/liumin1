import React, { useState, useEffect, useMemo, useRef } from 'react';
import { KBFile, Category, AudienceMode, ScriptBlock, ModelType, CharacterAsset } from '../types';
import { ICONS } from '../constants';
import { GeminiService } from '../services/geminiService';
import CinematicPreview from './CinematicPreview';

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

const REWRITE_STYLES = [
  { id: 'epic', label: '史诗质感', color: 'bg-amber-500' },
  { id: 'villain', label: '反派冷酷', color: 'bg-slate-900' },
  { id: 'emotional', label: '情感爆发', color: 'bg-rose-500' },
  { id: 'chuunibyou', label: '中二觉醒', color: 'bg-indigo-600' },
];

interface ScriptViewerProps {
  blockId: string;
  content: string;
  onVisualizeShot: (shot: string) => void;
  onUpdateContent: (newContent: string) => void;
  isGeneratingShot: boolean;
  characterAssets: CharacterAsset[];
  onOpenPreview: () => void;
}

const ScriptViewer: React.FC<ScriptViewerProps> = ({ blockId, content, onVisualizeShot, onUpdateContent, isGeneratingShot, characterAssets, onOpenPreview }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const [playingLine, setPlayingLine] = useState<number | null>(null);
  const [activeRewriteIdx, setActiveRewriteIdx] = useState<number | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  
  const gemini = new GeminiService();
  const audioContextRef = useRef<AudioContext | null>(null);

  const { scriptGroups, directorNote } = useMemo(() => {
    const lines = content.split('\n');
    const groups: any[] = [];
    let currentGroup: any = null;
    let note = "";
    let isNoteMode = false;

    lines.forEach(line => {
      const cleaned = line.trim();
      if (!cleaned) return;
      if (cleaned.startsWith('[DirectorNote]')) { isNoteMode = true; return; }
      if (isNoteMode) { note += cleaned + " "; return; }

      if (cleaned.startsWith('第') && cleaned.includes('集')) {
        groups.push({ type: 'HEADING', text: cleaned });
      } else if (cleaned.startsWith('[Shot:')) {
        currentGroup = {
          type: 'SHOT',
          id: cleaned.match(/\[Shot:(.*?)\]/)?.[1] || '---',
          duration: cleaned.match(/\[Duration:(.*?)\]/)?.[1] || '2s',
          visual: cleaned.split(']').slice(2).join(']').trim(),
          audio: [],
          bgm: null
        };
        groups.push(currentGroup);
      } else if (cleaned.startsWith('[BGM:')) {
        if (currentGroup) currentGroup.bgm = cleaned.replace('[BGM:', '').replace(']', '');
      } else if (cleaned.startsWith('[角色:') || cleaned.startsWith('[音效:')) {
        if (currentGroup) currentGroup.audio.push(cleaned);
      }
    });
    return { scriptGroups: groups, directorNote: note };
  }, [content]);

  const handlePlayAudio = async (charName: string, text: string, idx: number) => {
    if (playingLine !== null) return;
    setPlayingLine(idx);
    try {
      const asset = characterAssets.find(a => a.name === charName);
      const audioDataUri = await gemini.generateDialogueAudio(charName, text, asset?.voice_id);
      const base64Data = audioDataUri.split('base64,')[1];
      if (!base64Data) return;
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const ctx = audioContextRef.current;
      const audioBuffer = await decodeAudioData(decodeBase64(base64Data), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setPlayingLine(null);
      source.start();
    } catch (e) {
      console.error(e);
      setPlayingLine(null);
    }
  };

  const handleRewrite = async (charName: string, originalText: string, styleLabel: string, idxInContent: number) => {
    setIsRewriting(true);
    try {
      const newText = await gemini.rewriteDialogue(charName, originalText, styleLabel);
      const lines = content.split('\n');
      // 精确替换逻辑
      const escapedText = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\[角色:${charName}\\]\\[台词:${escapedText}\\]`);
      const newLines = lines.map(line => line.replace(regex, `[角色:${charName}][台词:${newText}]`));
      onUpdateContent(newLines.join('\n'));
    } catch (e) {
      alert("对白重写失败");
    } finally {
      setIsRewriting(false);
      setActiveRewriteIdx(null);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-full h-[500px] p-8 font-mono text-sm bg-slate-900 text-slate-300 border border-white/10 rounded-3xl outline-none"
        />
        <div className="flex justify-end gap-3">
          <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-slate-500 font-bold text-xs uppercase">Cancel</button>
          <button onClick={() => { onUpdateContent(editValue); setIsEditing(false); }} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg">Save Script</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        {directorNote ? (
          <div className="flex-1 bg-amber-50 border border-amber-100 p-6 rounded-3xl flex gap-4 items-start">
            <div className="bg-amber-500 text-white p-2 rounded-xl">{ICONS.Sparkles}</div>
            <p className="text-amber-800/80 text-sm italic font-medium leading-relaxed">{directorNote}</p>
          </div>
        ) : <div className="flex-1" />}
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsEditing(true)}
            className="p-4 bg-white border border-slate-200 text-slate-500 rounded-3xl hover:bg-slate-50 transition-all shadow-sm"
          >
            {ICONS.Refine}
          </button>
          <button 
            onClick={onOpenPreview}
            className="bg-slate-900 text-white px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center gap-3 hover:scale-105 transition-all shadow-xl"
          >
            {ICONS.Play} 视听导演预览
          </button>
        </div>
      </div>

      <div className="relative group/viewer">
        <div className="space-y-1">
          {scriptGroups.map((group, idx) => {
            if (group.type === 'HEADING') {
              return (
                <div key={idx} className="mt-12 mb-6 bg-slate-900 text-white px-8 py-4 rounded-3xl flex items-center justify-between border-l-8 border-blue-600">
                  <h3 className="text-xl font-black italic uppercase tracking-tight">{group.text}</h3>
                  <span className="text-[10px] font-mono opacity-30">EPISODE_SEQ_CONFIRMED</span>
                </div>
              );
            }

            if (group.type === 'SHOT') {
              return (
                <div key={idx} className="grid grid-cols-12 gap-0 border-b border-slate-100 group/row">
                  <div className="col-span-2 py-8 pr-6 border-r border-slate-100 flex flex-col items-end gap-2">
                    <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-[10px] font-mono">#{group.id}</span>
                    <span className="text-slate-400 text-[10px] font-black uppercase flex items-center gap-1">{ICONS.Clock} {group.duration}</span>
                  </div>

                  <div className="col-span-5 p-8 border-r border-slate-100 relative group/v">
                    <p className="text-slate-800 text-sm font-bold leading-relaxed">{group.visual}</p>
                    <button 
                      onClick={() => onVisualizeShot(group.visual)}
                      disabled={isGeneratingShot}
                      className="absolute bottom-6 right-6 p-2.5 bg-blue-50 text-blue-600 rounded-xl opacity-0 group-hover/v:opacity-100 hover:bg-blue-600 hover:text-white transition-all shadow-md"
                    >
                      {isGeneratingShot ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Image}
                    </button>
                  </div>

                  <div className="col-span-5 p-8 bg-slate-50/30">
                    <div className="space-y-4">
                      {group.audio.map((a: string, aidx: number) => {
                        const globalIdx = aidx + idx * 100;
                        if (a.startsWith('[角色:')) {
                          const name = a.match(/\[角色:(.*?)\]/)?.[1] || '---';
                          const text = a.split('台词:').slice(1).join('台词:').replace(/\]$/, '').trim();
                          return (
                            <div key={aidx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group/audio overflow-visible">
                              <span className="inline-block px-1.5 py-0.5 bg-slate-800 text-white rounded text-[8px] font-black mb-1.5">{name}</span>
                              <p className="text-slate-800 text-sm font-medium italic leading-relaxed">“{text}”</p>
                              
                              <div className="absolute top-2 right-2 flex gap-1">
                                <button 
                                  onClick={() => setActiveRewriteIdx(activeRewriteIdx === globalIdx ? null : globalIdx)}
                                  className="p-1.5 text-slate-300 hover:text-indigo-600 transition-all"
                                >
                                  {ICONS.Refine}
                                </button>
                                <button 
                                  onClick={() => handlePlayAudio(name, text, globalIdx)}
                                  className={`p-1.5 rounded-full transition-all ${playingLine === globalIdx ? 'bg-blue-600 text-white' : 'text-slate-200 hover:text-blue-600 hover:bg-blue-50'}`}
                                >
                                  {ICONS.Chat}
                                </button>
                              </div>

                              {activeRewriteIdx === globalIdx && (
                                <div className="absolute left-0 -bottom-14 w-full bg-slate-900 p-2 rounded-xl shadow-2xl z-20 flex gap-2 animate-in fade-in slide-in-from-top-2">
                                  {REWRITE_STYLES.map(style => (
                                    <button
                                      key={style.id}
                                      disabled={isRewriting}
                                      onClick={() => handleRewrite(name, text, style.label, globalIdx)}
                                      className={`flex-1 text-[9px] font-black text-white px-2 py-1.5 rounded-lg hover:opacity-80 transition-all ${style.color}`}
                                    >
                                      {isRewriting ? '...' : style.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return <p key={aidx} className="text-blue-500 text-[10px] font-bold px-2 italic">SFX: {a.replace('[音效:', '').replace(']', '')}</p>;
                      })}
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
};

const ScriptPanel: React.FC<{ files: KBFile[], mode: AudienceMode, modelType: ModelType }> = ({ files, mode, modelType }) => {
  const [sourceId, setSourceId] = useState<string>('');
  const [lockedLoreIds, setLockedLoreIds] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<ScriptBlock[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingShot, setIsGeneratingShot] = useState(false);
  const [targetEpisodes, setTargetEpisodes] = useState('1');
  const [characterAssets, setCharacterAssets] = useState<CharacterAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [previewBlockId, setPreviewBlockId] = useState<string | null>(null);
  
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

  const handleUpdateScript = async (blockId: string, newContent: string) => {
    const res = await fetch('/api/scripts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: blockId, content: newContent })
    });
    if (res.ok) setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, content: newContent } : b));
  };

  const handleGenerate = async () => {
    if (!sourceId) return alert("请先选择创作来源");
    setIsGenerating(true);
    try {
      const source = files.find(f => f.id === sourceId);
      const loreDocs = files.filter(f => lockedLoreIds.includes(f.id)).map(f => f.content);
      const content = await gemini.generateScriptBlock(mode, source?.content || '', '', blocks, targetEpisodes, modelType, loreDocs);
      
      const res = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, episodes: targetEpisodes, content })
      });
      // Fix: Await the response body before updating state, as await is not allowed in state setter callbacks.
      if (res.ok) {
        const newBlock = await res.json();
        setBlocks(prev => [...prev, newBlock]);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVisualizeShot = async (blockId: string, shotText: string) => {
    setIsGeneratingShot(true);
    try {
      const asset = characterAssets.find(a => a.id === selectedAssetId);
      const imageUrl = await gemini.generateShotImage(shotText, mode, asset?.description);
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

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {previewBlockId && (
        <CinematicPreview 
          block={blocks.find(b => b.id === previewBlockId)!} 
          characterAssets={characterAssets} 
          onClose={() => setPreviewBlockId(null)}
        />
      )}

      <div className="bg-slate-900 border-b border-white/5 p-5 flex flex-col gap-4 shadow-2xl z-40">
        <div className="flex items-center gap-6">
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">改编资料源 (章节内容)</label>
              <select 
                value={sourceId} onChange={e => setSourceId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2 text-xs font-bold outline-none"
              >
                <option value="" className="bg-slate-900">请选择小说内容...</option>
                {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id} className="bg-slate-900">{f.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">画面参考资产</label>
              <select 
                value={selectedAssetId} onChange={e => setSelectedAssetId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-2 text-xs font-bold outline-none"
              >
                <option value="" className="bg-slate-900">未指定参考立绘...</option>
                {characterAssets.map(a => <option key={a.id} value={a.id} className="bg-slate-900">{a.name}</option>)}
              </select>
            </div>
          </div>
          <button 
            disabled={isGenerating || !sourceId} onClick={handleGenerate}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-8 py-3 font-black text-xs uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all active:scale-95"
          >
            {isGenerating ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Play}
            {isGenerating ? 'AI 正在推理中' : '开始剧本创作'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
        <div className="max-w-6xl mx-auto py-16 px-8 space-y-24 pb-40">
          {blocks.map(block => (
            <div key={block.id} className="space-y-10 animate-fade-up">
              <div className="bg-white rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden">
                <div className="p-10 lg:p-16">
                  <ScriptViewer 
                    blockId={block.id}
                    content={block.content} 
                    onVisualizeShot={(shot) => handleVisualizeShot(block.id!, shot)}
                    onUpdateContent={(val) => handleUpdateScript(block.id, val)} 
                    isGeneratingShot={isGeneratingShot}
                    characterAssets={characterAssets}
                    onOpenPreview={() => setPreviewBlockId(block.id!)}
                  />
                </div>
              </div>

              {block.sceneImages && block.sceneImages.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4">
                  {block.sceneImages.map(img => (
                    <div key={img.id} className="group relative aspect-video bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white hover:border-blue-100 transition-all">
                      <img src={img.imageUrl} alt="shot" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent p-6 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                         <p className="text-white text-[11px] font-medium line-clamp-2">{img.shotDescription}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScriptPanel;