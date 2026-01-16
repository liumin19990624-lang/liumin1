
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
  Heart,
  MessageSquare,
  Wand2,
  Image as ImageIcon,
  Sparkles,
  Clock,
  Music,
  Video,
  Layers,
  Activity,
  Wind,
  Maximize2
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
  Clock: <Clock className="w-4 h-4" />,
  Music: <Music className="w-4 h-4" />,
  Video: <Video className="w-4 h-4" />,
  History: <Layers className="w-4 h-4" />,
  Batch: <Activity className="w-4 h-4" />,
  Wind: <Wind className="w-4 h-4" />,
  Expand: <Maximize2 className="w-4 h-4" />
};

export const STYLE_PROMPTS: Record<DirectorStyle, string> = {
  [DirectorStyle.SHINKAI]: "视觉风格：强调极高饱和度、透亮的云朵、丁达尔效应。强调光影细节，画面充满清新文艺感。",
  [DirectorStyle.UFOTABLE]: "视觉风格：强调粒子特效、光影的厚重感、动态模糊（Motion Blur）。强调战斗场景中的流光溢彩和极高的快门速度感。",
  [DirectorStyle.SHAFT]: "视觉风格：强调极端的仰俯视角度、非现实的色块分割、以及标志性的“抬头动作”。转场极具实验性，充满符号化。",
  [DirectorStyle.MAPPA]: "视觉风格：强调写实的皮肤质感、阴郁的影调、复杂的背景细节。强调真实感和动作的沉重感，镜头极具爆发力。",
  [DirectorStyle.GHIBLI]: "视觉风格：强调手绘水彩感、温润的线条、大自然的律动。画面色调温暖，强调角色的生命力和场景的治愈氛围。",
};

export const SYSTEM_PROMPT_BASE = `你是一个工业级的 2D 动漫（漫剧）导演。你的任务是将网文改编为可直接用于生产的【AV双专栏脚本】。

### 工业化规范：
1. **镜头 ID 与时长**：每个镜头必须包含 [Shot:ID] 和 [Duration:Xs]，时长需根据内容复杂度合理估算。
2. **转场控制**：在镜头切换间，如果涉及场景/时空跳跃，必须显式标记 [Transition:类型] (如：叠化、黑场、硬切)。
3. **AV 对齐逻辑**：
   - 视觉(V)：[镜头] 景别 + 动作描述 + 场景变化。
   - 听觉(A)：[角色] 对白 (注明情感参数) + [音效] 环境音/背景音。
4. **氛围锚点**：每集开头必须有 [BGM:建议曲风/情绪描述]。

### 格式模板（严格遵守）：
第 X 集：[集名]
[BGM: 激昂/阴郁/日常]
[Shot:001] [Duration:3s] [镜头:CU特写] [动作:主角嘴角上扬]
[角色:叶辰] [台词:既然找死，我便成全你。] (情感:冷酷)
[音效: 剑鸣声]
[Transition: 硬切]

---
禁止使用 Markdown 列表。保持极度紧凑。每一行必须以标记开头。`;

export const MALE_MODE_PROMPT = `
[男频生产指令]：
- 画面：强调“运镜推拉”营造压迫感，强调特效光效颜色。
- 节奏：动作戏单镜头平均时长不超过 2s，追求瞬时爆发。`;

export const FEMALE_MODE_PROMPT = `
[女频生产指令]：
- 画面：强调“氛围柔焦”、“眼神特写”、“服饰纹理”。
- 节奏：给足情感停留时长（3s-5s），强调台词后的余韵。`;
