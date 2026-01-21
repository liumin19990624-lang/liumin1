
import React, { useState, useEffect } from 'react';
import { AppStage, KBFile, WorkspaceTab } from './types.ts';
import { ICONS } from './constants.tsx';
import KBManager from './components/KBManager.tsx';
import Workspace from './components/Workspace.tsx';

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>(AppStage.KB_MANAGEMENT);
  const [files, setFiles] = useState<KBFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialTab, setInitialTab] = useState<WorkspaceTab>(WorkspaceTab.SCRIPT);

  useEffect(() => {
    const savedFiles = localStorage.getItem('anime_engine_files_v3');
    if (savedFiles) {
      try {
        setFiles(JSON.parse(savedFiles));
      } catch (e) {
        console.error("Failed to load saved files");
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('anime_engine_files_v3', JSON.stringify(files));
    }
  }, [files, isLoading]);
  
  const handleFileUpload = (newFiles: KBFile[]) => {
    setFiles(prev => [...newFiles, ...prev]);
  };

  const handleDeleteFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const navigateToWorkspace = (tab: WorkspaceTab = WorkspaceTab.SCRIPT) => {
    setInitialTab(tab);
    setStage(AppStage.WORKSPACE);
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-[#0a0a0c] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-2 border-white/5 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Initialising Creative Engine...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#0a0a0c]">
      <header className="h-16 px-8 flex items-center justify-between z-[100] border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg">
            {ICONS.Library}
          </div>
          <div>
            <h1 className="text-lg font-black text-white leading-tight tracking-tight italic">ANIME <span className="text-blue-500 not-italic">ENGINE</span></h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Directed Strategy v3.8</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-3">
            {stage === AppStage.WORKSPACE ? (
              <button 
                onClick={() => setStage(AppStage.KB_MANAGEMENT)}
                className="text-slate-400 hover:text-white font-bold text-xs px-4 py-2 border border-white/10 rounded-xl bg-white/5 transition-all flex items-center gap-2"
              >
                {ICONS.ArrowLeft} 资料库
              </button>
            ) : (
              files.length > 0 && (
                <>
                  <button 
                    onClick={() => navigateToWorkspace(WorkspaceTab.OUTLINE)}
                    className="text-slate-400 hover:text-white font-bold text-xs px-4 py-2 border border-white/10 rounded-xl bg-white/5 transition-all flex items-center gap-2"
                  >
                    {ICONS.FileText} 故事大纲
                  </button>
                  <button 
                    onClick={() => navigateToWorkspace(WorkspaceTab.SCRIPT)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold text-xs transition-all shadow-lg flex items-center gap-2"
                  >
                    启动导演台 {ICONS.ChevronRight}
                  </button>
                </>
              )
            )}
          </nav>
          <div className="w-px h-6 bg-white/10"></div>
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">STRONG DIRECTION ENABLED</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {stage === AppStage.KB_MANAGEMENT ? (
          <KBManager 
            files={files} 
            onUpload={handleFileUpload} 
            onDelete={handleDeleteFile} 
          />
        ) : (
          <Workspace files={files} initialTab={initialTab} onUpdateFiles={handleFileUpload} />
        )}
      </main>
    </div>
  );
};

export default App;
