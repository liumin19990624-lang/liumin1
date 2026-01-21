
import { GoogleGenAI, Modality } from "@google/genai";
import { SYSTEM_PROMPT_BASE, MALE_MODE_PROMPT, FEMALE_MODE_PROMPT, STYLE_PROMPTS } from "../constants.tsx";
import { AudienceMode, ScriptBlock, ModelType, DirectorStyle } from "../types.ts";

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  static cleanText(text: string | undefined): string {
    if (!text) return "";
    return text
      .replace(/[#\*`\-_~>]/g, '')
      .replace(/\[Shot:/gi, '（镜头：')
      .replace(/\[.*?\]/g, '')
      .replace(/\{.*?\}/g, '')
      .replace(/[a-zA-Z]{5,}/g, '') 
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * AI 脚本校对：检查错别字、逻辑与台词节奏
   */
  async *aiProofreadStream(content: string) {
    const ai = this.getAI();
    const promptText = `
    任务：【AI 专业剧本校对】
    请对以下动漫脚本进行深度校对。
    
    要求：
    1. 发现并修正错别字、语法错误和不通顺的台词。
    2. 检查（镜头：...）描述是否生动，是否符合 2D 动漫视觉逻辑。
    3. 优化台词节奏，使其更具表演力。
    4. 输出格式：
       - 问题列表：简要列出发现的具体问题。
       - 精修剧本：输出优化后的完整剧本，保持原有的格式。
    
    脚本内容：
    ${content}
    `;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: promptText }] }],
      config: { 
        systemInstruction: "你是一个极其严苛的动漫金牌审稿人。请用中文回答，保持专业、犀利且富有建设性。",
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 }
      },
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *generateFullOutlineStream(mode: AudienceMode, content: string, deep: boolean) {
    const ai = this.getAI();
    const prompt = `
    任务：将以下小说内容改编为动漫全辑大纲。
    要求：
    1. 风格：${mode === AudienceMode.MALE ? MALE_MODE_PROMPT : FEMALE_MODE_PROMPT}
    2. 深度：${deep ? '深度解析每一章的冲突与爽点' : '简洁概述主线'}
    3. 输出：每 3 集为一个剧情单元，列出核心冲突和视觉高光。
    内容：${content.substring(0, 15000)}
    `;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { 
        systemInstruction: "你是一个资深动漫策划，擅长将长篇网文精准切片为剧本大纲。",
        thinkingConfig: { thinkingBudget: 0 }
      },
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *extractCharactersStream(content: string) {
    const ai = this.getAI();
    const prompt = `从以下文本中提取所有核心角色及其性格特征、外貌描述、特殊能力：\n\n${content.substring(0, 10000)}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *extractReferenceScriptStream(content: string) {
    const ai = this.getAI();
    const prompt = `分析以下剧本片段的写作风格、分镜描述习惯、台词节奏，并提炼成一份可供后续改编参考的“风格模板”说明。要求保留其标志性的格式特征。\n\n${content.substring(0, 8000)}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *generateCharacterBioStream(content: string) {
    const ai = this.getAI();
    const prompt = `基于以下设定，扩写并精修为一份【2D动漫标准人物小传】。包含性格缺陷、高光时刻和视觉锚点。\n\n内容：${content.substring(0, 8000)}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *reverseReasonCharacterSettings(brief: string) {
    const ai = this.getAI();
    const prompt = `根据用户提供的碎片信息（视觉、性格或对白），反向推理并构建该角色的深层世界观背景、动机和反差萌设计：\n\n${brief}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { thinkingConfig: { thinkingBudget: 0 } }
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *generateScriptBlockStream(
    mode: AudienceMode,
    sourceContent: string,
    previousBlocks: ScriptBlock[],
    blockIndex: number, 
    model: ModelType = ModelType.FLASH,
    style: DirectorStyle = DirectorStyle.UFOTABLE,
    referenceContent: string = "",
    outlineContent: string = ""
  ) {
    const ai = this.getAI();
    const startEp = (blockIndex - 1) * 3 + 1;
    const endEp = blockIndex * 3;
    const offset = Math.max(0, (blockIndex - 1) * 8000); 
    const truncatedSource = sourceContent.substring(offset, offset + 12000);

    const promptText = `
    单元：第 ${startEp}-${endEp} 集
    调性：${mode === AudienceMode.MALE ? MALE_MODE_PROMPT : FEMALE_MODE_PROMPT} 
    视觉风格：${STYLE_PROMPTS[style]}
    ${referenceContent ? `风格参考模板：${referenceContent.substring(0, 2000)}` : ""}
    ${outlineContent ? `剧情大纲参考：${outlineContent.substring(0, 2000)}` : ""}
    上下文记忆：${previousBlocks.length > 0 ? previousBlocks[previousBlocks.length - 1].content.slice(-800) : '起始章节'}
    
    原著素材：
    ${truncatedSource}
    `;

    try {
      const response = await ai.models.generateContentStream({
        model: model,
        contents: [{ parts: [{ text: promptText }] }],
        config: { 
          systemInstruction: SYSTEM_PROMPT_BASE, 
          temperature: 0.8,
          thinkingConfig: { thinkingBudget: 0 }
        },
      });
      for await (const chunk of response) {
        if (chunk.text) yield chunk.text;
      }
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async generateCharacterImage(description: string, mode: AudienceMode): Promise<string> {
    const ai = this.getAI();
    const prompt = `Anime character sheet, ${description}, crisp lineart, studio quality, ${mode === AudienceMode.MALE ? 'shonen' : 'shoujo'}`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: { imageConfig: { aspectRatio: "1:1" } },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return "";
  }

  async generateShotImage(description: string, mode: AudienceMode, aspectRatio: string = "16:9", style: DirectorStyle = DirectorStyle.UFOTABLE): Promise<string> {
    const ai = this.getAI();
    const prompt = `Anime cinematic shot, ${description}, ${STYLE_PROMPTS[style]}, high quality, ${mode === AudienceMode.MALE ? 'shonen' : 'shoujo'}`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: { imageConfig: { aspectRatio: aspectRatio as any } },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return "";
  }
}
