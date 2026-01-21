
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

  async *generateTechnicalShotListStream(scriptContent: string, referenceContent: string = "") {
    const ai = this.getAI();
    const prompt = `
    任务：【动漫工业级分镜表转化】
    请将以下剧本内容转化为标准的动漫分镜表。
    
    输出要求：
    1. 每一行代表一个镜头。
    2. 严格遵循格式：[镜头号] | [景别/运动] | [画面描述] | [对白/声效]
    3. 景别必须包含：特写(CU)、中景(MS)、全景(WS)、俯冲(Tilt)、平移(Pan)等专业术语。
    ${referenceContent ? `4. 格式与术语参考模板（模仿其颗粒度和排版）：\n${referenceContent.substring(0, 2000)}` : "4. 确保镜头逻辑连贯，动作感强。"}
    
    剧本内容：
    ${scriptContent}
    `;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { 
        systemInstruction: "你是一位拥有 20 年经验的动漫分镜导演，擅长拆解镜头节奏。",
        temperature: 0.7 
      },
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *aiProofreadStream(content: string) {
    const ai = this.getAI();
    const promptText = `
    任务：【AI 专业剧本校对】
    请对以下动漫脚本进行深度校对。
    
    要求：
    1. 修正错别字、语法错误。
    2. 优化（镜头：...）视觉逻辑。
    3. 提升台词表演力。
    格式：问题列表 + 精修剧本。
    内容：${content}
    `;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: promptText }] }],
      config: { temperature: 0.7 },
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *generateFullOutlineStream(mode: AudienceMode, content: string, deep: boolean, referenceContent: string = "") {
    const ai = this.getAI();
    const prompt = `
    任务：改编动漫全辑大纲。
    风格：${mode === AudienceMode.MALE ? MALE_MODE_PROMPT : FEMALE_MODE_PROMPT}
    要求：每 3 集为一个剧情单元。
    ${referenceContent ? `格式参考（请模仿其详略和排版）：\n${referenceContent.substring(0, 1500)}` : ""}
    
    内容素材：${content.substring(0, 15000)}
    `;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *extractCharactersStream(content: string, referenceContent: string = "") {
    const ai = this.getAI();
    const prompt = `
    任务：提取核心角色简档。
    要求：包含性格、外貌、特殊能力。
    ${referenceContent ? `风格参考（请模仿其颗粒度）：\n${referenceContent.substring(0, 1500)}` : ""}
    
    内容素材：${content.substring(0, 10000)}
    `;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *extractReferenceScriptStream(content: string) {
    const ai = this.getAI();
    const prompt = `分析并提取以下剧本的“写作风格模板”，包含分镜描述习惯、台词节奏特征。输出一份可复用的格式指南。\n\n${content.substring(0, 8000)}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *generateCharacterBioStream(content: string, referenceContent: string = "") {
    const ai = this.getAI();
    const prompt = `
    任务：撰写 2D 动漫标准人物小传。
    要求：包含性格缺陷、高光时刻、视觉锚点。
    ${referenceContent ? `风格参考：\n${referenceContent.substring(0, 1500)}` : ""}
    
    素材：${content.substring(0, 8000)}
    `;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *reverseReasonCharacterSettings(brief: string) {
    const ai = this.getAI();
    const prompt = `根据以下碎片信息反向推理角色的深层动机、世界观背景和反差萌设计：\n\n${brief}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
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

    const response = await ai.models.generateContentStream({
      model: model,
      contents: [{ parts: [{ text: promptText }] }],
      config: { systemInstruction: SYSTEM_PROMPT_BASE, temperature: 0.8 },
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
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
