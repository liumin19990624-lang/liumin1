import React, { useState, useMemo } from 'react';
import { KBFile, Category } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { DocGenerator } from '../services/docGenerator.ts';

interface MergePanelProps {
  files: KBFile[];
  onSaveToKB: (f: KBFile) => void;
}

const MergePanel: React.FC<MergePanelProps> = ({ files, onSaveToKB }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergedContent, setMergedContent] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [mergeTitle, setMergeTitle] = useState('合并作品_' + new Date().toLocaleDateString());

  const plotFiles = useMemo(() => files.filter(f => f.category === Category.PLOT), [files]);

  const toggleFile = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteFromSelected = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const moveItem = (e: React.MouseEvent, index: number, direction: 'up' | 'down') => {
    e.stopPropagation();
    const newIds = [...selectedIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newIds.length) return;
    [newIds[index], newIds[targetIndex]] = [newIds[targetIndex], newIds[index]];
    setSelectedIds(newIds);
  };

  const handleMerge = async () => {
    if (selectedIds.length === 0) return;
    setIsMerging(true);
    setMergeProgress(0);
    setMergedContent('');

    const total = selectedIds.length;
    let fullText = '';
    
    for (let i = 0; i < total; i++) {
      const id = selectedIds[i];
      const file = files.find(f => f.id === id);
      if (file) {
        fullText += `【章节：${file.name}】\n\n${file.content}\n\n`;
      }
      setMergeProgress(Math.round(((i + 1) / total) * 100));
      await new Promise(r => setTimeout(r, 100)); 
    }
    
    setMergedContent(fullText.trim());
    setIsMerging(false);
  };

  const handleDownloadDocx = async () => {
    const blob = await DocGenerator.createWordDoc(mergeTitle, mergedContent);
    DocGenerator.downloadBlob(blob, `${mergeTitle}.docx`);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([mergedContent], { type: 'text/plain' });
    DocGenerator.downloadBlob(blob, `${mergeTitle}.txt`);
  };

  const handleSaveToKB = () => {
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: mergeTitle,
      category: Category.PLOT,
      content: mergedContent,
      uploadDate: new Date().toISOString()
    };
    onSaveToKB(newFile);
    alert("已存入资料库");
  };

  return (
    <div className="flex-1 flex flex-col bg-[#000000] overflow-hidden">
      <div className="h-24 px-10 border-b border-white/10 flex items-center justify-between bg-black/80 backdrop-blur-xl shrink-0 z-10">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-[#2062ee] uppercase tracking-[0.25em] mb-1 italic">Industrial Merger Tool</span>
          <h2 className="text-2xl font-black text-white italic tracking-tighter">章节无损合并实验室</h2>
        </div>
        <div className="flex items-center gap-4">
          <input 
            value={mergeTitle} 
            onChange={e => setMergeTitle(e.target.value)} 
            className="input-neo w-72"
            placeholder="命名合并后的档案..."
          />
          <button 
            disabled={selectedIds.length === 0 || isMerging}
            onClick={handleMerge}
            className={`px-10 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center gap-3 ${
              selectedIds.length === 0 || isMerging ? 'bg-slate-800 text-white/30' : 'bg-[#2062ee] hover:bg-blue-600 text-white shadow-blue-900/40'
            }`}
          >
            {isMerging ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Merge}
            {isMerging ? `合并中 ${mergeProgress}%` : "执行全量合并"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[450px] border-r border-white/10 overflow-y-auto custom-scrollbar p-8 bg-white/[0.01]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[11px] font-black text-white/60 uppercase tracking-widest italic">选择与排序章节</h3>
            <button onClick={() => setSelectedIds([])} className="text-[10px] font-black text-rose-500 uppercase hover:text-rose-400 transition-colors">清空已选</button>
          </div>
          <div className="space-y-4">
            {plotFiles.map(file => {
              const orderIndex = selectedIds.indexOf(file.id);
              const isSelected = orderIndex !== -1;
              return (
                <div 
                  key={file.id} 
                  onClick={() => toggleFile(file.id)}
                  className={`p-5 rounded-[1.8rem] border cursor-pointer transition-all flex items-center justify-between group relative overflow-hidden ${
                    isSelected ? 'bg-[#2062ee]/20 border-[#2062ee]/50 shadow-[0_0_20px_rgba(32,98,238,0.2)]' : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-4 relative z-10">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-black transition-all ${isSelected ? 'bg-[#2062ee] text-white shadow-lg shadow-blue-900/40' : 'bg-white/10 text-white/40 group-hover:text-white'}`}>
                      {isSelected ? orderIndex + 1 : ICONS.Plus}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-white italic truncate max-w-[200px]">{file.name}</span>
                      <span className="text-[10px] font-bold text-white/40 uppercase mt-1 tracking-widest">{file.content.length.toLocaleString()} 字</span>
                    </div>
                  </div>
                  
                  {isSelected && (
                    <div className="flex items-center gap-1 relative z-10 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={(e) => moveItem(e, orderIndex, 'up')} disabled={orderIndex === 0} className="p-2 text-white hover:text-[#2062ee] disabled:opacity-10 transition-colors">
                        {ICONS.ChevronUp}
                      </button>
                      <button onClick={(e) => moveItem(e, orderIndex, 'down')} disabled={orderIndex === selectedIds.length - 1} className="p-2 text-white hover:text-[#2062ee] disabled:opacity-10 transition-colors">
                        {ICONS.ChevronDown}
                      </button>
                      <button onClick={(e) => deleteFromSelected(e, file.id)} className="p-2 text-rose-500 hover:text-rose-400 transition-colors">
                        {ICONS.Trash}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-h-0 bg-black relative">
          {isMerging && (
            <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-20 text-center animate-fade-up">
              <div className="w-24 h-24 mb-8 bg-[#2062ee]/20 border border-[#2062ee]/40 rounded-full flex items-center justify-center text-[#2062ee] shadow-[0_0_40px_rgba(32,98,238,0.2)]">
                <div className="scale-150 animate-pulse flex items-center justify-center">
                  {ICONS.Layers}
                </div>
              </div>
              <h4 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-4">正在进行全量拼接...</h4>
              <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-[#2062ee] transition-all duration-300 shadow-[0_0_15px_rgba(32,98,238,0.5)]" style={{ width: `${mergeProgress}%` }}></div>
              </div>
              <p className="text-[11px] font-black text-white/50 uppercase tracking-widest">章节合并进度 {mergeProgress}%</p>
            </div>
          )}

          {mergedContent ? (
            <>
              <div className="p-6 border-b border-white/10 flex gap-4 justify-between items-center bg-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_100px_rgba(16,185,129,0.5)]"></div>
                  <span className="text-[11px] font-black text-white uppercase tracking-widest italic">合并预览 ({mergedContent.length.toLocaleString()} 字)</span>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleDownloadDocx} className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-white/20 transition-all">
                    {ICONS.Download} DOCX
                  </button>
                  <button onClick={handleDownloadTxt} className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-white/20 transition-all">
                    {ICONS.Download} TXT
                  </button>
                  <button onClick={handleSaveToKB} className="bg-[#2062ee] hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all">
                    存入资料库
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-16 custom-scrollbar bg-black">
                <div className="max-w-4xl mx-auto whitespace-pre-wrap font-sans text-white/90 leading-[2.2] text-lg font-medium italic tracking-wide">
                  {mergedContent}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-20 gap-4">
              <div className="scale-[4] text-white/10">{ICONS.Layers}</div>
              <p className="text-xs font-black uppercase tracking-[0.4em] italic text-white/20">请在左侧选择章节并执行合并</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MergePanel;