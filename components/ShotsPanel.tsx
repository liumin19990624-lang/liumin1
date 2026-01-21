import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { ICONS } from '../constants';
import { ScriptBlock, KBFile, Category } from '../types';
import { GeminiService } from '../services/geminiService';
import { toast } from '../components/Toast'; // 导入 Toast 组件

// 定义分镜条目类型（优化字段定义）
interface ShotEntry {
  id: string;
  duration: string;
  language: string;
  visual: string;
  dialogue: string;
  prompt: string;
}

// 定义分镜生成配置
interface ShotsConfig {
  shotDensity: 'standard' | 'detailed' | 'minimal'; // 分镜密度
  includePrompt: boolean; // 是否包含视频提示词
}

interface ShotsPanelProps {
  sourceBlocks: ScriptBlock[]; // 修正类型为 ScriptBlock[]
  files: KBFile[];
  onSaveToKB: (f: KBFile) => void;
  className?: string;
}

const ShotsPanel: React.FC<ShotsPanelProps> = ({
  sourceBlocks,
  files,
  onSaveToKB,
  className = '',
}) => {
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [refFileId, setRefFileId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [shotList, setShotList] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeShotId, setActiveShotId] = useState<string | null>(null); // 新增：当前激活的分镜
  const [config, setConfig] = useState<ShotsConfig>({ // 新增：分镜生成配置
    shotDensity: 'standard',
    includePrompt: true,
  });

  // 初始化 Gemini 服务（缓存实例）
  const gemini = useMemo(() => new GeminiService(), []);

  // 筛选参考文件（分镜/剧本类）
  const referenceFiles = useMemo(
    () => files.filter(f => f.category === Category.REFERENCE || f.category === Category.PLOT),
    [files]
  );

  // 清理流式文本的防抖处理
  const debouncedCleanText = useCallback((text: string) => {
    return text.replace(/\s+/g, ' ').replace(/\|\s+/g, '|').trim();
  }, []);

  // 解析分镜列表（优化解析逻辑，提高容错性）
  const parsedShots = useMemo((): ShotEntry[] => {
    const content = streamingText || shotList;
    if (!content) return [];

    return content.split('\n')
      .map(line => line.trim())
      .filter(line => line.includes('|') && 
        !line.toLowerCase().includes('镜号') && 
        !line.includes('---') && 
        line.length > 10) // 过滤无效行
      .map((line, index) => {
        const parts = line.split('|').map(s => s.trim()).filter(Boolean);
        // 确保字段完整性，不足时填充默认值
        return {
          id: parts[0] || `S${index + 1}`,
          duration: parts[1] || '3s',
          language: parts[2] || '中景',
          visual: parts[3] || '画面描述缺失',
          dialogue: parts[4] || '（无对白）',
          prompt: config.includePrompt ? (parts[5] || 'anime style, high quality, detailed') : ''
        };
      });
  }, [streamingText, shotList, config.includePrompt]);

  // 计算总时长（优化时长解析）
  const totalDurationSeconds = useMemo(() => {
    return parsedShots.reduce((acc, shot) => {
      // 支持多种时长格式：3s、3秒、0:03 等
      const num = parseInt(shot.duration.replace(/[^0-9]/g, '')) || 3;
      return acc + num;
    }, 0);
  }, [parsedShots]);

  // 时长状态（优化视觉反馈）
  const durationStatus = useMemo(() => {
    const mins = Math.floor(totalDurationSeconds / 60);
    const secs = totalDurationSeconds % 60;
    const isOk = totalDurationSeconds >= 120; // 2分钟以上为合格
    const isShort = totalDurationSeconds < 60; // 1分钟以下为过短
    return {
      text: `${mins}分${secs}秒`,
      isOk,
      isShort,
      percent: Math.min(100, (totalDurationSeconds / 180) * 100) // 以3分钟为满值
    };
  }, [totalDurationSeconds]);

  // 生成分镜列表（优化错误处理和用户反馈）
  const handleGenerateShots = useCallback(async () => {
    // 验证必填项
    const block = sourceBlocks.find(b => b.id === selectedBlockId);
    if (!block) {
      toast.warning("请先选择一个待拆解的剧本单元");
      return;
    }

    // 重置状态
    setIsGenerating(true);
    setStreamingText('');
    setShotList('');
    setSaveStatus(false);
    setErrorMessage('');
    setActiveShotId(null);

    let fullContent = '';
    try {
      const refFile = files.find(f => f.id === refFileId);
      
      // 根据配置生成分镜
      const densityPrompt = config.shotDensity === 'detailed' 
        ? '生成详细分镜，每个场景拆解为更多镜头，注重细节表现'
        : config.shotDensity === 'minimal'
          ? '生成精简分镜，保留核心镜头，去除冗余表现'
          : '生成标准密度分镜，平衡细节和效率';

      const stream = gemini.generateTechnicalShotListStream(
        `${block.content}\n\n${densityPrompt}`,
        refFile?.content || ''
      );

      // 处理流式响应
      for await (const chunk of stream) {
        fullContent += chunk;
        const cleanedText = debouncedCleanText(fullContent);
        setStreamingText(cleanedText);
      }

      // 生成完成
      const finalText = debouncedCleanText(fullContent);
      setStreamingText('');
      setShotList(finalText);

      // 自动激活第一个分镜
      if (parsedShots.length > 0) {
        setActiveShotId(parsedShots[0].id);
      }

      toast.success(`分镜生成成功，共 ${parsedShots.length} 个镜头，总时长 ${durationStatus.text}`);

    } catch (e: any) {
      console.error('分镜生成失败：', e);
      const errorMsg = e.message || "分镜生成异常中断，请检查网络或配置";
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedBlockId, sourceBlocks, files, refFileId, gemini, debouncedCleanText, config, parsedShots.length, durationStatus.text]);

  // 保存分镜到知识库（优化文件命名和元数据）
  const handleSaveToKB = useCallback(() => {
    const finalContent = shotList || streamingText;
    if (!finalContent) {
      toast.warning("暂无分镜内容可保存");
      return;
    }

    const block = sourceBlocks.find(b => b.id === selectedBlockId);
    if (!block) return;

    // 构建分镜文件
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[高精分镜] ${block.episodes} - ${parsedShots.length}镜 - 时长${durationStatus.text}`,
      category: Category.REFERENCE,
      content: finalContent,
      uploadDate: new Date().toISOString(),
      fileSize: finalContent.length,
      fileType: 'text/plain',
      lastModified: new Date().toISOString(),
      isFavorite: false,
    };

    onSaveToKB(newFile);
    setSaveStatus(true);
    toast.success("分镜已成功保存到知识库");
  }, [selectedBlockId, sourceBlocks, shotList, streamingText, parsedShots.length, durationStatus.text, onSaveToKB]);

  // 重置分镜生成状态
  const handleReset = useCallback(() => {
    setSelectedBlockId('');
    setRefFileId('');
    setStreamingText('');
    setShotList('');
    setSaveStatus(false);
    setErrorMessage('');
    setActiveShotId(null);
  }, []);

  // 复制分镜提示词
  const handleCopyPrompt = useCallback((prompt: string) => {
    navigator.clipboard.writeText(prompt)
      .then(() => toast.success("提示词已复制到剪贴板"))
      .catch(() => toast.error("复制失败，请手动复制"));
  }, []);

  return (
    <div className={`flex-1 flex flex-col bg-[#050508] overflow-hidden ${className}`}>
      {/* 顶部配置栏 */}
      <div className="h-32 px-6 md:px-10 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between bg-black/40 backdrop-blur-xl shrink-0 gap-4">
        {/* 标题区域 */}
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">
            Industrial Storyboarding
          </span>
          <h2 className="text-xl font-black text-white italic tracking-tighter">
            高精分镜管理中心
          </h2>
        </div>

        {/* 时长统计（仅生成分镜后显示） */}
        {parsedShots.length > 0 && (
          <div className="flex items-center gap-6 bg-[#0a0a0c]/80 border border-white/10 px-6 py-3 rounded-3xl shadow-xl">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                总计分镜时长
              </span>
              <span className={`text-lg font-black italic tabular-nums leading-none mt-1 ${
                durationStatus.isShort ? 'text-rose-400' : durationStatus.isOk ? 'text-emerald-400' : 'text-amber-500'
              }`}>
                {durationStatus.text}
              </span>
            </div>
            <div className="w-32 h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${
                  durationStatus.isShort ? 'bg-rose-500' : durationStatus.isOk ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${durationStatus.percent}%` }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                分镜总数
              </span>
              <span className="text-lg font-black italic tabular-nums leading-none mt-1 text-blue-400">
                {parsedShots.length} 镜
              </span>
            </div>
          </div>
        )}

        {/* 操作区域 */}
        <div className="flex flex-wrap items-center gap-4">
          {/* 剧本选择 */}
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <label className="text-[9px] font-black text-slate-500 uppercase ml-2">
              选择改编剧本
            </label>
            <select
              value={selectedBlockId}
              onChange={(e) => setSelectedBlockId(e.target.value)}
              className="bg-[#151517] border border-white/10 text-white text-xs font-bold rounded-2xl px-4 py-3 outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">选择剧本集数...</option>
              {sourceBlocks.length > 0 ? (
                sourceBlocks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.episodes}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  暂无剧本可选择
                </option>
              )}
            </select>
          </div>

          {/* 参考文件选择 */}
          <div className="flex flex-col gap-1.5 min-w-[200px]">
            <label className="text-[9px] font-black text-violet-500 uppercase ml-2 tracking-widest">
              参考文件范本
            </label>
            <select
              value={refFileId}
              onChange={(e) => setRefFileId(e.target.value)}
              className="bg-[#151517] border border-violet-500/20 text-violet-400 text-xs font-bold rounded-2xl px-4 py-3 outline-none"
            >
              <option value="">指向参考分镜格式...</option>
              {referenceFiles.length > 0 ? (
                referenceFiles.map(f => (
                  <option key={f.id} value={f.id}>
                    [{f.category}] {f.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  暂无参考文件
                </option>
              )}
            </select>
          </div>

          {/* 分镜密度配置 */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <label className="text-[9px] font-black text-slate-500 uppercase ml-2">
              分镜密度
            </label>
            <div className="flex bg-[#151517] border border-white/10 rounded-2xl overflow-hidden">
              <button
                onClick={() => setConfig(prev => ({ ...prev, shotDensity: 'minimal' }))}
                className={`flex-1 py-2 text-[10px] font-black uppercase transition-all ${
                  config.shotDensity === 'minimal' ? 'bg-blue-600 text-white' : 'text-slate-400'
                }`}
              >
                精简
              </button>
              <button
                onClick={() => setConfig(prev => ({ ...prev, shotDensity: 'standard' }))}
                className={`flex-1 py-2 text-[10px] font-black uppercase transition-all ${
                  config.shotDensity === 'standard' ? 'bg-blue-600 text-white' : 'text-slate-400'
                }`}
              >
                标准
              </button>
              <button
                onClick={() => setConfig(prev => ({ ...prev, shotDensity: 'detailed' }))}
                className={`flex-1 py-2 text-[10px] font-black uppercase transition-all ${
                  config.shotDensity === 'detailed' ? 'bg-blue-600 text-white' : 'text-slate-400'
                }`}
              >
                详细
              </button>
            </div>
          </div>

          {/* 功能按钮组 */}
          <div className="flex items-center gap-3">
            {/* 生成按钮 */}
            <button
              disabled={!selectedBlockId || isGenerating}
              onClick={handleGenerateShots}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:cursor-not-allowed text-white px-6 py-3 rounded-2xl font-black text-xs uppercase shadow-2xl transition-all flex items-center gap-2 active:scale-95"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin text-sm">{ICONS.Loading}</span>
                  解析中...
                </>
              ) : (
                <>
                  {ICONS.Zap}
                  {shotList ? "重新生成" : "生成分镜"}
                </>
              )}
            </button>

            {/* 保存按钮 */}
            {(shotList || streamingText) && (
              <button
                onClick={handleSaveToKB}
                disabled={isGenerating || saveStatus}
                className={`px-6 py-3 rounded-2xl text-xs font-black uppercase transition-all flex items-center gap-2 ${
                  saveStatus
                    ? 'bg-emerald-600 text-white shadow-emerald-900/20'
                    : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {saveStatus ? (
                  <>
                    {ICONS.Check} 已同步
                  </>
                ) : (
                  <>
                    {ICONS.Save} 入库
                  </>
                )}
              </button>
            )}

            {/* 重置按钮 */}
            {(shotList || streamingText || selectedBlockId) && (
              <button
                onClick={handleReset}
                disabled={isGenerating}
                className="p-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-500 border border-rose-600/30 rounded-2xl transition-all disabled:opacity-30"
                title="重置所有选择和结果"
              >
                {ICONS.Trash}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 错误提示区域 */}
      {errorMessage && (
        <div className="px-6 py-3 bg-rose-600/10 border-b border-rose-500/20">
          <p className="text-rose-400 text-xs font-bold flex items-center gap-2">
            {ICONS.Error} {errorMessage}
          </p>
        </div>
      )}

      {/* 主内容区 - 分镜列表 */}
      <div className="flex-1 overflow-auto custom-scrollbar p-4 md:p-8">
        {/* 空状态（未选择剧本且未生成） */}
        {!parsedShots.length && !isGenerating && !streamingText && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 p-10 text-center">
            <div className="scale-[2.5] mb-6 text-slate-600">
              {ICONS.Library}
            </div>
            <p className="text-sm font-black uppercase tracking-[0.4em] mb-3">
              等待剧本导入并启动自动化拆解
            </p>
            <p className="text-[10px] text-slate-500 max-w-md mx-auto">
              选择剧本后可配置分镜密度，生成符合工业标准的精细化分镜列表
            </p>
          </div>
        )}

        {/* 生成中状态（流式输出） */}
        {isGenerating && streamingText && parsedShots.length === 0 && (
          <div className="max-w-4xl mx-auto p-8 md:p-12 bg-[#0a0a0c]/80 border border-blue-500/10 rounded-[4rem] shadow-2xl animate-pulse">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-8 h-8 border-2 border-white/5 border-t-blue-500 rounded-full animate-spin"></div>
              <span className="text-xs font-black text-blue-400 uppercase tracking-widest">
                导演正在按工业标准拆解分镜（确保总时长 > 120秒）...
              </span>
            </div>
            <div className="text-white/20 text-[13px] italic whitespace-pre-wrap font-mono leading-relaxed bg-black/40 p-6 md:p-8 rounded-3xl border border-white/5">
              {streamingText.substring(Math.max(0, streamingText.length - 1200))}
              <span className="inline-block w-2.5 h-5 bg-blue-600 ml-2 shadow-[0_0_15px_rgba(37,99,235,0.8)] animate-pulse"></span>
            </div>
          </div>
        )}

        {/* 分镜表格（生成完成） */}
        {parsedShots.length > 0 && (
          <div className="min-w-[1700px] animate-fade-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white italic">
                精细化分镜列表（{parsedShots.length} 镜）
              </h3>
              <div className="flex items-center gap-3">
                <label
                  className="flex items-center gap-2 cursor-pointer"
                  htmlFor="include-prompt"
                >
                  <input
                    id="include-prompt"
                    type="checkbox"
                    checked={config.includePrompt}
                    onChange={(e) => setConfig(prev => ({ ...prev, includePrompt: e.target.checked }))}
                    className="w-4 h-4 rounded bg-[#151517] border border-white/20 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-[10px] font-black text-slate-400 uppercase">
                    显示视频提示词
                  </span>
                </label>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[3rem] border border-white/5 shadow-2xl backdrop-blur-3xl">
              <table className="w-full text-left border-separate border-spacing-0 bg-white/[0.01]">
                <thead>
                  <tr className="bg-[#0a0a0c]/50">
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-500 uppercase border-b border-white/5 w-20">
                      镜号
                    </th>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-emerald-500 uppercase border-b border-white/5 w-24">
                      时长
                    </th>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-blue-500 uppercase border-b border-white/5 w-48">
                      视听语言
                    </th>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-slate-100 uppercase border-b border-white/5 w-[450px]">
                      画面细节描述 (2D Anime)
                    </th>
                    <th className="px-6 md:px-8 py-5 text-[10px] font-black text-violet-400 uppercase border-b border-white/5 w-[350px]">
                      角色台词/对白
                    </th>
                    {config.includePrompt && (
                      <th className="px-6 md:px-8 py-5 text-[10px] font-black text-amber-500 uppercase border-b border-white/5">
                        Vidu 视频提示词
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {parsedShots.map((shot, idx) => (
                    <tr
                      key={idx}
                      className={`hover:bg-white/[0.03] transition-all group ${
                        activeShotId === shot.id ? 'bg-blue-600/5' : ''
                      }`}
                      onClick={() => setActiveShotId(shot.id)}
                    >
                      <td className="px-6 md:px-8 py-6 font-mono text-[11px] text-slate-500">
                        {shot.id}
                      </td>
                      <td className="px-6 md:px-8 py-6 font-mono text-xs text-emerald-400 font-black italic">
                        {shot.duration}
                      </td>
                      <td className="px-6 md:px-8 py-6">
                        <span className="text-blue-300 text-[10px] font-black uppercase tracking-widest bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                          {shot.language}
                        </span>
                      </td>
                      <td className="px-6 md:px-8 py-6 text-white/90 text-[13px] leading-relaxed font-sans italic tracking-wide">
                        {shot.visual}
                      </td>
                      <td className="px-6 md:px-8 py-6 text-violet-300 text-sm italic font-medium bg-violet-500/[0.02] rounded-lg">
                        {shot.dialogue}
                      </td>
                      {config.includePrompt && (
                        <td className="px-6 md:px-8 py-6">
                          <div className="relative">
                            <div className="p-4 bg-black/40 border border-white/5 rounded-2xl font-mono text-[10px] text-amber-200/80 group-hover:text-amber-200 transition-all leading-relaxed">
                              {shot.prompt || 'anime style, high quality, detailed, 2d animation'}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyPrompt(shot.prompt);
                              }}
                              className="absolute top-3 right-3 p-1.5 bg-black/50 hover:bg-black/70 text-amber-400 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="复制提示词"
                            >
                              {ICONS.Copy}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShotsPanel;
