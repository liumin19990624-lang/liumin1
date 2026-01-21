
export enum Category {
  PLOT = '剧情资料',
  CHARACTER = '人物设定',
  REFERENCE = '参考脚本',
  WORLD_BUILDING = '场景与规则',
}

export interface KBFile {
  id: string;
  name: string;
  category: Category;
  content: string;
  uploadDate: string;
}

export interface SceneImage {
  id: string;
  shotDescription: string;
  imageUrl: string;
  videoUrl?: string; 
  videoOperationId?: string;
  duration: number; // 镜头时长（秒）
  isGeneratingVideo?: boolean;
  videoError?: string;
}

export enum TropeType {
  FACE_SLAP = '打脸反杀',
  INVINCIBLE = '无敌碾压',
  REGRET = '追妻/前任火葬场',
  SYSTEM = '系统觉醒',
  HIDDEN_EXPERT = '扮猪吃虎',
  GENIUS = '天才回归',
}

export interface ScriptBlock {
  id: string;
  sourceId: string;
  episodes: string;
  content: string;
  sceneImages?: SceneImage[];
  directorNotes?: string;
  style?: DirectorStyle;
  trope?: TropeType;
  continuityStatus?: string; 
  created_at?: string;
  wordCount?: number;
}

export enum DirectorStyle {
  SHINKAI = '清新诚意 (新海诚感)',
  UFOTABLE = '绚烂特效 (飞碟社感)',
  SHAFT = '抽象转场 (新房昭之感)',
  MAPPA = '硬核写实 (MAPPA感)',
  GHIBLI = '治愈人文 (吉卜力感)',
}

export enum ModelType {
  FLASH = 'gemini-3-flash-preview',
  PRO = 'gemini-3-pro-preview'
}

export interface CharacterAsset {
  id: string;
  name: string;
  description: string;
  image_url: string;
  voice_id?: string;
  is_playing_voice?: boolean;
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
  CITY = '赛博街道'
}
