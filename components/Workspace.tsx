
import React, { useState } from 'react';
import { WorkspaceTab, KBFile, AudienceMode, ModelType } from '../types.ts';
import { ICONS } from '../constants.tsx';
import ScriptPanel from './ScriptPanel.tsx';
import OutlinePanel from './OutlinePanel.tsx';
import CharacterVisuals from './CharacterVisuals.tsx';

interface WorkspaceProps {
  files: KBFile[];
  onUpdateFiles?: (f: KBFile[]) => void;
}

const Workspace: React.FC<WorkspaceProps> = ({ files, onUpdateFiles }) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(WorkspaceTab.SCRIPT);
  const [mode, setMode] = useState<AudienceMode>(AudienceMode.MALE);

  return (
    <div className="h-full flex overflow-hidden">
      <aside className="w-64 bg-slate-900 p-6 flex flex-col gap-8 shadow-2xl z-20 flex-shrink-0">
        <div>
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">快速作业</h2>
          <nav className="space-y-2">
            {[
              { tab: WorkspaceTab.SCRIPT, icon: ICONS.FileText, label: '生成剧本', color: 'bg-blue-600' },
              { tab: WorkspaceTab.OUTLINE, icon: ICONS.Users, label: '提取大纲', color: 'bg-indigo-600' },
              { tab: WorkspaceTab.VISUALS, icon: ICONS.Image, label: '角色生成', color: 'bg-emerald-600' },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                  activeTab === item.tab ? `${item.color} text-white shadow-lg` : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span className="font-bold text-sm">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
          <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">爽点模式</h3>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setMode(AudienceMode.MALE)}
              className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                mode === AudienceMode.MALE ? 'bg-blue-600 border-blue-400 text-white' : 'bg-transparent border-slate-700 text-slate-500'
              }`}
            >
              {ICONS.Zap} <span className="font-bold text-xs">男频</span>
            </button>
            <button
              onClick={() => setMode(AudienceMode.FEMALE)}
              className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                mode === AudienceMode.FEMALE ? 'bg-rose-600 border-rose-400 text-white' : 'bg-transparent border-slate-700 text-slate-500'
              }`}
            >
              {ICONS.Heart} <span className="font-bold text-xs">女频</span>
            </button>
          </div>
        </div>
      </aside>

      <section className="flex-1 bg-white flex flex-col min-h-0 relative">
        <div className="flex-1 min-h-0 flex flex-col">
          {activeTab === WorkspaceTab.SCRIPT && <ScriptPanel files={files} mode={mode} modelType={ModelType.FLASH} />}
          {activeTab === WorkspaceTab.OUTLINE && <OutlinePanel files={files} onSaveToKB={(f) => onUpdateFiles?.([f])} />}
          {activeTab === WorkspaceTab.VISUALS && <CharacterVisuals mode={mode} />}
        </div>
      </section>
    </div>
  );
};

export default Workspace;
