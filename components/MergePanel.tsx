import React, { useState, useMemo, useCallback } from 'react';
import { KBFile, Category } from '../types';
import { ICONS } from '../constants';
import { DocGenerator } from '../services/docGenerator';
import { toast } from '../components/Toast'; // 导入 Toast 组件

interface MergePanelProps {
  files: KBFile[];
  onSaveToKB: (f: KBFile) => void;
  className?: string;
}

const MergePanel: React.FC<MergePanelProps> = ({
  files,
  onSaveToKB,
  className = '',
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergedContent, setMergedContent] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);
  const [mergeTitle, setMergeTitle] = useState(
    `合并作品_${new Date().toLocaleDateString()}`
  );
  const [showMergeOptions, setShowMergeOptions] = useState(false); // 新增：合并选项
  const [mergeSeparator, setMergeSeparator] = useState('\n\n'); // 新增：合并分隔符
  const [includeFilenames, setIncludeFilenames] = useState(false); // 新增：是否包含文件名

  // 筛选剧情类文件（缓存结果）
  const plotFiles = useMemo(
    () => files.filter(f => f.category === Category.PLOT),
    [files]
  );

  // 已选择的文件列表（按选择顺序排序）
  const selectedFiles = useMemo(
    () => selectedIds.map(id => files.find(f => f.id === id)).filter(Boolean) as KBFile[],
    [selectedIds, files]
  );

  // 切换文件选择状态
  const toggleFile = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }, []);

  // 调整选择文件的顺序
  const moveItem = useCallback((index: number, direction: 'up' | 'down') => {
    const newIds = [...selectedIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newIds.length) return;
    
    // 交换位置
    [newIds[index], newIds[targetIndex]] = [newIds[targetIndex], newIds[index]];
    setSelectedIds(newIds);
  }, [selectedIds]);

  // 移除已选择的文件
  const removeSelectedFile = useCallback((index: number) => {
    const newIds = [...selectedIds];
    newIds.splice(index, 1);
    setSelectedIds(newIds);
  }, [selectedIds]);

  // 执行文件合并（优化合并逻辑，支持更多选项）
  const handleMerge = useCallback(() => {
    if (selectedIds.length === 0) {
      toast.warning('请先选择要合并的章节');
      return;
    }

    setIsMerging(true);

    try {
      // 按顺序合并文件内容
      const fullText = selectedIds
        .map(id => {
          const file = files.find(f => f.id === id);
          if (!file) return '';

          // 如果需要包含文件名，添加文件名标记
          if (includeFilenames) {
            return `=== ${file.name} ===\n${file.content}`;
          }
          return file.content;
        })
        .join(mergeSeparator); // 使用自定义分隔符

      setMergedContent(fullText);
      toast.success(`成功合并 ${selectedIds.length} 个文件`);
    } catch (error) {
      console.error('文件合并失败：', error);
      toast.error('文件合并失败，请重试');
    } finally {
      setIsMerging(false);
    }
  }, [selectedIds, files, mergeSeparator, includeFilenames]);

  // 下载 DOCX 文件
  const handleDownloadDocx = useCallback(async () => {
    if (!mergedContent) {
      toast.warning('暂无合并内容可下载');
      return;
    }

    try {
      const blob = await DocGenerator.createWordDoc(mergeTitle, mergedContent);
      DocGenerator.downloadBlob(blob, `${mergeTitle}.docx`);
      toast.success(`正在下载：${mergeTitle}.docx`);
    } catch (error) {
      console.error('生成 DOCX 文件失败：', error);
      toast.error('生成 DOCX 文件失败，请重试');
    }
  }, [mergeTitle, mergedContent]);

  // 下载 TXT 文件
  const handleDownloadTxt = useCallback(() => {
    if (!mergedContent) {
      toast.warning('暂无合并内容可下载');
      return;
    }

    try {
      const blob = new Blob([mergedContent], { type: 'text/plain; charset=utf-8' });
      DocGenerator.downloadBlob(blob, `${mergeTitle}.txt`);
      toast.success(`正在下载：${mergeTitle}.txt`);
    } catch (error) {
      console.error('生成 TXT 文件失败：', error);
      toast.error('生成 TXT 文件失败，请重试');
    }
  }, [mergeTitle, mergedContent]);

  // 保存到知识库
  const handleSaveToKB = useCallback(() => {
    if (!mergedContent) {
      toast.warning('暂无合并内容可保存');
      return;
    }

    const newFile: KBFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: mergeTitle,
      category: Category.PLOT,
      content: mergedContent,
      uploadDate: new Date().toISOString(),
      fileSize: mergedContent.length,
      fileType: 'text/plain',
      lastModified: new Date().toISOString(),
      isFavorite: false,
    };

    onSaveToKB(newFile);
    toast.success('已成功存入资料库');
  }, [mergeTitle, mergedContent, onSaveToKB]);

  // 清空合并结果
  const handleClearMerge = useCallback(() => {
    setMergedContent('');
    setSelectedIds([]);
    setMergeTitle(`合并作品_${new Date().toLocaleDateString()}`);
    setIncludeFilenames(false);
    setMergeSeparator('\n\n');
  }, []);

  return (
    <div className={`flex-1 flex flex-col bg-[#050508] overflow-hidden ${className}`}>
      {/* 头部导航栏 */}
      <div className="h-20 px-6 md:px-10 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between bg-black/40 backdrop-blur-xl shrink-0">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">
            Content Consolidation
          </span>
          <h2 className="text-xl font-black text-white italic">原著章节无损合并工具</h2>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 mt-4 sm:mt-0">
          {/* 合并选项按钮 */}
          <button
            onClick={() => setShowMergeOptions(!showMergeOptions)}
            className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl font-black text-xs uppercase transition-all flex items-center gap-2"
          >
            {ICONS.Settings} 合并选项
          </button>

          {/* 文件名输入框 */}
          <input
            value={mergeTitle}
            onChange={(e) => setMergeTitle(e.target.value.trim() || `合并作品_${new Date().toLocaleDateString()}`)}
            className="bg-[#151517] border border-white/10 text-white rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-blue-500 w-full sm:w-64"
            placeholder="合并后文件名..."
          />

          {/* 执行合并按钮 */}
          <button
            disabled={selectedIds.length === 0 || isMerging}
            onClick={handleMerge}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-black text-xs uppercase transition-all shadow-lg flex items-center gap-2"
          >
            {isMerging ? (
              <>
                <span className="animate-spin text-xs">{ICONS.Loading}</span>
                合并中...
              </>
            ) : (
              <>
                {ICONS.Merge} 执行合并
              </>
            )}
          </button>
        </div>
      </div>

      {/* 合并选项面板（展开/收起） */}
      {showMergeOptions && (
        <div className="px-6 py-4 border-b border-white/5 bg-[#101012] backdrop-blur-xl">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block">
                章节分隔符
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setMergeSeparator('\n\n')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase ${
                    mergeSeparator === '\n\n' ? 'bg-blue-600/20 text-blue-500' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  空两行
                </button>
                <button
                  onClick={() => setMergeSeparator('\n')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase ${
                    mergeSeparator === '\n' ? 'bg-blue-600/20 text-blue-500' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  空一行
                </button>
                <button
                  onClick={() => setMergeSeparator('')}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase ${
                    mergeSeparator === '' ? 'bg-blue-600/20 text-blue-500' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  无分隔
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-2 cursor-pointer"
                htmlFor="include-filenames"
              >
                <input
                  id="include-filenames"
                  type="checkbox"
                  checked={includeFilenames}
                  onChange={(e) => setIncludeFilenames(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#151517] border border-white/20 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-[10px] font-black text-slate-400 uppercase">
                  包含章节文件名
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 主内容区 - 左右分栏 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：文件选择与排序 */}
        <div className="w-80 md:w-96 border-r border-white/5 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-[#0a0a0c]/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              选择与排序章节
            </h3>
            <span className="text-[10px] font-black text-blue-500">
              可选：{plotFiles.length} 个
            </span>
          </div>

          {/* 已选择文件列表 */}
          {selectedFiles.length > 0 && (
            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase mb-2">
                <span>已选章节（{selectedFiles.length} 个）</span>
                <button
                  onClick={handleClearMerge}
                  className="text-rose-500 hover:text-rose-400 transition-colors"
                  title="清空选择"
                >
                  清空
                </button>
              </div>
              {selectedFiles.map((file, index) => (
                <div
                  key={file.id}
                  className="p-4 rounded-2xl border border-blue-500/30 bg-blue-600/10 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                      {index + 1}
                    </div>
                    <span className="text-xs font-bold text-white truncate max-w-[160px]">
                      {file.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30"
                      title="上移"
                    >
                      {ICONS.ChevronUp}
                    </button>
                    <button
                      onClick={() => moveItem(index, 'down')}
                      disabled={index === selectedFiles.length - 1}
                      className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30"
                      title="下移"
                    >
                      {ICONS.ChevronDown}
                    </button>
                    <button
                      onClick={() => removeSelectedFile(index)}
                      className="p-1.5 text-slate-400 hover:text-rose-500"
                      title="移除"
                    >
                      {ICONS.X}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 可选文件列表 */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">
              可选章节
            </h4>
            {plotFiles.length > 0 ? (
              plotFiles.map((file) => {
                const isSelected = selectedIds.includes(file.id);
                return (
                  <div
                    key={file.id}
                    onClick={() => toggleFile(file.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between group hover:bg-white/5 ${
                      isSelected
                        ? 'bg-blue-600/5 border-blue-500/20 opacity-70'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                          isSelected
                            ? 'bg-blue-600/30 text-blue-500'
                            : 'bg-white/10 text-slate-500'
                        }`}
                      >
                        {isSelected ? '✓' : '+'}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white truncate">
                          {file.name}
                        </span>
                        <p className="text-[9px] text-slate-600 mt-0.5">
                          {file.content.length.toLocaleString()} 字符
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-[9px] font-black text-blue-500 bg-blue-600/20 px-2 py-0.5 rounded-full">
                        已选择
                      </span>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ICONS.Folder className="w-8 h-8 text-slate-600 mb-3" />
                <p className="text-[10px] font-black text-slate-500 uppercase">
                  暂无剧情类文件
                </p>
                <p className="text-[9px] text-slate-700 mt-1">
                  请先上传剧情原著或大纲文件
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：合并结果预览与导出 */}
        <div className="flex-1 flex flex-col min-h-0 bg-black">
          {mergedContent ? (
            <>
              {/* 导出按钮栏 */}
              <div className="p-4 border-b border-white/5 flex flex-wrap gap-3 justify-between bg-[#0a0a0c]/50">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleDownloadDocx}
                    className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all"
                    title="下载为 DOCX 文件"
                  >
                    {ICONS.FileWord} DOCX
                  </button>
                  <button
                    onClick={handleDownloadTxt}
                    className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all"
                    title="下载为 TXT 文件"
                  >
                    {ICONS.FileText} TXT
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleClearMerge}
                    className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all"
                    title="清空合并结果"
                  >
                    {ICONS.Trash} 清空
                  </button>
                  <button
                    onClick={handleSaveToKB}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all shadow-lg"
                    title="存入知识库"
                  >
                    {ICONS.Save} 存入资料库
                  </button>
                </div>
              </div>

              {/* 合并结果预览 */}
              <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                  <div className="mb-6 flex items-center gap-3">
                    <h3 className="text-lg font-bold text-white italic">合并结果预览</h3>
                    <span className="text-[10px] font-black text-slate-500 uppercase">
                      总字符数：{mergedContent.length.toLocaleString()}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap font-sans text-slate-300 leading-relaxed text-sm md:text-base">
                    {mergedContent}
                  </div>
                </div>
              </div>
            </>
          ) : (
            // 空状态提示
            <div className="flex-1 flex flex-col items-center justify-center opacity-30 p-10 text-center">
              <div className="scale-[2.5] mb-6 text-slate-600">
                {ICONS.Layers}
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-widest mb-2">
                请在左侧选择章节并执行合并
              </h3>
              <p className="text-[10px] text-slate-500 max-w-md mx-auto">
                支持调整章节顺序、设置合并分隔符、包含章节文件名等功能
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MergePanel;
