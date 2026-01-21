
import React, { useState, useEffect, useMemo } from 'react';
import { AudienceMode, CharacterAsset, KBFile, Category } from '../types';
import { ICONS } from '../constants';
import { GeminiService } from '../services/geminiService';
import { DocGenerator } from '../services/docGenerator';

const CharacterVisuals: React.FC<{ mode: AudienceMode, files: KBFile[], onSaveToKB?: (f: KBFile) => void }> = ({ mode, files, onSaveToKB }) => {
  const [activeSubTab, setActiveSubTab] = useState<'VISUAL' | 'LAB'>('VISUAL');
  const [cards, setCards] = useState<(CharacterAsset & { is_regenerating?: boolean })[]>([]);
  const [inputName, setInputName] = useState('');
  const [inputDesc, setInputDesc] = useState('');
  const [refFileId, setRefFileId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [labResult, setLabResult] = useState('');
  const [labStreaming, setLabStreaming] = useState('');
  const [labMode, setLabMode] = useState<'EXTRACT' | 'REVERSE'>('EXTRACT');
  const [labFileId, setLabFileId] = useState('');
  const [isLabLoading, setIsLabLoading] = useState(false);

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
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      let finalPrompt = `${inputName}: ${inputDesc}`;
      if (refFileId) {
        const refFile = files.find(f => f.id === refFileId);
        if (refFile) finalPrompt = `Ref Context: ${refFile.content.substring(0, 800)}. Name: ${inputName}. Visual Details: ${inputDesc}`;
      }
      const imageUrl = await gemini.generateCharacterImage(finalPrompt, mode);
      const newCard: CharacterAsset = {
        id: Math.random().toString(36).substr(2, 9),
        name: inputName || "未知角色",
        description: inputDesc || (refFileId ? "基于知识库引用" : "手动描述生成"),
        image_url: imageUrl,
        voice_id: 'Kore'
      };
      setCards(prev => [newCard, ...prev]);
      setInputName(''); setInputDesc(''); setRefFileId('');
    } finally { setIsGenerating(false); }
  };

  const handleRegenerate = async (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.is_regenerating) return;
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, is_regenerating: true } : c));
    try {
      const prompt = `Refined anime character art for ${card.name}. Description: ${card.description}`;
      const newImageUrl = await gemini.generateCharacterImage(prompt, mode);
      if (newImageUrl) {
        setCards(prev => prev.map(c => c.id === cardId ? { ...c, image_url: newImageUrl, is_regenerating: false } : c));
      }
    } catch (e) {
      alert("重绘失败，请重试");
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, is_regenerating: false } : c));
    }
  };

  const startLabWork = async () => {
    if (labMode === 'EXTRACT' && !labFileId) {
      alert("请选择一个资料文件");
      return;
    }
    setIsLabLoading(true);
    setLabResult('');
    setLabStreaming('');
    let full = '';
    try {
      const stream = labMode === 'EXTRACT' 
        ? gemini.generateCharacterBioStream(files.find(f => f.id === labFileId)?.content || '')
        : gemini.reverseReasonCharacterSettings(inputDesc || "通用视觉反推");
      for await (const chunk of stream) {
        full += chunk;
        setLabStreaming(GeminiService.cleanText(full));
      }
      setLabResult(GeminiService.cleanText(full));
      setLabStreaming('');
    } finally { setIsLabLoading(false); }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
      <div className="h-14 bg-white border-b flex px-10 items-center gap-8 shadow-sm">
        <button onClick={() => setActiveSubTab('VISUAL')} className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 h-full border-b-2 transition-all ${activeSubTab === 'VISUAL' ? 'border-emerald-500 text-slate-900' : 'border-transparent text-slate-400'}`}>
          {ICONS.Image} 视觉生成
        </button>
        <button onClick={() => setActiveSubTab('LAB')} className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 h-full border-b-2 transition-all ${activeSubTab === 'LAB' ? 'border-indigo-500 text-slate-900' : 'border-transparent text-slate-400'}`}>
          {ICONS.Sparkles} 角色实验室
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
        <div className="max-w-6xl mx-auto">
          {activeSubTab === 'VISUAL' ? (
            <div className="space-y-12">
              <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">引用画像设定</label>
                    <select value={refFileId} onChange={e => setRefFileId(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3 text-sm font-bold outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-emerald-500/20 transition-all">
                      <option value="">手动描述视觉细节...</option>
                      {files.filter(f => f.category === Category.CHARACTER).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">角色姓名</label>
                    <input value={inputName} onChange={e => setInputName(e.target.value)} placeholder="如：林北、苏清月..." className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3 text-sm font-bold outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">视觉风格增强</label>
                  <textarea value={inputDesc} onChange={e => setInputDesc(e.target.value)} placeholder="例如：银发蓝瞳，身着黑金盔甲..." className="w-full h-24 bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold outline-none resize-none ring-1 ring-slate-100 focus:ring-2 focus:ring-emerald-500/20 transition-all" />
                </div>
                <button disabled={isGenerating} onClick={generateVisual} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-black text-sm shadow-xl shadow-emerald-900/10 flex items-center justify-center gap-3 transition-all active:scale-[0.98]">
                  {isGenerating ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Refine}
                  {isGenerating ? "正在解析并渲染立绘..." : "生成 2D 动漫立绘"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
                {cards.map(card => (
                  <div key={card.id} className="bg-white rounded-[3.5rem] p-1.5 border border-slate-100 shadow-lg relative group overflow-hidden animate-fade-up">
                    <div className="absolute top-6 right-6 z-20 flex gap-2">
                      <button onClick={() => handleRegenerate(card.id)} disabled={card.is_regenerating} className="bg-black/40 hover:bg-blue-600 text-white p-3 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all border border-white/10 shadow-lg">
                        {ICONS.Refresh}
                      </button>
                      <button onClick={() => setCards(prev => prev.filter(c => c.id !== card.id))} className="bg-black/40 hover:bg-rose-600 text-white p-3 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all border border-white/10 shadow-lg">
                        {ICONS.Trash}
                      </button>
                    </div>
                    <div className="aspect-[3/4] bg-slate-900 rounded-[3.2rem] overflow-hidden relative">
                      <img src={card.image_url} className={`w-full h-full object-cover transition-all duration-700 ${card.is_regenerating ? 'blur-md scale-110 opacity-50' : 'group-hover:scale-105'}`} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-8 flex flex-col justify-end">
                        <p className="text-white/80 text-[10px] italic leading-relaxed line-clamp-3">{card.description}</p>
                      </div>
                    </div>
                    <div className="p-8 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Character Profile</span>
                        <h3 className="text-xl font-black text-slate-900 italic tracking-tighter truncate max-w-[150px]">{card.name}</h3>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-up">
              <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl flex flex-col gap-6">
                 <div className="flex gap-4">
                    <button onClick={() => setLabMode('EXTRACT')} className={`flex-1 p-4 rounded-2xl font-black text-xs transition-all ${labMode === 'EXTRACT' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                      {ICONS.FileText} 提取精修小传
                    </button>
                    <button onClick={() => setLabMode('REVERSE')} className={`flex-1 p-4 rounded-2xl font-black text-xs transition-all ${labMode === 'REVERSE' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                      {ICONS.Zap} 逻辑设定反推
                    </button>
                 </div>
                 {labMode === 'EXTRACT' ? (
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-2">选择资料库文件</label>
                     <select value={labFileId} onChange={e => setLabFileId(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-sm outline-none ring-1 ring-slate-100">
                        <option value="">点击选择源文件...</option>
                        {files.filter(f => f.category === Category.CHARACTER || f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                     </select>
                   </div>
                 ) : (
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-2">输入描述碎片</label>
                     <textarea value={inputDesc} onChange={e => setInputDesc(e.target.value)} placeholder="输入性格切面或视觉特征..." className="w-full h-32 p-5 bg-slate-50 rounded-2xl border-none text-sm font-bold outline-none resize-none ring-1 ring-slate-100" />
                   </div>
                 )}
                 <button disabled={isLabLoading} onClick={startLabWork} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-5 rounded-2xl font-black text-sm shadow-xl shadow-indigo-900/10 flex items-center justify-center gap-3 transition-all">
                    {isLabLoading ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Sparkles}
                    {labMode === 'EXTRACT' ? "启动精修任务" : "启动逻辑建模"}
                 </button>
              </div>

              {(labResult || labStreaming) && (
                <div className="bg-white rounded-[3rem] border border-slate-200 overflow-hidden flex flex-col shadow-2xl animate-fade-up">
                  <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Laboratory Output</span>
                    <div className="flex gap-2">
                      <button onClick={startLabWork} disabled={!!labStreaming} className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-100 transition-all flex items-center gap-2">
                        {ICONS.Refresh} 重新生成
                      </button>
                      <button onClick={() => onSaveToKB && onSaveToKB({ id: Math.random().toString(36).substr(2,9), name: `[分析] ${inputName || '未命名'}`, category: Category.CHARACTER, content: labResult, uploadDate: new Date().toISOString() })} className="bg-emerald-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">
                        存入资料库
                      </button>
                    </div>
                  </div>
                  <div className="p-16 whitespace-pre-wrap font-sans text-slate-700 leading-relaxed text-base italic selection:bg-indigo-100/50 h-[500px] overflow-y-auto custom-scrollbar">
                    {labStreaming || labResult}
                    {labStreaming && <span className="inline-block w-2 h-5 bg-indigo-500 ml-2 animate-pulse align-middle" />}
                  </div>
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
