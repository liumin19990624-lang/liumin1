
import React from 'react';
import { 
  FileText, Users, Settings, Library, ChevronRight, ChevronLeft, Upload, Play, RefreshCcw, Download,
  Trash2, FolderOpen, ArrowLeft, Zap, Heart, MessageSquare, Wand2, Image as ImageIcon, Sparkles, Volume2, PlusCircle,
  Sword, Shield, Star, ZapOff, Flame, ListOrdered, Clock, Combine, FileDown, Layers, Check, Camera, Eye, Layout, Sliders,
  Brain, Target, Compass, Rocket, Info, ChevronUp, ChevronDown, Key
} from 'lucide-react';
import { DirectorStyle, TropeType, ModelType, AudienceMode } from './types';

export const ICONS = {
  FileText: <FileText className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />,
  Settings: <Settings className="w-5 h-5" />,
  Library: <Library className="w-5 h-5" />,
  ChevronRight: <ChevronRight className="w-5 h-5" />,
  ChevronLeft: <ChevronLeft className="w-5 h-5" />,
  ChevronUp: <ChevronUp className="w-4 h-4" />,
  ChevronDown: <ChevronDown className="w-4 h-4" />,
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
  Layers: <Layers className="w-5 h-5" />,
  Check: <Check className="w-4 h-4" />,
  Camera: <Camera className="w-4 h-4" />,
  Eye: <Eye className="w-4 h-4" />,
  Layout: <Layout className="w-4 h-4" />,
  Sliders: <Sliders className="w-4 h-4" />,
  Brain: <Brain className="w-5 h-5" />,
  Target: <Target className="w-4 h-4" />,
  Compass: <Compass className="w-4 h-4" />,
  Rocket: <Rocket className="w-4 h-4" />,
  Info: <Info className="w-4 h-4" />,
  Key: <Key className="w-4 h-4" />
};

export const CHARACTER_TAGS = [
  "银发蓝瞳", "战损披风", "赛博朋克义眼", "古风汉服", "现代校服", 
  "机械铠甲", "精灵尖耳", "深红色长袍", "黑色皮衣", "白色连衣裙",
  "持剑姿态", "释放魔法", "冷酷眼神", "温柔微笑", "高傲神情"
];

export const CINEMATIC_MANUAL = `
【二次元AI绘画镜头语言全量结构化手册】
1. 动态强度：大动态（快速运动/超大动效）、中动态（一般动效）、小动态（微动细节）、超静态。
2. 镜头运动：
   - 横向：左移、右移、横摇镜头。
   - 垂直：升、降、竖摇镜头。
   - 缩放：推、拉、暴力推镜。
   - 固定：固定镜头。
   - 复杂：跟镜头、环绕镜头、甩镜头、旋转镜头。
   - 特殊：延时、手持镜头（模拟抖动）、慢镜头、快切、变速。
3. 视角：第一人称（POV）、航拍、微距、越肩、荷兰角、2D动漫风格、鱼眼、广角、镜像、分屏、全景视角。
4. 景别：远景、全景、中景、近景、特写、大特写、局部特写。
5. 构图与角度：
   - 构图：三分构图、对称构图、对角线构图、框架构图、螺旋构图。
   - 角度：低角度（仰拍）、高角度（俯拍）、平视镜头、鸟瞰镜头、虫眼视角、顶视镜头、斜侧角度。
6. 光学效果：丁达尔效应、散景效果、逆光、侧逆光、柔光、硬光、粒子特效。
`;

