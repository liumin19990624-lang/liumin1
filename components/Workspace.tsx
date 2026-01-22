import React, { useState, useEffect } from 'react';
import { WorkspaceTab, KBFile, AudienceMode, ModelType } from '../types.ts';
import { ICONS } from '../constants.tsx';
import ScriptPanel from './ScriptPanel.tsx';
import OutlinePanel from './OutlinePanel.tsx';
import CharacterVisuals from './CharacterVisuals.tsx';
import ShotsPanel from './ShotsPanel.tsx';
import MergePanel from './MergePanel.tsx';
import AgentPanel from './AgentPanel.tsx';

interface WorkspaceProps {
  files: KBFile[];
  initialTab?: WorkspaceTab;
  onUpdateFiles?: (f: KBFile[]) => void;
}

const Workspace: React.FC<WorkspaceProps> = ({ files, initialTab = WorkspaceTab.AGENT, onUpdateFiles }) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [mode, setMode] = useState<AudienceMode>(AudienceMode.MALE);
  const [allBlocks, setAllBlocks] = useState<any[]>([]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const refreshBlocks = () => {
    const blocks: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('script_blocks_v12_')) {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            blocks.push(...JSON.parse(item));
          } catch(e) {}
        }
      }
    }
    setAllBlocks(blocks);
  };

  useEffect(() => {
    refreshBlocks();
    window.addEventListener('storage', refreshBlocks);
    const interval = setInterval(refreshBlocks, 3000);
    return () => {
      window.removeEventListener('storage', refreshBlocks);
      clearInterval(interval);
    };
  }, [activeTab]);

  const handleSaveToKB = (newFile: KBFile) => {
    onUpdateFiles?.([newFile]);
  };

  const navigateToTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="h-full flex overflow-hidden bg-[#000000]">
      <aside className="w-64 bg-[#000000] p-6 flex flex-col gap-8 shadow-2xl z-20 flex-shrink-0 border-r border-white/10">
        <div>
          <h2 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-6 px-3">快速作业控制台</h2>
          <nav className="space-y-2">
            {[
              { tab: WorkspaceTab.AGENT, icon: ICONS.Brain, label: '策划代理', color: 'bg-[#2062ee]', shadow: 'shadow-blue-900/60' },
              { tab: WorkspaceTab.SCRIPT, icon: ICONS.FileText, label: '生成剧本', color: 'bg-[#2062ee]', shadow: 'shadow-blue-900/60' },
              { tab: WorkspaceTab.SHOTS, icon: ICONS.Library, label: '分镜脚本', color: 'bg-[#2062ee]', shadow: 'shadow-blue-900/60' },
              { tab: WorkspaceTab.OUTLINE, icon: ICONS.List, label: '提取大纲', color: 'bg-[#2062ee]', shadow: 'shadow-blue-900/60' },
              { tab: WorkspaceTab.VISUALS, icon: ICONS.Image, label: '角色生成', color: 'bg-[#2062ee]', shadow: 'shadow-blue-900/60' },
              { tab: WorkspaceTab.MERGE, icon: ICONS.Merge, label: '原著合并', color: 'bg-[#2062ee]', shadow: 'shadow-blue-900/60' },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all duration-300 ${
                  activeTab === item.tab ? `${item.color} text-white shadow-lg ${item.shadow} scale-105 z-10` : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className={`transition-transform duration-300 ${activeTab === item.tab ? 'scale-110' : ''}`}>
                  {item.icon}
                </div>
                <span className="font-bold text-sm tracking-tight">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto bg-white/[0.03] p-5 rounded-[2rem] border border-white/10">
          <h3 className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-4 px-1">频道模式切换</h3>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setMode(AudienceMode.MALE)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                mode === AudienceMode.MALE ? 'bg-blue-600/20 border-blue-500/50 text-[#2062ee]' : 'bg-transparent border-white/5 text-white/20 hover:text-white/40'
              }`}
            >
              {ICONS.Zap} <span className="font-bold text-xs uppercase tracking-widest">男频频道</span>
            </button>
            <button
              onClick={() => setMode(AudienceMode.FEMALE)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                mode === AudienceMode.FEMALE ? 'bg-rose-600/20 border-rose-500/50 text-rose-400' : 'bg-transparent border-white/5 text-white/20 hover:text-white/40'
              }`}
            >
              {ICONS.Heart} <span className="font-bold text-xs uppercase tracking-widest">女频频道</span>
            </button>
          </div>
        </div>
      </aside>

      <section className="flex-1 bg-[#000000] flex flex-col min-h-0 relative">
        <div className="flex-1 min-h-0 flex flex-col">
          {activeTab === WorkspaceTab.AGENT && <AgentPanel files={files} onNavigate={navigateToTab} />}
          {activeTab === WorkspaceTab.SCRIPT && <ScriptPanel files={files} mode={mode} modelType={ModelType.FLASH} onSaveToKB={handleSaveToKB} />}
          {activeTab === WorkspaceTab.OUTLINE && <OutlinePanel files={files} onSaveToKB={handleSaveToKB} />}
          {activeTab === WorkspaceTab.VISUALS && <CharacterVisuals mode={mode} files={files} onSaveToKB={handleSaveToKB} />}
          {activeTab === WorkspaceTab.SHOTS && <ShotsPanel sourceBlocks={allBlocks} files={files} onSaveToKB={handleSaveToKB} />}
          {activeTab === WorkspaceTab.MERGE && <MergePanel files={files} onSaveToKB={handleSaveToKB} />}
        </div>
      </section>
    </div>
  );
};

export default Workspace;