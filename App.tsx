import React, { useState, useEffect, useCallback } from 'react';
import { AppStage, KBFile, WorkspaceTab } from './types.ts';
import { ICONS } from './constants.tsx';
import KBManager from './components/KBManager.tsx';
import Workspace from './components/Workspace.tsx';

// 本地存储键名常量（避免硬编码）
const LOCAL_STORAGE_KEY = 'anime_engine_files_v3';

// 类型守卫：验证 KBFile 格式
const isKBFile = (file: unknown): file is KBFile => {
  if (!file || typeof file !== 'object') return false;
  const f = file as KBFile;
  return (
    typeof f.id === 'string' &&
    typeof f.name === 'string' &&
    typeof f.content === 'string' &&
    typeof f.type === 'string' &&
    (typeof f.createdAt === 'string' || typeof f.createdAt === 'number')
  );
};

// 验证文件列表格式
const validateFiles = (files: unknown[]): KBFile[] => {
  if (!Array.isArray(files)) return [];
  return files.filter(isKBFile);
};

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>(AppStage.KB_MANAGEMENT);
  const [files, setFiles] = useState<KBFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialTab, setInitialTab] = useState<WorkspaceTab>(WorkspaceTab.SCRIPT);
  const [error, setError] = useState<string | null>(null); // 新增错误状态

  // 从本地存储加载文件（优化性能，使用 useCallback）
  const loadFiles = useCallback(() => {
    try {
      setIsLoading(true);
      const savedFiles = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedFiles) {
        const parsedFiles = JSON.parse(savedFiles);
        const validFiles = validateFiles(parsedFiles);
        setFiles(validFiles);
      } else {
        setFiles([]); // 无存储文件时初始化空数组
      }
      setError(null);
    } catch (e) {
      console.error("Failed to load saved files:", e);
      setError("加载文件失败，请刷新页面重试");
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化加载文件
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // 保存文件到本地存储（优化依赖，避免不必要触发）
  useEffect(() => {
    if (!isLoading && !error) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(files));
      } catch (e) {
        console.error("Failed to save files to localStorage:", e);
        setError("保存文件失败，请检查存储空间");
      }
    }
  }, [files, isLoading, error]);

  // 处理文件上传（去重、添加元数据）
  const handleFileUpload = (newFiles: KBFile[]) => {
    if (!Array.isArray(newFiles) || newFiles.length === 0) return;

    // 验证新文件格式
    const validNewFiles = validateFiles(newFiles)
      // 为新文件添加默认元数据（如果缺失）
      .map(file => ({
        id: file.id || crypto.randomUUID(), // 使用 UUID 确保唯一
        createdAt: file.createdAt || Date.now(),
        updatedAt: Date.now(),
        ...file
      }))
      // 去重（根据 id 或 name）
      .filter(newFile => 
        !files.some(existing => 
          existing.id === newFile.id || existing.name === newFile.name
        )
      );

    setFiles(prev => [...prev, ...validNewFiles]);
  };

  // 处理文件更新（新增：支持单个文件更新）
  const handleUpdateFile = (updatedFile: KBFile) => {
    if (!isKBFile(updatedFile)) return;

    setFiles(prev => 
      prev.map(file => 
        file.id === updatedFile.id 
          ? { ...file, ...updatedFile, updatedAt: Date.now() } 
          : file
      )
    );
  };

  // 处理文件删除（优化逻辑，确保删除后状态同步）
  const handleDeleteFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // 导航到工作区（优化参数验证）
  const navigateToWorkspace = (tab: WorkspaceTab = WorkspaceTab.SCRIPT) => {
    // 验证 tab 有效性
    const validTabs = Object.values(WorkspaceTab);
    if (validTabs.includes(tab)) {
      setInitialTab(tab);
      setStage(AppStage.WORKSPACE);
    } else {
      setInitialTab(WorkspaceTab.SCRIPT);
      setStage(AppStage.WORKSPACE);
    }
  };

  // 刷新文件（新增：手动刷新功能）
  const handleRefreshFiles = () => {
    loadFiles();
  };

  // 加载中状态
  if (isLoading) {
    return (
      <div className="h-screen bg-[#0a0a0c] flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-2 border-white/5 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Initialising Creative Engine...</p>
      </div>
    );
  }

  // 错误状态提示
  if (error) {
    return (
      <div className="h-screen bg-[#0a0a0c] flex flex-col items-center justify-center p-8">
        <div className="bg-red-900/30 border border-red-500/30 rounded-2xl p-6 mb-6 flex items-center gap-4">
          {ICONS.Error}
          <p className="text-red-400 text-sm font-bold">{error}</p>
        </div>
        <button
          onClick={handleRefreshFiles}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold text-xs transition-all shadow-lg flex items-center gap-2"
        >
          {ICONS.Refresh} 刷新页面
        </button>
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
                className="text-slate-400 hover:text-white font-bold text-xs px-4 py-2 border border-white/10 rounded-xl bg-white/5 transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                aria-label="返回资料库"
              >
                {ICONS.ArrowLeft} 资料库
              </button>
            ) : (
              files.length > 0 ? (
                <>
                  <button 
                    onClick={() => navigateToWorkspace(WorkspaceTab.OUTLINE)}
                    className="text-slate-400 hover:text-white font-bold text-xs px-4 py-2 border border-white/10 rounded-xl bg-white/5 transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    aria-label="故事大纲"
                  >
                    {ICONS.FileText} 故事大纲
                  </button>
                  <button 
                    onClick={() => navigateToWorkspace(WorkspaceTab.SCRIPT)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold text-xs transition-all shadow-lg flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    aria-label="启动导演台"
                  >
                    启动导演台 {ICONS.ChevronRight}
                  </button>
                </>
              ) : (
                // 无文件时提示上传
                <div className="text-slate-500 text-xs font-bold">
                  请上传文件以开始创作
                </div>
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
            onUpdate={handleUpdateFile} // 传递更新文件回调
            onRefresh={handleRefreshFiles}
          />
        ) : (
          <Workspace 
            files={files} 
            initialTab={initialTab} 
            onUpdateFile={handleUpdateFile} // 支持工作区更新文件
            onDeleteFile={handleDeleteFile} // 支持工作区删除文件
          />
        )}
      </main>

      {/* 底部状态栏（新增：显示文件统计和状态） */}
      <footer className="h-8 border-t border-white/5 bg-black/40 backdrop-blur-xl px-8 flex items-center justify-between">
        <div className="text-[9px] text-slate-500 font-bold">
          资料库文件数: {files.length}
        </div>
        <div className="text-[9px] text-slate-500 font-bold">
          最后更新: {new Date().toLocaleTimeString()}
        </div>
      </footer>
    </div>
  );
};

export default App;
