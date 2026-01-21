import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AudienceMode, CharacterAsset, KBFile, Category } from '../types';
import { ICONS } from '../constants';
import { DMXAPIService } from '../services/dmxapiService'; // 替换为 DMXAPI 服务
import { toast } from '../components/Toast'; // 导入 Toast 组件（用于友好提示）

// 定义组件 Props 类型（增强类型提示）
interface CharacterVisualsProps {
  mode: AudienceMode;
  files: KBFile[];
  onSaveToKB?: (f: KBFile) => void;
  className?: string;
}

const CharacterVisuals: React.FC<CharacterVisualsProps> = ({
  mode,
  files,
  onSaveToKB,
  className = '',
}) => {
  // 状态管理
  const [activeSubTab, setActiveSubTab] = useState<'VISUAL' | 'LAB'>('VISUAL');
  const [cards, setCards] = useState<(CharacterAsset & { is_regenerating?: boolean })[]>([]);
  const [inputName, setInputName] = useState('');
  const [inputDesc, setInputDesc] = useState('');
  const [refFileId, setRefFileId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [labResult, setLabResult] = useState('');
  const [labStreaming, setLabStreaming] = useState('');
  const [labMode, setLabMode] = useState<'EXTRACT' | 'REVERSE'>('EXTRACT');
  const [labFileId, setLabFileId] = useState('');
  const [labRefId, setLabRefId] = useState('');
  const [isLabLoading, setIsLabLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(false);

  // 初始化 DMXAPI 服务（使用 useMemo 避免重复创建）
  const dmxapi = useMemo(() => new DMXAPIService(), []);

  // 筛选可用的参考文件（缓存结果，避免重复计算）
  const characterFiles = useMemo(
    () => files.filter(f => f.category === Category.CHARACTER),
    [files]
  );
  const plotFiles = useMemo(
    () => files.filter(f => f.category === Category.PLOT),
    [files]
  );

  // 从本地存储加载角色资产
  useEffect(() => {
    const loadSavedAssets = () => {
      try {
        const saved = localStorage.getItem('character_assets');
        if (saved) {
          const parsed = JSON.parse(saved) as CharacterAsset[];
          setCards(parsed.map(c => ({ ...c, is_regenerating: false })));
        }
      } catch (error) {
        console.error('加载角色资产失败：', error);
        toast.error('角色数据加载失败，将使用默认配置');
      }
    };

    loadSavedAssets();
  }, []);

  // 保存角色资产到本地存储（使用 useCallback 优化性能）
  const saveAssetsToLocalStorage = useCallback(() => {
    try {
      const toSave = cards.map(({ is_regenerating, ...rest }) => rest);
      localStorage.setItem('character_assets', JSON.stringify(toSave));
    } catch (error) {
      console.error('保存角色资产失败：', error);
      toast.error('角色数据保存失败，请检查存储空间');
    }
  }, [cards]);

  useEffect(() => {
    saveAssetsToLocalStorage();
  }, [cards, saveAssetsToLocalStorage]);

  // 生成角色立绘
  const generateVisual = async () => {
    if (isGenerating) return;
    if (!inputName && !refFileId) {
      toast.warning('请输入角色姓名或选择参考人设资料');
      return;
    }

    setIsGenerating(true);
    try {
      // 构建提示词（适配 DMXAPI 要求，优化关键词）
      let finalPrompt = `${inputName || '未知角色'}: ${inputDesc || '动漫风格立绘'}`;
      
      if (refFileId) {
        const refFile = files.find(f => f.id === refFileId);
        if (refFile) {
          // 截取关键内容，避免提示词过长
          const refContent = refFile.content.substring(0, 1500).replace(/\n/g, ' ');
          finalPrompt = `参考人设：${refContent}。生成角色：${inputName || refFile.name}，${inputDesc || '保持原人设风格的动漫立绘'}`;
        }
      }

      // 适配受众模式优化提示词
      if (mode === AudienceMode.MALE) {
        finalPrompt += '，男频风格，热血、精致细节、高对比度';
      } else {
        finalPrompt += '，女频风格，唯美、细腻线条、柔和色调';
      }

      // 调用 DMXAPI 生成图片
      const imageUrl = await dmxapi.generateCharacterImage(finalPrompt, mode);
      
      if (!imageUrl) {
        throw new Error('生成图片地址为空');
      }

      // 创建新角色卡片
      const newCard: CharacterAsset = {
        id: Math.random().toString(36).substr(2, 9),
        name: inputName || (refFileId ? files.find(f => f.id === refFileId)?.name || '未知角色' : '未知角色'),
        description: inputDesc || (refFileId ? '基于资料库引用生成' : '手动设定产出'),
        image_url: imageUrl,
        voice_id: 'Kore',
        personality: '',
        background: '',
        abilities: [],
        relationships: [],
        characterTropes: [],
        designNotes: '',
      };

      setCards(prev => [newCard, ...prev]);
      toast.success('角色立绘生成成功！');
      
      // 重置输入
      setInputName('');
      setInputDesc('');
      setRefFileId('');
    } catch (error) {
      console.error('生成角色立绘失败：', error);
      toast.error(`立绘生成失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 重绘角色立绘
  const handleRegenerate = async (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.is_regenerating) return;

    setCards(prev => prev.map(c => 
      c.id === cardId ? { ...c, is_regenerating: true } : c
    ));

    try {
      // 优化重绘提示词
      let prompt = `优化动漫角色立绘：角色名${card.name}，描述${card.description}。保持原有角色特征，提升画质和细节`;
      
      // 适配受众模式
      if (mode === AudienceMode.MALE) {
        prompt += '，增强热血感和视觉冲击力';
      } else {
        prompt += '，增强唯美感和细腻度';
      }

      const newImageUrl = await dmxapi.generateCharacterImage(prompt, mode);
      
      if (newImageUrl) {
        setCards(prev => prev.map(c => 
          c.id === cardId ? { ...c, image_url: newImageUrl, is_regenerating: false } : c
        ));
        toast.success('角色立绘重绘成功！');
      } else {
        throw new Error('重绘图片地址为空');
      }
    } catch (error) {
      console.error('重绘角色立绘失败：', error);
      toast.error(`立绘重绘失败：${error instanceof Error ? error.message : '未知错误'}`);
      setCards(prev => prev.map(c => 
        c.id === cardId ? { ...c, is_regenerating: false } : c
      ));
    }
  };

  // 启动角色小传建模
  const startLabWork = async () => {
    if (isLabLoading) return;
    if (!inputName && !labFileId) {
      toast.warning('请输入角色姓名或选择内容背景原著');
      return;
    }

    setIsLabLoading(true);
    setLabResult('');
    setLabStreaming('');
    setSaveStatus(false);
    
    let fullContent = '';

    try {
      const sourceFile = files.find(f => f.id === labFileId);
      const refFile = files.find(f => f.id === labRefId);
      
      // 构建小传生成提示词
      let prompt = '';
      if (labMode === 'EXTRACT') {
        prompt = `基于以下内容生成角色小传：
        角色姓名：${inputName || '匿名角色'}
        补充设定：${inputDesc || '无'}
        原著内容：${sourceFile?.content || '无'}
        参考模板：${refFile?.content || '无'}
        
        要求：
        1. 符合${mode === AudienceMode.MALE ? '男频' : '女频'}风格
        2. 包含性格、背景、能力、人物关系等核心要素
        3. 逻辑连贯，细节丰富，便于剧本创作
        4. 语言流畅，符合动漫角色设定规范`;
      } else {
        prompt = `反向生成角色小传：
        核心设定：${inputDesc || '自由建模'}
        角色姓名：${inputName || '匿名角色'}
        
        要求：
        1. 构建完整的角色逻辑链
        2. 包含性格、背景、能力、人物关系等要素
        3. 符合${mode === AudienceMode.MALE ? '男频' : '女频'}审美
        4. 细节丰富，便于后续剧情扩展`;
      }

      // 调用 DMXAPI 流式生成小传
      const stream = await dmxapi.generateCharacterBioStream(prompt);
      
      for await (const chunk of stream) {
        if (chunk) {
          fullContent += chunk;
          // 清理文本（移除多余空格、换行）
          const cleaned = DMXAPIService.cleanText(fullContent);
          setLabStreaming(cleaned);
        }
      }

      // 最终处理结果
      const finalResult = DMXAPIService.cleanText(fullContent);
      setLabResult(finalResult);
      setLabStreaming('');
      toast.success('角色小传建模成功！');
    } catch (error) {
      console.error('角色小传建模失败：', error);
      toast.error(`小传建模失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLabLoading(false);
    }
  };

  // 保存小传结果到知识库
  const handleSaveLabResultToKB = () => {
    if (!labResult) {
      toast.warning('暂无小传结果可保存');
      return;
    }
    if (!onSaveToKB) {
      toast.error('保存回调未配置');
      return;
    }

    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: `[角色小传] ${inputName || '匿名角色'} - ${new Date().toLocaleString()}`,
      category: Category.CHARACTER,
      content: labResult,
      uploadDate: new Date().toISOString(),
      fileType: 'text/plain',
      fileSize: labResult.length,
      lastModified: new Date().toISOString(),
      isFavorite: false,
    };

    onSaveToKB(newFile);
    setSaveStatus(true);
    toast.success('角色小传已成功存入知识库！');

    // 3秒后重置保存状态
    setTimeout(() => setSaveStatus(false), 3000);
  };

  // 删除角色卡片
  const handleDeleteCard = (cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId));
    toast.success('角色卡片已删除');
  };

  return (
    <div className={`flex-1 flex flex-col overflow-hidden bg-[#0a0a0c] ${className}`}>
      {/* 标签栏 */}
      <div className="h-14 bg-[#151517] border-b border-[rgba(255,255,255,0.1)] flex px-6 md:px-10 items-center gap-8 shadow-sm">
        <button
          onClick={() => setActiveSubTab('VISUAL')}
          className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 h-full border-b-2 transition-all ${
            activeSubTab === 'VISUAL'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          视觉渲染实验室
        </button>
        <button
          onClick={() => setActiveSubTab('LAB')}
          className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 h-full border-b-2 transition-all ${
            activeSubTab === 'LAB'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          角色小传建模
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          {activeSubTab === 'VISUAL' ? (
            <div className="space-y-12">
              {/* 生成表单 */}
              <div className="p-6 md:p-8 bg-[#151517] rounded-[2.5rem] border border-[rgba(255,255,255,0.1)] shadow-xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 参考人物模板 */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block">
                      参考人物模板
                    </label>
                    <select
                      value={refFileId}
                      onChange={(e) => setRefFileId(e.target.value)}
                      className="w-full bg-[#202022] border-none rounded-2xl px-5 py-3 text-sm font-bold outline-none ring-1 ring-[rgba(255,255,255,0.05)] text-white"
                    >
                      <option value="">指向参考人设资料...</option>
                      {characterFiles.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 角色姓名 */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block">
                      角色姓名
                    </label>
                    <input
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value)}
                      placeholder="输入角色名..."
                      className="w-full bg-[#202022] border-none rounded-2xl px-5 py-3 text-sm font-bold outline-none ring-1 ring-[rgba(255,255,255,0.05)] text-white"
                    />
                  </div>

                  {/* 渲染风格 */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block">
                      渲染风格
                    </label>
                    <div className="flex bg-[#202022] p-1 rounded-2xl">
                      <button className="flex-1 py-2 text-[10px] font-black uppercase rounded-xl bg-[#151517] shadow-sm text-white">
                        2D Anime
                      </button>
                    </div>
                  </div>
                </div>

                {/* 视觉细节增强 */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block">
                    视觉细节增强
                  </label>
                  <textarea
                    value={inputDesc}
                    onChange={(e) => setInputDesc(e.target.value)}
                    placeholder="银发蓝瞳，战损披风，赛博朋克义眼..."
                    className="w-full h-24 bg-[#202022] border-none rounded-2xl px-5 py-4 text-sm font-bold outline-none resize-none ring-1 ring-[rgba(255,255,255,0.05)] text-white"
                  />
                </div>

                {/* 生成按钮 */}
                <button
                  disabled={isGenerating}
                  onClick={generateVisual}
                  className={`w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-3 transition-all ${
                    isGenerating ? 'opacity-80 cursor-not-allowed' : 'hover:shadow-emerald-500/20'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <span className="animate-spin">{ICONS.Loading}</span>
                      正在解析视觉特征...
                    </>
                  ) : (
                    <>
                      {ICONS.Image}
                      渲染高清动漫立绘
                    </>
                  )}
                </button>
              </div>

              {/* 角色卡片列表 */}
              {cards.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8 pb-20">
                  {cards.map((card, index) => (
                    <div
                      key={card.id}
                      className="bg-[#151517] rounded-[3.5rem] p-1.5 border border-[rgba(255,255,255,0.1)] shadow-lg relative group overflow-hidden animate-fade-up"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* 操作按钮组 */}
                      <div className="absolute top-4 right-4 z-20 flex gap-2">
                        <button
                          onClick={() => handleRegenerate(card.id)}
                          disabled={card.is_regenerating}
                          title="不满意重新生成"
                          className={`bg-black/40 hover:bg-emerald-600 text-white p-2.5 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all border border-white/10 ${
                            card.is_regenerating ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {card.is_regenerating ? (
                            <span className="animate-spin text-xs">{ICONS.Loading}</span>
                          ) : (
                            ICONS.Refresh
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          title="删除角色"
                          className="bg-black/40 hover:bg-rose-600 text-white p-2.5 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all border border-white/10"
                        >
                          {ICONS.Trash}
                        </button>
                      </div>

                      {/* 角色图片 */}
                      <div className="aspect-[3/4] bg-[#202022] rounded-[3.2rem] overflow-hidden relative">
                        <img
                          src={card.image_url}
                          alt={card.name}
                          className={`w-full h-full object-cover transition-all duration-700 ${
                            card.is_regenerating ? 'blur-md scale-110 opacity-50' : 'hover:scale-105'
                          }`}
                          loading="lazy"
                        />
                        {card.is_regenerating && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="animate-spin text-2xl text-emerald-500">{ICONS.Loading}</span>
                          </div>
                        )}
                      </div>

                      {/* 角色信息 */}
                      <div className="p-6">
                        <h3 className="text-xl font-black text-white italic truncate">
                          {card.name}
                        </h3>
                        <p className="text-[9px] text-slate-400 mt-1 line-clamp-2">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 rounded-full bg-[#202022] flex items-center justify-center mb-6">
                    <ICONS.User className="w-10 h-10 text-slate-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">暂无角色立绘</h3>
                  <p className="text-slate-400 max-w-md">
                    输入角色信息并点击"渲染高清动漫立绘"按钮，生成你的第一个角色视觉形象
                  </p>
                </div>
              )}
            </div>
          ) : (
            // 角色小传建模标签
            <div className="space-y-8 animate-fade-up">
              {/* 建模表单 */}
              <div className="bg-[#151517] p-6 md:p-10 rounded-[3rem] border border-[rgba(255,255,255,0.1)] shadow-2xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 角色姓名 */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block">
                      角色姓名
                    </label>
                    <input
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value)}
                      placeholder="林北..."
                      className="w-full p-4 bg-[#202022] rounded-2xl border-none font-bold text-sm outline-none ring-1 ring-[rgba(255,255,255,0.05)] text-white"
                    />
                  </div>

                  {/* 内容背景原著 */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block">
                      内容背景原著
                    </label>
                    <select
                      value={labFileId}
                      onChange={(e) => setLabFileId(e.target.value)}
                      className="w-full p-4 bg-[#202022] rounded-2xl border-none font-bold text-sm outline-none ring-1 ring-[rgba(255,255,255,0.05)] text-white"
                    >
                      <option value="">指向小说内容...</option>
                      {plotFiles.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 参考小传模板 */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-violet-500 uppercase ml-2 block">
                      参考小传模板
                    </label>
                    <select
                      value={labRefId}
                      onChange={(e) => setLabRefId(e.target.value)}
                      className="w-full p-4 bg-[#202022] rounded-2xl border-none font-bold text-sm outline-none ring-1 ring-violet-500/20 text-white"
                    >
                      <option value="">指向参考小传模板...</option>
                      {characterFiles.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 补充设定 */}
                <textarea
                  value={inputDesc}
                  onChange={(e) => setInputDesc(e.target.value)}
                  placeholder="补充关键设定碎片（如：性格孤僻、拥有时空能力、来自未来...）"
                  className="w-full h-32 p-5 bg-[#202022] rounded-2xl border-none text-sm font-bold outline-none ring-1 ring-[rgba(255,255,255,0.05)] text-white resize-none"
                />

                {/* 建模模式切换 */}
                <div className="flex gap-4">
                  <button
                    onClick={() => setLabMode('EXTRACT')}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${
                      labMode === 'EXTRACT'
                        ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                        : 'bg-[#202022] text-slate-300 hover:bg-[#2a2a2c]'
                    }`}
                  >
                    正向提取建模
                  </button>
                  <button
                    onClick={() => setLabMode('REVERSE')}
                    className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${
                      labMode === 'REVERSE'
                        ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                        : 'bg-[#202022] text-slate-300 hover:bg-[#2a2a2c]'
                    }`}
                  >
                    反向逻辑建模
                  </button>
                </div>

                {/* 启动建模按钮 */}
                <button
                  disabled={isLabLoading}
                  onClick={startLabWork}
                  className={`w-full bg-indigo-600 hover:bg-indigo-500 text-white p-5 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-3 transition-all ${
                    isLabLoading ? 'opacity-80 cursor-not-allowed' : 'hover:shadow-indigo-500/20'
                  }`}
                >
                  {isLabLoading ? (
                    <>
                      <span className="animate-spin">{ICONS.Loading}</span>
                      正在解析因果逻辑...
                    </>
                  ) : (
                    <>
                      {ICONS.Brain}
                      启动无上限小传建模
                    </>
                  )}
                </button>
              </div>

              {/* 建模结果 */}
              {(labResult || labStreaming) && (
                <div className="bg-[#151517] rounded-[3rem] border border-[rgba(255,255,255,0.1)] overflow-hidden flex flex-col shadow-2xl animate-fade-up">
                  {/* 结果头部 */}
                  <div className="p-6 border-b border-[rgba(255,255,255,0.05)] flex flex-wrap justify-between items-center gap-4 bg-[#202022]">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest italic">
                      Character Lab Output
                    </span>
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={startLabWork}
                        disabled={!!labStreaming || isLabLoading}
                        className="bg-[#151517] border border-[rgba(255,255,255,0.1)] text-rose-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-rose-500/10 transition-all"
                      >
                        不满意重新生成
                      </button>
                      <button
                        onClick={handleSaveLabResultToKB}
                        disabled={saveStatus || isLabLoading}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all ${
                          saveStatus
                            ? 'bg-emerald-500 text-white'
                            : 'bg-indigo-600 text-white hover:bg-indigo-500'
                        }`}
                      >
                        {saveStatus ? '✓ 已存入库' : '存入知识库'}
                      </button>
                    </div>
                  </div>

                  {/* 结果内容 */}
                  <div className="p-8 md:p-16 whitespace-pre-wrap font-sans text-slate-200 leading-relaxed text-base italic h-[500px] overflow-y-auto custom-scrollbar">
                    {labStreaming || labResult}
                    {labStreaming && (
                      <span className="inline-block w-2 h-5 bg-indigo-500 ml-2 animate-pulse" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterVisuals;
