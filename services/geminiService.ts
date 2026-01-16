
import { SYSTEM_PROMPT_BASE, MALE_MODE_PROMPT, FEMALE_MODE_PROMPT } from "../constants";
import { AudienceMode, ScriptBlock, ModelType } from "../types";

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
    referenceContent: string,
    previousBlocks: ScriptBlock[],
    targetEpisodes: string,
    model: ModelType = ModelType.PRO,
    loreDocs: string[] = []
  ) {
    // 自动提取创作简报以保持连贯性
    const summary = previousBlocks.length > 0 
      ? `[叙事链快照]：已进行到第 ${previousBlocks[previousBlocks.length-1].episodes} 集。当前核心冲突已爆发。`
      : '创作伊始。';

    const history = previousBlocks.length > 0 
      ? `[上集回顾]：\n${previousBlocks.slice(-1).map(b => b.content.substring(0, 800)).join('\n')}`
      : '起始集。';

    const loreContext = loreDocs.length > 0 
      ? `[锁定设定]：\n${loreDocs.join('\n---\n')}`
      : '';

    const modePrompt = mode === AudienceMode.MALE ? MALE_MODE_PROMPT : FEMALE_MODE_PROMPT;

    const promptText = `
任务：改编漫剧第 ${targetEpisodes} 集脚本。
${summary}
${loreContext}
${history}
[小说片段]：
${sourceContent}
${modePrompt}
请输出 AV 双专栏脚本。必须在结尾增加 [DirectorNote] 进行节奏总结。`;

    const response = await this.callBackend({
      prompt: [{ parts: [{ text: promptText }] }],
      systemInstruction: SYSTEM_PROMPT_BASE,
      config: { model, temperature: 0.72 }
    });

    return response.text;
  }

  async rewriteDialogue(characterName: string, originalText: string, style: string) {
    const prompt = `你是一个漫剧对白精修专家。请将以下对白按照 [${style}] 风格重写，要求更具表现力，适合动漫载体：
角色：${characterName}
原话：${originalText}
请直接输出重写后的台词。`;

    const response = await this.callBackend({
      prompt: [{ parts: [{ text: prompt }] }],
      config: { model: ModelType.FLASH }
    });
    return response.text;
  }

  async generateShotImage(shotDescription: string, mode: AudienceMode, characterContext?: string) {
    const prompt = `2D Anime Cinematic Shot, Storyboard Style. ${mode === AudienceMode.MALE ? 'Action-focused, dynamic, sharp' : 'Emotional, soft, dreamy'}. ${characterContext || ''}. Shot: ${shotDescription}`;
    const data = await this.callBackend({
      prompt: [{ parts: [{ text: prompt }] }],
      config: { model: 'gemini-2.5-flash-image', imageConfig: { aspectRatio: "16:9" } }
    });
    return data.image;
  }

  async generateDialogueAudio(characterName: string, dialogueText: string, voiceId?: string) {
    let voiceName = voiceId;
    if (!voiceName) {
      voiceName = ['辰', '云', '天', '龙', '战', '尊'].some(n => characterName.includes(n)) ? 'Fenrir' : 'Kore';
    }
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: [{ parts: [{ text: dialogueText }] }], voiceName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error("TTS 失败");
    return data.audio;
  }

  async extractCharacters(content: string) {
    const response = await this.callBackend({
      prompt: [{ parts: [{ text: `提取人物核心特征：\n\n${content}` }] }],
      config: { model: ModelType.FLASH }
    });
    return response.text;
  }

  async generateFullOutline(mode: AudienceMode, content: string, referenceContent?: string) {
    const response = await this.callBackend({
      prompt: [{ parts: [{ text: `生成全集剧情大纲：\n模式：${mode}\n内容：${content}` }] }],
      config: { model: ModelType.PRO }
    });
    return response.text;
  }

  async generateCharacterImage(prompt: string, mode: AudienceMode) {
    const enhancedPrompt = `Anime character sheet, 2D art. Style: ${mode}. Character: ${prompt}`;
    const data = await this.callBackend({
      prompt: [{ parts: [{ text: enhancedPrompt }] }],
      config: { model: 'gemini-2.5-flash-image', imageConfig: { aspectRatio: "3:4" } }
    });
    return data.image;
  }
}
