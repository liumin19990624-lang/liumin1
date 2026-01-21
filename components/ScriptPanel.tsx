import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { KBFile, Category, AudienceMode, ScriptBlock, ModelType, DirectorStyle, TropeType } from '../types';
import { ICONS } from '../constants';
import { GeminiService } from '../services/geminiService';
import { toast } from '../components/Toast'; // 导入 Toast 组件

// 定义导演风格配置
interface DirectorStyleConfig {
  label: string;
  description: string;
}

// 定义桥段类型配置
interface TropeTypeConfig {
  label: string;
  description: string;
}

// 导演风格配置（统一管理）
const DIRECTOR_STYLE_CONFIGS: Record<DirectorStyle, DirectorStyleConfig> = {
  [DirectorStyle.UFOTABLE]: {
    label: 'ufotable',
    description: '光影华丽，打斗流畅，细节丰富，适合奇幻战斗题材'
  },
  [DirectorStyle.MAPPA]: {
    label: 'MAPPA',
    description: '画面张力强，色彩对比鲜明，适合暗黑系题材'
  },
  [DirectorStyle.BONES]: {
    label: 'BONES',
    description: '画风细腻，情感表达丰富，适合日常与战斗结合题材'
  },
  [DirectorStyle.PRODUCTION_I_G]: {
    label: 'Production I.G',
    description: '制作精良，写实风格，适合悬疑推理题材'
  },
  [DirectorStyle.TRIGGER]: {
    label: 'TRIGGER',
    description: '风格夸张，充满活力，适合热血搞笑题材'
  }
};

// 桥段类型配置（统一管理）
const TROPE_TYPE_CONFIGS: Record<TropeType, TropeTypeConfig> = {
  [TropeType.FACE_SLAP]: {
    label: '打脸反转',
    description: '主角被轻视后展现实力，打脸对手的经典桥段'
  },
  [TropeType.CRISIS]: {
    label: '危机爆发',
    description: '突发危机事件，推动剧情进入高潮'
  },
  [TropeType.REVELATION]: {
    label: '真相揭露',
    description: '隐藏的真相被揭开，颠覆之前的认知'
  },
  [TropeType.BONDING]: {
    label: '情感羁绊',
    description: '角色之间建立深厚情感，增强团队凝聚力'
  },
  [TropeType.GROWTH]: {
    label: '成长蜕变',
    description: '主角经历挫折后获得成长，突破自身极限'
  }
};

interface ScriptPanelProps {
  files: KBFile[];
  mode: AudienceMode;
  modelType: ModelType;
  onSaveToKB?: (f: KBFile) => void;
  className?: string;
}

