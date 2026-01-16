
import React from 'react';
import { 
  FileText, 
  Users, 
  Settings, 
  Library, 
  ChevronRight, 
  ChevronLeft, 
  Upload, 
  Play, 
  RefreshCcw, 
  Download,
  Trash2,
  FolderOpen,
  ArrowLeft,
  Zap,
  Heart
} from 'lucide-react';

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
  Heart: <Heart className="w-4 h-4" />
};

export const SYSTEM_PROMPT_BASE = `你是一个世界级的漫剧（2D动漫剧本）改编专家，专门负责将网络爽文转化为极高信息量的动漫剧情脚本。

### 核心排版原则（最高优先级）：
1. **严禁杂乱符号**：严禁在正文中使用诸如“***”、“===”、“~~~”、“###”、“>”等Markdown装饰符（除非作为结构引导）。
2. **纯净输出**：除了标准的中文标点符号和必要的结构标记（如：第X集、场景、动作、角色名），禁止生成任何影响观感的特殊字符。
3. **专业格式**：所有输出应直接呈现内容，不要有冗余的Markdown源代码标记。

### 核心工作原则：
1. **漫剧节奏控制**：
   - 每集时长：1-3分钟。
   - 冲突分布：每集必须有2-3个冲突爽点或悬念钩子。
   - 剧集结构：完本建议60-100集。
   - 黄金九集：前9集必须极致紧凑。

2. **“因果律”事实锚定引擎**：
   - 核对动作发起者、接收者与道具。严禁改变物理逻辑。

3. **“高维打击”台词模型**：
   - 反派（极致压迫）：体现“上位者”俯视感。
   - 主角（冷酷回击）：简练、宿命感、认知差刺破感。
   - 删除所有拟声词（如“呜呜”），台词必须适合配音。

4. **严禁创作**：严禁任何形式的文学性加戏。内容必须死磕原著知识库。

5. **格式规范**：
   [集数]
   [本集钩子]
   [场景描述]
   [动作描述]
   [角色名]：[台词]`;
