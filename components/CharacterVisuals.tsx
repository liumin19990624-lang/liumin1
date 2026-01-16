
import React, { useState, useEffect } from 'react';
import { AudienceMode, CharacterAsset } from '../types';
import { ICONS } from '../constants';
import { GeminiService } from '../services/geminiService';

const VOICE_OPTIONS = [
  { id: 'Fenrir', label: '沉稳男声 (Fenrir)', gender: 'male' },
  { id: 'Charon', label: '冷酷男声 (Charon)', gender: 'male' },
  { id: 'Kore', label: '活泼女声 (Kore)', gender: 'female' },
  { id: 'Puck', label: '温柔女声 (Puck)', gender: 'female' },
  { id: 'Zephyr', label: '中性少年 (Zephyr)', gender: 'neutral' },
];

const CharacterVisuals: React.FC<{ mode: AudienceMode }> = ({ mode }) => {
  const [cards, setCards] = useState<CharacterAsset[]>([]);
  const [inputName, setInputName] = useState('');
  const [inputDesc, setInputDesc] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  const gemini = new GeminiService();

  useEffect(() => {
    fetchVisuals();
  }, []);

  const fetchVisuals = async () => {
    const res = await fetch('/api/visuals');
    if (res.ok) setCards(await res.json());
  };

  const generateVisual = async () => {
    if (!inputDesc.trim()) return alert("请输入角色外貌描述");
    setIsGenerating(true);
    setLoadingMsg("AI 解析粒子云中...");
    try {
      // Corrected: Using newly implemented generateCharacterImage method from geminiService
      const imageUrl = await gemini.generateCharacterImage(`${inputName}: ${inputDesc}`, mode);
      const res = await fetch('/api/visuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inputName || '未命名角色', description: inputDesc, imageUrl })
      });
      
      // Fix: Await JSON parsing outside of the setCards callback
      if (res.ok) {
        const newCard = await res.json();
        setCards(prev => [newCard, ...prev]);
        setInputName(''); 
        setInputDesc('');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const updateVoiceId = async (id: string, voiceId: string) => {
    const res = await fetch('/api/visuals/voice', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, voiceId })
    });
    if (res.ok) {
      setCards(prev => prev.map(c => c.id === id ? { ...c, voice_id: voiceId } : c));
    }
  };

  const deleteCard = async (id: string) => {
    if (!confirm("确定要移除此资产吗？")) return;
    const res = await fetch(`/api/visuals?id=${id}`, { method: 'DELETE' });
    if (res.ok) setCards(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
      <div className="bg-white border-b p-10 shadow-sm z-10">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600 p-3.5 rounded-2xl text-white shadow-xl">{ICONS.Sparkles}</div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">AI 角色资产管理</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Character Asset Workflow</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">角色姓名 (作为生成锚点)</label>
              <input 
                value={inputName} onChange={e => setInputName(e.target.value)}
                placeholder="例如：苏清雪"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:bg-white focus:border-emerald-400 transition-all shadow-inner"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">外貌描述 (决定视觉风格)</label>
              <input 
                value={inputDesc} onChange={e => setInputDesc(e.target.value)}
                placeholder="例如：白发、金瞳、穿着古风长裙..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:bg-white focus:border-emerald-400 transition-all shadow-inner"
              />
            </div>
          </div>

          <button 
            disabled={isGenerating} onClick={generateVisual}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-3 hover:bg-black transition-all active:scale-[0.98] disabled:bg-slate-300"
          >
            {isGenerating ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Sparkles}
            {isGenerating ? "正在解析二次元坐标..." : "生成 2D 动漫立绘资产 (2 额度)"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
          {cards.map(card => (
            <div key={card.id} className="bg-white rounded-[3rem] p-1 border border-slate-100 shadow-xl hover:shadow-2xl transition-all group relative">
              <button 
                onClick={() => deleteCard(card.id)}
                className="absolute top-6 right-6 z-20 bg-black/50 text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-rose-500 transition-all shadow-lg"
              >
                {ICONS.Trash}
              </button>
              <div className="aspect-[3/4] bg-slate-900 rounded-[2.8rem] overflow-hidden relative">
                <img src={card.image_url} alt={card.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-8 flex flex-col justify-end">
                  <p className="text-white/80 text-xs italic line-clamp-4 leading-relaxed font-medium">{card.description}</p>
                </div>
              </div>
              <div className="p-8 space-y-5">
                <div>
                  <h3 className="text-xl font-black text-slate-900">{card.name}</h3>
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">Production ID: {card.id.slice(0,8)}</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">{ICONS.Chat} 绑定配音声线</label>
                  <select 
                    value={card.voice_id || ''} 
                    onChange={e => updateVoiceId(card.id, e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-black outline-none hover:bg-slate-100 transition-colors"
                  >
                    <option value="">自动适配声线...</option>
                    {VOICE_OPTIONS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CharacterVisuals;
