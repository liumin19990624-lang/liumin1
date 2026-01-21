
import React, { useState } from 'react';
import { Category, KBFile } from '../types.ts';
import { ICONS } from '../constants.tsx';
import mammoth from 'mammoth';

interface KBManagerProps {
  files: KBFile[];
  onUpload: (files: KBFile[]) => void;
  onDelete: (id: string) => void;
}

const CATEGORIES = [
  { id: Category.PLOT, label: '剧情原著/大纲', icon: ICONS.FileText },
  { id: Category.CHARACTER, label: '人物设定', icon: ICONS.Users },
  { id: Category.REFERENCE, label: '参考脚本', icon: ICONS.Settings },
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

  return (
    <div className="h-full flex bg-[#0a0a0c] text-white overflow-hidden">
      <aside className="w-80 border-r border-white/5 p-8 flex flex-col gap-8 bg-black/40 backdrop-blur-3xl">
        <div>
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-8">Asset Categorization</h2>
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
      </aside>

      <main className="flex-1 p-16 overflow-y-auto custom-scrollbar relative">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="border-2 border-dashed border-white/10 rounded-[4rem] p-20 flex flex-col items-center justify-center bg-white/[0.02] hover:bg-white/[0.03] transition-all relative group">
            {isProcessing && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md rounded-[4rem] flex flex-col items-center justify-center z-20">
                <div className="w-12 h-12 border-2 border-white/5 border-t-blue-500 rounded-full animate-spin mb-6"></div>
                <p className="text-xs font-black uppercase tracking-widest text-blue-500">正在重构神经元资料...</p>
              </div>
            )}
            <div className="w-24 h-24 bg-blue-600/10 text-blue-600 rounded-[2.5rem] flex items-center justify-center mb-8 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <div className="scale-150">{ICONS.Upload}</div>
            </div>
            <h3 className="text-3xl font-black mb-2 italic tracking-tighter">上传【{selectedCategory}】</h3>
            <p className="text-slate-500 text-sm mb-10 font-medium">支持 TXT, DOCX。大型小说将自动分片适配。</p>
            <label className="cursor-pointer bg-white text-black px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-2xl">
              选择文件
              <input type="file" multiple className="hidden" onChange={handleFileInput} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
            {files.filter(f => f.category === selectedCategory).map(file => (
              <div key={file.id} className="bg-white/[0.03] border border-white/10 p-8 rounded-[2.5rem] flex flex-col gap-6 group hover:border-blue-500/30 transition-all relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 group-hover:text-blue-500 transition-colors">
                      {ICONS.FileText}
                    </div>
                    <div>
                      <h5 className="font-bold text-sm text-white truncate max-w-[200px]">{file.name}</h5>
                      <p className="text-[9px] font-black text-slate-500 uppercase mt-1">Uploaded {new Date(file.uploadDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setViewFile(file)} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-all">
                      {ICONS.ChevronRight}
                    </button>
                    <button onClick={() => onDelete(file.id)} className="p-3 bg-white/5 hover:bg-rose-500/20 rounded-xl text-slate-500 hover:text-rose-500 transition-all">
                      {ICONS.Trash}
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 line-clamp-3 font-medium leading-relaxed">
                   {file.content.substring(0, 150)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {viewFile && (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-10 animate-fade-up">
          <div className="w-full max-w-5xl h-full bg-[#0a0a0c] border border-white/10 rounded-[3rem] overflow-hidden flex flex-col shadow-2xl">
            <div className="h-20 px-10 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
               <div className="flex items-center gap-4">
                 <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                 <h4 className="text-sm font-black text-white italic">{viewFile.name}</h4>
                 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{viewFile.content.length} Characters</span>
               </div>
               <button onClick={() => setViewFile(null)} className="text-slate-500 hover:text-white transition-all bg-white/5 p-3 rounded-full">
                 {ICONS.ArrowLeft}
               </button>
            </div>
            <div className="flex-1 overflow-y-auto p-16 custom-scrollbar">
               <div className="whitespace-pre-wrap font-sans text-white/80 leading-[2] text-base font-light">
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
