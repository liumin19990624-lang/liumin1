
import React, { useState } from 'react';
import { AppStage, KBFile } from './types';
import { ICONS } from './constants';
import KBManager from './components/KBManager';
import Workspace from './components/Workspace';

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>(AppStage.KB_MANAGEMENT);
  const [files, setFiles] = useState<KBFile[]>([]);
  
  const handleFileUpload = (newFiles: KBFile[]) => {
    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDeleteFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const nextStage = () => {
    if (files.length === 0) {
      alert("请至少上传一份文件作为资料源");
      return;
    }
    setStage(AppStage.WORKSPACE);
  };

  const prevStage = () => {
    setStage(AppStage.KB_MANAGEMENT);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Dynamic Header */}
      <header className="glass-effect h-16 px-8 flex items-center justify-between shadow-sm z-[100] border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 p-2 rounded-xl text-white shadow-inner">
            {ICONS.Library}
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight tracking-tight">漫剧适配大师 <span className="text-blue-600">Pro</span></h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI Content Workstation v2.0</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {stage === AppStage.WORKSPACE && (
            <button 
              onClick={prevStage}
              className="group flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm px-4 py-2 rounded-xl transition-all border border-slate-200 bg-white shadow-sm"
            >
              <div className="group-hover:-translate-x-1 transition-transform">
                {ICONS.ArrowLeft}
              </div>
              返回知识库
            </button>
          )}

          {stage === AppStage.KB_MANAGEMENT && files.length > 0 && (
            <button 
              onClick={nextStage}
              className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-6 py-2 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95"
            >
              进入工作台
              {ICONS.ChevronRight}
            </button>
          )}
          
          <div className="w-px h-6 bg-slate-200 mx-2"></div>
          
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">AI Core Ready</span>
          </div>
        </div>
      </header>

      {/* Content Area - Full Height Scroll Control */}
      <main className="flex-1 overflow-hidden relative">
        {stage === AppStage.KB_MANAGEMENT ? (
          <KBManager 
            files={files} 
            onUpload={handleFileUpload} 
            onDelete={handleDeleteFile} 
          />
        ) : (
          <Workspace files={files} />
        )}
      </main>
    </div>
  );
};

export default App;
