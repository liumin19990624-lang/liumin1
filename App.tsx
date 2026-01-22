
import React, { useState, useEffect } from 'react';
import { AppStage, KBFile, WorkspaceTab } from './types.ts';
import { ICONS } from './constants.tsx';
import KBManager from './components/KBManager.tsx';
import Workspace from './components/Workspace.tsx';

// Fix: Completed the component and added the missing default export to resolve index.tsx import error.
const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>(AppStage.KB_MANAGEMENT);
  const [files, setFiles] = useState<KBFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialTab, setInitialTab] = useState<WorkspaceTab>(WorkspaceTab.AGENT);
  
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showKeyGate, setShowKeyGate] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      // Load local data from persistence
      const savedFiles = localStorage.getItem('anime_engine_files_v3');
      if (savedFiles) {
        try { 
          const parsed = JSON.parse(savedFiles);
          if (Array.isArray(parsed)) setFiles(parsed);
        } catch (e) { 
          console.error("Failed to load local KB files", e);
          setFiles([]); 
        }
      }

      // Check for necessary API KEY Selection for Veo and advanced models
      // Use pre-configured window.aistudio methods directly
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
        if (!selected) setShowKeyGate(true);
      } else {
        // Fallback or assumption for environments without custom aistudio key selection
        setHasApiKey(true);
      }
      setIsLoading(false);
    };
    initApp();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('anime_engine_files_v3', JSON.stringify(files));
    }
  }, [files, isLoading]);

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true);
      setShowKeyGate(false);
    } else {
      setShowKeyGate(false);
    }
  };
  
  const handleFileUpload = (newFiles: KBFile[]) => setFiles(prev => [...newFiles, ...prev]);
  const handleDeleteFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const navigateToWorkspace = (tab: WorkspaceTab = WorkspaceTab.SCRIPT) => {
    setInitialTab(tab);
    setStage(AppStage.WORKSPACE);
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-[#000000] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-2 border-white/20 border-t-[#2062ee] rounded-full animate-spin mb-4"></div>
        <p className="text-white/60 text-[10px] font-black uppercase tracking-widest italic tracking-tighter">Initialising Anime Engine...</p>
      </div>
    );
  }

  // Fix: Completed the showKeyGate view and ensured className is a string to resolve line 89 error.
  if (showKeyGate) {
    return (
      <div className="h-screen bg-[#000000] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(32,98,238,0.2),transparent_70%)]"></div>
        <div className="card-neo max-w-xl w-full p-12 text-center relative z-10 border-white/20 shadow-[0_0_100px_rgba(0,0,0,1)]">
          <div className="w-20 h-20 bg-[#2062ee] rounded-3xl flex items-center justify-center text-white mx-auto shadow-2xl mb-8">
            {ICONS.Key}
          </div>
          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-4">激活工业级改编算力</h2>
          <p className="text-white/80 text-sm leading-relaxed mb-8 font-medium">
            为了提供极致的 4K 分镜生成及长剧本自动重构，我们需要您连接自己的 <span className="text-[#2062ee] font-black underline decoration-blue-500/50 underline-offset-4 cursor-help" onClick={() => window.open('https://ai.google.dev/gemini-api/docs/billing', '_blank')}>Google Cloud Paid Project</span>。
          </p>
          <button 
            onClick={handleSelectKey}
            className="w-full bg-[#2062ee] hover:bg-blue-600 text-white py-6 rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 shadow-blue-900/40 flex items-center justify-center gap-3"
          >
            {ICONS.Key} 立即连接 API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#000000]">
      <header className="h-20 px-10 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/50 backdrop-blur-xl z-[100]">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-[#2062ee] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-900/40">
            {ICONS.Library}
          </div>
          <div>
            <h1 className="text-xl font-black text-white italic tracking-tighter">ANIME ENGINE <span className="text-[#2062ee]">PRO</span></h1>
            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Directing Intelligence v2.5</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
           {stage === AppStage.WORKSPACE && (
             <button 
               onClick={() => setStage(AppStage.KB_MANAGEMENT)}
               className="text-white/40 hover:text-white flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all"
             >
               {ICONS.ArrowLeft} 返回资料库
             </button>
           )}
           {stage === AppStage.KB_MANAGEMENT && files.length > 0 && (
             <button 
               onClick={() => setStage(AppStage.WORKSPACE)}
               className="bg-[#2062ee] hover:bg-blue-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-blue-900/40 transition-all active:scale-95 flex items-center gap-2"
             >
               启动导演台 {ICONS.ChevronRight}
             </button>
           )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {stage === AppStage.KB_MANAGEMENT ? (
          <KBManager files={files} onUpload={handleFileUpload} onDelete={handleDeleteFile} />
        ) : (
          <Workspace files={files} initialTab={initialTab} onUpdateFiles={handleFileUpload} />
        )}
      </main>
    </div>
  );
};

export default App;
