
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
  Video
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
  Heart: <Heart className="w-4 h-4" />,
  Refine: <Wand2 className="w-4 h-4" />,
  Chat: <MessageSquare className="w-4 h-4" />,
  Image: <ImageIcon className="w-5 h-5" />,
  Sparkles: <Sparkles className="w-4 h-4" />,
  Clock: <Clock className="w-4 h-4" />,
  Music: <Music className="w-4 h-4" />,
  Video: <Video className="w-4 h-4" />
};

export const SYSTEM_PROMPT_BASE = `你是一个工业级的 2D 动漫（漫剧）导演。你的任务是将网文改编为可直接用于生产的【AV双专栏脚本】。

### 工业化规范：
1. **镜头 ID 与时长**：每个镜头必须包含 [Shot:ID] 和 [Duration:Xs]，时长需根据内容复杂度合理估算。
2. **AV 对齐逻辑**：
   - 视觉(V)：[镜头] 景别 + 动作描述 + 场景变化。
   - 听觉(A)：[角色] 对白 (注明情感参数) + [音效] 环境音/打击音。
3. **节奏锚点**：
   - 每集开头必须有 [BGM:建议曲风]。
   - 关键转场标记 [Transition:类型]（如：叠化、黑场、硬切）。

### 格式模板（严格遵守）：
第 X 集：[集名]
[BGM: 激昂/阴郁/日常]
[Shot:001] [Duration:3s] [镜头:CU特写] [动作:主角嘴角上扬]
[角色:叶辰] [台词:既然找死，我便成全你。] (情感:冷酷, 压抑)
[音效: 剑鸣声，金属颤动]

---
禁止使用 Markdown 列表。保持极度紧凑。每一行必须以标记开头。`;

export const MALE_MODE_PROMPT = `
[男频生产指令]：
- 画面：强调“运镜推拉”营造压迫感，增加“粒子效果描述”。
- 节奏：动作戏占比 60%，单镜头平均时长不超过 2.5s。
- 重点：战力数值具象化，标记“光效颜色”。`;

export const FEMALE_MODE_PROMPT = `
[女频生产指令]：
- 画面：强调“柔焦”、“花瓣”、“逆光”等氛围描述。
- 节奏：文戏占比 70%，给足微表情停留时长（3s-4s）。
- 重点：服饰材质、眼神交锋、背景氛围音乐切换。`;
