import React, { useState, useCallback, useMemo } from 'react';
import { Category, KBFile } from '../types';
import { ICONS } from '../constants';
import { DocGenerator } from '../services/docGenerator';
import mammoth from 'mammoth';
import { toast } from '../components/Toast'; // 导入 Toast 组件

// 定义分类选项接口（增强类型提示）
interface CategoryOption {
  id: Category;
  label: string;
  icon: React.ReactNode;
}

interface KBManagerProps {
  files: KBFile[];
  onUpload: (files: KBFile[]) => void;
  onDelete: (id: string) => void;
  onUpdateFile?: (file: KBFile) => void; // 新增：更新文件回调（用于收藏等功能）
}

// 分类配置（统一管理）
const CATEGORY_OPTIONS: CategoryOption[] = [
  { id: Category.PLOT, label: '剧情原著/大纲', icon: ICONS.FileText },
  { id: Category.CHARACTER, label: '人物设定', icon: ICONS.Users },
  { id: Category.REFERENCE, label: '参考分镜', icon: ICONS.Settings },
  { id: Category.WORLD_BUILDING, label: '场景规则', icon: ICONS.Library },
];

const KBManager: React.FC<KBManagerProps> = ({
  files,
  onUpload,
  onDelete,
  onUpdateFile,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<Category>(Category.PLOT);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewFile, setViewFile] = useState<KBFile | null>(null);
  const [searchQuery, setSearchQuery] = useState(''); // 新增：搜索功能
  const [activeSort, setActiveSort] = useState<'uploadDate' | 'name'>('uploadDate'); // 新增：排序功能
  const [sortAscending, setSortAscending] = useState(false); // 新增：排序方向

  // 筛选并排序文件（缓存结果，避免重复计算）
  const filteredFiles = useMemo(() => {
    return files
      .filter(file => {
        // 分类筛选
        if (file.category !== selectedCategory) return false;
        // 搜索筛选（名称和内容匹配）
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          return (
            file.name.toLowerCase().includes(query) ||
            file.content.toLowerCase().includes(query)
          );
        }
        return true;
      })
      .sort((a, b) => {
        // 排序逻辑
        if (activeSort === 'name') {
          return sortAscending
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        } else {
          // 按上传日期排序
          return sortAscending
            ? new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
            : new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
        }
      });
  }, [files, selectedCategory, searchQuery, activeSort, sortAscending]);

  // 分类文件数量统计（缓存结果）
  const categoryCounts = useMemo(() => {
    return CATEGORY_OPTIONS.reduce((counts, category) => {
      counts[category.id] = files.filter(file => file.category === category.id).length;
      return counts;
    }, {} as Record<Category, number>);
  }, [files]);

  // 读取文件内容（优化错误处理和格式支持）
  const readFileContent = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const fileName = file.name.toLowerCase();

      // DOCX 文件处理
      if (fileName.endsWith('.docx')) {
        reader.onload = async (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const result = await mammoth.extractRawText({ arrayBuffer });
            resolve(result.value || '');
          } catch (err) {
            console.error('解析 DOCX 文件失败：', err);
            reject(new Error('DOCX 文件解析失败，请检查文件格式'));
          }
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsArrayBuffer(file);
      }
      // TXT 或其他文本文件
      else if (fileName.endsWith('.txt') || file.type.includes('text')) {
        reader.onload = (e) => resolve(e.target?.result as string || '');
        reader.onerror = () => reject(new Error('文本文件读取失败'));
        reader.readAsText(file);
      }
      // 不支持的文件格式
      else {
        reject(new Error(`不支持的文件格式：${file.name.split('.').pop()}`));
      }
    });
  }, []);

  // 处理文件上传（优化批量处理和错误提示）
  const processFiles = useCallback(async (rawFiles: File[]) => {
    if (rawFiles.length === 0) return;
    if (isProcessing) return;

    setIsProcessing(true);
    const successfulFiles: KBFile[] = [];
    const failedFiles: string[] = [];

    try {
      for (const file of rawFiles) {
        try {
          // 检查文件大小（限制 50MB）
          if (file.size > 50 * 1024 * 1024) {
            failedFiles.push(`${file.name}（文件超过 50MB 限制）`);
            continue;
          }

          const content = await readFileContent(file);
          const newFile: KBFile = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            category: selectedCategory,
            content: content,
            uploadDate: new Date().toISOString(),
            fileSize: file.size,
            fileType: file.type,
            lastModified: new Date().toISOString(),
            isFavorite: false,
          };
          successfulFiles.push(newFile);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '未知错误';
          failedFiles.push(`${file.name}（${errorMsg}）`);
        }
      }

      // 处理上传结果
      if (successfulFiles.length > 0) {
        onUpload(successfulFiles);
        toast.success(`成功上传 ${successfulFiles.length} 个文件`);
      }

      if (failedFiles.length > 0) {
        toast.error(`以下文件上传失败：\n${failedFiles.join('\n')}`);
      }
    } catch (error) {
      console.error('文件上传处理失败：', error);
      toast.error('文件上传处理失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, selectedCategory, readFileContent, onUpload]);

  // 处理文件输入（支持拖拽和点击上传）
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  }, [processFiles]);

  // 处理拖拽上传
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  }, [processFiles]);

  // 阻止拖拽默认行为
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // 下载 DOCX 文件
  const handleDownloadDocx = useCallback(async (file: KBFile) => {
    try {
      const blob = await DocGenerator.createWordDoc(file.name, file.content);
      DocGenerator.downloadBlob(blob, `${file.name.replace(/\.[^/.]+$/, "")}.docx`);
      toast.success(`正在下载：${file.name}.docx`);
    } catch (error) {
      console.error('生成 DOCX 文件失败：', error);
      toast.error('生成 DOCX 文件失败，请重试');
    }
  }, []);

  // 下载 TXT 文件
  const handleDownloadTxt = useCallback((file: KBFile) => {
    try {
      const blob = new Blob([file.content], { type: 'text/plain; charset=utf-8' });
      DocGenerator.downloadBlob(blob, `${file.name.replace(/\.[^/.]+$/, "")}.txt`);
      toast.success(`正在下载：${file.name}.txt`);
    } catch (error) {
      console.error('生成 TXT 文件失败：', error);
      toast.error('生成 TXT 文件失败，请重试');
    }
  }, []);

  // 切换文件收藏状态
  const toggleFavorite = useCallback((file: KBFile) => {
    if (!onUpdateFile) return;

    const updatedFile: KBFile = {
      ...file,
      isFavorite: !file.isFavorite,
      lastModified: new Date().toISOString(),
    };
    onUpdateFile(updatedFile);
    toast.success(`${updatedFile.isFavorite ? '收藏' : '取消收藏'}成功`);
  }, [onUpdateFile]);

  // 确认删除文件
  const confirmDelete = useCallback((id: string, fileName: string) => {
    if (window.confirm(`确定要删除文件"${fileName}"吗？此操作不可恢复。`)) {
      onDelete(id);
      toast.success('文件已删除');
    }
  }, [onDelete]);

  // 格式化文件大小
  const formatFileSize = useCallback((size?: number): string => {
    if (!size) return '未知大小';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  return (
    <div className="h-full flex bg-[#0a0a0c] text-white overflow-hidden">
      {/* 侧边栏 - 分类管理 */}
      <aside className="w-80 border-r border-white/5 p-6 md:p-8 flex flex-col gap-8 bg-black/40 backdrop-blur-3xl">
        <div className="flex-1">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-8">
            存储库分类管理
          </h2>
          <div className="space-y-2">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full flex items-center justify-between p-5 rounded-[1.5rem] transition-all group ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40 border border-blue-400/30'
                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`transition-colors ${
                      selectedCategory === cat.id
                        ? 'text-white'
                        : 'text-slate-600 group-hover:text-blue-500'
                    }`}
                  >
                    {cat.icon}
                  </div>
                  <span className="font-bold text-sm tracking-tight">{cat.label}</span>
                </div>
                <span
                  className={`text-[10px] font-black ${
                    selectedCategory === cat.id
                      ? 'bg-white/20'
                      : 'bg-white/5'
                  } px-3 py-1 rounded-full`}
                >
                  {categoryCounts[cat.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 资源提示卡片 */}
        <div className="p-6 bg-blue-600/10 border border-blue-500/20 rounded-3xl">
          <p className="text-[10px] font-black text-blue-400 uppercase mb-2">资源提示</p>
          <p className="text-[11px] text-blue-200/60 leading-relaxed font-bold italic">
            这里存储了您上传的原著以及所有生成的“连载大纲”、“剧本单元”和“分镜脚本”。
          </p>
        </div>
      </aside>

      {/* 主内容区 - 文件管理 */}
      <main className="flex-1 p-6 md:p-16 overflow-y-auto custom-scrollbar relative">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* 搜索和排序栏 */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            {/* 搜索框 */}
            <div className="relative w-full md:w-96">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索文件名或内容..."
                className="w-full bg-[#151517] border border-slate-800 rounded-2xl px-5 py-3 pl-12 text-sm font-medium text-white outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500">
                {ICONS.Search}
              </div>
            </div>

            {/* 排序控制 */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden md:inline">
                排序：
              </span>
              <select
                value={activeSort}
                onChange={(e) => setActiveSort(e.target.value as 'uploadDate' | 'name')}
                className="bg-[#151517] border border-slate-800 text-white text-[10px] font-bold px-3 py-2 rounded-lg"
              >
                <option value="uploadDate">上传时间</option>
                <option value="name">文件名称</option>
              </select>
              <button
                onClick={() => setSortAscending(!sortAscending)}
                className="bg-[#151517] border border-slate-800 p-2 rounded-lg text-slate-400 hover:text-white transition-all"
                title={sortAscending ? "降序排列" : "升序排列"}
              >
                {sortAscending ? ICONS.ArrowUp : ICONS.ArrowDown}
              </button>
            </div>
          </div>

          {/* 上传区域 */}
          <div
            className="border-2 border-dashed border-white/10 rounded-[4rem] p-10 md:p-20 flex flex-col items-center justify-center bg-white/[0.02] hover:bg-white/[0.03] transition-all relative group shadow-2xl"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {isProcessing && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md rounded-[4rem] flex flex-col items-center justify-center z-20">
                <div className="w-12 h-12 border-2 border-white/5 border-t-blue-500 rounded-full animate-spin mb-6"></div>
                <p className="text-xs font-black uppercase tracking-widest text-blue-500">
                  正在接入云端存储中心...
                </p>
              </div>
            )}

            <div className="w-20 h-20 md:w-24 md:h-24 bg-blue-600/10 text-blue-600 rounded-[2.5rem] flex items-center justify-center mb-6 border border-blue-500/20 group-hover:scale-110 transition-transform">
              <div className="scale-150">{ICONS.Upload}</div>
            </div>
            <h3 className="text-2xl md:text-3xl font-black mb-2 italic tracking-tighter uppercase">
              入库【{selectedCategory}】
            </h3>
            <p className="text-slate-500 text-sm mb-8 font-bold uppercase tracking-widest">
              支持 TXT, DOCX。支持拖拽至此区域。单文件限制 50MB
            </p>
            <label className="cursor-pointer bg-white text-black px-10 py-4 md:px-12 md:py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-2xl active:scale-95">
              上传本地文件
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInput}
                accept=".txt,.docx"
              />
            </label>
          </div>

          {/* 文件列表 */}
          {filteredFiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="bg-[#151517] border border-white/10 p-6 md:p-8 rounded-[2.5rem] flex flex-col gap-5 group hover:border-blue-500/30 transition-all relative overflow-hidden backdrop-blur-sm"
                >
                  {/* 收藏按钮 */}
                  <button
                    onClick={() => toggleFavorite(file)}
                    className="absolute top-6 right-6 p-2 bg-black/30 hover:bg-black/50 rounded-xl text-slate-400 hover:text-amber-500 transition-all z-10"
                    title={file.isFavorite ? "取消收藏" : "收藏文件"}
                  >
                    {file.isFavorite ? ICONS.StarFilled : ICONS.Star}
                  </button>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 group-hover:text-blue-500 transition-colors">
                        {ICONS.FileText}
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-bold text-sm md:text-base text-white truncate">
                          {file.name}
                        </h5>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-tighter italic">
                            {new Date(file.uploadDate).toLocaleDateString()}
                          </p>
                          <p className="text-[9px] font-black text-slate-700 uppercase tracking-tighter">
                            {formatFileSize(file.fileSize)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewFile(file)}
                        title="预览文件"
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-all"
                      >
                        {ICONS.Eye}
                      </button>
                      <button
                        onClick={() => confirmDelete(file.id, file.name)}
                        title="删除文件"
                        className="p-3 bg-white/5 hover:bg-rose-500/20 rounded-xl text-slate-500 hover:text-rose-500 transition-all"
                      >
                        {ICONS.Trash}
                      </button>
                    </div>
                  </div>

                  {/* 文件内容预览 */}
                  <div className="text-[11px] text-slate-400 line-clamp-3 font-medium leading-relaxed italic">
                    {file.content.length > 200
                      ? `${file.content.substring(0, 200)}...`
                      : file.content || '无内容'}
                  </div>

                  {/* 下载按钮组（hover 显示） */}
                  <div className="flex gap-3 mt-2 border-t border-white/5 pt-5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownloadDocx(file)}
                      className="flex-1 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-500/20 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all"
                      title="下载为 DOCX 文件"
                    >
                      {ICONS.FileWord} DOCX
                    </button>
                    <button
                      onClick={() => handleDownloadTxt(file)}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 px-4 py-2.5 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all"
                      title="下载为 TXT 文件"
                    >
                      {ICONS.FileText} TXT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // 空状态提示
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-[#151517] flex items-center justify-center mb-6 rounded-full border border-white/10">
                <ICONS.Folder className="w-10 h-10 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">暂无文件</h3>
              <p className="text-slate-500 max-w-md">
                {searchQuery.trim()
                  ? '未找到匹配的文件，请尝试其他搜索关键词'
                  : `请上传 ${selectedCategory} 相关文件，支持 TXT 和 DOCX 格式`}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* 文件预览弹窗 */}
      {viewFile && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-10 animate-fade-up">
          <div className="w-full max-w-5xl h-full bg-[#0a0a0c] border border-white/10 rounded-[4rem] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(30,41,59,0.5)]">
            {/* 弹窗头部 */}
            <div className="h-20 px-8 md:px-12 border-b border-white/5 flex items-center justify-between bg-[#151517]">
              <div className="flex items-center gap-6">
                <div className="w-3 h-3 rounded-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.8)]"></div>
                <div className="min-w-0">
                  <h4 className="text-lg md:text-xl font-black text-white italic tracking-tighter truncate">
                    {viewFile.name}
                  </h4>
                  <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.3em] mt-1">
                    {viewFile.content.length.toLocaleString()} 字符
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                <button
                  onClick={() => toggleFavorite(viewFile)}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-500 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all"
                >
                  {viewFile.isFavorite ? ICONS.StarFilled : ICONS.Star}
                  {viewFile.isFavorite ? "已收藏" : "收藏"}
                </button>
                <button
                  onClick={() => handleDownloadDocx(viewFile)}
                  className="bg-blue-600 text-white px-4 md:px-6 py-2 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-blue-500 transition-all"
                >
                  {ICONS.Download} 导出 Word
                </button>
                <button
                  onClick={() => setViewFile(null)}
                  className="text-slate-400 hover:text-white transition-all bg-white/5 p-3 rounded-full border border-white/10"
                  title="关闭预览"
                >
                  {ICONS.X}
                </button>
              </div>
            </div>

            {/* 弹窗内容区 */}
            <div className="flex-1 overflow-y-auto p-8 md:p-20 custom-scrollbar">
              <div className="max-w-4xl mx-auto whitespace-pre-wrap font-sans text-white/90 leading-[2.2] text-base font-light italic">
                {viewFile.content || '该文件没有内容'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KBManager;
