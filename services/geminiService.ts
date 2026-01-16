
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT_BASE } from "../constants";
import { AudienceMode, ScriptBlock } from "../types";

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateScriptBlock(
    mode: AudienceMode,
    sourceContent: string,
    referenceContent: string,
    previousBlocks: ScriptBlock[],
    targetEpisodes: string
  ) {
    const ai = this.getAI();
    const history = previousBlocks.length > 0 
      ? `前序剧集背景（必须遵守因果律）：\n${previousBlocks.map(b => `第${b.episodes}集内容：\n${b.content.substring(0, 500)}...`).join('\n\n')}`
      : '本季首播。';
    
    const prompt = `
    当前模式：${mode}
    目标改编：第 ${targetEpisodes} 集

    ### 强制要求：
    1. 严禁使用 #, *, >, - 等 Markdown 符号装饰。
    2. 请直接按以下格式输出内容：
       
       第X集：[标题]
       本集钩子：1.xxx 2.xxx
       
       场景：[时间/地点]
       动作：[描述]
       角色名：台词内容
       
       （循环此结构）

    3. 冲突/悬念：每集必须包含 2-3 个明确钩子。
    4. 物理锚定：严格遵守因果逻辑。
    
    参考风格：
    ${referenceContent ? referenceContent.substring(0, 1000) : '2025年动漫节奏'}
    
    原著小说：
    ${sourceContent}
    
    ${history}

    请输出第 ${targetEpisodes} 集的纯净版剧本。
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT_BASE,
          temperature: 0.8,
          thinkingConfig: { thinkingBudget: 2500 }
        },
      });

      return response.text || "AI 返回了空内容。";
    } catch (err) {
      console.error("Gemini Service Error:", err);
      throw err;
    }
  }

  async generateFullOutline(mode: AudienceMode, sourceContent: string, referenceContent: string = '') {
    const ai = this.getAI();
    const prompt = `
    ### 任务：生成 2000-3000 字全集剧情深度总结
    
    要求：
    1. 严禁使用特殊装饰符号，保持排版极致纯净。
    2. 内容分段清晰：核心故事核、世界观锚定、前瞻期、爆发期、巅峰收官。
    3. 每段必须详实有力，字数在 2000-3000 字之间。
    
    参考风格：
    ${referenceContent ? referenceContent.substring(0, 2000) : '2025年漫剧节奏'}
    
    原著小说：
    ${sourceContent}
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT_BASE,
          temperature: 0.75,
          thinkingConfig: { thinkingBudget: 5000 }
        },
      });

      return response.text || "生成大纲失败。";
    } catch (err) {
      console.error("Gemini Outline Error:", err);
      throw err;
    }
  }

  async extractCharacters(scriptContent: string) {
    const ai = this.getAI();
    const prompt = `
    ### 任务：全集人物检索与统计（纯净版）
    
    要求：
    1. 严禁使用 Markdown 符号装饰。
    2. 字段：姓名、性别、年龄、身份、性格、形象、关系、出现集数。
    
    检索源：
    ${scriptContent}
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: "专业剧本分析师。直接输出文字内容，不要带 Markdown 语法标记。",
          temperature: 0.1,
          thinkingConfig: { thinkingBudget: 2000 }
        },
      });

      return response.text || "未能提取到人物信息。";
    } catch (err) {
      console.error("Gemini Extraction Error:", err);
      throw err;
    }
  }
}
