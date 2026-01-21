import React, { useState, useEffect, useCallback } from 'react';
import { WorkspaceTab, KBFile, AudienceMode, ModelType, ScriptBlock } from '../types';
import { ICONS } from '../constants';
import ScriptPanel from './ScriptPanel.tsx';
import OutlinePanel from './OutlinePanel.tsx';
import CharacterVisuals from './CharacterVisuals.tsx';
import ShotsPanel from './ShotsPanel.tsx';
import MergePanel from './MergePanel.tsx';
import { toast } from '../components/Toast'; // 导入 Toast 组件

interface WorkspaceProps {
  files: KBFile[];
  initialTab?: WorkspaceTab;
  onUpdateFiles?: (f: KBFile[]) => void;
  onDeleteFile?: (fileId: string) => void; // 新增：文件删除回调
}

// 定义导航项配置
interface NavItem {
  tab: WorkspaceTab;
  icon: React.ReactNode;
  label: string;
  color: string;
  description: string; // 新增：功能描述
}

const Workspace: React.FC<WorkspaceProps> = ({
  files,
  initialTab = WorkspaceTab.SCRIPT,
  onUpdateFiles,
  onDeleteFile,
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialTab);
  const [mode, setMode] = useState<AudienceMode>(AudienceMode.MALE);
  const [allBlocks, setAllBlocks] = useState<ScriptBlock[]>([]); // 修正类型为 ScriptBlock[]
  const [isRefreshing, setIsRefreshing] = useState(false); // 新增：刷新状态

  // 初始化时设置初始标签页
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // 刷新剧本块（优化性能和错误处理）
  const refreshBlocks = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    try {
      const blocks: ScriptBlock[] = [];
      // 遍历 localStorage 查找所有剧本块
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('script_blocks_v12_')) {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed = JSON.parse(item) as ScriptBlock[];
            // 去重并添加源文件信息
            const uniqueBlocks = parsed.filter(block => 
              !blocks.some(existing => existing.id === block.id)
            );
            blocks.push(...uniqueBlocks);
          }
        }
      }

      // 按集数排序
      blocks.sort((a, b) => {
        const numA = parseInt(a.episodes.replace(/[^0-9]/g, '')) || 0;
        const numB = parseInt(b.episodes.replace(/[^0-9]/g, '')) || 0;
        return numA - numB;
      });

      setAllBlocks(blocks);
    } catch (e) {
      console.error('刷新剧本块失败：', e);
      toast.error('刷新剧本列表失败，请重试');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // 初始化和监听剧本块变化
  useEffect(() => {
    refreshBlocks();
    
    // 监听 storage 变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('script_blocks_v12_')) {
        refreshBlocks();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // 轮询检查（优化为 5 秒一次，减少性能消耗）
    const interval = setInterval(refreshBlocks, 5000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [refreshBlocks, activeTab]);

  // 保存文件到知识库（优化错误处理和反馈）
  const handleSaveToKB = useCallback((newFile: KBFile) => {
    if (!newFile || !newFile.content.trim()) {
      toast.warning('文件内容为空，保存失败');
      return;
    }

    onUpdateFiles?.([newFile]);
    toast.success(`文件 "${newFile.name}" 已保存到知识库`);
  }, [onUpdateFiles]);

  // 清除所有剧本块（新增功能）
  const handleClearAllBlocks = useCallback(() => {
    if (allBlocks.length === 0) {
      toast.warning('暂无剧本块可清除');
      return;
    }

    if (window.confirm('确定要清除所有剧本块吗？此操作不可恢复！')) {
      // 清除所有相关的 localStorage 项
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('script_blocks_v12_')) {
          localStorage.removeItem(key);
        }
      }

      setAllBlocks([]);
      toast.success('所有剧本块已清除');
    }
  }, [allBlocks.length]);

  // 导航项配置（新增功能描述）
  const navItems: NavItem[] = [
    {
      tab: WorkspaceTab.SCRIPT,
      icon: ICONS.FileText,
      label: '生成剧本',
      color: 'bg-blue-600',
      description: '将小说改编为动画剧本'
    },
    {
      tab: WorkspaceTab.SHOTS,
      icon: ICONS.Library,
      label: '分镜脚本',
      color: 'bg-violet-600',
      description: '生成精细化分镜列表'
    },
    {
      tab: WorkspaceTab.OUTLINE,
      icon: ICONS.List, // 修正图标为列表更贴合大纲功能
      label: '提取大纲',
      color: 'bg-indigo-600',
      description: '生成剧情大纲和人物设定'
    },
    {
      tab: WorkspaceTab.VISUALS,
      icon: ICONS.Image,
      label: '角色生成',
      color: 'bg-emerald-600',
      description: '生成角色视觉参考图'
    },
    {
      tab: WorkspaceTab.MERGE,
      icon: ICONS.Merge,
      label: '原著合并',
      color: 'bg-amber-600',
      description: '合并多个原著文件'
    },
  ];

  return (
    <div className="h-full flex overflow-hidden bg-[#050508]">
      {/* 侧边导航栏 */}
      <aside className="w-64 bg-[#151517] p-6 flex flex-col gap-8 shadow-2xl z-20 flex-shrink-0 border-r border-white/5">
        {/* 导航菜单 */}
        <div>
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">快速作业</h2>
          <nav className="space-y-2">
            {navItems.map((item) => (
              <button
                key={item.tab}
                onClick={() => setActiveTab(item.tab)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                  activeTab === item.tab
                    ? `${item.color} text-white shadow-lg`
                    : 'text-slate-400 hover:bg-[#1e1e1e] hover:text-slate-200'
                }`}
                title={item.description}
              >
                {/* 装饰条 */}
                {activeTab === item.tab && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-white/30"></span>
                )}
                {item.icon}
                <span className="font-bold text-sm">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* 剧本块统计（新增） */}
        {allBlocks.length > 0 && (
          <div className="bg-[#1e1e1e] p-4 rounded-2xl border border-white/5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                剧本统计
              </h3>
              <button
                onClick={handleClearAllBlocks}
                className="text-[10px] text-rose-500 hover:text-rose-400 transition-colors"
                title="清除所有剧本块"
              >
                {ICONS.Trash}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">总集数</span>
                <span className="text-xs font-bold text-white">{allBlocks.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">总字数</span>
                <span className="text-xs font-bold text-white">
                  {allBlocks.reduce((acc, block) => acc + block.content.length, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 受众模式选择 */}
        <div className="mt-auto bg-[#1e1e1e] p-4 rounded-2xl border border-white/5">
          <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">
            受众模式
          </h3>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setMode(AudienceMode.MALE)}
              className={`flex items-center gap-2 p-3 rounded-xl border transition-all duration-300 ${
                mode === AudienceMode.MALE
                  ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                  : 'bg-transparent border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
              }`}
            >
              {ICONS.Zap}
              <span className="font-bold text-xs">男频</span>
            </button>
            <button
              onClick={() => setMode(AudienceMode.FEMALE)}
              className={`flex items-center gap-2 p-3 rounded-xl border transition-all duration-300 ${
                mode === AudienceMode.FEMALE
                  ? 'bg-rose-600 border-rose-400 text-white shadow-md'
                  text-white shadow-md'
                  : 'bg-transparent border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
              }`}
            >
              {ICONS.Heart}
              <span className="font-bold text-xs">女频</span>
            </button>
            <button
              onClick={() => setMode(AudienceMode.ALL)}
              className={`flex items-center gap-2 p-3 rounded-xl border transition-all duration-300 ${
                mode === AudienceMode.ALL
                  ? 'bg-emerald-600 border-emerald-400 text-white shadow-md'
                  : 'bg-transparent border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
              }`}
            >
              {ICONS.Globe}
              <span className="font-bold text-xs">全受众</span>
            </button>
          </div>
        </div>

        {/* 刷新按钮（新增） */}
        <button
          onClick={refreshBlocks}
          disabled={isRefreshing}
          className="mt-4 w-full py-2 bg-[#1e1e1e] hover:bg-[#252525] text-slate-400 hover:text-white rounded-xl transition-all flex items-center justify-center gap-2 text-xs font-bold"
        >
          {isRefreshing ? (
            <span className="animate-spin">{ICONS.Loading}</span>
          ) : (
            ICONS.Refresh
          )}
          {isRefreshing ? '刷新中...' : '刷新剧本列表'}
        </button>
      </aside>

      {/* 主内容区 */}
      <section className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {activeTab === WorkspaceTab.SCRIPT && (
            <ScriptPanel
              files={files}
              mode={mode}
              modelType={ModelType.FLASH}
              onSaveToKB={handleSaveToKB}
            />
          )}
          {activeTab === WorkspaceTab.OUTLINE && (
            <OutlinePanel
              files={files}
              onSaveToKB={handleSaveToKB}
            />
          )}
          {activeTab === WorkspaceTab.VISUALS && (
            <CharacterVisuals
              mode={mode}
              files={files}
              onSaveToKB={handleSaveToKB}
            />
          )}
          {activeTab === WorkspaceTab.SHOTS && (
            <ShotsPanel
              sourceBlocks={allBlocks}
              files={files}
              onSaveToKB={handleSaveToKB}
            />
          )}
          {activeTab === WorkspaceTab.MERGE && (
            <MergePanel
              files={files}
              onSaveToKB={handleSaveToKB}
            />
          )}
        </div>
      </section>
    </div>
  );
};

export default Workspace;
