
import React from 'react';
import { 
  FileText, Users, Settings, Library, ChevronRight, ChevronLeft, Upload, Play, RefreshCcw, Download,
  Trash2, FolderOpen, ArrowLeft, Zap, Heart, MessageSquare, Wand2, Image as ImageIcon, Sparkles, Volume2, PlusCircle,
  Sword, Shield, Star, ZapOff, Flame, ListOrdered, Clock, Combine, FileDown, Layers
} from 'lucide-react';
import { DirectorStyle, TropeType } from './types';

export const ICONS = {
  FileText: <FileText className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />,
  Settings: <Settings className="w-5 h-5" />,
  Library: <Library className="w-5 h-5" />,
  ChevronRight: <ChevronRight className="w-5 h-5" />,
  ChevronLeft: <ChevronLeft className="w-5 h-5" />,
  Upload: <Upload className="w-5 h-5" />,
  Play: <Play className="w-5 h-5" />,
  Refresh: <RefreshCcw className="w-5 h-5" />,
  Download: <Download className="w-5 h-5" />,
  Trash: <Trash2 className="w-5 h-5" />,
  Folder: <FolderOpen className="w-5 h-5" />,
  ArrowLeft: <ArrowLeft className="w-5 h-5" />,
  Zap: <Zap className="w-4 h-4" />,
  Heart: <Heart className="w-4 h-4" />,
  Refine: <Wand2 className="w-4 h-4" />,
  Chat: <MessageSquare className="w-4 h-4" />,
  Image: <ImageIcon className="w-5 h-5" />,
  Sparkles: <Sparkles className="w-4 h-4" />,
  Volume: <Volume2 className="w-4 h-4" />,
  Plus: <PlusCircle className="w-4 h-4" />,
  Sword: <Sword className="w-4 h-4" />,
  Shield: <Shield className="w-4 h-4" />,
  Star: <Star className="w-4 h-4" />,
  Trope: <Flame className="w-4 h-4" />,
  List: <ListOrdered className="w-4 h-4" />,
  Clock: <Clock className="w-4 h-4" />,
  Merge: <Combine className="w-5 h-5" />,
  FileDown: <FileDown className="w-5 h-5" />,
  Layers: <Layers className="w-5 h-5" />
};

export const STYLE_PROMPTS: Record<DirectorStyle, string> = {
  [DirectorStyle.SHINKAI]: "新海诚清新光影风格，强调云层、丁达尔效应和细腻的背景细节。",
  [DirectorStyle.UFOTABLE]: "飞碟社绚丽特效风格，粒子效果饱满，战斗时有极强的动态模糊和光污染质感。",
  [DirectorStyle.SHAFT]: "新房昭之意识流风格，极端倾斜构图，明亮的色块对比，PPT感但富有冲击力的静止帧。",
  [DirectorStyle.MAPPA]: "MAPPA写实硬核风格，肌肉线条清晰，阴影厚重，强调原始的战斗力量感。",
  [DirectorStyle.GHIBLI]: "吉卜力治愈手绘风格，水彩质感，柔和的光线，强调自然与人物的和谐。",
};

export const TROPE_PROMPTS: Record<TropeType, string> = {
  [TropeType.FACE_SLAP]: "【打脸反杀】通过反向拉扯和极致的视觉反差表现爽感。",
  [TropeType.INVINCIBLE]: "【无敌碾压】镜头强调压迫感和绝对的力量统治力。",
  [TropeType.REGRET]: "【火葬场】情感极限拉扯，增加大量慢镜头和微表情描写。",
  [TropeType.SYSTEM]: "【系统流】UI界面的数字化特效与现实环境的融合。",
  [TropeType.HIDDEN_EXPERT]: "【扮猪吃虎】平凡外表下的惊人爆发，镜头节奏由慢转瞬爆发。",
  [TropeType.GENIUS]: "【王者归来】神圣感、霸气侧漏的构图设计。",
};

export const SYSTEM_PROMPT_BASE = `你是一位精通漫剧工业化生产的顶级导演。
本次任务目标：制作符合长篇连载（60-100集）要求的精品漫剧全案，总时长需达到120分钟以上。

【改编核心准则 - 极致细节，不设上限】
1. **内容篇幅**：移除任何字数限制。你的目标是提供“尽可能多”的细节。通过深度挖掘环境、心理、物理反馈、微表情、镜头语言来自然扩充篇幅。禁止无意义的重复，但必须做到事无巨细。
2. **工业级大纲**：大纲需覆盖全集逻辑，明确每一集的悬念钩子。
3. **分镜表专业化**：分镜需具备极高的视觉引导性，包含“镜号、运动、视觉描述、台词、提示词”。
4. **配音级台词**：台词需精炼且口语化。
5. **纯净输出**：禁止任何 Markdown 符号（#，*，- 等）。`;
