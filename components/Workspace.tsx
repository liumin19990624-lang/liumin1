
import React, { useState } from 'react';
import { WorkspaceTab, KBFile, AudienceMode, ModelType } from '../types';
import { ICONS } from '../constants';
import ScriptPanel from './ScriptPanel';
import OutlinePanel from './OutlinePanel';
import CharacterVisuals from './CharacterVisuals';

interface WorkspaceProps {
  files: KBFile[];
}

const Workspace: React.FC<WorkspaceProps> = ({ files }) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(WorkspaceTab.SCRIPT);
  const [mode, setMode] = useState<AudienceMode>(AudienceMode.MALE);
  const [modelType, setModelType] = useState<ModelType>(ModelType.PRO);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 p-8 flex flex-col gap-10 shadow-2xl z-20">
        <div>
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-6">核心枢纽</h2>
          <nav className="space-y-3">
            {[
              { tab: WorkspaceTab.SCRIPT, icon: ICONS.FileText, label: '剧情脚本', color: 'bg-blue-600' },
              { tab: WorkspaceTab.OUTLINE, icon: ICONS.Users, label: '全集大纲', color: 'bg-indigo-600' },
              { tab: WorkspaceTab.VISUALS, icon: ICONS.Image, label: '角色视觉', color: 'bg-emerald-600' },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all duration-300 ${
                  activeTab === item.tab 
                  ? `${item.color} text-white shadow-xl scale-[1.02]` 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="font-black text-sm">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto space-y-6">
          {/* 模型级别切换 */}
          <div className="bg-slate-800/30 p-5 rounded-3xl border border-slate-700/50">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">智力模型</h3>
            <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-700">
              <button 
                onClick={() => setModelType(ModelType.FLASH)}
                className={`text-[10px] font-black py-2 rounded-lg transition-all ${modelType === ModelType.FLASH ? 'bg-slate-700 text-white shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
              >
                快速 FLASH
              </button>
              <button 
                onClick={() => setModelType(ModelType.PRO)}
                className={`text-[10px] font-black py-2 rounded-lg transition-all ${modelType === ModelType.PRO ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                深度 PRO
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 p-6 rounded-[1.5rem] border border-slate-700/50">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-5">爽点引擎模式</h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setMode(AudienceMode.MALE)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  mode === AudienceMode.MALE ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-transparent border-slate-700 text-slate-500'
                }`}
              >
                {ICONS.Zap}
                <span className="font-black text-xs uppercase">男频模式</span>
              </button>
              <button
                onClick={() => setMode(AudienceMode.FEMALE)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  mode === AudienceMode.FEMALE ? 'bg-rose-600 border-rose-400 text-white shadow-lg' : 'bg-transparent border-slate-700 text-slate-500'
                }`}
              >
                {ICONS.Heart}
                <span className="font-black text-xs uppercase">女频模式</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <section className="flex-1 bg-white flex flex-col overflow-hidden relative">
        <div className="relative z-10 h-full">
          {activeTab === WorkspaceTab.SCRIPT && <ScriptPanel files={files} mode={mode} modelType={modelType} />}
          {activeTab === WorkspaceTab.OUTLINE && <OutlinePanel files={files} />}
          {activeTab === WorkspaceTab.VISUALS && <CharacterVisuals mode={mode} />}
        </div>
      </section>
    </div>
  );
};

export default Workspace;
