
import React, { useState, useEffect, useMemo } from 'react';
import { AudienceMode, CharacterAsset, KBFile, Category } from '../types';
import { ICONS } from '../constants';
import { GeminiService } from '../services/geminiService';

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
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      let finalPrompt = `${inputName}: ${inputDesc}`;
      if (refFileId) {
        const refFile = files.find(f => f.id === refFileId);
        if (refFile) finalPrompt = `Ref Context: ${refFile.content.substring(0, 1500)}. Name: ${inputName}. Visual Details: ${inputDesc}`;
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
      setInputName(''); setInputDesc(''); setRefFileId('');
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

  const startLabWork = async () => {
    setIsLabLoading(true);
    setLabResult('');
    setLabStreaming('');
    setSaveStatus(false);
    let full = '';
    try {
      const sourceFile = files.find(f => f.id === labFileId);
      const refFile = files.find(f => f.id === labRefId);
      
      const stream = labMode === 'EXTRACT' 
        ? gemini.generateCharacterBioStream(
            inputName, 
            inputDesc, 
            sourceFile?.content || '',
            refFile?.content || ''
          )
        : gemini.generateCharacterBioStream("深度逻辑反向设定", inputDesc, "自由建模");
        
      for await (const chunk of stream) {
        full += chunk;
        setLabStreaming(GeminiService.cleanText(full));
      }
      setLabResult(GeminiService.cleanText(full));
      setLabStreaming('');
    } finally { setIsLabLoading(false); }
  };

  const handleSaveLabResultToKB = () => {
    if (!labResult) return;
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[小传] ${inputName || '匿名角色'} - ${new Date().toLocaleTimeString()}`,
      category: Category.CHARACTER,
      content: labResult,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB?.(newFile);
    setSaveStatus(true);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
      <div className="h-14 bg-white border-b flex px-10 items-center gap-8 shadow-sm">
        <button onClick={() => setActiveSubTab('VISUAL')} className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 h-full border-b-2 transition-all ${activeSubTab === 'VISUAL' ? 'border-emerald-500 text-slate-900' : 'border-transparent text-slate-400'}`}>
          视觉渲染实验室
        </button>
        <button onClick={() => setActiveSubTab('LAB')} className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 h-full border-b-2 transition-all ${activeSubTab === 'LAB' ? 'border-indigo-500 text-slate-900' : 'border-transparent text-slate-400'}`}>
          角色小传建模
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
        <div className="max-w-6xl mx-auto">
          {activeSubTab === 'VISUAL' ? (
            <div className="space-y-12">
              <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">参考人物模板</label>
                    <select value={refFileId} onChange={e => setRefFileId(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3 text-sm font-bold outline-none ring-1 ring-slate-100">
                      <option value="">指向参考人设资料...</option>
                      {files.filter(f => f.category === Category.CHARACTER).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">角色姓名</label>
                    <input value={inputName} onChange={e => setInputName(e.target.value)} placeholder="输入角色名..." className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3 text-sm font-bold outline-none ring-1 ring-slate-100" />
                  </div>
                   <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">渲染风格</label>
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                       <button className="flex-1 py-2 text-[10px] font-black uppercase rounded-xl bg-white shadow-sm">2D Anime</button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">视觉细节增强</label>
                  <textarea value={inputDesc} onChange={e => setInputDesc(e.target.value)} placeholder="银发蓝瞳，战损披风，赛博朋克义眼..." className="w-full h-24 bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold outline-none resize-none ring-1 ring-slate-100" />
                </div>
                <button disabled={isGenerating} onClick={generateVisual} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-3 transition-all">
                  {isGenerating ? "正在解析视觉特征..." : "渲染高清动漫立绘"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
                {cards.map(card => (
                  <div key={card.id} className="bg-white rounded-[3.5rem] p-1.5 border border-slate-100 shadow-lg relative group overflow-hidden animate-fade-up">
                    <div className="absolute top-6 right-6 z-20 flex gap-2">
                      <button onClick={() => handleRegenerate(card.id)} disabled={card.is_regenerating} title="不满意重新生成" className="bg-black/40 hover:bg-emerald-600 text-white p-3 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all border border-white/10">
                        {ICONS.Refresh}
                      </button>
                      <button onClick={() => setCards(prev => prev.filter(c => c.id !== card.id))} className="bg-black/40 hover:bg-rose-600 text-white p-3 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all border border-white/10">
                        {ICONS.Trash}
                      </button>
                    </div>
                    <div className="aspect-[3/4] bg-slate-900 rounded-[3.2rem] overflow-hidden relative">
                      <img src={card.image_url} className={`w-full h-full object-cover transition-all duration-700 ${card.is_regenerating ? 'blur-md scale-110 opacity-50' : ''}`} />
                    </div>
                    <div className="p-8">
                       <h3 className="text-xl font-black text-slate-900 italic truncate">{card.name}</h3>
                       <p className="text-[9px] text-slate-400 mt-1 line-clamp-1">{card.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-up">
              <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">角色姓名</label>
                      <input value={inputName} onChange={e => setInputName(e.target.value)} placeholder="林北..." className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-sm outline-none ring-1 ring-slate-100" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">内容背景原著</label>
                      <select value={labFileId} onChange={e => setLabFileId(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-sm outline-none ring-1 ring-slate-100">
                         <option value="">指向小说内容...</option>
                         {files.filter(f => f.category === Category.PLOT).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-violet-500 uppercase ml-2">参考小传模板</label>
                      <select value={labRefId} onChange={e => setLabRefId(e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-sm outline-none ring-1 ring-violet-200">
                         <option value="">指向参考小传模板...</option>
                         {files.filter(f => f.category === Category.CHARACTER).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                 </div>
                 <textarea value={inputDesc} onChange={e => setInputDesc(e.target.value)} placeholder="补充关键设定碎片..." className="w-full h-32 p-5 bg-slate-50 rounded-2xl border-none text-sm font-bold outline-none ring-1 ring-slate-100" />
                 <button disabled={isLabLoading} onClick={startLabWork} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-5 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-3">
                    {isLabLoading ? "正在解析因果逻辑..." : "启动无上限小传建模"}
                 </button>
              </div>

              {(labResult || labStreaming) && (
                <div className="bg-white rounded-[3rem] border border-slate-200 overflow-hidden flex flex-col shadow-2xl animate-fade-up">
                  <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest italic">Character Lab Output</span>
                    <div className="flex gap-2">
                      <button onClick={startLabWork} disabled={!!labStreaming} className="bg-white border border-slate-200 text-rose-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-rose-50 transition-all">
                        不满意重新生成
                      </button>
                      <button onClick={handleSaveLabResultToKB} disabled={saveStatus} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all ${saveStatus ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>
                        {saveStatus ? "✓ 已存入库" : "存入知识库"}
                      </button>
                    </div>
                  </div>
                  <div className="p-16 whitespace-pre-wrap font-sans text-slate-700 leading-relaxed text-base italic h-[500px] overflow-y-auto custom-scrollbar">
                    {labStreaming || labResult}
                    {labStreaming && <span className="inline-block w-2 h-5 bg-indigo-500 ml-2 animate-pulse" />}
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
