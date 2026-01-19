
import { GoogleGenAI, Modality } from "@google/genai";
import { SYSTEM_PROMPT_BASE, MALE_MODE_PROMPT, FEMALE_MODE_PROMPT, STYLE_PROMPTS } from "../constants.tsx";
import { AudienceMode, ScriptBlock, ModelType, DirectorStyle } from "../types.ts";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.API_KEY;
    this.ai = new GoogleGenAI({ apiKey: apiKey as string });
  }

  /**
   * 极简清洗：只保留中文汉字、标点和特定格式。
   * 彻底移除所有 Markdown (#, *, -, `, [ ], { }) 以及英文单词。
   */
  static cleanText(text: string | undefined): string {
    if (!text) return "";
    return text
      .replace(/[#\*`\-_~>]/g, '') // 移除 Markdown 符号
      .replace(/\[Shot:/gi, '（镜头：')
      .replace(/\[.*?\]/g, '')      // 移除所有中括号标签
      .replace(/\{.*?\}/g, '')      // 移除所有大括号标签
      .replace(/[a-zA-Z]+/g, '')    // 移除所有残留英文
      .replace(/\n\s*\n/g, '\n\n')  // 合并多余换行
      .trim();
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
    const startEp = (blockIndex - 1) * 3 + 1;
    const endEp = blockIndex * 3;
    
    // 扩大阅读范围，确保覆盖用户要求的 3000 字量级
    const segmentSize = 10000;
    const offset = (blockIndex - 1) * 8000; 
    const truncatedSource = sourceContent.substring(offset, offset + segmentSize);

    const promptText = `
    【目标】改编动漫脚本 第 ${startEp}-${endEp} 集
    【受众】${mode === AudienceMode.MALE ? MALE_MODE_PROMPT : FEMALE_MODE_PROMPT} 
    【风格】${STYLE_PROMPTS[style]}
    
    【全局剧本大纲】
    ${outlineContent ? outlineContent.substring(0, 4000) : "请根据情节逻辑自然衔接"}

    【参考格式】
    ${referenceContent ? referenceContent.substring(0, 1500) : "标准动漫剧本格式"}

    【前情提要】
    ${previousBlocks.length > 0 ? previousBlocks[previousBlocks.length - 1].content.slice(-800) : '故事起始'}
    
    【原著核心内容】
    ${truncatedSource}

    【改编任务】
    1. 将上述内容精练为 3 集剧本。
    2. 禁止任何英文。禁止“呜呜、哈哈哈”拟声词。
    3. 格式：
    第 N 集
    （镜头：画面描述）
    角色名：台词内容
    `;

    try {
      const response = await this.ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT_BASE,
          temperature: 0.7,
        },
      });

      for await (const chunk of response) {
        if (chunk.text) yield chunk.text;
      }
    } catch (error: any) {
      throw new Error(`剧本流生成异常: ${error.message}`);
    }
  }

  async *generateFullOutlineStream(mode: AudienceMode, content: string, referenceStyle: string = "") {
    const promptText = `
    任务：阅读以下超长网文，撰写一份 2000-3000 字的【深度剧本改编大纲】。
    
    要求：
    1. 必须包含：世界观基调、核心人物成长弧光、每 10 集一个的大钩子、全篇 100 集的爽点分布图。
    2. 语言必须纯正中文，禁止英文，禁止符号。
    3. 内容要极尽详细，涵盖主要矛盾冲突。
    ${referenceStyle ? `4. 风格参考：请模仿该大纲的叙事力度：${referenceStyle.substring(0, 1000)}` : ""}

    原著内容：
    ${content.substring(0, 25000)}
    `;

    const response = await this.ai.models.generateContentStream({
      model: 'gemini-3-pro-preview', // 大纲提取使用 Pro 模型以获得更高质量
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        systemInstruction: "你是一位资深文学策划，擅长将长篇小说结构化。你的输出必须是美观、纯净的中文长文，字数要充实，达到 2000 字以上。",
      },
    });

    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *extractCharactersStream(content: string) {
    const promptText = `提取核心角色，要求详细。禁止英文。内容：${content.substring(0, 10000)}`;
    const response = await this.ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        systemInstruction: "你是一个资深动漫人设师。请输出：姓名、性格、外貌特征、关键记忆点。纯中文。",
      },
    });
    for await (const chunk of response) {
      if (chunk.text) yield chunk.text;
    }
  }

  async generateShotImage(description: string, mode: AudienceMode, aspectRatio: string = "16:9", style: DirectorStyle = DirectorStyle.UFOTABLE): Promise<string> {
    const prompt = `Anime 2D concept art, ${STYLE_PROMPTS[style]}, ${description}, professional lighting, ${mode === AudienceMode.MALE ? 'shonen style' : 'shoujo style'}`;
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: { imageConfig: { aspectRatio: aspectRatio as any } },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return "";
  }

  async generateCharacterImage(description: string, mode: AudienceMode): Promise<string> {
    const prompt = `Anime character sheet, full body, ${description}, flat colors, white background, high detail, ${mode === AudienceMode.MALE ? 'shonen' : 'shoujo'}`;
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: { imageConfig: { aspectRatio: "1:1" } },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return "";
  }

  async generateTTS(text: string, voiceName: string = 'Kore'): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio ? `data:audio/pcm;base64,${base64Audio}` : "";
  }
}
