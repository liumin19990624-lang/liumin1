
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { SYSTEM_PROMPT_BASE, STYLE_PROMPTS, TROPE_PROMPTS } from "../constants.tsx";
import { AudienceMode, ScriptBlock, ModelType, DirectorStyle, TropeType } from "../types.ts";

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  /**
   * 极致文本清洗：移除 Markdown、乱码、多余英文标签
   * 确保文本格式整洁、美观，符合中文阅读习惯
   */
  static cleanText(text: string | undefined): string {
    if (!text) return "";
    return text
      // 1. 移除所有 Markdown 特殊符号（# * - > _ ~ `）
      .replace(/[#\*`\-_~>]/g, '') 
      // 2. 统一使用中文全角符号，并移除方括号标签
      .replace(/\[/g, '（').replace(/\]/g, '）')
      .replace(/\{/g, '（').replace(/\}/g, '）')
      .replace(/: /g, '：')
      .replace(/, /g, '，')
      // 3. 移除常见的 AI 英文标签头及其前缀
      .replace(/(Shot|Visual|Audio|Dialogue|Duration|Scene|Action|Note|Camera|Cut|Transition|Description|Prompt|Script|Chapter|Episode|Title)\s*[：:]/gi, '')
      // 4. 对核心中文标识符进行强制换行处理，提升排版美感
      .replace(/(镜头|画面描述|音频台词|场景|对白|心理描述|旁白|备注)\s*[：:]/g, (match) => `\n${match.replace(/[:：]/, '：')}`)
      // 5. 清理多余的连续换行和行间空格
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
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
    // 动态计算偏移量，确保每集内容承接
    const offset = Math.max(0, (blockIndex - 1) * 2500); 
    const truncatedSource = sourceContent.substring(offset, offset + 4500);

    const promptText = `
    【剧本改编任务 - 第 ${blockIndex} 集】
    小说原著内容截选：${truncatedSource}
    
    ${referenceContent ? `【强制参考范本】：\n${referenceContent}\n(要求：严格模仿此范本的叙事节奏、对白精简度及排版格式)` : ""}
    
    【改编规格】：
    1. 风格：${STYLE_PROMPTS[style]}
    2. 爽点核心：${trope ? TROPE_PROMPTS[trope] : "通用爽剧节奏"}
    3. **禁止输出**：任何 Markdown 符号（如 #, *）、英文标签、英文提示词、乱码或特殊转义符。
    4. **排版要求**：使用纯净中文，通过换行区分场景、动作和台词。
    5. **深度改编**：挖掘角色内心戏和细节动作。
    `;

    const response = await ai.models.generateContentStream({
      model: model,
      contents: [{ parts: [{ text: promptText }] }],
      config: { 
        systemInstruction: SYSTEM_PROMPT_BASE + "\n请输出优雅、整洁的纯中文剧本内容，剔除所有格式化符号和英文标记。", 
        temperature: 0.85,
      },
    });

    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *generateTechnicalShotListStream(scriptContent: string, referenceContent: string = "") {
    const ai = this.getAI();
    const prompt = `
    【分镜拆解 - 120s+ 工业标准】
    将剧本拆解为 6 列分镜表。格式：镜号 | 时长 | 视听语言 | 画面描述 | 原著台词 | Vidu提示词

    【剧本内容】：
    ${scriptContent}

    ${referenceContent ? `【参考分镜标准】：\n${referenceContent}` : ""}

    指标：总长>120秒。禁止 Markdown 符号。画面描述极致细腻。
    `;

    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { 
        systemInstruction: "你只输出以'|'分隔的纯净数据行，严禁 Markdown 标记和英文标签。",
        temperature: 0.7,
      },
    });

    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *generateFullOutlineStream(mode: AudienceMode, content: string, deep: boolean, referenceContent: string = "") {
    const ai = this.getAI();
    const prompt = `为小说提取全案大纲。${deep ? '深度模式。' : ''} ${referenceContent ? `参考：${referenceContent}` : ""}\n\n内容：${content.substring(0, 8000)}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { systemInstruction: SYSTEM_PROMPT_BASE }
    });
    for await (const chunk of response) if (chunk.text) yield chunk.text;
  }

  async *extractCharactersStream(content: string, referenceContent: string = "") {
    const ai = this.getAI();
    const prompt = `提取角色详细设定档案。${referenceContent ? `参考格式：${referenceContent}` : ""}\n\n内容：${content.substring(0, 6000)}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of response) if (chunk.text) yield chunk.text;
  }

  async *generateCharacterBioStream(name: string, desc: string, source: string, referenceContent: string = "") {
    const ai = this.getAI();
    const prompt = `为【${name}】编写深度小传。${referenceContent ? `参考风格：${referenceContent}` : ""}\n\n依据：${source.substring(0, 4000)}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of response) if (chunk.text) yield chunk.text;
  }

  async generateCharacterImage(prompt: string, mode: AudienceMode) {
    const ai = this.getAI();
    const fullPrompt = `High-end 2D Anime portrait, character design sheet, detailed, ${prompt}`;
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
