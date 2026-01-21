
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
  const [mergeTitle, setMergeTitle] = useState('合并作品_' + new Date().toLocaleDateString());

  const plotFiles = useMemo(() => files.filter(f => f.category === Category.PLOT), [files]);

  const toggleFile = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIds = [...selectedIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newIds.length) return;
    [newIds[index], newIds[targetIndex]] = [newIds[targetIndex], newIds[index]];
    setSelectedIds(newIds);
  };

  const handleMerge = () => {
    if (selectedIds.length === 0) return;
    setIsMerging(true);
    // 核心逻辑：一字不动，按顺序拼接
    const fullText = selectedIds
      .map(id => files.find(f => f.id === id)?.content || '')
      .join('\n\n');
    
    setMergedContent(fullText);
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
    <div className="flex-1 flex flex-col bg-[#050508] overflow-hidden">
      <div className="h-20 px-10 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-xl shrink-0">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Content Consolidation</span>
          <h2 className="text-xl font-black text-white italic">原著章节无损合并工具</h2>
        </div>
        <div className="flex items-center gap-4">
          <input 
            value={mergeTitle} 
            onChange={e => setMergeTitle(e.target.value)} 
            className="bg-slate-900 border border-white/10 text-white rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-blue-500 w-64"
            placeholder="合并后文件名..."
          />
          <button 
            disabled={selectedIds.length === 0}
            onClick={handleMerge}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white px-6 py-2 rounded-xl font-black text-xs uppercase transition-all shadow-lg"
          >
            执行合并
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：选择与排序 */}
        <div className="w-96 border-r border-white/5 overflow-y-auto custom-scrollbar p-6 bg-white/[0.02]">
          <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">选择与排序章节</h3>
          <div className="space-y-3">
            {plotFiles.map(file => {
              const orderIndex = selectedIds.indexOf(file.id);
              const isSelected = orderIndex !== -1;
              return (
                <div 
                  key={file.id} 
                  onClick={() => toggleFile(file.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group ${
                    isSelected ? 'bg-blue-600/10 border-blue-500/50' : 'bg-white/5 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${isSelected ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-500'}`}>
                      {isSelected ? orderIndex + 1 : '+'}
                    </div>
                    <span className="text-xs font-bold text-white truncate">{file.name}</span>
                  </div>
                  {isSelected && (
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); moveItem(orderIndex, 'up'); }} className="text-slate-500 hover:text-white">{ICONS.ChevronLeft}</button>
                      <button onClick={(e) => { e.stopPropagation(); moveItem(orderIndex, 'down'); }} className="text-slate-500 hover:text-white">{ICONS.ChevronRight}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧：预览与导出 */}
        <div className="flex-1 flex flex-col min-h-0 bg-black">
          {mergedContent ? (
            <>
              <div className="p-4 border-b border-white/5 flex gap-4 justify-end bg-white/[0.03]">
                <button onClick={handleDownloadDocx} className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                  {ICONS.Download} DOCX
                </button>
                <button onClick={handleDownloadTxt} className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                  {ICONS.Download} TXT
                </button>
                <button onClick={handleSaveToKB} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                  存入资料库
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                <div className="max-w-4xl mx-auto whitespace-pre-wrap font-sans text-slate-400 leading-relaxed text-sm italic">
                  {mergedContent}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-20">
              <div className="scale-[3] mb-8">{ICONS.Layers}</div>
              <p className="text-xs font-black uppercase tracking-widest">请在左侧选择章节并执行合并</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MergePanel;
