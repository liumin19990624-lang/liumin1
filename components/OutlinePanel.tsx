import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { KBFile, AudienceMode, Category } from '../types';
import { ICONS } from '../constants';
import { GeminiService } from '../services/geminiService';
import { toast } from '../components/Toast'; // 导入 Toast 组件

// 定义分析模式类型和配置
type AnalysisMode = 'CHARACTERS' | 'PLOT_OUTLINE' | 'REF_SCRIPT' | 'CAST_BIO';

interface ModeConfig {
  label: string;
  description: string;
  category: Category;
  requiresCharName?: boolean;
}

// 分析模式配置（统一管理）
const MODE_CONFIGS: Record<AnalysisMode, ModeConfig> = {
  PLOT_OUTLINE: {
    label: '连载大纲',
    description: '生成结构化的多章节连载大纲，包含情节递进和伏笔设计',
    category: Category.PLOT
  },
  CHARACTERS: {
    label: '提取人物',
    description: '批量提取作品中所有核心角色，生成完整的人物关系图谱和设定',
    category: Category.CHARACTER
  },
  CAST_BIO: {
    label: '角色小传',
    description: '为指定角色生成深度人物小传，包含性格、背景、成长弧线',
    category: Category.CHARACTER,
    requiresCharName: true
  },
  REF_SCRIPT: {
    label: '参考脚本',
    description: '提取核心情节片段，生成可直接参考的剧本格式模板',
    category: Category.REFERENCE
  }
};

