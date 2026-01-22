
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
  const [refFileId, setRefFileId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [shotList, setShotList] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState(false);

  const gemini = useMemo(() => new GeminiService(), []);

  const handleGenerateShots = async () => {
    const block = sourceBlocks.find(b => b.id === selectedBlockId);
    if (!block) {
      alert("请先选择一个待拆解的剧本单元。");
      return;
    }
    setIsGenerating(true);
    setStreamingText('');
    setShotList('');
    setSaveStatus(false);

    let full = '';
    try {
      const refFile = files.find(f => f.id === refFileId);
      const stream = gemini.generateTechnicalShotListStream(
        block.content, 
        refFile?.content || ''
      );
      for await (const chunk of stream) {
        full += chunk;
        setStreamingText(full);
      }
      setShotList(full);
    } catch (e) {
      console.error(e);
      alert("分镜生成异常中断，请检查网络或配置");
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
          visual: parts[3] || '画面描述缺失', 
          dialogue: parts[4] || '（无）',
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
    const isOk = totalDurationSeconds >= 120;
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
      name: `[高精分镜] ${block?.episodes || '未命名'} - 时长${durationStatus.text}`,
      category: Category.REFERENCE,
      content: finalContent,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB(newFile);
    setSaveStatus(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#050508] overflow-hidden">
      <div className="h-28 px-10 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-10">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Industrial Storyboarding</span>
            <h2 className="text-xl font-black text-white italic tracking-tighter">高精分镜管理中心</h2>
          </div>

          {parsedShots.length > 0 && (
            <div className="flex items-center gap-6 bg-white/[0.03] border border-white/10 px-8 py-2.5 rounded-3xl shadow-xl">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">总计分镜时长</span>
                <span className={`text-lg font-black italic tabular-nums leading-none mt-1 ${durationStatus.isOk ? 'text-emerald-400' : 'text-amber-500'}`}>
                  {durationStatus.text}
                </span>
              </div>
              <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${durationStatus.isOk ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                  style={{ width: `${durationStatus.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase ml-2">选择改编剧本</label>
            <select 
              value={selectedBlockId} 
              onChange={e => setSelectedBlockId(e.target.value)} 
              className="bg-slate-900 border border-white/10 text-white text-xs font-bold rounded-2xl px-5 py-3 outline-none min-w-[200px] focus:ring-1 focus:ring-blue-500"
            >
              <option value="">选择剧本集数...</option>
              {sourceBlocks.map(b => <option key={b.id} value={b.id}>{b.episodes}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-black text-violet-500 uppercase ml-2 tracking-widest">参考文件范本</label>
            <select 
              value={refFileId} 
              onChange={e => setRefFileId(e.target.value)} 
              className="bg-slate-900 border border-violet-500/20 text-violet-400 text-xs font-bold rounded-2xl px-5 py-3 outline-none min-w-[200px]"
            >
              <option value="">指向参考分镜格式...</option>
              {files.filter(f => f.category === Category.REFERENCE).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          <div className="flex items-end h-full pb-1 gap-3">
            <button 
              disabled={!selectedBlockId || isGenerating} 
              onClick={handleGenerateShots} 
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-2xl transition-all flex items-center gap-3 active:scale-95"
            >
              {isGenerating ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Zap}
              {isGenerating ? "正在解析..." : (shotList ? "不满意请重写" : "生成精细分镜")}
            </button>
            
            {(shotList || streamingText) && (
              <button 
                onClick={handleSaveToKB} 
                disabled={isGenerating || saveStatus}
                className={`px-6 py-4 rounded-2xl text-xs font-black uppercase transition-all flex items-center gap-3 ${
                  saveStatus 
                  ? 'bg-emerald-600 text-white shadow-emerald-900/20' 
                  : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                {saveStatus ? "✓ 已同步" : ICONS.Download}
                {saveStatus ? "" : "入库"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-8">
        {!parsedShots.length && !isGenerating && (
          <div className="h-full flex flex-col items-center justify-center opacity-20">
            <div className="scale-[3] mb-8">{ICONS.Library}</div>
            <p className="text-sm font-black uppercase tracking-[0.4em]">等待剧本导入并启动自动化拆解</p>
          </div>
        )}

        {parsedShots.length > 0 && (
          <div className="min-w-[1700px] animate-fade-up">
            <table className="w-full text-left border-separate border-spacing-0 rounded-[3rem] overflow-hidden bg-white/[0.01] border border-white/5 shadow-2xl backdrop-blur-3xl">
              <thead>
                <tr className="bg-white/[0.04]">
                  <th className="px-8 py-7 text-[10px] font-black text-slate-500 uppercase border-b border-white/5 w-24">镜号</th>
                  <th className="px-8 py-7 text-[10px] font-black text-emerald-500 uppercase border-b border-white/5 w-28">时长</th>
                  <th className="px-8 py-7 text-[10px] font-black text-blue-500 uppercase border-b border-white/5 w-56">视听语言</th>
                  <th className="px-8 py-7 text-[10px] font-black text-slate-100 uppercase border-b border-white/5 w-[500px]">画面细节描述 (2D Anime)</th>
                  <th className="px-8 py-7 text-[10px] font-black text-violet-400 uppercase border-b border-white/5 w-[350px]">角色台词/对白</th>
                  <th className="px-8 py-7 text-[10px] font-black text-amber-500 uppercase border-b border-white/5">Vidu 视频提示词</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {parsedShots.map((s, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.03] transition-all group">
                    <td className="px-8 py-8 font-mono text-[11px] text-slate-500">{s.id}</td>
                    <td className="px-8 py-8 font-mono text-xs text-emerald-400 font-black italic">{s.duration}</td>
                    <td className="px-8 py-8">
                       <span className="text-blue-300 text-[10px] font-black uppercase tracking-widest bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                         {s.language}
                       </span>
                    </td>
                    <td className="px-8 py-8 text-white/90 text-[13px] leading-relaxed font-sans italic tracking-wide">{s.visual}</td>
                    <td className="px-8 py-8 text-violet-300 text-sm italic font-medium bg-violet-500/[0.02]">{s.dialogue}</td>
                    <td className="px-8 py-8">
                      <div className="p-4 bg-black/40 border border-white/5 rounded-2xl font-mono text-[10px] text-amber-200/40 group-hover:text-amber-200 transition-all leading-relaxed">
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
          <div className="max-w-4xl mx-auto p-20 bg-blue-600/[0.01] border border-blue-500/10 rounded-[4rem] shadow-2xl animate-pulse">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-10 h-10 border-2 border-white/5 border-t-blue-500 rounded-full animate-spin"></div>
              <span className="text-xs font-black text-blue-400 uppercase tracking-widest">导演正在按工业标准拆解分镜（确保总时长 > 120秒）...</span>
            </div>
            <div className="text-white/20 text-[13px] italic whitespace-pre-wrap font-mono leading-relaxed bg-black/40 p-10 rounded-3xl border border-white/5">
              {streamingText.substring(Math.max(0, streamingText.length - 1200))}
              <span className="inline-block w-2.5 h-5 bg-blue-600 ml-2 shadow-[0_0_15px_rgba(37,99,235,0.8)]"></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShotsPanel;
