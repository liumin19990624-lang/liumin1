
import React, { useState } from 'react';
import { Category, KBFile } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { DocGenerator } from '../services/docGenerator.ts';
import mammoth from 'mammoth';

interface KBManagerProps {
  files: KBFile[];
  onUpload: (files: KBFile[]) => void;
  onDelete: (id: string) => void;
}

const CATEGORIES = [
  { id: Category.PLOT, label: '剧情原著/大纲', icon: ICONS.FileText },
  { id: Category.CHARACTER, label: '人物设定', icon: ICONS.Users },
  { id: Category.REFERENCE, label: '参考分镜', icon: ICONS.Settings },
  { id: Category.WORLD_BUILDING, label: '场景规则', icon: ICONS.Library },
];

const KBManager: React.FC<KBManagerProps> = ({ files, onUpload, onDelete }) => {
  const [selectedCategory, setSelectedCategory] = useState<Category>(Category.PLOT);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewFile, setViewFile] = useState<KBFile | null>(null);

  const processFiles = async (rawFiles: File[]) => {
    if (rawFiles.length === 0) return;
    setIsProcessing(true);
    try {
      const results: KBFile[] = [];
      for (const file of rawFiles) {
        const content = await readFileContent(file);
        const newFile: KBFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          category: selectedCategory,
          content: content,
          uploadDate: new Date().toISOString()
        };
        results.push(newFile);
      }
      onUpload(results);
    } catch (error) {
      alert("解析文件失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      if (file.name.endsWith('.docx')) {
        reader.onload = async (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          try {
            const result = await mammoth.extractRawText({ arrayBuffer });
            resolve(result.value);
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = (e) => resolve(e.target?.result as string || '');
        reader.readAsText(file);
      }
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files) as File[]);
    }
  };

  const handleDownloadDocx = async (file: KBFile) => {
    const blob = await DocGenerator.createWordDoc(file.name, file.content);
    DocGenerator.downloadBlob(blob, `${file.name.replace(/\.[^/.]+$/, "")}.docx`);
  };

  const handleDownloadTxt = (file: KBFile) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    DocGenerator.downloadBlob(blob, `${file.name.replace(/\.[^/.]+$/, "")}.txt`);
  };

  return (
    <div className="h-full flex bg-[#0a0a0c] text-white overflow-hidden">
      <aside className="w-80 border-r border-white/5 p-8 flex flex-col gap-8 bg-black/40 backdrop-blur-3xl">
        <div className="flex-1">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-8">存储库分类管理</h2>
          <div className="space-y-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full flex items-center justify-between p-5 rounded-[1.5rem] transition-all group ${
                  selectedCategory === cat.id 
                  ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40 border border-blue-400/30' 
                  : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={selectedCategory === cat.id ? 'text-white' : 'text-slate-600 group-hover:text-blue-500'}>
                    {cat.icon}
                  </div>
                  <span className="font-bold text-sm tracking-tight">{cat.label}</span>
                </div>
                <span className={`text-[10px] font-black ${selectedCategory === cat.id ? 'bg-white/20' : 'bg-white/5'} px-3 py-1 rounded-full`}>
                  {files.filter(f => f.category === cat.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-6 bg-blue-600/10 border border-blue-500/20 rounded-3xl">
          <p className="text-[10px] font-black text-blue-400 uppercase mb-2">资源提示</p>
          <p className="text-[11px] text-blue-200/60 leading-relaxed font-bold italic">
            这里存储了您上传的原著以及所有生成的“连载大纲”、“剧本单元”和“分镜脚本”。
          </p>
        </div>
      </aside>

      <main className="flex-1 p-16 overflow-y-auto custom-scrollbar relative">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="border-2 border-dashed border-white/10 rounded-[4rem] p-20 flex flex-col items-center justify-center bg-white/[0.02] hover:bg-white/[0.03] transition-all relative group shadow-2xl">
            {isProcessing && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md rounded-[4rem] flex flex-col items-center justify-center z-20">
                <div className="w-12 h-12 border-2 border-white/5 border-t-blue-500 rounded-full animate-spin mb-6"></div>
                <p className="text-xs font-black uppercase tracking-widest text-blue-500">正在接入云端存储中心...</p>
              </div>
            )}
            <div className="w-24 h-24 bg-blue-600/10 text-blue-600 rounded-[2.5rem] flex items-center justify-center mb-8 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <div className="scale-150">{ICONS.Upload}</div>
            </div>
            <h3 className="text-3xl font-black mb-2 italic tracking-tighter uppercase">入库【{selectedCategory}】</h3>
            <p className="text-slate-500 text-sm mb-10 font-bold uppercase tracking-widest">支持 TXT, DOCX。支持拖拽至此区域。</p>
            <label className="cursor-pointer bg-white text-black px-12 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-2xl active:scale-95">
              上传本地文件
              <input type="file" multiple className="hidden" onChange={handleFileInput} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
            {files.filter(f => f.category === selectedCategory).map(file => (
              <div key={file.id} className="bg-white/[0.03] border border-white/10 p-8 rounded-[2.5rem] flex flex-col gap-6 group hover:border-blue-500/30 transition-all relative overflow-hidden backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 group-hover:text-blue-500 transition-colors">
                      {ICONS.FileText}
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-white truncate max-w-[180px] italic">{file.name}</h5>
                      <p className="text-[9px] font-black text-slate-600 uppercase mt-1 tracking-tighter italic">Synced: {new Date(file.uploadDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setViewFile(file)} title="预览" className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-all">
                      {ICONS.ChevronRight}
                    </button>
                    <button onClick={() => onDelete(file.id)} title="删除" className="p-3 bg-white/5 hover:bg-rose-500/20 rounded-xl text-slate-500 hover:text-rose-500 transition-all">
                      {ICONS.Trash}
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 line-clamp-3 font-medium leading-relaxed italic">
                   {file.content.substring(0, 200)}...
                </div>
                <div className="flex gap-3 mt-2 border-t border-white/5 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => handleDownloadDocx(file)} className="flex-1 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-500/20 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                     {ICONS.Download} DOCX
                   </button>
                   <button onClick={() => handleDownloadTxt(file)} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                     {ICONS.Download} TXT
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {viewFile && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-10 animate-fade-up">
          <div className="w-full max-w-5xl h-full bg-[#0a0a0c] border border-white/10 rounded-[4rem] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(30,41,59,0.5)]">
            <div className="h-24 px-12 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
               <div className="flex items-center gap-6">
                 <div className="w-3 h-3 rounded-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.8)]"></div>
                 <div>
                   <h4 className="text-xl font-black text-white italic tracking-tighter">{viewFile.name}</h4>
                   <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em] mt-1">{viewFile.content.length.toLocaleString()} Characters Deep Dive</p>
                 </div>
               </div>
               <div className="flex items-center gap-4">
                 <button onClick={() => handleDownloadDocx(viewFile)} className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-blue-500 transition-all">
                    {ICONS.Download} Word 导出
                 </button>
                 <button onClick={() => setViewFile(null)} className="text-slate-400 hover:text-white transition-all bg-white/5 p-4 rounded-full border border-white/10">
                   {ICONS.ArrowLeft}
                 </button>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-20 custom-scrollbar">
               <div className="max-w-4xl mx-auto whitespace-pre-wrap font-sans text-white/90 leading-[2.2] text-lg font-light italic">
                 {viewFile.content}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KBManager;
