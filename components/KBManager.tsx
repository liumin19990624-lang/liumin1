
import React, { useState } from 'react';
import { Category, KBFile } from '../types';
import { ICONS } from '../constants';
import mammoth from 'mammoth';

interface KBManagerProps {
  files: KBFile[];
  onUpload: (files: KBFile[]) => void;
  onDelete: (id: string) => void;
}

const CATEGORIES = [
  { id: Category.PLOT, label: '剧情资料', icon: ICONS.FileText, color: 'blue' },
  { id: Category.CHARACTER, label: '人物设定', icon: ICONS.Users, color: 'emerald' },
  { id: Category.REFERENCE, label: '参考脚本', icon: ICONS.Settings, color: 'amber' },
  { id: Category.WORLD_BUILDING, label: '场景与规则', icon: ICONS.Library, color: 'rose' },
];

const KBManager: React.FC<KBManagerProps> = ({ files, onUpload, onDelete }) => {
  const [selectedCategory, setSelectedCategory] = useState<Category>(Category.PLOT);
  const [dragging, setDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = async (rawFiles: File[]) => {
    if (rawFiles.length === 0) return;
    setIsProcessing(true);
    try {
      const results: KBFile[] = [];
      for (const file of rawFiles) {
        const content = await readFileContent(file);
        
        // 核心改动：上传到后端并保存至数据库
        const res = await fetch('/api/kb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            category: selectedCategory,
            content: content
          })
        });

        if (res.ok) {
          const savedFile = await res.json();
          results.push(savedFile);
        }
      }
      onUpload(results);
    } catch (error) {
      alert("同步至云端失败，请检查网络连接。");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此资料吗？云端备份也将同步移除。")) return;
    try {
      const res = await fetch(`/api/kb?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete(id);
      }
    } catch (err) {
      alert("删除失败");
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
            reject(new Error(`无法解析 DOCX: ${file.name}`));
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = (e) => resolve(e.target?.result as string || '');
        reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`));
        reader.readAsText(file);
      }
    });
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    processFiles(Array.from(e.dataTransfer.files) as File[]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files) as File[]);
    }
  };

  return (
    <div className="h-full flex bg-slate-50/50">
      <aside className="w-80 border-r border-slate-200/60 p-8 flex flex-col gap-10">
        <div>
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 px-2">云端档案库</h2>
          <div className="space-y-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group ${
                  selectedCategory === cat.id 
                  ? 'bg-slate-900 text-white shadow-xl translate-x-2' 
                  : 'text-slate-500 hover:bg-white hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`${selectedCategory === cat.id ? 'text-white' : 'text-slate-300 group-hover:text-slate-900'}`}>
                    {cat.icon}
                  </div>
                  <span className="font-bold text-sm tracking-tight">{cat.label}</span>
                </div>
                <div className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  selectedCategory === cat.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {files.filter(f => f.category === cat.id).length}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto bg-blue-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-2xl">
          <h3 className="font-black text-lg mb-2 relative z-10">云端同步已开启</h3>
          <p className="text-xs text-blue-100 opacity-90 relative z-10">
            您的资料已通过企业级加密存储于云端，随时随地开启创作。
          </p>
        </div>
      </aside>

      <main className="flex-1 p-12 overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-12">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleFileDrop}
            className={`relative border-2 border-dashed rounded-[3rem] p-20 flex flex-col items-center justify-center transition-all duration-500 ${
              dragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white'
            }`}
          >
            {isProcessing && (
              <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center gap-5">
                <div className="w-14 h-14 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
                <p className="font-black text-xl">正在同步至云端服务器...</p>
              </div>
            )}
            <div className={`w-28 h-28 rounded-[2.5rem] flex items-center justify-center mb-8 ${dragging ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-300'}`}>
              <div className="scale-[2]">{ICONS.Upload}</div>
            </div>
            <h3 className="text-3xl font-black text-slate-900 mb-3">上传至【{selectedCategory}】</h3>
            <label className="mt-10 cursor-pointer">
              <span className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-black">选择本地文件</span>
              <input type="file" multiple className="hidden" onChange={handleFileInput} />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
            {files.filter(f => f.category === selectedCategory).map(file => (
              <div key={file.id} className="bg-white border border-slate-100 p-8 rounded-[2.5rem] hover:shadow-2xl transition-all relative group">
                <button 
                  onClick={() => handleDelete(file.id)}
                  className="absolute right-6 top-6 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                >
                  {ICONS.Trash}
                </button>
                <div className="p-4 rounded-2xl bg-slate-50 text-slate-600 mb-6 inline-block">
                  {CATEGORIES.find(c => c.id === file.category)?.icon}
                </div>
                <h5 className="font-black text-slate-800 text-lg line-clamp-2">{file.name}</h5>
                <p className="text-[10px] font-bold text-slate-300 mt-4 uppercase">Stored in Cloud</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default KBManager;
