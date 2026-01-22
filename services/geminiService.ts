
import { ScriptBlock, ModelType, DirectorStyle, TropeType, AudienceMode } from "../types.ts";
import { STYLE_PROMPTS, TROPE_PROMPTS, SYSTEM_PROMPT_BASE, AUDIENCE_PROMPTS, CINEMATIC_MANUAL, AGENT_ANALYSIS_PROMPT } from "../constants.tsx";

export class GeminiService {
  /**
   * 极致文本清洗
   */
  static cleanText(text: string | undefined): string {
    if (!text) return "";
    return text
      .replace(/[#\*`\-_~>]/g, '') 
      .replace(/\[/g, '（').replace(/\]/g, '）')
      .replace(/\{/g, '（').replace(/\}/g, '）')
      .replace(/: /g, '：')
      .replace(/, /g, '，')
      .replace(/(Shot|Visual|Audio|Dialogue|Duration|Scene|Action|Note|Camera|Cut|Transition|Description|Prompt|Script|Chapter|Episode|Title|Narrator|Visuals|Instructions|Technical)\s*[：:]/gi, '')
      .replace(/(镜头|画面描述|音频台词|场景|对白|心理描述|旁白|备注|运镜|转场|机位)\s*[：:]/g, (match) => `\n${match.replace(/[:：]/, '：')}`)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private async *callInternalApi(payload: any) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, stream: true })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: "连接中断，请重试" } }));
      throw new Error(err.error?.message || `HTTP Error ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) return;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield decoder.decode(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  async *analyzeProjectStream(sourceContent: string, referenceContent: string = "") {
    const prompt = `
    【项目全案深度分析】
    原著内容：\n${sourceContent.substring(0, 15000)}
    ${referenceContent ? `参考资料/风格标准：\n${referenceContent}` : ""}
    请基于以上内容生成改编全案报告。
    `;
    yield* this.callInternalApi({ 
      prompt, 
      systemInstruction: AGENT_ANALYSIS_PROMPT 
    });
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
    const prompt = `
    【剧本重构任务 - 第 ${blockIndex} 集】
    受众模式：${AUDIENCE_PROMPTS[mode]}
    导演风格：${STYLE_PROMPTS[style]}
    核心爽点：${trope ? TROPE_PROMPTS[trope] : "通用爽感"}
    
    原著内容：${sourceContent.substring((blockIndex-1)*2000, (blockIndex-1)*2000 + 4000)}
    ${referenceContent ? `风格参考：\n${referenceContent}` : ""}
    
    请严格遵循以下镜头手册进行改编：
    ${CINEMATIC_MANUAL}
    
    请输出标准工业剧本，包含明确的镜头技术参数描述。
    `;

    yield* this.callInternalApi({ 
      prompt, 
      model, 
      systemInstruction: SYSTEM_PROMPT_BASE 
    });
  }

  async *generateTechnicalShotListStream(scriptContent: string, referenceContent: string = "") {
    const prompt = `
    【精细化分镜表生成】
    ${CINEMATIC_MANUAL}
    剧本内容：\n${scriptContent}
    ${referenceContent ? `参考标准：\n${referenceContent}` : ""}
    请输出以'|'分隔的数据行：镜号 | 时长 | 技术参数 | 画面描述 | 原著台词 | Vidu提示词。
    `;
    yield* this.callInternalApi({ 
      prompt, 
      systemInstruction: "你是一个分镜导演，严禁输出任何多余解释，严格遵循手册术语。" 
    });
  }

  // FIX: Added extractCharactersStream method to handle character setting extraction
  async *extractCharactersStream(sourceContent: string, refContent: string = "") {
    const prompt = `
    【人物设定深度提取】
    请从以下原著内容中提取所有核心角色及重要配角。
    原著内容：\n${sourceContent.substring(0, 10000)}
    ${refContent ? `参考格式：\n${refContent}` : ""}
    
    输出要求：包含姓名、身份、性格、外貌特征、核心动机。
    `;
    yield* this.callInternalApi({ prompt, systemInstruction: "你是一个专业的文学编辑和编剧，擅长挖掘人物深度设定。" });
  }

  // FIX: Added extractReferenceScriptStream to handle shot template extraction
  async *extractReferenceScriptStream(sourceContent: string) {
    const prompt = `
    【分镜模板提取】
    请从以下内容中提取其分镜节奏和视觉风格特征，形成一个可参考的剧本模板。
    内容：\n${sourceContent.substring(0, 5000)}
    `;
    yield* this.callInternalApi({ prompt, systemInstruction: "你是一个资深导演，擅长拆解视听语言风格。" });
  }

  // FIX: Added generateCharacterBioStream to handle deep character modeling
  async *generateCharacterBioStream(name: string, desc: string, sourceContent: string, refContent: string = "") {
    const prompt = `
    【角色小传深度建模】
    角色姓名：${name}
    初始设定：${desc}
    原著背景：${sourceContent.substring(0, 8000)}
    ${refContent ? `参考小传范本：\n${refContent}` : ""}
    
    任务：基于以上信息，为该角色创作一份详尽的角色小传，包含生平、转折点、因果逻辑和独特的台词风格。
    `;
    yield* this.callInternalApi({ prompt, systemInstruction: "你是一个专业的角色设计师，擅长塑造有血有肉的角色。" });
  }

  // FIX: Added generateFullOutlineStream to handle series outline generation
  async *generateFullOutlineStream(mode: AudienceMode, sourceContent: string, deep: boolean, refContent: string = "") {
    const prompt = `
    【连载大纲全案生成】
    受众模式：${AUDIENCE_PROMPTS[mode]}
    分析深度：${deep ? "工业级深度（包含每一集的钩子、冲突与高潮）" : "标准深度"}
    
    原著内容：\n${sourceContent.substring(0, 15000)}
    ${refContent ? `参考大纲架构：\n${refContent}` : ""}
    
    请输出完整的分集大纲。
    `;
    yield* this.callInternalApi({ prompt, systemInstruction: SYSTEM_PROMPT_BASE });
  }

  async generateShotImage(visualDescription: string, technicalParams: string): Promise<string> {
    const prompt = `2D Anime style, high quality, cinematography. Visual: ${visualDescription}. Technical: ${technicalParams}. Masterpiece, sharp lines.`;
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model: 'gemini-2.5-flash-image' })
    });
    if (!response.ok) throw new Error("Image Generation Failed");
    const data = await response.json();
    return data.image;
  }

  async triggerVideoGeneration(imageB64: string, prompt: string): Promise<string> {
    const response = await fetch('/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageB64.replace(/^data:image\/\w+;base64,/, ""), prompt })
    });
    if (!response.ok) throw new Error("Video Trigger Failed");
    const data = await response.json();
    return data.operationId;
  }

  async pollVideoStatus(operationId: string): Promise<{ done: boolean, videoUrl?: string }> {
    const response = await fetch(`/api/video?id=${operationId}`);
    if (!response.ok) return { done: false };
    return await response.json();
  }

  async generateCharacterImage(prompt: string, mode: AudienceMode): Promise<string> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: `Masterpiece, best quality, 2D anime style, character portrait of ${prompt}, matching ${AUDIENCE_PROMPTS[mode]} style`, 
        model: 'gemini-2.5-flash-image' 
      })
    });
    const data = await response.json();
    return data.image;
  }
}
