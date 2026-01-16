
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
}

export interface ScriptBlock {
  id: string;
  sourceId: string;
  episodes: string;
  content: string;
  sceneImages?: SceneImage[];
  directorNotes?: string;
  loreContextIds?: string[]; // 锁定的知识库ID
  isBatchProcessing?: boolean; // 批处理状态标记
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
}

export enum AppStage {
  KB_MANAGEMENT = 'KB_MANAGEMENT',
  WORKSPACE = 'WORKSPACE',
}

export enum WorkspaceTab {
  SCRIPT = 'SCRIPT',
  OUTLINE = 'OUTLINE',
  VISUALS = 'VISUALS',
}

export enum AudienceMode {
  MALE = '男频模式',
  FEMALE = '女频模式',
}
