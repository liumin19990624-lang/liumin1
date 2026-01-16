
import React, { useState } from 'react';
import { KBFile, AudienceMode, Category } from '../types';
import { ICONS } from '../constants';
import { GeminiService } from '../services/geminiService';
import { DocGenerator } from '../services/docGenerator';

interface OutlinePanelProps {
  files: KBFile[];
}

type AnalysisMode = 'CHARACTERS' | 'PLOT_OUTLINE';

const OutlinePanel: React.FC<OutlinePanelProps> = ({ files }) => {
  const [targetId, setTargetId] = useState<string>('');
  const [refId, setRefId] = useState<string>('');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('CHARACTERS');
  const [audienceMode, setAudienceMode] = useState<AudienceMode>(AudienceMode.MALE);
  const [result, setResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  const gemini = new GeminiService();
  
  const refFiles = files.filter(f => f.category === Category.REFERENCE);

  const handleStart = async () => {
    if (!targetId) {
      alert("请指向并选择知识库中的目标文件");
      return;
    }

    setIsLoading(true);
    setLoadingMsg(analysisMode === 'CHARACTERS' ? "正在深度扫描全集内容统计人物..." : "正在撰写 2000-3000 字全篇深度总结大纲...");
    
    try {
      const file = files.find(f => f.id === targetId);
      const refFile = files.find(f => f.id === refId);
      let output = '';
      if (analysisMode === 'CHARACTERS') {
        output = await gemini.extractCharacters(file?.content || '');
      } else {
        output = await gemini.generateFullOutline(audienceMode, file?.content || '', refFile?.content || '');
      }

      // 实时清洗输出中的 Markdown 符号
      const cleanedOutput = output
        .split('\n')
        .map(line => line.replace(/^[#\s\>\-\*]+/, '').replace(/\*/g, '').trim())
        .join('\n');

      setResult(cleanedOutput);
    } catch (error) {
      console.error(error);
      alert("作业失败，请检查配置或重试。");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadDoc = async () => {
    const title = analysisMode === 'CHARACTERS' ? "漫剧全集角色深度统计报表" : `${audienceMode} - 漫剧全集剧情大纲(深度总结版)`;
    const blob = await DocGenerator.createWordDoc(title, result);
    DocGenerator.downloadBlob(blob, `${title}_${new Date().getTime()}.docx`);
  };

  const resetResult = () => setResult('');

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
      {!result && (
        <div className="bg-white border-b p-5 flex flex-wrap items-end gap-6 shadow-sm z-10 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">核心作业功能</label>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setAnalysisMode('CHARACTERS')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  analysisMode === 'CHARACTERS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                人物统计
              </button>
              <button
                onClick={() => setAnalysisMode('PLOT_OUTLINE')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  analysisMode === 'PLOT_OUTLINE' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                全篇总结
              </button>
            </div>
          </div>

          <div className="space-y-1.5 flex-1 min-w-[260px]">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${analysisMode === 'CHARACTERS' ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">指向作业文件</label>
            </div>
            <select 
              value={targetId} 
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none cursor-pointer hover:bg-white"
            >
              <option value="">指向目标资料...</option>
              {files.map(f => <option key={f.id} value={f.id}>{f.name} ({f.category})</option>)}
            </select>
          </div>

          {analysisMode === 'PLOT_OUTLINE' && (
            <div className="space-y-1.5 flex-1 min-w-[260px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">参考风格源</label>
              </div>
              <select 
                value={refId} 
                onChange={(e) => setRefId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm outline-none cursor-pointer hover:bg-white"
              >
                <option value="">(可选) 指向参考文本...</option>
                {refFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          )}
          
          <button
            disabled={isLoading || !targetId}
            onClick={handleStart}
            className="bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white font-bold px-8 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95"
          >
            {isLoading ? <div className="animate-spin">{ICONS.Refresh}</div> : analysisMode === 'CHARACTERS' ? ICONS.Users : ICONS.FileText}
            {analysisMode === 'CHARACTERS' ? "开始统计" : "撰写总结"}
          </button>
        </div>
      )}

      {result && (
        <div className="bg-white border-b p-4 flex items-center justify-between shadow-sm sticky top-0 z-20">
          <button
            onClick={resetResult}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm px-4 py-2 rounded-xl transition-all border border-slate-200"
          >
            {ICONS.ArrowLeft} 返回配置
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleStart}
              className="flex items-center gap-2 text-blue-600 font-bold text-sm px-4 py-2 rounded-xl transition-all border border-blue-100 bg-blue-50"
            >
              {ICONS.Refresh} 重新生成
            </button>
            <button
              onClick={downloadDoc}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl transition-all shadow-lg font-bold flex items-center gap-2"
            >
              {ICONS.Download} 下载 Word
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 lg:p-10 relative">
        {result ? (
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/50 overflow-hidden">
              <div className="bg-slate-900 p-10 text-white flex items-center gap-6">
                <div className={`p-4 rounded-2xl ${analysisMode === 'CHARACTERS' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                  {analysisMode === 'CHARACTERS' ? ICONS.Users : ICONS.FileText}
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight mb-1">
                    {analysisMode === 'CHARACTERS' ? '漫剧人物深度画像' : '全篇剧情深度总结'}
                  </h2>
                  <p className="text-slate-400 font-medium italic">已锁定资料源核心锚点，字数饱满，排版纯净。</p>
                </div>
              </div>
              
              <div className="p-10 lg:p-16">
                <div className="prose prose-slate max-w-none">
                  <div className="whitespace-pre-wrap font-sans text-slate-700 leading-[1.8] text-base lg:text-lg bg-slate-50/50 p-10 rounded-[2rem] border border-slate-100">
                    {result}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-8 p-12 text-center">
            <div className="w-28 h-28 border-[10px] border-slate-100 border-t-slate-900 rounded-full animate-spin"></div>
            <div>
              <p className="text-slate-900 font-black text-3xl mb-3">{loadingMsg}</p>
              <p className="text-slate-500 text-sm italic font-medium">正在进行全篇降维总结，规划叙事宏图，确保排版纯净炸裂...</p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-8 text-center">
            <div className="w-40 h-40 bg-white rounded-[3rem] flex items-center justify-center shadow-inner border border-slate-100 opacity-60">
              <div className="scale-[2.5]">{analysisMode === 'CHARACTERS' ? ICONS.Users : ICONS.FileText}</div>
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800 tracking-tight">全自动深度分析引擎</p>
              <p className="text-sm mt-3 text-slate-400 font-medium">指向目标后 AI 将生成 2000 字以上的纯净文字总结</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutlinePanel;