const ScriptPanel: React.FC<ScriptPanelProps> = ({
  files,
  mode,
  modelType,
  onSaveToKB,
  className = '',
}) => {
  const [sourceId, setSourceId] = useState<string>('');
  const [refFileId, setRefFileId] = useState<string>('');
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const [trope, setTrope] = useState<TropeType>(TropeType.FACE_SLAP);
  const [directorStyle, setDirectorStyle] = useState<DirectorStyle>(DirectorStyle.UFOTABLE);
  
  const [blocks, setBlocks] = useState<ScriptBlock[]>([]);
  const [batchCount, setBatchCount] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGeneratingIdx, setCurrentGeneratingIdx] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null); // 新增：当前激活的剧本块

  // 初始化 Gemini 服务（缓存实例）
  const gemini = useMemo(() => new GeminiService(), []);

  // 筛选可用的源文件（剧情类和大纲类）
  const sourceFiles = useMemo(
    () => files.filter(f => f.category === Category.PLOT || f.category === Category.REFERENCE),
    [files]
  );

  // 筛选参考文件（排除当前选中的源文件）
  const referenceFiles = useMemo(
    () => files.filter(f => f.id !== sourceId && (f.category === Category.PLOT || f.category === Category.REFERENCE || f.category === Category.CHARACTER)),
    [files, sourceId]
  );

  // 持久化存储 - 加载剧本块
  useEffect(() => {
    if (sourceId) {
      const saved = localStorage.getItem(`script_blocks_v12_${sourceId}`);
      if (saved) {
        try {
          const parsedBlocks = JSON.parse(saved) as ScriptBlock[];
          setBlocks(parsedBlocks);
          
          // 恢复保存状态
          const savedStatus = parsedBlocks.reduce((acc, block) => {
            acc[block.id] = false;
            return acc;
          }, {} as Record<string, boolean>);
          setSavedStatus(savedStatus);
        } catch (e) {
          console.error('加载剧本块失败：', e);
          setBlocks([]);
          setSavedStatus({});
          toast.error('加载历史剧本失败，已重置');
        }
      } else {
        setBlocks([]);
        setSavedStatus({});
      }
    } else {
      setBlocks([]);
      setSavedStatus({});
      setActiveBlockId(null);
    }
  }, [sourceId]);

  // 持久化存储 - 保存剧本块
  useEffect(() => {
    if (sourceId && blocks.length > 0) {
      localStorage.setItem(`script_blocks_v12_${sourceId}`, JSON.stringify(blocks));
    }
  }, [blocks, sourceId]);

  // 清理流式文本的防抖处理
  const debouncedCleanText = useCallback((text: string) => {
    return GeminiService.cleanText(text);
  }, []);

  // 核心生成函数：生成单个剧本块
  const executeGeneration = useCallback(async (
    currentBlocks: ScriptBlock[],
    targetIdx?: number
  ): Promise<ScriptBlock | null> => {
    const isRegen = targetIdx !== undefined;
    const currentIdx = isRegen ? targetIdx : currentBlocks.length + 1;
    setCurrentGeneratingIdx(currentIdx);
    setStreamingText('');
    setErrorMessage('');

    try {
      const source = files.find(f => f.id === sourceId);
      const refFile = files.find(f => f.id === refFileId);

      if (!source) {
        throw new Error("源文件不存在");
      }

      if (!source.content.trim()) {
        throw new Error("源文件内容为空");
      }

      let fullContent = '';
      // 生成剧本块流
      const stream = gemini.generateScriptBlockStream(
        mode,
        source.content,
        currentBlocks.slice(0, currentIdx - 1),
        currentIdx,
        modelType,
        directorStyle,
        trope,
        refFile?.content || ''
      );

      // 处理流式响应
      for await (const chunk of stream) {
        fullContent += chunk;
        const cleanedText = debouncedCleanText(fullContent);
        setStreamingText(cleanedText);
      }

      const cleanedContent = debouncedCleanText(fullContent);
      if (!cleanedContent.trim()) {
        throw new Error("生成的剧本内容为空");
      }

      return {
        id: isRegen ? currentBlocks[targetIdx - 1].id : Math.random().toString(36).substr(2, 9),
        sourceId: sourceId,
        episodes: `第 ${currentIdx} 集剧本`,
        content: cleanedContent,
        continuityStatus: `改编完成 | ${cleanedContent.length} 字`,
        style: directorStyle,
        trope: trope
      };

    } catch (e: any) {
      console.error("剧本生成失败：", e);
      const errorMsg = e.message || "剧本生成异常，请稍后重试";
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      return null;
    } finally {
      setStreamingText('');
      setCurrentGeneratingIdx(null);
    }
  }, [mode, sourceId, refFileId, modelType, directorStyle, trope, files, gemini, debouncedCleanText]);

  // 生成下一个剧本块
  const handleGenerateNext = useCallback(async (targetIdx?: number) => {
    if (!sourceId) {
      toast.warning("请先选择待改编的小说原著");
      return;
    }

    if (isGenerating) {
      toast.warning("正在生成中，请稍后再试");
      return;
    }

    setIsGenerating(true);
    const result = await executeGeneration(blocks, targetIdx);

    if (result) {
      if (targetIdx !== undefined) {
        // 重新生成指定剧本块
        const newBlocks = [...blocks];
        newBlocks[targetIdx - 1] = result;
        setBlocks(newBlocks);
        setSavedStatus(prev => ({ ...prev, [result.id]: false }));
        toast.success(`第 ${targetIdx} 集剧本重新生成成功`);
      } else {
        // 生成新的剧本块
        setBlocks(prev => [...prev, result]);
        setActiveBlockId(result.id);
        toast.success(`第 ${blocks.length + 1} 集剧本生成成功`);
      }
    }

    setIsGenerating(false);
  }, [sourceId, isGenerating, blocks, executeGeneration]);

  // 批量生成剧本块
  const handleBatchGenerate = useCallback(async () => {
    if (!sourceId) {
      toast.warning("请先选择待改编的小说原著");
      return;
    }

    if (isGenerating) {
      toast.warning("正在生成中，请稍后再试");
      return;
    }

    if (batchCount < 1 || batchCount > 5) {
      toast.warning("批量生成数量请限制在 1-5 集");
      return;
    }

    setIsGenerating(true);
    let successCount = 0;

    try {
      for (let i = 0; i < batchCount; i++) {
        const targetIdx = blocks.length + 1;
        const result = await executeGeneration(blocks, undefined);
        
        if (result) {
          setBlocks(prev => [...prev, result]);
          successCount++;
        } else {
          toast.error(`第 ${targetIdx} 集剧本生成失败，已终止批量生成`);
          break;
        }
      }

      toast.success(`批量生成完成，成功生成 ${successCount} 集剧本`);
    } catch (e) {
      console.error("批量生成失败：", e);
      toast.error("批量生成异常，请稍后重试");
    } finally {
      setIsGenerating(false);
    }
  }, [sourceId, isGenerating, blocks, batchCount, executeGeneration]);

  // 保存剧本块到知识库
  const handleSaveBlock = useCallback((block: ScriptBlock) => {
    if (!onSaveToKB) {
      toast.warning("保存功能未启用");
      return;
    }

    const sourceFile = files.find(f => f.id === sourceId);
    const sourceFileName = sourceFile?.name || '未知文件';

    const newFile: KBFile = {
      id: block.id,
      name: `${block.episodes} - ${sourceFileName}`,
      category: Category.REFERENCE,
      content: block.content,
      uploadDate: new Date().toISOString(),
      fileSize: block.content.length,
      fileType: 'text/plain',
      lastModified: new Date().toISOString(),
      isFavorite: false,
    };

    onSaveToKB(newFile);
    setSavedStatus(prev => ({ ...prev, [block.id]: true }));
    toast.success(`${block.episodes} 已保存到知识库`);
  }, [sourceId, files, onSaveToKB]);

  // 删除剧本块
  const handleDeleteBlock = useCallback((blockId: string, index: number) => {
    if (window.confirm("确定要删除该剧本块吗？此操作不可恢复。")) {
      const newBlocks = blocks.filter(block => block.id !== blockId);
      setBlocks(newBlocks);
      setSavedStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[blockId];
        return newStatus;
      });

      if (activeBlockId === blockId) {
        setActiveBlockId(newBlocks.length > 0 ? newBlocks[newBlocks.length - 1].id : null);
      }

      toast.success(`第 ${index + 1} 集剧本已删除`);
    }
  }, [blocks, activeBlockId]);

  // 清空所有剧本块
  const handleClearAll = useCallback(() => {
    if (blocks.length === 0) {
      toast.warning("暂无剧本块可清空");
      return;
    }

    if (window.confirm("确定要清空所有剧本块吗？此操作不可恢复。")) {
      setBlocks([]);
      setSavedStatus({});
      setActiveBlockId(null);
      localStorage.removeItem(`script_blocks_v12_${sourceId}`);
      toast.success("所有剧本块已清空");
    }
  }, [blocks, sourceId]);

  // 切换源文件时重置状态
  const handleSourceChange = useCallback((newSourceId: string) => {
    if (sourceId !== newSourceId && blocks.length > 0) {
      if (!window.confirm("切换源文件将清空当前剧本块，是否继续？")) {
        return;
      }
    }
    setSourceId(newSourceId);
    setIsSelectionActive(false);
    setRefFileId('');
  }, [sourceId, blocks.length]);

  return (
    <div className={`flex-1 flex flex-col overflow-hidden bg-[#050508] ${className}`}>
      {/* 配置面板 */}
      <div className="h-24 md:h-32 px-6 md:px-10 border-b border-white/5 bg-black/40 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4 z-10">
        {/* 源文件选择 */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1 max-w-xl">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest md:mr-3">
            源文件
          </label>
          <select
            value={sourceId}
            onChange={(e) => handleSourceChange(e.target.value)}
            className="flex-1 p-3 bg-black/40 border border-white/10 text-white rounded-2xl outline-none font-bold text-xs focus:ring-1 focus:ring-blue-500"
          >
            <option value="">选择待改编的原著/大纲...</option>
            {sourceFiles.length > 0 ? (
              sourceFiles.map(f => (
                <option key={f.id} value={f.id}>
                  [{f.category}] {f.name}
                </option>
              ))
            ) : (
              <option value="" disabled>
                暂无可用源文件，请先上传
              </option>
            )}
          </select>
        </div>

        {/* 参考文件选择 */}
        {sourceId && (
          <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1 max-w-xl">
            <label className="text-[10px] font-black text-violet-500 uppercase tracking-widest md:mr-3">
              参考文件 (可选)
            </label>
            <select
              value={refFileId}
              onChange={(e) => setRefFileId(e.target.value)}
              className="flex-1 p-3 bg-black/40 border border-violet-500/20 text-violet-400 rounded-2xl outline-none font-bold text-xs focus:ring-1 focus:ring-violet-500"
            >
              <option value="">选择参考剧本/设定...</option>
              {referenceFiles.length > 0 ? (
                referenceFiles.map(f => (
                  <option key={f.id} value={f.id}>
                    [{f.category}] {f.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  暂无可用参考文件
                </option>
              )}
            </select>
          </div>
        )}
      </div>

      {/* 高级配置面板 */}
      {sourceId && (
        <div className="px-6 py-4 border-b border-white/5 bg-[#0a0a0c]/50 flex flex-wrap items-center gap-6">
          {/* 桥段类型选择 */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1 min-w-[200px]">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest md:mr-3">
              核心桥段
            </label>
            <select
              value={trope}
              onChange={(e) => setTrope(e.target.value as TropeType)}
              className="flex-1 p-3 bg-black/40 border border-white/10 text-white rounded-2xl outline-none font-bold text-xs focus:ring-1 focus:ring-blue-500"
            >
              {Object.entries(TROPE_TYPE_CONFIGS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
            <span className="text-[9px] text-slate-600 max-w-[200px]">
              {TROPE_TYPE_CONFIGS[trope].description}
            </span>
          </div>

          {/* 导演风格选择 */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1 min-w-[200px]">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest md:mr-3">
              导演风格
            </label>
            <select
              value={directorStyle}
              onChange={(e) => setDirectorStyle(e.target.value as DirectorStyle)}
              className="flex-1 p-3 bg-black/40 border border-white/10 text-white rounded-2xl outline-none font-bold text-xs focus:ring-1 focus:ring-blue-500"
            >
              {Object.entries(DIRECTOR_STYLE_CONFIGS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
            <span className="text-[9px] text-slate-600 max-w-[200px]">
              {DIRECTOR_STYLE_CONFIGS[directorStyle].description}
            </span>
          </div>

          {/* 批量生成配置 */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1 min-w-[200px]">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest md:mr-3">
              批量生成
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={batchCount}
                onChange={(e) => setBatchCount(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                min="1"
                max="5"
                className="w-16 p-3 bg-black/40 border border-white/10 text-white rounded-2xl outline-none font-bold text-xs focus:ring-1 focus:ring-blue-500 text-center"
              />
              <span className="text-[10px] text-slate-500">集</span>
              <button
                onClick={handleBatchGenerate}
                disabled={isGenerating || !sourceId}
                className="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase transition-all disabled:opacity-30"
              >
                批量生成
              </button>
            </div>
          </div>

          {/* 清空按钮 */}
          <button
            onClick={handleClearAll}
            disabled={isGenerating || blocks.length === 0}
            className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-500 border border-rose-600/30 rounded-2xl text-[10px] font-black uppercase transition-all disabled:opacity-30"
          >
            {ICONS.Trash} 清空所有
          </button>
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 剧本块列表（左侧） */}
        {sourceId && (
          <div className="w-80 border-r border-white/5 overflow-y-auto custom-scrollbar p-4 bg-[#0a0a0c]/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                剧本集 ({blocks.length})
              </h3>
              <button
                onClick={() => handleGenerateNext()}
                disabled={isGenerating}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1 disabled:opacity-30"
              >
                {ICONS.Plus} 新增
              </button>
            </div>

            {blocks.length > 0 ? (
              <div className="space-y-3">
                {blocks.map((block, index) => (
                  <div
                    key={block.id}
                    onClick={() => setActiveBlockId(block.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all group ${
                      activeBlockId === block.id
                        ? 'bg-blue-600/10 border-blue-500/30'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                    } ${currentGeneratingIdx === index + 1 ? 'animate-pulse' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm text-white">
                        {block.episodes}
                      </h4>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateNext(index + 1);
                          }}
                          disabled={isGenerating}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors disabled:opacity-30"
                          title="重新生成"
                        >
                          {ICONS.Refresh}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBlock(block.id, index);
                          }}
                          disabled={isGenerating}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors disabled:opacity-30"
                          title="删除"
                        >
                          {ICONS.X}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-slate-500">风格：{block.style}</span>
                      <span className="text-slate-600">{block.continuityStatus}</span>
                    </div>
                    <div className="mt-2 text-[9px] text-slate-500">
                      桥段：{TROPE_TYPE_CONFIGS[block.trope].label}
                    </div>
                    {savedStatus[block.id] && (
                      <div className="absolute top-3 right-3 bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full">
                        已保存
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ICONS.FileText className="w-12 h-12 text-slate-600 mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">暂无剧本块</h3>
                <p className="text-[10px] text-slate-500 max-w-xs">
                  点击"新增"按钮生成第一集剧本，或使用批量生成功能一次生成多集
                </p>
              </div>
            )}
          </div>
        )}

        {/* 剧本预览与编辑区（右侧） */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-black p-6 md:p-12">
          {!sourceId ? (
            // 未选择源文件状态
            <div className="flex flex-col items-center justify-center h-full opacity-30">
              <ICONS.FileText className="w-16 h-16 text-slate-600 mb-6" />
              <h3 className="text-xl font-bold text-white mb-3">请先选择源文件</h3>
              <p className="text-[10px] text-slate-500 max-w-md text-center">
                从左侧选择待改编的小说原著或大纲，然后配置生成参数开始剧本创作
              </p>
            </div>
          ) : !activeBlockId && blocks.length === 0 ? (
            // 已选择源文件但无剧本块
            <div className="flex flex-col items-center justify-center h-full opacity-30">
              <ICONS.PlusCircle className="w-16 h-16 text-slate-600 mb-6" />
              <h3 className="text-xl font-bold text-white mb-3">开始创作剧本</h3>
              <p className="text-[10px] text-slate-500 max-w-md text-center">
                点击左侧"新增"按钮生成第一集剧本，或使用批量生成功能一次生成多集
              </p>
            </div>
          ) : (
            // 剧本预览区
            <div className="max-w-4xl mx-auto">
              {errorMessage && (
                <div className="mb-6 p-4 bg-rose-600/10 border border-rose-500/20 rounded-2xl animate-fade-up">
                  <p className="text-rose-400 text-xs font-bold flex items-center gap-2">
                    {ICONS.Error} {errorMessage}
                  </p>
                </div>
              )}

              {/* 生成中状态 */}
              {currentGeneratingIdx !== null && (
                <div className="mb-6 p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl animate-fade-up">
                  <p className="text-blue-400 text-xs font-bold flex items-center gap-2">
                    <span className="animate-spin">{ICONS.Loading}</span> 
                    正在生成第 {currentGeneratingIdx} 集剧本...
                  </p>
                </div>
              )}

              {/* 剧本标题栏 */}
              {activeBlockId && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-white italic">
                      {blocks.find(b => b.id === activeBlockId)?.episodes || '剧本预览'}
                    </h3>
                    <div className="flex flex-wrap gap-3 mt-2">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        {ICONS.Paintbrush} 风格：{DIRECTOR_STYLE_CONFIGS[directorStyle].label}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        {ICONS.Star} 桥段：{TROPE_TYPE_CONFIGS[trope].label}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        {ICONS.User} 受众：{mode === AudienceMode.MALE ? '男性向' : mode === AudienceMode.FEMALE ? '女性向' : '全受众'}
                      </span>
                    </div>
                  </div>

                  {/* 操作按钮组 */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleGenerateNext(currentGeneratingIdx)}
                      disabled={isGenerating}
                      className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-500 border border-rose-600/30 rounded-2xl text-[10px] font-black uppercase transition-all disabled:opacity-30"
                    >
                      {ICONS.Refresh} 重新生成
                    </button>
                    <button
                      onClick={() => handleSaveBlock(blocks.find(b => b.id === activeBlockId)!)}
                      disabled={isGenerating || savedStatus[activeBlockId]}
                      className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase transition-all ${
                        savedStatus[activeBlockId]
                          ? 'bg-emerald-500 text-white flex items-center gap-1'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      } disabled:opacity-30`}
                    >
                      {savedStatus[activeBlockId] ? (
                        <>
                          {ICONS.Check} 已保存
                        </>
                      ) : (
                        '保存到知识库'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 剧本内容预览 */}
              <div className="bg-[#0a0a0c]/80 border border-white/5 rounded-[2rem] p-6 md:p-10 shadow-2xl">
                {streamingText ? (
                  // 流式生成中
                  <div className="whitespace-pre-wrap font-sans text-slate-200 leading-[2.2] text-base font-medium">
                    {streamingText}
                    <span className="inline-block w-2.5 h-5 bg-blue-600 ml-2 animate-pulse shadow-[0_0_10px_rgba(37,99,235,0.8)]" />
                  </div>
                ) : activeBlockId ? (
                  // 生成完成
                  <div className="whitespace-pre-wrap font-sans text-slate-200 leading-[2.2] text-base font-medium">
                    {blocks.find(b => b.id === activeBlockId)?.content || '暂无剧本内容'}
                  </div>
                ) : (
                  // 无激活剧本块
                  <div className="flex items-center justify-center h-64 text-slate-600">
                    请从左侧选择一个剧本块进行预览
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScriptPanel;
