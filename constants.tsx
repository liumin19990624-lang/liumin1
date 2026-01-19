
import React from 'react';
import { 
  FileText, Users, Settings, Library, ChevronRight, ChevronLeft, Upload, Play, RefreshCcw, Download,
  Trash2, FolderOpen, ArrowLeft, Zap, Heart, MessageSquare, Wand2, Image as ImageIcon, Sparkles, Volume2, PlusCircle
} from 'lucide-react';
import { DirectorStyle } from './types';

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
  Plus: <PlusCircle className="w-4 h-4" />
};

export const STYLE_PROMPTS: Record<DirectorStyle, string> = {
  [DirectorStyle.SHINKAI]: "新海诚清新光影风格",
  [DirectorStyle.UFOTABLE]: "飞碟社绚丽特效风格",
  [DirectorStyle.SHAFT]: "新房昭之意识流风格",
  [DirectorStyle.MAPPA]: "MAPPA写实硬核风格",
  [DirectorStyle.GHIBLI]: "吉卜力治愈手绘风格",
};

export const MALE_MODE_PROMPT = "男频模式：快节奏、爽点密集、战斗感强。";
export const FEMALE_MODE_PROMPT = "女频模式：情感细腻、唯美氛围、内心戏多。";

export const SYSTEM_PROMPT_BASE = `你是一位顶尖的动漫编剧和配音导演。
你的任务是将网文原著改编为每 3 集为一个单元的专业 2D 动漫脚本。

脚本要求（核心）：
1. 语言：必须全中文输出，禁止出现任何英文标识或乱码符号。
2. 台词：严禁出现“呜呜”、“哈哈哈”、“哼”等小说拟声词。请转化为具体的动作描写或具备表演力的情感对白。
3. 格式：严格按照以下结构输出，不要使用 Markdown（如 #, *, - 等）：

第 N 集
（镜头：视觉画面详细描述）
人物名：配音台词

约束：
- 直接输出脚本内容，不要任何前言、后记、分析过程。
- 每集包含 5-8 个核心分镜。
- 台词要短促、有力度，符合配音表演节奏。`;
