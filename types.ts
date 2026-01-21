// ========== 核心枚举类型（规范命名、补充新增选项）==========
export enum Category {
  PLOT = '剧情资料',
  CHARACTER = '人物设定',
  REFERENCE = '参考脚本',
  WORLD_BUILDING = '场景与规则',
}

export enum TropeType {
  FACE_SLAP = '打脸反杀',
  INVINCIBLE = '无敌碾压',
  REGRET = '追妻/前任火葬场',
  SYSTEM = '系统觉醒',
  HIDDEN_EXPERT = '扮猪吃虎',
  GENIUS = '天才回归',
  OVERCOME = '逆风翻盘', // 新增：匹配 TROPE_PROMPTS 扩展类型
}

export enum DirectorStyle {
  SHINKAI = '清新诚意 (新海诚感)',
  UFOTABLE = '绚烂特效 (飞碟社感)',
  SHAFT = '抽象转场 (新房昭之感)',
  MAPPA = '硬核写实 (MAPPA感)',
  GHIBLI = '治愈人文 (吉卜力感)',
  JUJUTSU = '咒术战斗 (咒术回战感)', // 新增：匹配 STYLE_PROMPTS 扩展类型
  DEMON_SLAYER = '细腻热血 (鬼灭之刃感)', // 新增：匹配 STYLE_PROMPTS 扩展类型
}

export enum ModelType {
  FLASH = 'flash', // 简化命名：匹配 MODEL_PROMPTS 逻辑（原 Gemini 名称改为通用标识）
  PRO = 'pro',
  ULTRA = 'ultra', // 新增：匹配 MODEL_PROMPTS 扩展类型（旗舰质量模型）
}

export enum AppStage {
  KB_MANAGEMENT = 'KB_MANAGEMENT',
  WORKSPACE = 'WORKSPACE',
}

export enum WorkspaceTab {
  SCRIPT = 'SCRIPT',
  OUTLINE = 'OUTLINE',
  VISUALS = 'VISUALS',
  SHOTS = 'SHOTS',
  MERGE = 'MERGE',
  CHARACTER = 'CHARACTER', // 新增：角色创作标签（适配角色小传功能）
}

export enum AudienceMode {
  MALE = '男频模式',
  FEMALE = '女频模式',
}

export enum AmbientAtmosphere {
  QUIET = '寂静室内',
  RAIN = '科幻细雨',
  BATTLE = '战场硝烟',
  MYSTIC = '神秘遗迹',
  CITY = '赛博街道',
  FOREST = '静谧森林', // 新增：自然场景氛围
  DESERT = '荒漠戈壁', // 新增：极端环境氛围
  SPACE = '宇宙空间', // 新增：科幻场景氛围
}

// ========== 核心接口类型（补充字段、增强完整性）==========
export interface KBFile {
  id: string;
  name: string;
  category: Category;
  content: string;
  uploadDate: string;
  fileSize?: number; // 新增：文件大小（字节）
  fileType?: string; // 新增：文件类型（如 text/plain、application/vnd.openxmlformats-officedocument.wordprocessingml.document）
  lastModified?: string; // 新增：最后修改时间
  isFavorite?: boolean; // 新增：是否收藏
}

export interface SceneImage {
  id: string;
  shotDescription: string;
  imageUrl: string;
  thumbnailUrl?: string; // 新增：缩略图 URL（优化加载性能）
  videoUrl?: string;
  videoOperationId?: string;
  duration: number; // 镜头时长（秒）
  isGeneratingVideo?: boolean;
  videoError?: string;
  shotNumber?: number; // 新增：镜头序号（分镜表排序用）
  cameraMovement?: string; // 新增：运镜方式（推/拉/摇/移/跟/定）
  visualFocus?: string; // 新增：视觉重点（如「主角面部特写」「全景场景」）
  aiPrompt?: string; // 新增：AI 绘图提示词（便于二次生成）
}

export interface ScriptBlock {
  id: string;
  sourceId: string; // 关联的 KBFile ID
  episodes: string; // 集数（如「1-3」「5」）
  content: string; // 剧本内容
  sceneImages?: SceneImage[]; // 关联的镜头画面
  directorNotes?: string; // 导演备注
  style?: DirectorStyle; // 导演风格
  trope?: TropeType; // 爽点类型
  continuityStatus?: 'DRAFT' | 'REVIEW' | 'FINALIZED'; // 优化：使用枚举值规范状态
  created_at?: string; // 创建时间
  updated_at?: string; // 新增：最后更新时间
  wordCount?: number; // 字数统计
  audienceMode?: AudienceMode; // 新增：受众模式
  modelType?: ModelType; // 新增：生成使用的模型
  ambientAtmosphere?: AmbientAtmosphere; // 新增：环境氛围
  isLocked?: boolean; // 新增：是否锁定（防止误编辑）
}

export interface CharacterAsset {
  id: string;
  name: string;
  description: string; // 基础描述
  image_url: string; // 角色形象图
  voice_id?: string; // 配音 ID
  is_playing_voice?: boolean; // 是否正在播放配音
  personality?: string; // 新增：性格特点
  background?: string; // 新增：背景故事
  abilities?: string[]; // 新增：能力/技能
  relationships?: string[]; // 新增：人物关系（如「与XX是挚友」「与XX是敌人」）
  characterTropes?: TropeType[]; // 新增：角色关联爽点类型
  designNotes?: string; // 新增：设计备注（如「服装以红色为主，突出热血感」）
}

// ========== 扩展接口类型（适配项目新增功能）==========
/** 故事大纲接口 */
export interface Outline {
  id: string;
  scriptBlockId: string; // 关联的剧本块 ID
  title: string; // 大纲标题
  content: string; // 大纲内容
  coreConflicts: string[]; // 核心冲突
  suspenseHooks: string[]; // 悬念钩子
  episodeDistribution: string; // 集数分配（如「第1集：铺垫，第2集：冲突爆发」）
  characterArcs?: string[]; // 人物弧光
  created_at: string;
  updated_at: string;
  modelType?: ModelType;
}

/** 分镜表接口 */
export interface ShotList {
  id: string;
  scriptBlockId: string; // 关联的剧本块 ID
  title: string; // 分镜表标题（如「第5集 战斗场景分镜」）
  shots: SceneImage[]; // 分镜列表
  totalDuration: number; // 总时长（秒）
  shotCount: number; // 镜头数量
  directorStyle?: DirectorStyle;
  created_at: string;
  updated_at: string;
  exportStatus?: 'READY' | 'EXPORTING' | 'FAILED'; // 导出状态
}

/** 本地存储的应用状态 */
export interface AppState {
  currentStage: AppStage; // 当前应用阶段
  activeWorkspaceTab: WorkspaceTab; // 当前激活的工作区标签
  selectedKbFileIds: string[]; // 选中的知识库文件 ID
  lastAccessedAt: string; // 最后访问时间
  themeMode: 'LIGHT' | 'DARK' | 'SYSTEM'; // 主题模式
  defaultModelType: ModelType; // 默认使用的模型
  defaultAudienceMode: AudienceMode; // 默认受众模式
  recentScriptBlocks: string[]; // 最近编辑的剧本块 ID
}