const OutlinePanel: React.FC<{
  files: KBFile[];
  onSaveToKB: (f: KBFile) => void;
}> = ({ files, onSaveToKB }) => {
  const [targetId, setTargetId] = useState<string>('');
  const [refFileId, setRefFileId] = useState<string>('');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('PLOT_OUTLINE');
  const [isDeepExtraction, setIsDeepExtraction] = useState(true);
  const [result, setResult] = useState<string>('');
  const [streamingText, setStreamingText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(false);
  const [charName, setCharName] = useState('');
  const [audienceMode, setAudienceMode] = useState<AudienceMode>(AudienceMode.MALE); // 新增：受众模式
  const [errorMessage, setErrorMessage] = useState<string>(''); // 新增：错误提示

  // 初始化 Gemini 服务（缓存实例）
  const gemini = useMemo(() => new GeminiService(), []);

  // 筛选剧情类文件（缓存结果）
  const plotFiles = useMemo(
    () => files.filter(f => f.category === Category.PLOT),
    [files]
  );

  // 筛选参考文件（排除当前选中的目标文件）
  const referenceFiles = useMemo(
    () => files.filter(f => f.id !== targetId),
    [files, targetId]
  );

  // 清理流式文本的防抖处理
  const debouncedCleanText = useCallback((text: string) => {
    return GeminiService.cleanText(text);
  }, []);

  // 处理分析任务启动（优化错误处理和用户反馈）
  const handleStart = useCallback(async () => {
    // 重置状态
    setIsLoading(true);
    setResult('');
    setStreamingText('');
    setSaveStatus(false);
    setErrorMessage('');

    try {
      // 验证必填项
      if (!targetId) {
        throw new Error('请先选择内容原著');
      }

      if (analysisMode === 'CAST_BIO' && !charName.trim()) {
        throw new Error('请输入需建模的角色姓名');
      }

      // 获取文件内容
      const sourceFile = files.find(f => f.id === targetId);
      const refFile = files.find(f => f.id === refFileId);
      const sourceContent = sourceFile?.content || '';
      const refContent = refFile?.content || '';

      if (!sourceContent.trim()) {
        throw new Error('选中的原著文件内容为空');
      }

      let stream: AsyncIterable<string>;

      // 根据模式选择对应的生成方法
      switch (analysisMode) {
        case 'CHARACTERS':
          stream = gemini.extractCharactersStream(sourceContent, refContent);
          break;
        case 'REF_SCRIPT':
          stream = gemini.extractReferenceScriptStream(sourceContent);
          break;
        case 'CAST_BIO':
          stream = gemini.generateCharacterBioStream(
            charName.trim(),
            '基于原著深度建模',
            sourceContent,
            refContent
          );
          break;
        case 'PLOT_OUTLINE':
        default:
          stream = gemini.generateFullOutlineStream(
            audienceMode,
            sourceContent,
            isDeepExtraction,
            refContent
          );
          break;
      }

      // 处理流式响应
      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk;
        const cleanedText = debouncedCleanText(fullContent);
        setStreamingText(cleanedText);
      }

      // 生成完成，更新结果
      const finalText = debouncedCleanText(fullContent);
      setStreamingText('');
      setResult(finalText);
      toast.success(`成功生成${MODE_CONFIGS[analysisMode].label}`);

    } catch (err: any) {
      console.error('分析任务失败：', err);
      const errorMsg = err.message || '全案分析异常中止，请稍后重试';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [
    targetId,
    refFileId,
    analysisMode,
    charName,
    isDeepExtraction,
    audienceMode,
    files,
    gemini,
    debouncedCleanText
  ]);

  // 处理保存到知识库
  const handleSaveToKB = useCallback(() => {
    if (!result) {
      toast.warning('暂无生成结果可保存');
      return;
    }

    const config = MODE_CONFIGS[analysisMode];
    const sourceFileName = files.find(f => f.id === targetId)?.name || '未知文件';

    // 构建新文件
    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[${config.label}] ${sourceFileName}`,
      category: config.category,
      content: result,
      uploadDate: new Date().toISOString(),
      fileSize: result.length,
      fileType: 'text/plain',
      lastModified: new Date().toISOString(),
      isFavorite: false,
    };

    onSaveToKB(newFile);
    setSaveStatus(true);
    toast.success(`已成功存入${config.label}到知识库`);
  }, [result, analysisMode, targetId, files, onSaveToKB]);

  // 重置面板状态
  const handleReset = useCallback(() => {
    setTargetId('');
    setRefFileId('');
    setAnalysisMode('PLOT_OUTLINE');
    setIsDeepExtraction(true);
    setResult('');
    setStreamingText('');
    setSaveStatus(false);
    setCharName('');
    setAudienceMode(AudienceMode.MALE);
    setErrorMessage('');
  }, []);

  // 监听分析模式变化，清理相关状态
  useEffect(() => {
    setCharName('');
    setErrorMessage('');
  }, [analysisMode]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#050508]">
      {/* 初始状态 - 配置面板 */}
      {!result && !streamingText && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-10 animate-fade-up">
          <div className="max-w-3xl w-full bg-[#0a0a0c]/80 border border-white/10 rounded-[3rem] p-8 md:p-12 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
            {/* 装饰背景 */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 blur-[80px] rounded-full"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-violet-600/10 blur-[60px] rounded-full"></div>

            {/* 标题区域 */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl">
                {ICONS.Sparkles}
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter">
                  策划建模中心 Pro
                </h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                  Deep Production Intelligence
                </p>
              </div>
            </div>

            {/* 错误提示 */}
            {errorMessage && (
              <div className="mb-6 p-4 bg-rose-600/10 border border-rose-500/20 rounded-2xl animate-fade-up">
                <p className="text-rose-400 text-xs font-bold flex items-center gap-2">
                  {ICONS.Error} {errorMessage}
                </p>
              </div>
            )}

            <div className="space-y-6">
              {/* 文件选择区域 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 目标文件选择 */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">
                    选择内容原著 <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full p-4 bg-black/40 border border-white/10 text-white rounded-2xl outline-none font-bold text-xs focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">知识库原著小说...</option>
                    {plotFiles.length > 0 ? (
                      plotFiles.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>
                        暂无剧情类文件，请先上传
                      </option>
                    )}
                  </select>
                </div>

                {/* 参考文件选择 */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-violet-500 uppercase ml-2 tracking-widest">
                    参考文件 (可选)
                  </label>
                  <select
                    value={refFileId}
                    onChange={(e) => setRefFileId(e.target.value)}
                    className="w-full p-4 bg-black/40 border border-violet-500/20 text-violet-400 rounded-2xl outline-none font-bold text-xs focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="">选择参考范本/大纲...</option>
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
              </div>

              {/* 任务模式选择 */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">
                  任务模式 <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap bg-black/40 p-1.5 rounded-2xl border border-white/5 gap-1">
                  {Object.entries(MODE_CONFIGS).map(([mode, config]) => (
                    <button
                      key={mode}
                      onClick={() => setAnalysisMode(mode as AnalysisMode)}
                      className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all text-center ${
                        analysisMode === mode
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title={config.description}
                    >
                      {config.label}
                    </button>
                  ))}
                </div>
                {/* 模式描述 */}
                <p className="text-[9px] text-slate-600 ml-2">
                  {MODE_CONFIGS[analysisMode].description}
                </p>
              </div>

              {/* 角色姓名输入（仅角色小传模式） */}
              {analysisMode === 'CAST_BIO' && (
                <div className="animate-fade-up">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest mb-2 block">
                    指定建模人物姓名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={charName}
                    onChange={(e) => setCharName(e.target.value)}
                    placeholder="输入需建模角色姓名（如：张三）..."
                    className="w-full p-4 bg-black/40 border border-white/10 text-white rounded-2xl outline-none text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* 高级配置区域 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 受众模式选择 */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">
                    受众模式
                  </label>
                  <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
                    <button
                      onClick={() => setAudienceMode(AudienceMode.MALE)}
                      className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${
                        audienceMode === AudienceMode.MALE
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      男性向
                    </button>
                    <button
                      onClick={() => setAudienceMode(AudienceMode.FEMALE)}
                      className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${
                        audienceMode === AudienceMode.FEMALE
                          ? 'bg-pink-600 text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      女性向
                    </button>
                    <button
                      onClick={() => setAudienceMode(AudienceMode.ALL)}
                      className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${
                        audienceMode === AudienceMode.ALL
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-500'
                      }`}
                    >
                      全受众
                    </button>
                  </div>
                </div>

                {/* 深度分析开关 */}
                <div className="space-y-3 flex items-end">
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest block">
                        深度分析模式
                      </label>
                      <p className="text-[9px] text-slate-600 ml-2">
                        开启后将生成更详细的分析结果
                      </p>
                    </div>
                    <div
                      className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${
                        isDeepExtraction
                          ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                          : 'bg-slate-800'
                      }`}
                      onClick={() => setIsDeepExtraction(!isDeepExtraction)}
                      title={isDeepExtraction ? '关闭深度分析' : '开启深度分析'}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                          isDeepExtraction ? 'left-7' : 'left-1'
                        }`}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 启动按钮 */}
              <button
                disabled={isLoading || !targetId || (analysisMode === 'CAST_BIO' && !charName.trim())}
                onClick={handleStart}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin text-sm">{ICONS.Loading}</div>
                    深度分析建模中...
                  </>
                ) : (
                  <>
                    {ICONS.Play} 启动全案内容生成
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 结果展示状态 */}
      {(result || streamingText) && (
        <div className="flex-1 flex flex-col min-h-0 animate-fade-up">
          {/* 顶部操作栏 */}
          <div className="h-20 px-6 md:px-10 border-b border-white/5 bg-black/40 backdrop-blur-xl flex flex-wrap justify-between items-center z-10 shadow-xl">
            <button
              onClick={handleReset}
              className="text-xs font-black text-slate-500 hover:text-white uppercase flex items-center gap-2 transition-colors mb-2 md:mb-0"
            >
              {ICONS.ArrowLeft} 返回控制台
            </button>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleStart}
                disabled={!!streamingText || isLoading}
                className="px-5 py-2.5 rounded-2xl bg-rose-600/10 text-rose-500 border border-rose-600/20 text-[11px] font-black uppercase hover:bg-rose-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {ICONS.Refresh} 不满意请重写
              </button>
              <button
                onClick={handleSaveToKB}
                disabled={!!streamingText || saveStatus || isLoading}
                className={`px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase transition-all shadow-xl ${
                  saveStatus
                    ? 'bg-emerald-500 text-white flex items-center gap-2'
                    : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saveStatus ? (
                  <>
                    {ICONS.Check} 已存入库
                  </>
                ) : (
                  '存入知识库'
                )}
              </button>
            </div>
          </div>

          {/* 结果预览区域 */}
          <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar bg-[#050508]">
            <div className="max-w-4xl mx-auto">
              <div className="bg-[#0a0a0c]/80 border border-white/5 rounded-[3rem] p-8 md:p-16 shadow-2xl relative overflow-hidden">
                {/* 左侧装饰线 */}
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 opacity-20"></div>
                
                {/* 生成结果标题 */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-white italic">
                    {MODE_CONFIGS[analysisMode].label} 生成结果
                  </h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase mt-1">
                    基于文件：{files.find(f => f.id === targetId)?.name || '未知文件'}
                  </p>
                </div>

                {/* 结果内容 */}
                <div className="whitespace-pre-wrap font-sans text-slate-200 leading-[2.2] text-base font-medium italic tracking-wide">
                  {streamingText || result}
                  {/* 打字动画指示器 */}
                  {streamingText && (
                    <span className="inline-block w-2.5 h-5 bg-blue-600 ml-2 animate-pulse shadow-[0_0_10px_rgba(37,99,235,0.8)]" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutlinePanel;
