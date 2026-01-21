
import React, { useState, useMemo } from 'react';
import { ICONS } from '../constants.tsx';
import { ScriptBlock, KBFile, Category, ModelType } from '../types.ts';
import { GeminiService } from '../services/geminiService.ts';

interface ShotEntry {
  id: string;
  duration: string;
  language: string;
  visual: string;
  dialogue: string;
  prompt: string;
}

interface ShotsPanelProps {
  sourceBlocks: any[];
  files: KBFile[];
  onSaveToKB: (f: KBFile) => void;
}

const ShotsPanel: React.FC<ShotsPanelProps> = ({ sourceBlocks, files, onSaveToKB }) => {
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [shotList, setShotList] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState(false);

  const gemini = useMemo(() => new GeminiService(), []);

  const handleGenerateShots = async () => {
    const block = sourceBlocks.find(b => b.id === selectedBlockId);
    if (!block) {
      alert("请先选择一个剧本集数单元。");
      return;
    }
    setIsGenerating(true);
    setStreamingText('');
    setShotList('');
    setSaveStatus(false);

    let full = '';
    try {
      const stream = gemini.generateTechnicalShotListStream(block.content);
      for await (const chunk of stream) {
        full += chunk;
        setStreamingText(full);
      }
      setShotList(full);
    } catch (e) {
      console.error(e);
      alert("分镜生成中断，请重试");
    } finally {
      setIsGenerating(false);
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
        return { 
          id: parts[0] || '?', 
          duration: parts[1] || '3s', 
          language: parts[2] || '常规镜头', 
          visual: parts[3] || '描述缺失', 
          dialogue: parts[4] || '（无对白）',
          prompt: parts[5] || '' 
        };
      });
  }, [streamingText, shotList]);

  const totalDurationSeconds = useMemo(() => {
    return parsedShots.reduce((acc, shot) => {
      const seconds = parseInt(shot.duration.replace(/[^0-9]/g, '')) || 0;
      return acc + seconds;
    }, 0);
  }, [parsedShots]);

  const durationStatus = useMemo(() => {
    const mins = Math.floor(totalDurationSeconds / 60);
    const secs = totalDurationSeconds % 60;
    const isOk = totalDurationSeconds >= 120; // 核心要求：多余 2 分钟
    return {
      text: `${mins}分${secs}秒`,
      isOk,
      percent: Math.min(100, (totalDurationSeconds / 180) * 100)
    };
  }, [totalDurationSeconds]);

  const handleSaveToKB = () => {
    const finalContent = shotList || streamingText;
    if (!finalContent) return;
    
    const block = sourceBlocks.find(b => b.id === selectedBlockId);
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[分镜全案] ${block?.episodes || '未命名'} - 时长${durationStatus.text}`,
      category: Category.REFERENCE,
      content: finalContent,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB(newFile);
    setSaveStatus(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#050508] overflow-hidden">
      {/* 顶部控制台 */}
      <div className="h-28 px-10 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Advanced Storyboarding</span>
            <h2 className="text-xl font-black text-white italic tracking-tighter">分镜脚本管理中心</h2>
          </div>

          {parsedShots.length > 0 && (
            <div className="flex items-center gap-6 bg-white/[0.03] border border-white/10 px-8 py-2.5 rounded-3xl shadow-2xl">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase">当前集数预计时长</span>
                <span className={`text-lg font-black italic tabular-nums leading-none mt-1 ${durationStatus.isOk ? 'text-emerald-400' : 'text-amber-500'}`}>
                  {durationStatus.text}
                </span>
              </div>
              <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full transition-all duration-1000 ${durationStatus.isOk ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                  style={{ width: `${durationStatus.percent}%` }}
                />
              </div>
              <div className="flex flex-col items-end">
                 <span className={`text-[9px] font-black uppercase ${durationStatus.isOk ? 'text-emerald-500' : 'text-amber-500'}`}>
                   {durationStatus.isOk ? '时长已达标 (>2min)' : '时长未达标'}
                 </span>
                 <span className="text-[8px] font-bold text-slate-600">PRODUCTION READY</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase ml-2">选择剧本来源</label>
            <select 
              value={selectedBlockId} 
              onChange={e => setSelectedBlockId(e.target.value)} 
              className="bg-slate-900 border border-white/10 text-white text-xs font-bold rounded-2xl px-5 py-3 outline-none min-w-[220px] focus:border-blue-500"
            >
              <option value="">{sourceBlocks.length === 0 ? "暂无可用剧本" : "选择剧本单元..."}</option>
              {sourceBlocks.map(b => <option key={b.id} value={b.id}>{b.episodes} ({b.content.length}字)</option>)}
            </select>
          </div>

          <div className="flex items-end h-full pb-1 gap-3">
            <button 
              disabled={!selectedBlockId || isGenerating} 
              onClick={handleGenerateShots} 
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase shadow-xl transition-all flex items-center gap-3"
            >
              {isGenerating ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Zap}
              {isGenerating ? "正在拆解..." : (shotList ? "重新生成分镜" : "生成精细分镜")}
            </button>
            
            {(shotList || streamingText) && (
              <button 
                onClick={handleSaveToKB} 
                disabled={isGenerating || saveStatus}
                className={`px-6 py-3.5 rounded-2xl text-xs font-black uppercase transition-all flex items-center gap-3 ${
                  saveStatus 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                {saveStatus ? "✓ 已存入库" : ICONS.Download}
                {saveStatus ? "" : "保存存库"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 沉浸式表格内容 */}
      <div className="flex-1 overflow-auto custom-scrollbar p-8">
        {!parsedShots.length && !isGenerating && (
          <div className="h-full flex flex-col items-center justify-center opacity-30">
            <div className="scale-[3] mb-8">{ICONS.Library}</div>
            <p className="text-sm font-black uppercase tracking-[0.3em]">等待剧本导入并开始拆解</p>
          </div>
        )}

        {parsedShots.length > 0 && (
          <div className="min-w-[1700px] animate-fade-up">
            <table className="w-full text-left border-separate border-spacing-0 rounded-[3rem] overflow-hidden bg-white/[0.01] border border-white/5 shadow-2xl">
              <thead>
                <tr className="bg-white/[0.04]">
                  <th className="px-8 py-7 text-[10px] font-black text-slate-500 uppercase border-b border-white/5 w-24">镜号</th>
                  <th className="px-8 py-7 text-[10px] font-black text-emerald-500 uppercase border-b border-white/5 w-28">时长</th>
                  <th className="px-8 py-7 text-[10px] font-black text-blue-500 uppercase border-b border-white/5 w-56">视听语言</th>
                  <th className="px-8 py-7 text-[10px] font-black text-slate-100 uppercase border-b border-white/5 w-[500px]">画面内容描述</th>
                  <th className="px-8 py-7 text-[10px] font-black text-violet-400 uppercase border-b border-white/5 w-[350px]">原著台词</th>
                  <th className="px-8 py-7 text-[10px] font-black text-amber-500 uppercase border-b border-white/5">Vidu 提示词</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {parsedShots.map((s, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.03] transition-all group">
                    <td className="px-8 py-8 font-mono text-[11px] text-slate-500">{s.id}</td>
                    <td className="px-8 py-8 font-mono text-xs text-emerald-400 font-black italic">{s.duration}</td>
                    <td className="px-8 py-8">
                       <span className="text-blue-300 text-[10px] font-black uppercase tracking-wider bg-blue-500/10 px-3 py-1.5 rounded-lg">
                         {s.language}
                       </span>
                    </td>
                    <td className="px-8 py-8 text-white/90 text-[13px] leading-relaxed font-sans">{s.visual}</td>
                    <td className="px-8 py-8 text-violet-300 text-sm italic font-medium">{s.dialogue}</td>
                    <td className="px-8 py-8">
                      <div className="p-4 bg-black/40 border border-white/5 rounded-2xl font-mono text-[10px] text-amber-200/40 group-hover:text-amber-200 transition-all">
                        {s.prompt}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isGenerating && streamingText && parsedShots.length === 0 && (
          <div className="max-w-4xl mx-auto p-20 bg-blue-600/[0.02] border border-blue-500/10 rounded-[4rem] animate-pulse">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-10 h-10 border-2 border-white/5 border-t-blue-500 rounded-full animate-spin"></div>
              <span className="text-xs font-black text-blue-400 uppercase tracking-widest">导演正在进行工业级分镜拆解，确保时长 > 120s</span>
            </div>
            <div className="text-white/30 text-[13px] italic whitespace-pre-wrap font-mono leading-relaxed">
              {streamingText.substring(Math.max(0, streamingText.length - 1000))}
              <span className="inline-block w-2 h-4 bg-blue-500 ml-1"></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShotsPanel;
