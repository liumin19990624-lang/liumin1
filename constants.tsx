import React from 'react';
import { 
  FileText, Users, Settings, Library, ChevronRight, ChevronLeft, Upload, Play, RefreshCcw, Download,
  Trash2, FolderOpen, ArrowLeft, Zap, Heart, MessageSquare, Wand2, Image as ImageIcon, Sparkles, Volume2, PlusCircle,
  Sword, Shield, Star, ZapOff, Flame, ListOrdered, Clock, Combine, FileDown, Layers, Check, AlertCircle,
  LayoutGrid, BookOpen, User, Brain, Film, Camera, PenTool, Save, ExternalLink, X, Maximize2, Minimize2
} from 'lucide-react';
import { DirectorStyle, TropeType, ModelType, AudienceMode } from './types';

// ========== 统一图标配置（规范尺寸、支持自定义颜色）==========
/**
 * 图标组件类型定义（支持尺寸和颜色自定义）
 */
type IconProps = {
  className?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg' | number;
};

// 基础图标组件（统一尺寸逻辑）
const createIcon = (IconComponent: React.ElementType) => ({ 
  className = '', 
  color = 'currentColor', 
  size = 'md' 
}: IconProps = {}) => {
  const sizeMap = { sm: 4, md: 5, lg: 6 };
  const iconSize = typeof size === 'number' ? size : sizeMap[size];
  return React.createElement(IconComponent, {
    className: `w-${iconSize} h-${iconSize} ${className}`,
    color,
  });
};

// 导出可复用图标（支持自定义配置）
export const ICONS = {
  // 基础图标（默认 md 尺寸）
  FileText: createIcon(FileText),
  Users: createIcon(Users),
  Settings: createIcon(Settings),
  Library: createIcon(Library),
  ChevronRight: createIcon(ChevronRight),
  ChevronLeft: createIcon(ChevronLeft),
  Upload: createIcon(Upload),
  Play: createIcon(Play),
  Refresh: createIcon(RefreshCcw),
  Download: createIcon(Download),
  Trash: createIcon(Trash2),
  Folder: createIcon(FolderOpen),
  ArrowLeft: createIcon(ArrowLeft),
  Image: createIcon(ImageIcon),
  Merge: createIcon(Combine),
  FileDown: createIcon(FileDown),
  Layers: createIcon(Layers),
  LayoutGrid: createIcon(LayoutGrid),
  BookOpen: createIcon(BookOpen),
  User: createIcon(User),
  Brain: createIcon(Brain),
  Film: createIcon(Film),
  Camera: createIcon(Camera),
  PenTool: createIcon(PenTool),
  Save: createIcon(Save),
  ExternalLink: createIcon(ExternalLink),
  Close: createIcon(X),
  Maximize: createIcon(Maximize2),
  Minimize: createIcon(Minimize2),
  
  // 小尺寸图标（默认 sm 尺寸）
  Zap: createIcon(Zap)({ size: 'sm' }),
  Heart: createIcon(Heart)({ size: 'sm' }),
  Refine: createIcon(Wand2)({ size: 'sm' }),
  Chat: createIcon(MessageSquare)({ size: 'sm' }),
  Sparkles: createIcon(Sparkles)({ size: 'sm' }),
  Volume: createIcon(Volume2)({ size: 'sm' }),
  Plus: createIcon(PlusCircle)({ size: 'sm' }),
  Sword: createIcon(Sword)({ size: 'sm' }),
  Shield: createIcon(Shield)({ size: 'sm' }),
  Star: createIcon(Star)({ size: 'sm' }),
  Trope: createIcon(Flame)({ size: 'sm' }),
  List: createIcon(ListOrdered)({ size: 'sm' }),
  Clock: createIcon(Clock)({ size: 'sm' }),
  Check: createIcon(Check)({ size: 'sm' }),
  Error: createIcon(AlertCircle)({ size: 'sm' }),
};

