
import React, { useState, useEffect } from 'react';
import { AudienceMode, CharacterAsset } from '../types';
import { ICONS } from '../constants';
import { GeminiService } from '../services/geminiService';

const VOICE_OPTIONS = [
  { id: 'Fenrir', label: '沉稳男声 (Fenrir)' },
  { id: 'Charon', label: '冷酷男声 (Charon)' },
  { id: 'Kore', label: '活泼女声 (Kore)' },
  { id: 'Puck', label: '温柔女声 (Puck)' },
  { id: 'Zephyr', label: '中性少年 (Zephyr)' },
];

const CharacterVisuals: React.FC<{ mode: AudienceMode }> = ({ mode }) => {
  const [cards, setCards] = useState<CharacterAsset[]>([]);
  const [inputName, setInputName] = useState('');
  const [inputDesc, setInputDesc] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const gemini = new GeminiService();

  useEffect(() => {
    const saved = localStorage.getItem('character_assets');
    if (saved) setCards(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('character_assets', JSON.stringify(cards));
  }, [cards]);

  const generateVisual = async () => {
    if (!inputDesc.trim()) return alert("请输入角色描述");
    setIsGenerating(true);
    try {
      const imageUrl = await gemini.generateCharacterImage(`${inputName}: ${inputDesc}`, mode);
      const newCard: CharacterAsset = {
        id: Math.random().toString(36).substr(2, 9),
        name: inputName || '未命名角色',
        description: inputDesc,
        image_url: imageUrl,
        voice_id: 'Kore'
      };
      setCards(prev => [newCard, ...prev]);
      setInputName(''); 
      setInputDesc('');
    } finally {
      setIsGenerating(false);
    }
  };

  const playVoicePreview = async (card: CharacterAsset) => {
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, is_playing_voice: true } : c));
    try {
      const audioUrl = await gemini.generateTTS(`你好，我是 ${card.name}。`, card.voice_id);
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play();
      }
    } finally {
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, is_playing_voice: false } : c));
    }
  };

  const deleteCard = (id: string) => {
    if (confirm("删除此角色？")) setCards(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
      <div className="bg-white border-b p-10 shadow-sm z-10">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600 p-3.5 rounded-2xl text-white shadow-xl">{ICONS.Sparkles}</div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">AI 角色资产管理</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Character Studio</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <input value={inputName} onChange={e => setInputName(e.target.value)} placeholder="角色姓名" className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold outline-none" />
            <input value={inputDesc} onChange={e => setInputDesc(e.target.value)} placeholder="描述：性格、发色、瞳色、服装..." className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-bold outline-none" />
          </div>
          <button disabled={isGenerating} onClick={generateVisual} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-3 disabled:bg-slate-300">
            {isGenerating ? <div className="animate-spin">{ICONS.Refresh}</div> : "生成动漫立绘"}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          {cards.map(card => (
            <div key={card.id} className="bg-white rounded-[3rem] p-1 border border-slate-100 shadow-xl relative group">
              <button onClick={() => deleteCard(card.id)} className="absolute top-6 right-6 z-20 bg-black/50 text-white p-2.5 rounded-full opacity-0 group-hover:opacity-100">{ICONS.Trash}</button>
              <div className="aspect-[3/4] bg-slate-900 rounded-[2.8rem] overflow-hidden">
                <img src={card.image_url} className="w-full h-full object-cover" />
              </div>
              <div className="p-8 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900">{card.name}</h3>
                <button onClick={() => playVoicePreview(card)} className="p-3 bg-blue-600 rounded-full text-white">
                  {card.is_playing_voice ? <div className="animate-spin w-4 h-4 border-2 border-t-transparent rounded-full" /> : ICONS.Volume}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CharacterVisuals;
