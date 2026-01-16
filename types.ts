
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

export interface ScriptBlock {
  episodes: string; // e.g. "1-3"
  content: string;
}

export interface CharacterInfo {
  name: string;
  gender: string;
  age: string;
  relation: string;
  personality: string;
  image: string;
  chapters: string;
}

export enum AppStage {
  KB_MANAGEMENT = 'KB_MANAGEMENT',
  WORKSPACE = 'WORKSPACE',
}

export enum WorkspaceTab {
  SCRIPT = 'SCRIPT',
  OUTLINE = 'OUTLINE',
}

export enum AudienceMode {
  MALE = '男频模式',
  FEMALE = '女频模式',
}