// ========== 导演风格配置（扩展描述、补充视觉关键词）==========
export const STYLE_PROMPTS: Record<DirectorStyle, string> = {
  [DirectorStyle.SHINKAI]: "新海诚清新光影风格 - 核心视觉：通透云层、丁达尔效应、细腻背景细节、柔和渐变色调、城市与自然的融合；镜头语言：慢推镜头、全景空镜、特写光影变化；情感基调：治愈、细腻、略带忧伤。",
  [DirectorStyle.UFOTABLE]: "飞碟社（Ufotable）绚丽特效风格 - 核心视觉：饱满粒子效果、强烈光污染质感、金属反光细节、高速动态模糊；镜头语言：快速切换、跟拍镜头、特写战斗细节；情感基调：热血、激昂、史诗感。",
  [DirectorStyle.SHAFT]: "新房昭之意识流风格 - 核心视觉：极端倾斜构图、高饱和色块对比、几何图形元素、PPT式静止帧；镜头语言：不规则运镜、夸张特写、符号化画面；情感基调：神秘、荒诞、充满隐喻。",
  [DirectorStyle.MAPPA]: "MAPPA写实硬核风格 - 核心视觉：清晰肌肉线条、厚重阴影、粗糙质感、写实人体比例；镜头语言：手持镜头、低角度构图、暴力剪辑；情感基调：黑暗、压抑、原始力量感。",
  [DirectorStyle.GHIBLI]: "吉卜力（Ghibli）治愈手绘风格 - 核心视觉：水彩质感、柔和自然光线、细腻笔触、自然场景写实；镜头语言：平稳运镜、全景自然风光、生活化细节特写；情感基调：温暖、治愈、充满希望。",
  [DirectorStyle.JUJUTSU]: "咒术回战战斗风格 - 核心视觉：黑色咒力特效、简洁线条、高对比度光影、战斗烟尘细节；镜头语言：高速平移、旋转镜头、战斗瞬间定格；情感基调：紧张、燃系、战术感。",
  [DirectorStyle.DEMON_SLAYER]: "鬼灭之刃细腻风格 - 核心视觉：呼吸法彩色特效、细腻服饰纹理、自然场景写实、角色微表情丰富；镜头语言：跟随式运镜、慢动作特写、群像构图；情感基调：热血、温情、悲壮。",
};

// ========== 爽点类型配置（细化镜头要求、增强画面感）==========
export const TROPE_PROMPTS: Record<TropeType, string> = {
  [TropeType.FACE_SLAP]: "【打脸反杀】- 爽点核心：前期隐忍铺垫，后期强势反击；镜头要求：对比镜头（前期卑微vs后期霸气）、慢动作特写打脸瞬间、旁观者震惊表情、反派狼狈姿态；情感递进：压抑→爆发→解气。",
  [TropeType.INVINCIBLE]: "【无敌碾压】- 爽点核心：绝对力量差距，无需悬念的胜利；镜头要求：低角度仰拍主角、俯视镜头展现反派渺小、力量冲击特效（冲击波、烟尘）、快节奏战斗剪辑；情感递进：霸气→震撼→爽快。",
  [TropeType.REGRET]: "【追妻火葬场】- 爽点核心：情感拉扯，反派后悔追悔；镜头要求：慢镜头展现主角决绝背影、特写反派痛苦表情、回忆杀穿插、雨/雪等氛围烘托；情感递进：虐心→心疼→释然。",
  [TropeType.SYSTEM]: "【系统流】- 爽点核心：数字化成长，即时反馈；镜头要求：UI界面悬浮特效、数据跳动动画、技能释放特效、等级提升光效；情感递进：期待→惊喜→成就感。",
  [TropeType.HIDDEN_EXPERT]: "【扮猪吃虎】- 爽点核心：平凡外表下的惊人实力；镜头要求：前期低调镜头（俯拍、远景）、后期爆发镜头（仰拍、特写）、反差感运镜（慢→快）、旁观者震惊反应；情感递进：平淡→惊讶→崇拜。",
  [TropeType.GENIUS]: "【王者归来】- 爽点核心：曾经的巅峰回归，重拾荣耀；镜头要求：神圣光效环绕、慢推特写主角眼神、群像仰视构图、回忆杀与现实交织；情感递进：期待→激昂→热血。",
  [TropeType.OVERCOME]: "【逆风翻盘】- 爽点核心：绝境中突破，反败为胜；镜头要求：低光环境烘托绝境、特写主角汗水/血迹、爆发时光线突变、快节奏战斗剪辑；情感递进：绝望→挣扎→狂喜。",
};

