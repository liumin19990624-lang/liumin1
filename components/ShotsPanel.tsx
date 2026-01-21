
import React, { useState, useMemo, useEffect } from 'react';
import { ICONS } from '../constants.tsx';
import { ScriptBlock, KBFile, Category } from '../types.ts';
import { GeminiService } from '../services/geminiService.ts';
import { DocGenerator } from '../services/docGenerator.ts';

const ShotsPanel: React.FC<{ sourceBlocks: any[], files: KBFile[], onSaveToKB: (f: KBFile) => void }> = ({ sourceBlocks, files, onSaveToKB }) => {
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [refTemplateId, setRefTemplateId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [shotList, setShotList] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState(false);

  const gemini = useMemo(() => new GeminiService(), []);

  const handleGenerateShots = async () => {
    const block = sourceBlocks.find(b => b.id === selectedBlockId);
    const refFile = files.find(f => f.id === refTemplateId);
    if (!block) return;

    setIsGenerating(true);
    setStreamingText('');
    setShotList('');
    setSaveStatus(false);

    let full = '';
    try {
      const stream = gemini.generateTechnicalShotListStream(block.content, refFile?.content || '');
      for await (const chunk of stream) {
        full += chunk;
        setStreamingText(full);
      }
      setShotList(full);
      setStreamingText('');
    } catch (e) {
      alert("分镜解析失败");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToKB = () => {
    if (!shotList) return;
    const block = sourceBlocks.find(b => b.id === selectedBlockId);
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[分镜表] ${block?.episodes || '未命名剧集'}`,
      category: Category.PLOT,
      content: shotList,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB(newFile);
    setSaveStatus(true);
  };

  const parsedShots = useMemo(() => {
    const lines = (streamingText || shotList).split('\n').filter(l => l.includes('|'));
    return lines.map(line => {
      const parts = line.split('|').map(p => p.trim());
      return {
        id: parts[0] || '??',
        technical: parts[1] || '---',
        visual: parts[2] || '---',
        audio: parts[3] || '---'
      };
    });
  }, [streamingText, shotList]);

  return (
    <div className="flex-1 flex flex-col bg-[#050508] overflow-hidden">
      <div className="h-24 px-10 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Storyboarding Engine</span>
            <h2 className="text-xl font-black text-white italic tracking-tighter">分镜表生成与精修</h2>
          </div>
          <div className="h-10 w-px bg-white/10 mx-2"></div>
          <div className="flex gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-slate-500 uppercase ml-2">选择剧本单元</label>
              <select 
                value={selectedBlockId} 
                onChange={e => {setSelectedBlockId(e.target.value); setShotList('');}}
                className="bg-slate-900 border border-white/10 text-white text-[10px] font-bold rounded-xl px-3 py-2 outline-none focus:border-blue-500 min-w-[180px]"
              >
                <option value="">待选单元...</option>
                {sourceBlocks.map(b => <option key={b.id} value={b.id}>{b.episodes}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[8px] font-black text-slate-500 uppercase ml-2">参考分镜模板</label>
              <select 
                value={refTemplateId} 
                onChange={e => setRefTemplateId(e.target.value)}
                className="bg-slate-900 border border-white/10 text-white text-[10px] font-bold rounded-xl px-3 py-2 outline-none focus:border-blue-500 min-w-[180px]"
              >
                <option value="">默认风格...</option>
                {files.filter(f => f.category === Category.REFERENCE).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
           <button 
             disabled={!selectedBlockId || isGenerating} 
             onClick={handleGenerateShots}
             className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
           >
             {isGenerating ? <div className="animate-spin text-white">⟳</div> : (shotList ? ICONS.Refresh : ICONS.Play)}
             {isGenerating ? '分镜解析中...' : (shotList ? '重新生成 (不满意)' : '开始生成')}
           </button>
           {shotList && (
             <>
               <button 
                 onClick={handleSaveToKB}
                 disabled={saveStatus}
                 className={`px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase border transition-all ${saveStatus ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
               >
                 {saveStatus ? '✓ 已保存至资料库' : '保存至资料库'}
               </button>
               <button 
                 onClick={() => DocGenerator.downloadBlob(new Blob([shotList]), "分镜表.txt")}
                 className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase"
               >
                 导出表格
               </button>
             </>
           )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
        {!shotList && !streamingText ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 pointer-events-none">
             <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-6">
                <div className="scale-[2] text-white">📋</div>
             </div>
             <p className="text-white font-black text-sm uppercase tracking-widest">请选择一个剧本单元以启动分镜拆解</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto animate-fade-up">
             <div className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-white/[0.03] border-b border-white/5">
                         <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest w-24">镜头号</th>
                         <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest w-40">景别/运动</th>
                         <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">视觉画面描述</th>
                         <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest w-64">音频/对白</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                      {parsedShots.map((shot, idx) => (
                        <tr key={idx} className="group hover:bg-white/[0.01] transition-colors">
                           <td className="px-8 py-6">
                              <span className="text-blue-500 font-mono text-xs font-black">{shot.id}</span>
                           </td>
                           <td className="px-8 py-6">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                shot.technical.includes('CU') ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                                shot.technical.includes('WS') ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              }`}>
                                {shot.technical}
                              </span>
                           </td>
                           <td className="px-8 py-6">
                              <p className="text-white/80 text-sm leading-relaxed font-light">{shot.visual}</p>
                           </td>
                           <td className="px-8 py-6">
                              <p className="text-slate-500 text-[11px] leading-relaxed italic">{shot.audio}</p>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
             {streamingText && (
               <div className="mt-8 flex items-center justify-center gap-4 text-blue-500 animate-pulse">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  <span className="text-[10px] font-black uppercase tracking-widest">AI 分镜师正在解析剧本深度动作...</span>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShotsPanel;
