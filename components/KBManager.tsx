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
      alert("解析文件失败: " + error);
    } finally {
      setIsProcessing(false);
    }
  };

  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.name.endsWith('.docx')) {
        const reader = new FileReader();
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
        const reader = new FileReader();
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
    <div className="h-full flex bg-[#000000] text-white overflow-hidden">
      <aside className="w-80 border-r border-white/10 p-8 flex flex-col gap-8 bg-black">
        <div className="flex-1">
          <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.25em] mb-8 px-2">存储库分类管理</h2>
          <div className="space-y-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full flex items-center justify-between p-5 rounded-[1.5rem] transition-all group border ${
                  selectedCategory === cat.id 
                  ? 'bg-[#2062ee] border-[#2062ee] text-white shadow-xl shadow-blue-900/40' 
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={selectedCategory === cat.id ? 'text-white' : 'text-white/40 group-hover:text-[#2062ee]'}>
                    {cat.icon}
                  </div>
                  <span className="font-bold text-sm tracking-tight">{cat.label}</span>
                </div>
                <span className={`text-[10px] font-black ${selectedCategory === cat.id ? 'bg-black/20' : 'bg-white/10'} px-3 py-1 rounded-full`}>
                  {files.filter(f => f.category === cat.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-6 bg-white/5 border border-white/10 rounded-3xl">
          <p className="text-[10px] font-black text-[#2062ee] uppercase mb-2">资源提示</p>
          <p className="text-[11px] text-white/80 leading-relaxed font-bold italic">
            这里存储了您上传的原著以及所有生成的“连载大纲”、“剧本单元”和“分镜脚本”。
          </p>
        </div>
      </aside>

      <main className="flex-1 p-16 overflow-y-auto custom-scrollbar relative bg-[#000000]">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="card-neo border-2 border-dashed border-white/10 rounded-[4rem] p-20 flex flex-col items-center justify-center bg-white/[0.02] hover:bg-white/[0.05] transition-all relative group">
            {isProcessing && (
              <div className="absolute inset-0 bg-black/95 backdrop-blur-md rounded-[4rem] flex flex-col items-center justify-center z-20">
                <div className="w-12 h-12 border-2 border-white/10 border-t-[#2062ee] rounded-full animate-spin mb-6"></div>
                <p className="text-xs font-black uppercase tracking-widest text-[#2062ee]">正在接入云端存储中心...</p>
              </div>
            )}
            <div className="w-24 h-24 bg-white/5 text-[#2062ee] rounded-[2.5rem] flex items-center justify-center mb-8 border border-white/10 group-hover:scale-110 transition-transform">
              <div className="scale-150">{ICONS.Upload}</div>
            </div>
            <h3 className="text-3xl font-black mb-2 italic tracking-tighter uppercase text-white">入库【{selectedCategory}】</h3>
            <p className="text-white/40 text-sm mb-10 font-bold uppercase tracking-widest">支持 TXT, DOCX。支持拖拽至此区域。</p>
            <label className="cursor-pointer bg-white text-black px-12 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-[#2062ee] hover:text-white transition-all shadow-2xl active:scale-95">
              上传本地文件
              <input type="file" multiple className="hidden" onChange={handleFileInput} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
            {files.filter(f => f.category === selectedCategory).map(file => (
              <div key={file.id} className="card-neo p-8 flex flex-col gap-6 group relative overflow-hidden backdrop-blur-sm animate-fade-up border border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white/40 group-hover:text-[#2062ee] transition-colors">
                      {ICONS.FileText}
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-white truncate max-w-[180px] italic">{file.name}</h5>
                      <p className="text-[9px] font-black text-white/20 uppercase mt-1 tracking-tighter italic">Synced: {new Date(file.uploadDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setViewFile(file)} title="预览" className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/40 hover:text-white transition-all">
                      {ICONS.ChevronRight}
                    </button>
                    <button onClick={() => onDelete(file.id)} title="删除" className="p-3 bg-white/5 hover:bg-rose-600/20 rounded-xl text-white/40 hover:text-rose-500 transition-all">
                      {ICONS.Trash}
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-white/60 line-clamp-3 font-medium leading-relaxed italic">
                   {file.content.substring(0, 200)}...
                </div>
                <div className="flex gap-3 mt-2 border-t border-white/10 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => handleDownloadDocx(file)} className="flex-1 bg-white/5 hover:bg-[#2062ee] text-white/80 hover:text-white border border-white/10 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                     {ICONS.Download} DOCX
                   </button>
                   <button onClick={() => handleDownloadTxt(file)} className="flex-1 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/10 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                     {ICONS.Download} TXT
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {viewFile && (
        <div className="fixed inset-0 z-[150] bg-black/98 backdrop-blur-2xl flex items-center justify-center p-10 animate-fade-up">
          <div className="card-neo w-full max-w-5xl h-full overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,1)] border border-white/20">
            <div className="h-24 px-12 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
               <div className="flex items-center gap-6">
                 <div className="w-3 h-3 rounded-full bg-[#2062ee] shadow-[0_0_15px_rgba(32,98,238,0.8)]"></div>
                 <div>
                   <h4 className="text-xl font-black text-white italic tracking-tighter">{viewFile.name}</h4>
                   <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.3em] mt-1">{viewFile.content.length.toLocaleString()} Characters Deep Dive</p>
                 </div>
               </div>
               <div className="flex items-center gap-4">
                 <button onClick={() => handleDownloadDocx(viewFile)} className="bg-[#2062ee] text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-blue-600 transition-all">
                    {ICONS.Download} Word 导出
                 </button>
                 <button onClick={() => setViewFile(null)} className="text-white/40 hover:text-white transition-all bg-white/5 p-4 rounded-full border border-white/10">
                   {ICONS.ArrowLeft}
                 </button>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-20 custom-scrollbar bg-black">
               <div className="max-w-4xl mx-auto whitespace-pre-wrap font-sans text-white/90 leading-[2.2] text-lg font-medium italic">
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