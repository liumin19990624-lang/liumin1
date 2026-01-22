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
    const prompt = `【剧本重构 - 第 ${blockIndex} 集】\n受众：${AUDIENCE_PROMPTS[mode]}\n风格：${STYLE_PROMPTS[style]}\n爽点：${trope ? TROPE_PROMPTS[trope] : ""}\n内容：${sourceContent.substring((blockIndex-1)*2000, (blockIndex-1)*2000 + 4000)}\n${referenceContent ? `【极重要参考】请严格模仿以下参考文件的叙事风格、格式排版及对白节奏进行改编：\n${referenceContent}` : ""}`;

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
    const prompt = `你现在是一位资深漫剧分镜导演。请将以下改编剧本拆解为“工业级高颗粒度分镜表”。
    
    【核心KPI指标】
    1. 分镜规模：必须拆解出 48 镜至 64 镜，严禁笼统概括，确保每一丝情绪波动都有独立画面。
    2. 总时长：各分镜时长(Duration)累加必须超过 130s（建议在 130s-160s 之间）。
    3. 运镜指令：每一镜必须包含具体的运动指令：推镜头(Push)、拉镜头(Pull)、摇镜头(Pan/Tilt)、移镜头(Truck/Dolly)、环绕镜头(Orbit)、暴力冲镜、荷兰角旋转等。
    
    【输出协议：7 列管道符格式】
    镜号 | 时长 | 镜头技术 | 画面描述 | 角色台词 | 绘画提示词 | 关联原文
    
    【字段深度详解】
    - 镜号：递增数字 1-64。
    - 时长：数字+s (如 3s, 5s)。
    - 镜头技术：景别 + 具体的运动指令 (如：特写+快速推镜)。
    - 画面描述：环境细节、角色动作、微表情。
    - 角色台词：该镜头的对白，无则填“（无）”。
    - 绘画提示词：对应的英文 SD Prompt。
    - 关联原文：激发此分镜的小说/剧本原句。

    待处理剧本：
    ${scriptContent}

    ${refContent ? `风格/分镜参考资料（请学习其运镜逻辑和景别切换规律）：\n${refContent}` : ""}`;
    
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: CINEMATIC_MANUAL + "\n任务：输出 48-64 镜的高颗粒度分镜表。严禁输出表格以外的任何字符。",
        thinkingConfig: { thinkingBudget: 4000 }
      },
    });

    for await (const chunk of responseStream) {
      if (chunk.text) yield chunk.text;
    }
  }

  async generateShotImage(visualDescription: string, technicalParams: string): Promise<string> {
    const ai = this.getAI();
    const prompt = `2D Anime style, professional studio quality. Visual: ${visualDescription}. Cinematography: ${technicalParams}. 16:9 widescreen, masterpiece, high definition, sharp lines.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return "";
  }

  async triggerVideoGeneration(imageB64: string, prompt: string): Promise<string> {
    const ai = this.getAI();
    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `High-end 2D anime animation: ${prompt}. Cinematic movement, dynamic 16:9 aspect ratio.`,
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
        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (videoResponse.ok) {
          const blob = await videoResponse.blob();
          return { done: true, videoUrl: URL.createObjectURL(blob) };
        }
      }
    }
    return { done: false };
  }

  async generateCharacterImage(prompt: string, mode: AudienceMode): Promise<string> {
    const ai = this.getAI();
    const fullPrompt = `2D Anime character, ${mode === AudienceMode.MALE ? 'cool' : 'beautiful'}, ${prompt}, white background.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: fullPrompt }] }],
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    return "";
  }

  async *extractCharactersStream(sourceContent: string, referenceContent: string = "") {
    const ai = this.getAI();
    const prompt = `提取角色：\n${sourceContent.substring(0, 8000)}\n${referenceContent ? `参考格式：\n${referenceContent}` : ""}`;
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of responseStream) { if (chunk.text) yield chunk.text; }
  }

  async *generateCharacterBioStream(name: string, desc: string, source: string, ref: string) {
    const ai = this.getAI();
    const prompt = `你现在是一位资深动漫编剧。请为角色【${name}】进行深度全案建模。
    
    【建模要求】
    1. 动机推演：基于原著逻辑，深度挖掘其不可告人的潜在动机、原始恐惧与核心欲望。
    2. 关系网重构：梳理其在原著中的利益关联人，并推演其潜在的敌友转化关系。
    3. 背景补全：合理补全原著中未提及的童年阴影或关键转折事件。
    4. 视觉基调：定义该角色在漫剧中的色调语言（如：暗黑系冷紫、破碎感霜蓝）。
    
    【核心产出：生平分镜时间轴】
    在结尾处，必须输出一个结构化的“分镜时间轴”，描述角色一生中的 5 个关键视觉瞬间：
    [阶段名]: [视觉镜头描述] | [核心事件] | [视觉风格/光影]

    输入资料：
    - 基础人设：${desc}
    - 原著参考：${source.substring(0, 5000)}
    - 风格对标：${ref ? ref.substring(0, 3000) : "无"}
    
    请输出专业、深刻且具有工业厚度的小传内容。`;

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        thinkingConfig: { thinkingBudget: 8000 }
      }
    });
    for await (const chunk of responseStream) { if (chunk.text) yield chunk.text; }
  }

  async *generateFullOutlineStream(mode: AudienceMode, source: string, deep: boolean, ref: string) {
    const ai = this.getAI();
    const prompt = `生成大纲：\n${source.substring(0, 10000)}\n${ref ? `参考大纲架构：\n${ref}` : ""}`;
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of responseStream) { if (chunk.text) yield chunk.text; }
  }

  async *extractReferenceScriptStream(sourceContent: string) {
    const ai = this.getAI();
    const prompt = `分析视觉风格模板：\n${sourceContent.substring(0, 8000)}`;
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
    });
    for await (const chunk of responseStream) { if (chunk.text) yield chunk.text; }
  }
}