
import React, { useState, useEffect, useMemo } from 'react';
import { KBFile, Category, AudienceMode, ScriptBlock } from '../types';
import { ICONS } from '../constants';
import { GeminiService } from '../services/geminiService';
import { DocGenerator } from '../services/docGenerator';

interface ScriptPanelProps {
  files: KBFile[];
  mode: AudienceMode;
}

const ScriptViewer: React.FC<{ content: string }> = ({ content }) => {
  const lines = useMemo(() => content.split('\n'), [content]);

  return (
    <div className="space-y-4 font-sans selection:bg-blue-100">
      {lines.map((line, i) => {
        // 去除所有常见的 Markdown 引导符和星号
        const cleaned = line.replace(/^[#\s\>\-\*]+/, '').replace(/\*/g, '').trim();
        if (!cleaned) return <div key={i} className="h-4" />;

        // 集数标题
        if (cleaned.startsWith('第') && cleaned.includes('集')) {
          return (
            <div key={i} className="mt-8 mb-4 border-l-4 border-slate-900 pl-4">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">{cleaned}</h3>
            </div>
          );
        }

        // 钩子
        if (cleaned.startsWith('本集钩子') || cleaned.includes('悬念')) {
          return (
            <div key={i} className="bg-amber-50 border border-amber-200 p-4 rounded-xl my-4 flex gap-3">
              <div className="text-amber-500 mt-1">{ICONS.Zap}</div>
              <p className="text-amber-900 font-bold text-sm italic leading-relaxed">{cleaned}</p>
            </div>
          );
        }

        // 场景
        if (cleaned.startsWith('场景')) {
          return (
            <div key={i} className="bg-slate-100 px-4 py-1.5 rounded-lg inline-block text-xs font-black text-slate-500 uppercase tracking-widest my-4">
              🎬 {cleaned}
            </div>
          );
        }

        // 对话 (格式：角色名：台词)
        if (cleaned.includes('：') || cleaned.includes(':')) {
          const sep = cleaned.includes('：') ? '：' : ':';
          const parts = cleaned.split(sep);
          // 逻辑判断：如果冒号前字符不多（通常是名字），则渲染为对话格式
          if (parts[0].length > 0 && parts[0].length < 15) {
            return (
              <div key={i} className="pl-6 relative py-2 group hover:bg-slate-50 transition-colors rounded-lg">
                <div className="absolute left-0 top-3 w-1 h-full bg-slate-200 group-hover:bg-blue-400 transition-colors"></div>
                <span className="font-black text-slate-900 mr-2">{parts[0]}</span>
                <span className="text-slate-800 leading-relaxed text-lg tracking-wide">{parts.slice(1).join(sep)}</span>
              </div>
            );
          }
        }

        // 动作描述或其他
        if (cleaned.startsWith('动作') || cleaned.startsWith('[') || cleaned.startsWith('（')) {
          return (
            <p key={i} className="text-slate-400 text-sm italic pl-6 leading-relaxed my-2">
              {cleaned}
            </p>
          );
        }

        return (
          <p key={i} className="text-slate-700 leading-relaxed pl-6">
            {cleaned}
          </p>
        );
      })}
    </div>
  );
};

const ScriptPanel: React.FC<ScriptPanelProps> = ({ files, mode }) => {
  const [sourceId, setSourceId] = useState<string>('');
  const [refId, setRefId] = useState<string>('');
  const [blocks, setBlocks] = useState<ScriptBlock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [progress, setProgress] = useState(0);

  const plotFiles = files.filter(f => f.category === Category.PLOT);
  const refFiles = files.filter(f => f.category === Category.REFERENCE);
  const gemini = new GeminiService();

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(p => (p < 95 ? p + Math.random() * 5 : p));
      }, 400);
    } else {
      clearInterval(interval);
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const generateNext = async () => {
    if (!sourceId) {
      alert("请选择小说原著作为作业锚点");
      return;
    }
    setIsLoading(true);
    const startEp = (blocks.length * 3) + 1;
    const targetRange = `${startEp}-${startEp + 2}`;
    setLoadingMsg(`AI 改改编引擎作业中：第 ${targetRange} 集...`);
    try {
      const sourceFile = files.find(f => f.id === sourceId);
      const refFile = files.find(f => f.id === refId);
      const content = await gemini.generateScriptBlock(
        mode,
        sourceFile?.content || '',
        refFile?.content || '',
        blocks,
        targetRange
      );
      setBlocks(prev => [...prev, { episodes: targetRange, content }]);
    } catch (error) {
      console.error(error);
      alert("生成失败，请检查 API 状态。");
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateBlock = async (index: number) => {
    setIsLoading(true);
    const block = blocks[index];
    setLoadingMsg(`正在精准重刷第 ${block.episodes} 集...`);
    try {
      const sourceFile = files.find(f => f.id === sourceId);
      const refFile = files.find(f => f.id === refId);
      const content = await gemini.generateScriptBlock(
        mode,
        sourceFile?.content || '',
        refFile?.content || '',
        blocks.slice(0, index),
        block.episodes
      );
      const newBlocks = [...blocks];
      newBlocks[index] = { ...block, content };
      setBlocks(newBlocks);
    } catch (error) {
      console.error(error);
      alert("重刷失败。");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadDoc = async () => {
    // 导出时清洗内容，确保 Word 文档没有 Markdown 符号
    const cleanContent = (text: string) => text.split('\n').map(l => l.replace(/^[#\s\>\-\*]+/, '').replace(/\*/g, '').trim()).join('\n');
    const fullContent = blocks.map(b => `第 ${b.episodes} 集改编成果\n\n${cleanContent(b.content)}`).join('\n\n' + '-'.repeat(40) + '\n\n');
    const title = `${mode}动漫剧本改编成果`;
    const blob = await DocGenerator.createWordDoc(title, fullContent);
    DocGenerator.downloadBlob(blob, `${title}_${new Date().getTime()}.docx`);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/30">
      <div className="bg-white border-b border-slate-200 p-6 flex flex-wrap items-end gap-6 shadow-sm z-10">
        <div className="flex-1 min-w-[280px]">
          <label className="flex items-center gap-2 mb-2 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">原著小说源 (核心)</span>
          </label>
          <div className="relative">
            <select 
              value={sourceId} 
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold transition-all outline-none appearance-none cursor-pointer"
            >
              <option value="">点击指向知识库中的原著...</option>
              {plotFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              {ICONS.ChevronRight}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-[280px]">
          <label className="flex items-center gap-2 mb-2 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">节奏/排版参考源</span>
          </label>
          <div className="relative">
            <select 
              value={refId} 
              onChange={(e) => setRefId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold transition-all outline-none appearance-none cursor-pointer"
            >
              <option value="">(可选) 强指向参考剧本...</option>
              {refFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              {ICONS.ChevronRight}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled={isLoading || !sourceId}
            onClick={generateNext}
            className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-sm flex items-center gap-3 shadow-xl hover:bg-black disabled:bg-slate-300 transition-all active:scale-95"
          >
            {isLoading ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Play}
            {blocks.length === 0 ? "启动改编引擎" : "续写三集"}
          </button>
          
          {blocks.length > 0 && (
            <button
              onClick={downloadDoc}
              className="bg-emerald-600 text-white p-3 rounded-xl shadow-xl hover:bg-emerald-700 transition-all"
              title="导出纯净版剧本"
            >
              {ICONS.Download}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar relative bg-[#fdfaf2]">
        {blocks.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-6 text-center">
            <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-inner border border-slate-100 opacity-50 mb-4">
              <div className="scale-150">{ICONS.FileText}</div>
            </div>
            <div>
              <p className="text-lg font-black tracking-widest text-slate-400 uppercase">等待指令激活</p>
              <p className="text-xs text-slate-400 mt-2 font-bold">选择原著后开启 2025 漫剧节奏引擎</p>
            </div>
          </div>
        )}

        {blocks.map((block, idx) => (
          <div key={idx} className="max-w-4xl mx-auto bg-white rounded-[1rem] shadow-xl border border-slate-200 overflow-hidden animate-fade-up relative">
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-slate-50 border-r border-slate-200 flex flex-col items-center pt-8 gap-4 opacity-40">
              {[1,2,3,4,5,6,7,8,9,10].map(n => <div key={n} className="w-2 h-2 rounded-full bg-slate-300"></div>)}
            </div>

            <div className="bg-slate-900 ml-8 px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-[9px] font-black bg-blue-600 text-white px-2 py-0.5 rounded uppercase tracking-widest tracking-tight">EPISODE {block.episodes}</span>
                <h6 className="text-white font-black text-lg">第 {block.episodes} 集改编完成</h6>
              </div>
              <button
                disabled={isLoading}
                onClick={() => regenerateBlock(idx)}
                className="bg-slate-800 text-blue-400 hover:text-blue-300 hover:bg-slate-700 flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded-lg transition-all"
              >
                {isLoading ? <div className="animate-spin">{ICONS.Refresh}</div> : ICONS.Refresh}
                精准重写
              </button>
            </div>

            <div className="p-10 lg:p-14 ml-8">
              <ScriptViewer content={block.content} />
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="sticky bottom-6 left-0 right-0 flex justify-center z-50">
            <div className="bg-white/90 backdrop-blur shadow-2xl rounded-2xl p-6 border border-slate-200 max-w-lg w-full flex flex-col gap-4 animate-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
                  <p className="font-black text-slate-900 text-sm">{loadingMsg}</p>
                </div>
                <span className="text-sm font-black text-slate-900">{Math.floor(progress)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-900 transition-all duration-300 ease-out rounded-full" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScriptPanel;
