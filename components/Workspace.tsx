
import React, { useState } from 'react';
import { WorkspaceTab, KBFile, AudienceMode } from '../types';
import { ICONS } from '../constants';
import ScriptPanel from './ScriptPanel';
import OutlinePanel from './OutlinePanel';

interface WorkspaceProps {
  files: KBFile[];
}

const Workspace: React.FC<WorkspaceProps> = ({ files }) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(WorkspaceTab.SCRIPT);
  const [mode, setMode] = useState<AudienceMode>(AudienceMode.MALE);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Workspace Sidebar */}
      <aside className="w-72 bg-slate-900 p-8 flex flex-col gap-10 shadow-2xl z-20">
        <div>
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">作业中心</h2>
          <nav className="space-y-3">
            <button
              onClick={() => setActiveTab(WorkspaceTab.SCRIPT)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group ${
                activeTab === WorkspaceTab.SCRIPT 
                ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/50' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`${activeTab === WorkspaceTab.SCRIPT ? 'text-white' : 'text-slate-600 group-hover:text-blue-400'}`}>
                  {ICONS.FileText}
                </div>
                <span className="font-black text-sm tracking-tight">剧情脚本</span>
              </div>
              {activeTab === WorkspaceTab.SCRIPT && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
            </button>

            <button
              onClick={() => setActiveTab(WorkspaceTab.OUTLINE)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group ${
                activeTab === WorkspaceTab.OUTLINE 
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/50' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`${activeTab === WorkspaceTab.OUTLINE ? 'text-white' : 'text-slate-600 group-hover:text-indigo-400'}`}>
                  {ICONS.Users}
                </div>
                <span className="font-black text-sm tracking-tight">剧情大纲</span>
              </div>
              {activeTab === WorkspaceTab.OUTLINE && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
            </button>
          </nav>
        </div>

        <div className="mt-auto">
          <div className="bg-slate-800/50 p-6 rounded-[1.5rem] border border-slate-700/50 backdrop-blur-sm">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-5">爽点节奏引擎</h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setMode(AudienceMode.MALE)}
                className={`relative group flex items-center gap-3 p-4 rounded-xl transition-all border-2 overflow-hidden ${
                  mode === AudienceMode.MALE 
                  ? 'bg-blue-600 border-blue-400 text-white shadow-lg' 
                  : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${mode === AudienceMode.MALE ? 'bg-white/20' : 'bg-slate-700'}`}>
                  {ICONS.Zap}
                </div>
                <span className="font-black text-xs tracking-widest uppercase">男频模式</span>
                {mode === AudienceMode.MALE && <div className="absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-white/10 to-transparent pointer-events-none"></div>}
              </button>

              <button
                onClick={() => setMode(AudienceMode.FEMALE)}
                className={`relative group flex items-center gap-3 p-4 rounded-xl transition-all border-2 overflow-hidden ${
                  mode === AudienceMode.FEMALE 
                  ? 'bg-rose-600 border-rose-400 text-white shadow-lg' 
                  : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${mode === AudienceMode.FEMALE ? 'bg-white/20' : 'bg-slate-700'}`}>
                  {ICONS.Heart}
                </div>
                <span className="font-black text-xs tracking-widest uppercase">女频模式</span>
                {mode === AudienceMode.FEMALE && <div className="absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-white/10 to-transparent pointer-events-none"></div>}
              </button>
            </div>
            <p className="mt-5 text-[10px] text-slate-500 italic leading-relaxed text-center">AI 将自动调节冲突密度与情感曲线</p>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <section className="flex-1 bg-slate-50/50 flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px] pointer-events-none z-0"></div>
        <div className="relative z-10 h-full flex flex-col">
          {activeTab === WorkspaceTab.SCRIPT ? (
            <ScriptPanel files={files} mode={mode} />
          ) : (
            <OutlinePanel files={files} />
          )}
        </div>
      </section>
    </div>
  );
};

export default Workspace;
