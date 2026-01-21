
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { KBFile, Category, AudienceMode, ScriptBlock, ModelType, DirectorStyle, TropeType } from '../types.ts';
import { ICONS } from '../constants.tsx';
import { GeminiService } from '../services/geminiService.ts';

interface ScriptPanelProps {
  files: KBFile[];
  mode: AudienceMode;
  modelType: ModelType;
  onSaveToKB?: (f: KBFile) => void;
}

const ScriptPanel: React.FC<ScriptPanelProps> = ({ files, mode, modelType, onSaveToKB }) => {
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
  
  const gemini = useMemo(() => new GeminiService(), []);

  // 持久化存储
  useEffect(() => {
    if (sourceId) {
      const saved = localStorage.getItem(`script_blocks_v12_${sourceId}`);
      if (saved) {
        try {
          setBlocks(JSON.parse(saved));
        } catch (e) {
          setBlocks([]);
        }
      } else setBlocks([]);
    }
  }, [sourceId]);

  useEffect(() => {
    if (sourceId && blocks.length > 0) {
      localStorage.setItem(`script_blocks_v12_${sourceId}`, JSON.stringify(blocks));
    }
  }, [blocks, sourceId]);

  // 核心生成函数：接受当前已知的所有块，返回新生成的块
  const executeGeneration = async (currentBlocks: ScriptBlock[], targetIdx?: number): Promise<ScriptBlock | null> => {
    const isRegen = targetIdx !== undefined;
    const currentIdx = isRegen ? targetIdx : currentBlocks.length + 1;
    setCurrentGeneratingIdx(currentIdx);
    setStreamingText('');

    try {
      const source = files.find(f => f.id === sourceId);
      const refFile = files.find(f => f.id === refFileId);
      if (!source) throw new Error("Source file missing");

      let fullContent = '';
      // 传入已有的 blocks 确保 AI 知道上下文进度
      const stream = gemini.generateScriptBlockStream(
        mode, source.content, currentBlocks.slice(0, currentIdx - 1), 
        currentIdx, modelType, directorStyle, trope, refFile?.content || ''
      );

      for await (const chunk of stream) {
        fullContent += chunk;
        setStreamingText(GeminiService.cleanText(fullContent)); 
      }
      
      const cleaned = GeminiService.cleanText(fullContent);
      return {
        id: isRegen ? currentBlocks[targetIdx - 1].id : Math.random().toString(36).substr(2, 9),
        sourceId: sourceId,
        episodes: `第 ${currentIdx} 集剧本`,
        content: cleaned,
        continuityStatus: `改编完成 | ${cleaned.length} 字`,
        style: directorStyle,
        trope: trope
      };
    } catch (e) {
      console.error("Generation failed:", e);
      return null;
    } finally {
      setStreamingText('');
      setCurrentGeneratingIdx(null);
    }
  };

  const handleGenerateNext = async (targetIdx?: number) => {
    if (!sourceId) { alert("请先选择待改编的小说原著"); return; }
    setIsGenerating(true);
    const result = await executeGeneration(blocks, targetIdx);
    if (result) {
      if (targetIdx !== undefined) {
        const newBlocks = [...blocks];
        newBlocks[targetIdx - 1] = result;
        setBlocks(newBlocks);
        setSavedStatus(prev => ({ ...prev, [result.id]: false }));
      } else {
        setBlocks(prev => [...prev, result]);
      }
    }
    setIsGenerating(false);
  };

  const handleBatchGenerate = async () => {
    if (!sourceId) { alert("请