// ========== 模型配置（新增：匹配 DMXAPI 支持的模型）==========
export const MODEL_PROMPTS: Record<ModelType, string> = {
  [ModelType.FLASH]: "轻量快速模型 - 优先保证生成速度，适合快速预览、大纲生成、角色提取等轻量任务；输出特点：简洁明了，重点突出，耗时短（单任务10-20秒）。",
  [ModelType.PRO]: "平衡性能模型 - 兼顾速度与质量，适合剧本生成、分镜设计等核心任务；输出特点：细节丰富，逻辑连贯，性价比高（单任务20-40秒）。",
  [ModelType.ULTRA]: "旗舰质量模型 - 极致质量优先，适合深度改编、角色小传、精品分镜等高质量需求；输出特点：细节极致，情感饱满，镜头语言专业（单任务40-60秒）。",
};

// ========== 受众模式配置（新增：适配男女频不同风格）==========
export const AUDIENCE_PROMPTS: Record<AudienceMode, string> = {
  [AudienceMode.MALE]: "男频向内容 - 核心偏好：热血战斗、权谋博弈、实力成长、兄弟情义、逆袭爽感；风格要求：节奏明快，冲突直接，爽点密集，战斗场面宏大，主角目标明确。",
  [AudienceMode.FEMALE]: "女频向内容 - 核心偏好：情感拉扯、细腻互动、角色魅力、唯美场景、宿命感；风格要求：情感饱满，细节细腻，氛围营造到位，人物关系复杂，台词精炼有张力。",
};

// ========== 系统提示词（优化逻辑、补充工业级要求）==========
export const SYSTEM_PROMPT_BASE = `你是一位精通漫剧工业化生产的顶级导演，拥有丰富的长篇连载漫剧制作经验。
本次任务目标：制作符合长篇连载（60-100集）要求的精品漫剧全案，单集时长120-180秒，总时长需达到120分钟以上，确保每集有独立看点且剧情连贯。

【改编核心准则 - 极致细节，工业标准】
1. **内容篇幅控制**：
   - 单集剧本：1000-1800字（含场景、镜头、对白、动作），避免冗余重复，用细节扩充内容
   - 分镜表：每集50-60个镜头，单镜头时长2-5秒，总时长≥120秒，确保节奏紧凑
   - 大纲：每集包含2个核心冲突+1个强悬念钩子，钩子需具备足够吸引力，引导观众追更

2. **工业级质量要求**：
   - 大纲：逻辑闭环，人物弧光清晰，每集节奏严格遵循：铺垫（30%）→ 冲突（40%）→ 高潮（20%）→ 钩子（10%）
   - 剧本：镜头语言专业，动作描写具象化（可直接转化为画面），对白精炼且符合角色人设，无OOC行为
   - 分镜：包含明确的运镜方式（推/拉/摇/移/跟/定）、时长控制、视觉重点、构图方式，可直接用于动画制作团队落地

3. **风格统一性要求**：
   - 严格遵循指定导演风格的视觉特点、镜头语言和情感基调，全程保持一致
   - 深度融合指定爽点类型的镜头要求和情感递进节奏，精准命中目标受众偏好
   - 角色言行、场景设计、特效风格需符合对应受众模式的核心偏好，不偏离定位

4. **纯净输出规范**：
   - 禁止任何Markdown符号（# * - > _ ~ ` [] {} () 等）、英文标签、英文提示词、特殊转义符
   - 统一使用中文全角符号，排版整洁，通过换行区分场景、镜头、对白、动作等不同模块
   - 输出内容仅保留漫剧制作相关信息，无任何多余说明、解释或提示性文字`;

// ========== 常用常量（新增：统一复用的值）==========
export const APP_CONSTANTS = {
  // 存储键名
  LOCAL_STORAGE_KEY: 'anime_engine_files_v3',
  // 版本信息
  VERSION: 'v3.8',
  // 最大文件大小（5MB）
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  // 支持的文件类型
  SUPPORTED_FILE_TYPES: ['text/plain', '.txt', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  // 生成内容长度限制
  CONTENT_LIMITS: {
    SCRIPT: 4000, // 单集剧本最大字数
    OUTLINE: 3000, // 大纲最大字数
    CHARACTER: 3000, // 角色设定最大字数
    SHOT_LIST: 6000, // 分镜表最大长度
  },
};
