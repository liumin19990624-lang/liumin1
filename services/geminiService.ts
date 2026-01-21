
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { SYSTEM_PROMPT_BASE, STYLE_PROMPTS, TROPE_PROMPTS } from "../constants.tsx";
import { AudienceMode, ScriptBlock, ModelType, DirectorStyle, TropeType } from "../types.ts";

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  static cleanText(text: string | undefined): string {
    if (!text) return "";
    return text
      .replace(/[#\*`\-_~>]/g, '') // 移除 Markdown 符号
      .replace(/\[/g, '（').replace(/\]/g, '）') // 替换方括号为中文括号
      .replace(/Shot:|镜头:/gi, '镜头：')
      .replace(/Visual:|画面:/gi, '画面：')
      .replace(/Audio:|音频:/gi, '音频：')
      .replace(/Duration:|时长:/gi, '时长：')
      .replace(/Scene:|场景:/gi, '场景：')
      .replace(/[a-zA-Z]+:/g, (match) => match.includes('http') ? match : '') // 移除大部分英文标签，保留URL
      .trim();
  }

  async *generateScriptBlockStream(
    mode: AudienceMode,
    sourceContent: string,
    previousBlocks: ScriptBlock[],
    blockIndex: number, 
    model: ModelType = ModelType.FLASH,
    style: DirectorStyle = DirectorStyle.UFOTABLE,
    trope?: TropeType,
    referenceContent: string = ""
  ) {
    const ai = this.getAI();
    const offset = Math.max(0, (blockIndex - 1) * 3000); 
    const truncatedSource = sourceContent.substring(offset, offset + 5000);

    const promptText = `
    【第 ${blockIndex} 集剧本改编任务】
    小说原著内容：${truncatedSource}
    
    要求：
    1. 改编为适合动漫呈现的剧本，情感饱满，动作感强。
    2. 禁止输出任何英文标签、Markdown 符号或乱码。
    3. 风格参考：${STYLE_PROMPTS[style]}
    4. 爽点模式：${trope ? TROPE_PROMPTS[trope] : "通用"}
    `;

    const response = await ai.models.generateContentStream({
      model: model,
      contents: [{ parts: [{ text: promptText }] }],
      config: { 
        systemInstruction: SYSTEM_PROMPT_BASE + "\n请使用纯净中文输出，禁止任何 Markdown 格式符号。", 
        temperature: 0.8,
      },
    });

    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *generateTechnicalShotListStream(scriptContent: string, refTemplate: string = "") {
    const ai = this.getAI();
    const prompt = `
    【工业级高精细分镜拆解任务 - 目标时长：120-180秒】
    你现在的身份是一位经验丰富的动漫导演。请将以下剧本拆解为极其详尽的分镜脚本。

    剧本内容：
    ${scriptContent}

    【硬性要求】
    1. **时长控制**：总时长必须在 120 秒到 180 秒之间。请根据剧情密度合理分配，确保总和多余 2 分钟。
    2. **镜头密度**：必须拆解出至少 30-45 个镜头，确保每一秒的视听体验都有据可查。
    3. **输出格式**：每一行必须严格按照 6 列输出，使用 "|" 分隔。禁止输出任何 Markdown 表格边框线（如 ---|---）。
    格式：镜号 | 时长 | 视听语言 | 画面描述 | 原著台词 | Vidu 生成视频的提示词

    【列定义】
    - 镜号：自增数字，如 01, 02...
    - 时长：必须以 "s" 结尾，如 "3s", "5s"。
    - 视听语言：包含景别（特写/全景）、运动（推拉摇移）、光影基调。
    - 画面描述：极致细腻的 2D 动漫画面表现，禁止输出乱码。
    - 原著台词：该镜头的角色对白。无对白填“（无）”。
    - Vidu 提示词：高质量英文 Prompt，包含角色一致性描写、风格、光影。

    不要输出任何前言和总结，禁止输出 Markdown 符号，直接开始输出分镜行。
    `;

    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { 
        systemInstruction: "你是一个专业的动漫导演分镜助手。你只负责按格式输出纯净的数据行，禁止使用 # * - 等符号。",
        temperature: 0.7,
      },
    });

    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *generateFullOutlineStream(mode: AudienceMode, content: string, deep: boolean, ref: string) {
    const ai = this.getAI();
    const prompt = `请为以下小说内容提取连载大纲。${deep ? '深度模式。' : ''} 参考模板：${ref}\n\n内容：${content.substring(0, 8000)}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { systemInstruction: SYSTEM_PROMPT_BASE }
    });
    for await (const chunk of response) if (chunk.text) yield chunk.text;
  }

  async *extractCharactersStream(content: string, ref: string) {
    const ai = this.getAI();
    const prompt = `从内容中提取核心人物及其设定：${content.substring(0, 6000)}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of response) if (chunk.text) yield chunk.text;
  }

  async *generateCharacterBioStream(name: string, desc: string, source: string, ref?: string) {
    const ai = this.getAI();
    const prompt = `为角色【${name}】编写深度人物小传。原著：${source.substring(0, 4000)}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of response) if (chunk.text) yield chunk.text;
  }

  async *extractReferenceScriptStream(content: string) {
    const ai = this.getAI();
    const prompt = `分析剧本结构：${content.substring(0, 5000)}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of response) if (chunk.text) yield chunk.text;
  }

  async generateCharacterImage(prompt: string, mode: AudienceMode) {
    const ai = this.getAI();
    const fullPrompt = `Anime style, high quality 2D, character portrait, ${prompt}`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: fullPrompt }] }],
    });
    let base64 = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64 = part.inlineData.data;
          break;
        }
      }
    }
    return `data:image/png;base64,${base64}`;
  }
}
