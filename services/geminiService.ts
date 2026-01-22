
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { SYSTEM_PROMPT_BASE, STYLE_PROMPTS, TROPE_PROMPTS } from "../constants.tsx";
import { AudienceMode, ScriptBlock, ModelType, DirectorStyle, TropeType } from "../types.ts";

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  /**
   * 极致文本清洗：彻底移除 Markdown、AI 标签、中英乱码
   * 目标：输出符合中文阅读习惯的整洁文本
   */
  static cleanText(text: string | undefined): string {
    if (!text) return "";
    return text
      // 1. 移除 Markdown 特殊符号
      .replace(/[#\*`\-_~>]/g, '') 
      // 2. 统一使用中文标点，移除方括号
      .replace(/\[/g, '（').replace(/\]/g, '）')
      .replace(/\{/g, '（').replace(/\}/g, '）')
      .replace(/: /g, '：')
      .replace(/, /g, '，')
      // 3. 移除常见的 AI 英文标签及其前缀
      .replace(/(Shot|Visual|Audio|Dialogue|Duration|Scene|Action|Note|Camera|Cut|Transition|Description|Prompt|Script|Chapter|Episode|Title|Narrator|Visuals|Instructions|Technical)\s*[：:]/gi, '')
      // 4. 对核心中文标识符强制换行，提升工业排版美感
      .replace(/(镜头|画面描述|音频台词|场景|对白|心理描述|旁白|备注|光影|机位|运镜)\s*[：:]/g, (match) => `\n${match.replace(/[:：]/, '：')}`)
      // 5. 压缩多余空行，清理行首尾空白
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
    // 动态采样，确保 AI 知道前文剧情并保持连贯
    const offset = Math.max(0, (blockIndex - 1) * 2000); 
    const truncatedSource = sourceContent.substring(offset, offset + 5000);

    const promptText = `
    【第 ${blockIndex} 集剧本深度改编】
    小说原著截选：${truncatedSource}
    
    ${referenceContent ? `【参考范本】：\n${referenceContent}\n(请严格参考其排版与对白节奏)` : ""}
    
    【改编指令】：
    1. 改编为 2D 动漫剧本。风格：${STYLE_PROMPTS[style]}。
    2. 爽点：${trope ? TROPE_PROMPTS[trope] : "节奏感"}。
    3. **禁止输出**：任何 Markdown (#, *, -)、英文标签 (Shot:, Dialogue:)、乱码、非中文字符（除非是必要的视频提示词）。
    4. **要求**：纯净中文叙述，强调画面动感。
    `;

    const response = await ai.models.generateContentStream({
      model: model,
      contents: [{ parts: [{ text: promptText }] }],
      config: { 
        systemInstruction: SYSTEM_PROMPT_BASE + "\n请输出整洁、美观的纯中文剧本，去除一切无用符号。", 
        temperature: 0.8,
      },
    });

    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *generateTechnicalShotListStream(scriptContent: string, referenceContent: string = "") {
    const ai = this.getAI();
    const prompt = `
    【分镜拆解任务 - 120s+ 标准】
    内容：${scriptContent}
    ${referenceContent ? `参考：${referenceContent}` : ""}
    格式：镜号 | 时长 | 视听语言 | 画面描述 | 原著台词 | Vidu提示词
    要求：总长>120s。纯中文。画面描述极其细腻。无 Markdown。
    `;

    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { 
        systemInstruction: "只输出'|'分隔的数据行，禁止 Markdown。",
        temperature: 0.7,
      },
    });

    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *generateFullOutlineStream(mode: AudienceMode, content: string, deep: boolean, referenceContent: string = "") {
    const ai = this.getAI();
    const prompt = `提取连载大纲。${deep ? '深度模式。' : ''} ${referenceContent ? `参考：${referenceContent}` : ""}\n\n内容：${content.substring(0, 8000)}`;
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: { systemInstruction: SYSTEM_PROMPT_BASE }
    });
    for await (const chunk of response) if (chunk.text) yield chunk.text;
  }
}
