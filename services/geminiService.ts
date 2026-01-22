import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { ScriptBlock, ModelType, DirectorStyle, TropeType, AudienceMode } from "../types.ts";
import { STYLE_PROMPTS, TROPE_PROMPTS, SYSTEM_PROMPT_BASE, AUDIENCE_PROMPTS, CINEMATIC_MANUAL, AGENT_ANALYSIS_PROMPT } from "../constants.tsx";

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  static cleanText(text: string | undefined): string {
    if (!text) return "";
    return text
      .replace(/[#\*`\-_~>]/g, '') 
      .replace(/\{/g, '（').replace(/\}/g, '）')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async *analyzeProjectStream(sourceContent: string, referenceContent: string = "") {
    const ai = this.getAI();
    const prompt = `基于以下原著内容生成改编全案报告：\n${sourceContent.substring(0, 12000)}\n${referenceContent ? `参考资料：\n${referenceContent}` : ""}`;
    
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: AGENT_ANALYSIS_PROMPT,
        thinkingConfig: { thinkingBudget: 4000 }
      },
    });

    for await (const chunk of responseStream) {
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
    trope?: TropeType,
    referenceContent: string = ""
  ) {
    const ai = this.getAI();
    const prompt = `【剧本重构 - 第 ${blockIndex} 集】\n受众：${AUDIENCE_PROMPTS[mode]}\n风格：${STYLE_PROMPTS[style]}\n爽点：${trope ? TROPE_PROMPTS[trope] : ""}\n内容：${sourceContent.substring((blockIndex-1)*2000, (blockIndex-1)*2000 + 4000)}\n${referenceContent ? `参考：\n${referenceContent}` : ""}`;

    const responseStream = await ai.models.generateContentStream({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT_BASE,
        thinkingConfig: { thinkingBudget: 8000 }
      },
    });

    for await (const chunk of responseStream) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *generateTechnicalShotListStream(scriptContent: string, refContent: string = "") {
    const ai = this.getAI();
    const prompt = `你现在是一位资深漫剧分镜导演。请将以下改编剧本拆解为标准的 7 列工业分镜表。
    
    【核心指令】
    1. 必须精准提取每一个视觉锚点，严禁遗漏关键冲突动作。
    2. 每一行必须严格按照 7 个字段输出，并用管道符 | 分隔。
    3. 字段顺序：镜号 | 时长 | 镜头技术 | 画面描述 | 角色台词 | 绘画提示词 | 关联原文
    
    【字段详解】
    - 镜号：递增数字（如 1）。
    - 时长：格式如 3s, 5s。
    - 镜头技术：景别+运镜（如：中景，推镜头）。
    - 画面描述：分镜内的具体视觉动作及环境描写。
    - 角色台词：该镜头的台词内容，无则填“（无）”。
    - 绘画提示词：对应的英文 SD Prompt（含 anime, cinematic lighting, 2D 标签）。
    - 关联原文：剧本/小说中对应此镜头的原段落文字。

    待处理剧本：
    ${scriptContent}

    ${refContent ? `分镜风格参考：\n${refContent}` : ""}`;
    
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: CINEMATIC_MANUAL + "\n必须严格遵守 7 列管道符分隔格式。严禁输出表格外的任何文字解释。",
        thinkingConfig: { thinkingBudget: 4000 }
      },
    });

    for await (const chunk of responseStream) {
      if (chunk.text) yield chunk.text;
    }
  }

  async *extractReferenceScriptStream(sourceContent: string) {
    const ai = this.getAI();
    const prompt = `分析以下内容，提取并总结其核心视觉风格、分镜偏好及叙事结构模板：\n${sourceContent.substring(0, 8000)}`;
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "你是一位资深漫剧文学策划，负责提取可复用的风格化脚本模板。",
      },
    });
    for await (const chunk of responseStream) {
      if (chunk.text) yield chunk.text;
    }
  }

  async generateShotImage(visualDescription: string, technicalParams: string): Promise<string> {
    const ai = this.getAI();
    const prompt = `2D Anime style, professional studio quality. Visual: ${visualDescription}. Cinematography: ${technicalParams}. masterpiece, high quality, sharp lines.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return "";
  }

  async generateCharacterImage(prompt: string, mode: AudienceMode): Promise<string> {
    const ai = this.getAI();
    const fullPrompt = `2D Anime character design, ${mode === AudienceMode.MALE ? 'cool' : 'beautiful'}, ${prompt}, white background, high quality, concept art.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: fullPrompt }] }],
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    return "";
  }

  async triggerVideoGeneration(imageB64: string, prompt: string): Promise<string> {
    const ai = this.getAI();
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Cinematic anime animation: ${prompt}. Smooth movement, dynamic lighting.`,
      image: {
        imageBytes: imageB64.replace(/^data:image\/\w+;base64,/, ""),
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });
    return operation.name;
  }

  async pollVideoStatus(operationId: string): Promise<{ done: boolean, videoUrl?: string }> {
    const ai = this.getAI();
    const operation = await ai.operations.getVideosOperation({ operation: { name: operationId } as any });
    if (operation.done) {
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        // GUIDELINE: Must append API key when fetching from the download link
        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (videoResponse.ok) {
          const blob = await videoResponse.blob();
          return { done: true, videoUrl: URL.createObjectURL(blob) };
        }
      }
    }
    return { done: false };
  }

  async *extractCharactersStream(sourceContent: string, referenceContent: string = "") {
    const ai = this.getAI();
    const prompt = `分析并提取以下内容中的核心人设：\n${sourceContent.substring(0, 8000)}`;
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of responseStream) { if (chunk.text) yield chunk.text; }
  }

  async *generateCharacterBioStream(name: string, desc: string, source: string, ref: string) {
    const ai = this.getAI();
    const prompt = `为【${name}】生成深度逻辑建模小传。原著背景：\n${source.substring(0, 5000)}`;
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of responseStream) { if (chunk.text) yield chunk.text; }
  }

  async *generateFullOutlineStream(mode: AudienceMode, source: string, deep: boolean, ref: string) {
    const ai = this.getAI();
    const prompt = `基于${mode}模式生成连载大纲。内容：\n${source.substring(0, 10000)}`;
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of responseStream) { if (chunk.text) yield chunk.text; }
  }
}