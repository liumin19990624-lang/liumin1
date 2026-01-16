
import { SYSTEM_PROMPT_BASE, MALE_MODE_PROMPT, FEMALE_MODE_PROMPT, STYLE_PROMPTS } from "../constants";
import { AudienceMode, ScriptBlock, ModelType, DirectorStyle } from "../types";

export class GeminiService {
  private async callBackend(payload: any) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "AI 通信异常");
    return data;
  }

  async generateScriptBlock(
    mode: AudienceMode,
    sourceContent: string,
    previousBlocks: ScriptBlock[],
    targetEpisodes: string,
    model: ModelType = ModelType.PRO,
    style: DirectorStyle = DirectorStyle.GHIBLI
  ) {
    const stylePrompt = STYLE_PROMPTS[style];
    const lastBlock = previousBlocks[previousBlocks.length - 1];
    const continuityContext = lastBlock 
      ? `[叙事链快照]：已进行到第 ${lastBlock.episodes} 集。当前环境与角色状态：${lastBlock.continuityStatus || '连贯'}。`
      : '起始章节，请设定宏大的开场氛围。';

    const promptText = `
任务：改编漫剧第 ${targetEpisodes} 集脚本。
${continuityContext}
${stylePrompt}
[小说原著片段]：
${sourceContent}
${mode === AudienceMode.MALE ? MALE_MODE_PROMPT : FEMALE_MODE_PROMPT}
请输出符合规范的脚本。要求包含 [Shot:ID]、[Duration:Xs] 和 [角色:对白] 标记。
结尾必须包含一行 [ContinuityStatus: 总结本集结束时角色和环境的状态，用于下集参考]。`;

    const response = await this.callBackend({
      prompt: [{ parts: [{ text: promptText }] }],
      systemInstruction: SYSTEM_PROMPT_BASE,
      config: { model, temperature: 0.72 }
    });

    return response.text;
  }

  async generateShotImage(
    shotDescription: string, 
    mode: AudienceMode, 
    characterContext?: string, 
    style: DirectorStyle = DirectorStyle.SHINKAI,
    mixers: string[] = []
  ) {
    const mixerPrompt = mixers.length > 0 ? `Enhance with visual mixers: ${mixers.join(', ')}.` : '';
    const prompt = `2D Anime Cinematic Shot, ${style}. ${mixerPrompt} ${mode === AudienceMode.MALE ? 'High contrast, dynamic lighting' : 'Soft glow, aesthetic'}. Character: ${characterContext || ''}. Scene: ${shotDescription}`;
    
    const data = await this.callBackend({
      prompt: [{ parts: [{ text: prompt }] }],
      config: { model: 'gemini-2.5-flash-image', imageConfig: { aspectRatio: "16:9" } }
    });
    return data.image;
  }

  async generateCinematicVideo(imageUri: string, prompt: string, style: DirectorStyle) {
    const base64Image = imageUri.split('base64,')[1];
    const res = await fetch('/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Image,
        prompt: `High quality anime motion animation, ${style}. ${prompt}. 60fps feel, smooth parallax.`
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  }

  async pollVideoStatus(operationId: string) {
    const res = await fetch(`/api/video?id=${operationId}`);
    return await res.json();
  }

  async generateDialogueAudio(characterName: string, dialogueText: string, voiceId?: string) {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt: [{ parts: [{ text: `(扮演${characterName}) ${dialogueText}` }] }], 
        voiceName: voiceId || 'Kore' 
      })
    });
    return await res.json();
  }

  async extractCharacters(content: string) {
    const promptText = `请从以下文本中提取主要角色，输出格式为：角色名 - 视觉特征描述 - 性格核心。\n\n${content}`;
    const response = await this.callBackend({
      prompt: [{ parts: [{ text: promptText }] }],
      config: { model: ModelType.FLASH }
    });
    return response.text;
  }

  // Fixed: Added referenceContent as an optional third argument to match the caller in OutlinePanel.tsx
  async generateFullOutline(mode: AudienceMode, content: string, referenceContent?: string) {
    const refPrompt = referenceContent ? `\n请参考以下风格源的叙事节奏与文风：\n${referenceContent}\n` : '';
    const promptText = `请为以下内容撰写一份${mode}风格的 2000 字深度剧情大纲，突出叙事节奏和高潮转折点。${refPrompt}\n\n[目标小说文本]：\n${content}`;
    const response = await this.callBackend({
      prompt: [{ parts: [{ text: promptText }] }],
      config: { model: ModelType.PRO }
    });
    return response.text;
  }

  async generateCharacterImage(description: string, mode: AudienceMode) {
    const prompt = `2D hand-drawn Anime Character Concept Art, ${mode}. Full body, high detail, plain background. Description: ${description}`;
    const data = await this.callBackend({
      prompt: [{ parts: [{ text: prompt }] }],
      config: { model: 'gemini-2.5-flash-image', imageConfig: { aspectRatio: "1:1" } }
    });
    return data.image;
  }
}