export const STYLE_PROMPTS: Record<DirectorStyle, string> = {
  [DirectorStyle.SHINKAI]: "新海诚清新光影风格 - 核心视觉：丁达尔效应、细腻背景细节、柔和渐变色调；镜头要求：全景空镜、缓慢推镜头。",
  [DirectorStyle.UFOTABLE]: "飞碟社绚丽特效风格 - 核心视觉：大动态、粒子效果、金属反光；镜头要求：快速切换、跟拍镜头、高速动态模糊。",
  [DirectorStyle.SHAFT]: "新房昭之意识流风格 - 核心视觉：极端倾斜构图、荷兰角、高饱和色块；镜头要求：不规则运镜、PPT式静止帧。",
  [DirectorStyle.MAPPA]: "MAPPA写实硬核风格 - 核心视觉：写实人体比例、厚重阴影；镜头要求：手持镜头抖动、低角度构图、暴力剪辑。",
  [DirectorStyle.GHIBLI]: "吉卜力治愈手绘风格 - 核心视觉：水彩质感、自然场景写实；镜头要求：平视镜头、全景自然风光。",
  [DirectorStyle.JUJUTSU]: "咒术回战战斗风格 - 核心视觉：大动态、黑色咒力特效；镜头要求：高速平移、旋转镜头、战斗瞬间定格。",
  [DirectorStyle.DEMON_SLAYER]: "鬼灭之刃细腻风格 - 核心视觉：呼吸法彩色特效、细腻服饰纹理；镜头要求：跟随式运镜、慢动作特写。",
};

export const TROPE_PROMPTS: Record<TropeType, string> = {
  [TropeType.FACE_SLAP]: "【打脸反杀】- 爽点核心：前期隐忍后期爆发；镜头：特写打脸瞬间、荷兰角增强冲突感、慢动作捕捉反派震惊。",
  [TropeType.INVINCIBLE]: "【无敌碾压】- 爽点核心：绝对力量差距；镜头：低角度仰拍主角、鸟瞰镜头展现战场狼藉、大动态冲击波。",
  [TropeType.REGRET]: "【追妻火葬场】- 爽点核心：情感拉扯；镜头：特写痛苦表情、越肩对话、丁达尔效应烘托凄美感。",
  [TropeType.SYSTEM]: "【系统流】- 爽点核心：数字化成长；镜头：UI界面悬浮特效、微距特写数据跳动。",
  [TropeType.HIDDEN_EXPERT]: "【扮猪吃虎】- 爽点核心：身份反差；镜头：前期平视低调、后期大仰角霸气、对角线构图增加张力。",
  [TropeType.GENIUS]: "【王者归来】- 爽点核心：重拾荣耀；镜头：神圣光效、环绕镜头展现全方位霸气。",
  [TropeType.OVERCOME]: "【逆风翻盘】- 爽点核心：绝境突破；镜头：低光环境、大动态快切、爆发时光线突变。",
};

export const AUDIENCE_PROMPTS: Record<AudienceMode, string> = {
  [AudienceMode.MALE]: "男频爽文模式：强调节奏感、反转、力量感及热血冲突。多用大动态、低角度、跟镜头。",
  [AudienceMode.FEMALE]: "女频爽文模式：强调情感细腻度、氛围感及唯美对白。多用近景特写、柔光、丁达尔效应。",
  [AudienceMode.ALL]: "全受众通用模式：平衡动作节奏与情感深度，适配广泛受众审美。",
};

export const SYSTEM_PROMPT_BASE = `你是一位精通漫剧工业化生产的顶级导演。
本次任务目标：将网文小说改编为符合2D动漫节奏的工业化剧本。

${CINEMATIC_MANUAL}

【改编核心准则 - 爽文适配】
1. **爽点提取**：精准定位原著中的冲突点，放大主角的情感爆发和实力反转。
2. **镜头化语言**：禁止文学化描写，必须转化为[Shot: Description]格式，且必须包含动态强度、镜头运动、景别、视角等专业术语。
3. **节奏控制**：每集必须包含 1个核心冲突，2个小高潮，末尾预留“钩子”。
4. **输出规范**：严禁Markdown符号，仅保留场景标识、镜头技术参数和对白。
5. **台词风格**：台词需精炼且具有角色辨识度，避免书面语。`;

export const AGENT_ANALYSIS_PROMPT = `你是一位“漫剧改编智能代理”。
你的任务是深度阅读用户提供的网文原著，并输出一份“工业化动漫改编全案”。

请按以下格式输出（严禁使用Markdown符号，使用中文）：
【视觉愿景】：描述动漫的整体美术风格、色调倾向（如：赛博霓虹、水墨武侠、清新治愈）。
【推荐风格】：从以下选项中选一：${Object.values(DirectorStyle).join(', ')}。
【爽点矩阵】：提取原著中的 3-5 个核心爽点标签。
【叙事节奏】：描述每集的平均冲突密度。
【人物画像简述】：核心角色的视觉记忆点提取。`;
