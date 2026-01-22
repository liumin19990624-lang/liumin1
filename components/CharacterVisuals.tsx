import React, { useState, useEffect, useMemo } from 'react';
import { AudienceMode, CharacterAsset, KBFile, Category } from '../types';
import { ICONS, CHARACTER_TAGS } from '../constants';
import { GeminiService } from '../services/geminiService';

interface TimelineEntry {
  stage: string;
  visual: string;
  event: string;
  style: string;
}

const CharacterVisuals: React.FC<{ mode: AudienceMode, files: KBFile[], onSaveToKB?: (f: KBFile) => void }> = ({ mode, files, onSaveToKB }) => {
  const [activeSubTab, setActiveSubTab] = useState<'VISUAL' | 'LAB'>('VISUAL');
  const [cards, setCards] = useState<(CharacterAsset & { is_regenerating?: boolean })[]>([]);
  const [inputName, setInputName] = useState('');
  const [inputDesc, setInputDesc] = useState('');
  const [refFileId, setRefFileId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('2D Anime');
  
  const [labResult, setLabResult] = useState('');
  const [labStreaming, setLabStreaming] = useState('');
  const [isEditingLab, setIsEditingLab] = useState(false);
  const [editedLabResult, setEditedLabResult] = useState('');
  
  const [labFileId, setLabFileId] = useState('');
  const [labRefId, setLabRefId] = useState('');
  const [isLabLoading, setIsLabLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(false);

  const gemini = useMemo(() => new GeminiService(), []);

  useEffect(() => {
    const saved = localStorage.getItem('character_assets');
    if (saved) setCards(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const toSave = cards.map(({ is_regenerating, ...rest }) => rest);
    localStorage.setItem('character_assets', JSON.stringify(toSave));
  }, [cards]);

  const generateVisual = async () => {
    if (isGenerating || !inputName) return;
    setIsGenerating(true);
    try {
      let finalPrompt = `${selectedStyle} Style, ${inputName}: ${inputDesc}`;
      if (refFileId) {
        const refFile = files.find(f => f.id === refFileId);
        if (refFile) finalPrompt = `Ref Context: ${refFile.content.substring(0, 1500)}. Style: ${selectedStyle}. Name: ${inputName}. Visual Details: ${inputDesc}`;
      }
      const imageUrl = await gemini.generateCharacterImage(finalPrompt, mode);
      const newCard: CharacterAsset = {
        id: Math.random().toString(36).substr(2, 9),
        name: inputName || "未知角色",
        description: inputDesc || (refFileId ? "基于资料库引用生成" : "手动设定产出"),
        image_url: imageUrl,
        voice_id: 'Kore'
      };
      setCards(prev => [newCard, ...prev]);
      setInputName(''); 
      setInputDesc(''); 
      setRefFileId('');
    } finally { setIsGenerating(false); }
  };

  const handleRegenerate = async (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.is_regenerating) return;
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, is_regenerating: true } : c));
    try {
      const prompt = `Refined anime character art. Original Name: ${card.name}. Description: ${card.description}`;
      const newImageUrl = await gemini.generateCharacterImage(prompt, mode);
      if (newImageUrl) {
        setCards(prev => prev.map(c => c.id === cardId ? { ...c, image_url: newImageUrl, is_regenerating: false } : c));
      }
    } catch (e) {
      alert("重绘失败");
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, is_regenerating: false } : c));
    }
  };

  const toggleTag = (tag: string) => {
    if (inputDesc.includes(tag)) {
      setInputDesc(prev => prev.replace(new RegExp(tag + '[,，\\s]*'), '').trim());
    } else {
      setInputDesc(prev => (prev ? `${prev}，${tag}` : tag));
    }
  };

  const startLabWork = async () => {
    setIsLabLoading(true);
    setLabResult('');
    setLabStreaming('');
    setIsEditingLab(false);
    setSaveStatus(false);
    let full = '';
    try {
      const sourceFile = files.find(f => f.id === labFileId);
      const refFile = files.find(f => f.id === labRefId);
      
      const stream = gemini.generateCharacterBioStream(
            inputName || "深度逻辑建模", 
            inputDesc, 
            sourceFile?.content || '',
            refFile?.content || ''
          );
        
      for await (const chunk of stream) {
        full += chunk;
        setLabStreaming(full);
      }
      const cleaned = GeminiService.cleanText(full);
      setLabResult(cleaned);
      setEditedLabResult(cleaned);
      setLabStreaming('');
    } catch (e) {
      alert("生成失败，请重试");
    } finally { setIsLabLoading(false); }
  };

  const parsedTimeline = useMemo((): TimelineEntry[] => {
    const text = labStreaming || labResult;
    if (!text) return [];
    
    // 解析 [阶段名]: [描述] | [事件] | [风格] 格式
    const lines = text.split('\n').filter(l => l.includes('|') && l.includes(':'));
    return lines.map(line => {
      const [header, ...rest] = line.split(':');
      const parts = rest.join(':').split('|').map(s => s.trim());
      return {
        stage: header.trim().replace(/^\[|\]$/g, ''),
        visual: parts[0] || '',
        event: parts[1] || '',
        style: parts[2] || ''
      };
    }).filter(t => t.stage && t.event);
  }, [labStreaming, labResult]);

  const handleSaveLabResultToKB = () => {
    const finalContent = isEditingLab ? editedLabResult : labResult;
    if (!finalContent) return;
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[小传] ${inputName || '匿名角色'} - ${new Date().toLocaleTimeString()}`,
      category: Category.CHARACTER,
      content: finalContent,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB?.(newFile);
    setSaveStatus(true);
    setIsEditingLab(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#000000]">
      <div className="h-16 glass-dark flex px-10 items-center gap-10 border-b border-white/10 shrink-0 z-10">
        <button onClick={() => setActiveSubTab('VISUAL')} className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 h-full border-b-2 transition-all ${activeSubTab === 'VISUAL' ? 'border-[#2062ee] text-white' : 'border-transparent text-white/40 hover:text-white'}`}>
          视觉渲染实验室
        </button>
        <button onClick={() => setActiveSubTab('LAB')} className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 h-full border-b-2 transition-all ${activeSubTab === 'LAB' ? 'border-[#2062ee] text-white' : 'border-transparent text-white/40 hover:text-white'}`}>
          角色小传与分镜时间轴
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
        <div className="max-w-6xl mx-auto pb-20">
          {activeSubTab === 'VISUAL' ? (
            <div className="space-y-12">
              <div className="card-neo p-10 space-y-8 shadow-2xl animate-fade-up relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#2062ee]/10 blur-[80px] rounded-full -mr-32 -mt-32"></div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/70 uppercase ml-2 tracking-widest">角色姓名</label>
                    <input value={inputName} onChange={e => setInputName(e.target.value)} placeholder="例：赛博剑客·零" className="input-neo w-full placeholder:text-white/20" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-[#2062ee] uppercase ml-2 tracking-widest">参考资料 (人物模板)</label>
                    <select value={refFileId} onChange={e => setRefFileId(e.target.value)} className="input-neo w-full appearance-none cursor-pointer">
                      <option value="">指向参考人设资料...</option>
                      {files.filter(f => f.category === Category.CHARACTER).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/70 uppercase ml-2 tracking-widest">渲染风格模式</label>
                    <select value={selectedStyle} onChange={e => setSelectedStyle(e.target.value)} className="input-neo w-full appearance-none cursor-pointer">
                      <option value="2D Anime">2D Anime (经典)</option>
                      <option value="3D Cartoon">3D 卡通渲染</option>
                      <option value="Ink Style">水墨国风</option>
                      <option value="Cyberpunk">极致赛博</option>
                      <option value="Realism">写实厚涂</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-white/60 uppercase tracking-widest">视觉细节增强</label>
                    <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest italic">Industrial Presets</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {CHARACTER_TAGS.map(tag => (
                      <button 
                        key={tag} 
                        onClick={() => toggleTag(tag)}
                        className={`px-4 py-2 rounded-full text-[10px] font-bold border transition-all ${
                          inputDesc.includes(tag) 
                          ? 'bg-[#2062ee] border-[#2062ee] text-white shadow-[0_0_20px_rgba(32,98,238,0.5)]' 
                          : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <textarea 
                    value={inputDesc} 
                    onChange={e => setInputDesc(e.target.value)} 
                    placeholder="描述更多视觉细节，如：异色瞳、特殊的武器、服装材质..." 
                    className="input-neo w-full h-32 leading-relaxed resize-none placeholder:text-white/20" 
                  />
                </div>

                <button 
                  disabled={isGenerating || !inputName} 
                  onClick={generateVisual} 
                  className={`w-full py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-4 active:scale-[0.98] ${
                    isGenerating ? 'bg-slate-800 text-white/30' : (inputName ? 'bg-[#2062ee] hover:bg-blue-600 text-white shadow-blue-900/40' : 'bg-slate-800 text-white/20')
                  }`}
                >
                  {isGenerating ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Sparkles}
                  {isGenerating ? "正在解析视觉神经元..." : (inputName ? "渲染高清动漫立绘" : "请输入角色姓名")}
                </button>
              </div>

              {cards.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {cards.map(card => (
                    <div key={card.id} className="card-neo p-2 group relative overflow-hidden animate-fade-up">
                      <div className="absolute top-6 right-6 z-20 flex gap-2">
                        <button onClick={() => handleRegenerate(card.id)} disabled={card.is_regenerating} className="bg-black/80 hover:bg-[#2062ee] text-white p-3 rounded-2xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all border border-white/20 shadow-2xl">
                          {ICONS.Refresh}
                        </button>
                        <button onClick={() => setCards(prev => prev.filter(c => c.id !== card.id))} className="bg-black/80 hover:bg-rose-600 text-white p-3 rounded-2xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all border border-white/20 shadow-2xl">
                          {ICONS.Trash}
                        </button>
                      </div>
                      <div className="aspect-[3/4] rounded-[2.5rem] overflow-hidden bg-slate-950 relative shadow-inner">
                        <img 
                          src={card.image_url} 
                          className={`w-full h-full object-cover transition-all duration-1000 ${card.is_regenerating ? 'blur-2xl scale-110 opacity-30' : 'group-hover:scale-105'}`} 
                        />
                        {card.is_regenerating && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 border-2 border-[#2062ee] border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(32,98,238,0.5)]"></div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
                      </div>
                      <div className="p-8">
                        <div className="flex items-center justify-between mb-3">
                           <h3 className="text-xl font-black text-white italic truncate tracking-tight">{card.name}</h3>
                           <span className="text-[9px] font-black text-blue-300 uppercase tracking-tighter border border-blue-400/30 px-2 py-0.5 rounded-full">HQ RENDER</span>
                        </div>
                        <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed italic font-medium">{card.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-12 animate-fade-up">
              <div className="card-neo p-10 space-y-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-80 h-80 bg-[#2062ee]/10 blur-[100px] rounded-full -ml-40 -mt-40"></div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                   <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/70 uppercase ml-2 tracking-widest">角色姓名</label>
                    <input value={inputName} onChange={e => setInputName(e.target.value)} placeholder="角色全称..." className="input-neo w-full placeholder:text-white/20" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-white/70 uppercase ml-2 tracking-widest">原著背景资料</label>
                    <select value={labFileId} onChange={e => setLabFileId(e.target.value)} className="input-neo w-full appearance-none cursor-pointer">
                       <option value="">指向小说内容...</option>
                       {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-[#2062ee] uppercase ml-2 tracking-widest">参考小传格式 (对标)</label>
                    <select value={labRefId} onChange={e => setLabRefId(e.target.value)} className="input-neo w-full appearance-none cursor-pointer border-[#2062ee]/30">
                       <option value="">指向参考小传...</option>
                       {files.filter(f => f.category === Category.CHARACTER).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-3 relative z-10">
                  <label className="text-[10px] font-black text-white/70 uppercase ml-2 tracking-widest">额外特征设定</label>
                  <textarea value={inputDesc} onChange={e => setInputDesc(e.target.value)} placeholder="补充任何关于性格、秘密动机、特殊道具的细节..." className="input-neo w-full h-32 leading-relaxed resize-none placeholder:text-white/20" />
                </div>
                <button 
                  disabled={isLabLoading} 
                  onClick={startLabWork} 
                  className={`w-full py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-4 ${
                    isLabLoading ? 'bg-slate-800 text-white/30' : 'bg-[#2062ee] hover:bg-blue-600 text-white shadow-blue-900/40'
                  }`}
                >
                  {isLabLoading ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Brain}
                  {isLabLoading ? "正在重构角色灵魂..." : "启动深度建模与生平分镜生成"}
                </button>
              </div>

              {(labResult || labStreaming) && (
                <div className="grid grid-cols-12 gap-10 animate-fade-up">
                  {/* 小传文本内容 */}
                  <div className={`card-neo overflow-hidden flex flex-col shadow-2xl transition-all duration-500 ${parsedTimeline.length > 0 ? 'col-span-8' : 'col-span-12'}`}>
                    <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                      <div className="flex items-center gap-4">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#2062ee] animate-pulse"></div>
                        <span className="text-[11px] font-black text-white uppercase tracking-[0.25em]">Character Deep Bio</span>
                      </div>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => {
                            if (!isEditingLab) setEditedLabResult(labResult);
                            setIsEditingLab(!isEditingLab);
                          }} 
                          className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all border ${
                            isEditingLab ? 'bg-amber-600/20 border-amber-500/40 text-amber-500' : 'bg-white/5 border-white/10 text-white'
                          }`}
                        >
                          {isEditingLab ? "取消" : "编辑内容"}
                        </button>
                        <button 
                          onClick={handleSaveLabResultToKB} 
                          disabled={saveStatus || !!labStreaming} 
                          className={`px-10 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-2xl transition-all ${
                            saveStatus ? 'bg-emerald-600 text-white' : 'bg-[#2062ee] text-white hover:bg-blue-600 shadow-blue-900/40'
                          }`}
                        >
                          {saveStatus ? "✓ 已存入库" : "存入资料库"}
                        </button>
                      </div>
                    </div>
                    <div className="p-16 whitespace-pre-wrap font-sans text-white/90 leading-[2.2] text-lg font-medium italic tracking-wide h-[750px] overflow-y-auto custom-scrollbar bg-black/60 shadow-inner">
                      {isEditingLab ? (
                        <textarea
                          value={editedLabResult}
                          onChange={(e) => setEditedLabResult(e.target.value)}
                          className="w-full h-full bg-transparent border-none focus:ring-0 text-white font-sans leading-[2.2] text-lg font-medium tracking-wide resize-none outline-none"
                          autoFocus
                        />
                      ) : (
                        <>
                          {labStreaming || labResult}
                          {labStreaming && <span className="inline-block w-3 h-7 bg-[#2062ee] ml-2 animate-pulse shadow-[0_0_20px_rgba(32,98,238,0.8)]" />}
                        </>
                      )}
                    </div>
                  </div>

                  {/* 生平分镜时间轴组件 */}
                  {parsedTimeline.length > 0 && (
                    <div className="col-span-4 space-y-6">
                       <div className="flex items-center gap-3 px-2">
                         <div className="text-[#2062ee]">{ICONS.Layout}</div>
                         <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/60 italic">生平分镜时间轴 (Timeline)</h3>
                       </div>
                       <div className="relative border-l border-white/10 ml-4 space-y-8 py-4">
                          {parsedTimeline.map((item, idx) => (
                            <div key={idx} className="relative pl-10 group animate-fade-up" style={{ animationDelay: `${idx * 150}ms` }}>
                               <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#2062ee] group-hover:scale-150 transition-transform shadow-[0_0_15px_rgba(32,98,238,0.6)]"></div>
                               <div className="card-neo p-6 bg-white/[0.03] hover:bg-white/[0.08] transition-all border border-white/5 group-hover:border-[#2062ee]/30">
                                  <span className="text-[10px] font-black text-[#2062ee] uppercase tracking-[0.2em] mb-2 block">{item.stage}</span>
                                  <h4 className="text-sm font-bold text-white mb-3 italic">“{item.event}”</h4>
                                  <div className="space-y-3 pt-3 border-t border-white/5">
                                     <div className="flex items-start gap-2">
                                        <div className="mt-1 text-white/20 scale-75">{ICONS.Camera}</div>
                                        <p className="text-[11px] text-white/50 leading-relaxed italic">{item.visual}</p>
                                     </div>
                                     <div className="flex items-start gap-2">
                                        <div className="mt-1 text-white/20 scale-75">{ICONS.Sparkles}</div>
                                        <p className="text-[9px] font-black text-[#2062ee]/60 uppercase italic tracking-wider">{item.style}</p>
                                     </div>
                                  </div>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterVisuals;