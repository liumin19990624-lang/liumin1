
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
  { id: Category.PLOT, label: '剧情资料', icon: ICONS.FileText },
  { id: Category.CHARACTER, label: '人物设定', icon: ICONS.Users },
  { id: Category.REFERENCE, label: '参考脚本', icon: ICONS.Settings },
  { id: Category.WORLD_BUILDING, label: '场景与规则', icon: ICONS.Library },
];

const KBManager: React.FC<KBManagerProps> = ({ files, onUpload, onDelete }) => {
  const [selectedCategory, setSelectedCategory] = useState<Category>(Category.PLOT);
  const [isProcessing, setIsProcessing] = useState(false);

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
    <div className="h-full flex bg-slate-950 text-white">
      <aside className="w-80 border-r border-white/5 p-8 flex flex-col gap-8 bg-black/20">
        <div>
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">资料库分类</h2>
          <div className="space-y-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                  selectedCategory === cat.id 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  {cat.icon}
                  <span className="font-bold text-sm">{cat.label}</span>
                </div>
                <span className="text-[10px] font-black opacity-40">
                  {files.filter(f => f.category === cat.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 p-12 overflow-y-auto custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="border-2 border-dashed border-white/10 rounded-[3rem] p-16 flex flex-col items-center justify-center bg-white/5 relative">
            {isProcessing && (
              <div className="absolute inset-0 bg-black/60 rounded-[3rem] flex flex-col items-center justify-center z-10">
                <div className="w-10 h-10 border-2 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <p className="text-xs font-black uppercase">正在读取核心资料...</p>
              </div>
            )}
            <div className="w-20 h-20 bg-blue-600/20 text-blue-500 rounded-3xl flex items-center justify-center mb-6">
              <div className="scale-150">{ICONS.Upload}</div>
            </div>
            <h3 className="text-2xl font-black mb-2">上传【{selectedCategory}】</h3>
            <p className="text-slate-500 text-sm mb-8">支持 TXT, DOCX。内容将被 AI 引擎实时结构化。</p>
            <label className="cursor-pointer bg-white text-black px-10 py-4 rounded-2xl font-black text-sm hover:scale-105 transition-all">
              选择本地文件
              <input type="file" multiple className="hidden" onChange={handleFileInput} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {files.filter(f => f.category === selectedCategory).map(file => (
              <div key={file.id} className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="text-slate-500">{ICONS.FileText}</div>
                  <div>
                    <h5 className="font-bold text-sm truncate max-w-[200px]">{file.name}</h5>
                    <p className="text-[9px] font-black text-slate-500 uppercase mt-1">{new Date(file.uploadDate).toLocaleDateString()}</p>
                  </div>
                </div>
                <button onClick={() => onDelete(file.id)} className="text-slate-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                  {ICONS.Trash}
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default KBManager;
