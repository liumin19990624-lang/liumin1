import axios from "axios";
import { SYSTEM_PROMPT_BASE, STYLE_PROMPTS, TROPE_PROMPTS } from "../constants.tsx";
import { AudienceMode, ScriptBlock, ModelType, DirectorStyle, TropeType } from "../types.ts";

// ========== DMXAPI 核心配置（直接使用你的密钥）==========
const DMXAPI_CONFIG = {
  apiKey: "sk-56iBqzyCSBRB17iQSW2MILO0d1P2UgC8miT6BbvoEvPYI5Nw",
  baseUrl: "https://www.dmxapi.cn/api/v1",
};

// 校验 API 配置（启动时报错，避免运行时异常）
if (!DMXAPI_CONFIG.apiKey || !DMXAPI_CONFIG.baseUrl) {
  throw new Error("DMXAPI 密钥或地址配置错误，请检查");
}

// 创建 DMXAPI 客户端（统一请求配置）
const dmxApiClient = axios.create({
  baseURL: DMXAPI_CONFIG.baseUrl,
  headers: {
    "Authorization": `Bearer ${DMXAPI_CONFIG.apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
  timeout: 60000, // 延长超时时间（剧本生成耗时较长）
});

// 模型映射（DMXAPI 支持的模型）
const MODEL_MAPPING: Record<ModelType, string> = {
  [ModelType.FLASH]: "gemini-3-flash-preview", // 轻量模型
  [ModelType.PRO]: "claude-3-sonnet", // 平衡模型
  [ModelType.ULTRA]: "claude-3-opus", // 旗舰模型
};

export class GeminiService {
  /**
   * 极致文本清洗：移除 Markdown、乱码、多余英文标签
   * 确保文本格式整洁、美观，符合中文阅读习惯
   */
  static cleanText(text: string | undefined | null): string {
    if (!text) return "";
    return text
      // 1. 移除所有 Markdown 特殊符号（# * - > _ ~ `）
      .replace(/[#\*`\-_~>]/g, '')
      // 2. 统一使用中文全角符号，并移除方括号标签
      .replace(/\[/g, '（').replace(/\]/g, '）')
      .replace(/\{/g, '（').replace(/\}/g, '）')
      .replace(/: /g, '：')
      .replace(/, /g, '，')
      .replace(/;/g, '；')
      .replace(/\?/g, '？')
      .replace(/!/g, '！')
      // 3. 移除常见的 AI 英文标签头及其前缀
      .replace(/(Shot|Visual|Audio|Dialogue|Duration|Scene|Action|Note|Camera|Cut|Transition|Description|Prompt|Script|Chapter|Episode|Title)\s*[：:]/gi, '')
      // 4. 对核心中文标识符进行强制换行处理，提升排版美感
      .replace(/(镜头|画面描述|音频台词|场景|对白|心理描述|旁白|备注)\s*[：:]/g, (match) => `\n${match.replace(/[:：]/, '：')}`)
      // 5. 清理多余的连续换行和行间空格
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/^\s+(场景|镜头)/gm, '$1')
      .trim();
  }

  /**
   * 生成剧本片段（流式输出，适配 DMXAPI）
   */
  async *generateScriptBlockStream(
    mode: AudienceMode,
    sourceContent: string,
    previousBlocks: ScriptBlock[],
    blockIndex: number,
    model: ModelType = ModelType.FLASH,
    style: DirectorStyle = DirectorStyle.UFOTABLE,
    trope?: TropeType,
    referenceContent: string = ""
  ): AsyncGenerator<string, void, unknown> {
    // 输入校验
    if (!sourceContent.trim()) throw new Error("小说原著内容不能为空");
    if (blockIndex < 1) throw new Error("集数索引必须大于等于 1");

    // 动态计算偏移量，确保每集内容承接
    const offset = Math.max(0, (blockIndex - 1) * 2500);
    const truncatedSource = sourceContent.substring(offset, offset + 4500);

    // 构建前序上下文（提升剧情连贯性）
    const previousContext = previousBlocks
      .map((block) => `【第 ${block.blockIndex} 集内容】\n${block.content}`)
      .join("\n\n");

    // 构建提示词
    const promptText = `
【剧本改编任务 - 第 ${blockIndex} 集】
${previousContext ? `【前序剧情承接】\n${previousContext}\n` : ""}
小说原著内容截选：${truncatedSource}

${referenceContent ? `【强制参考范本】：\n${referenceContent}\n(要求：严格模仿此范本的叙事节奏、对白精简度及排版格式)` : ""}

【改编规格】：
1. 目标受众：${mode === AudienceMode.MALE ? "男频" : "女频"}
2. 风格：${STYLE_PROMPTS[style]}
3. 爽点核心：${trope ? TROPE_PROMPTS[trope] : "通用爽剧节奏"}
4. **禁止输出**：任何 Markdown 符号（如 #, *）、英文标签、英文提示词、乱码或特殊转义符。
5. **排版要求**：使用纯净中文，通过换行区分场景、动作和台词。
6. **深度改编**：挖掘角色内心戏和细节动作。

输出示例：
场景1：雨夜别墅
镜头01：全景
暴雨倾盆，黑色宾利停在欧式别墅门口，车门打开，顾彦琛身着手工西装，撑着黑伞下车，雨水打湿他的裤脚。
顾彦琛：把她带出来。

镜头02：中景
苏晚晚蜷缩在沙发角落，穿着单薄的睡衣，看到顾彦琛进来，身体微微发抖。
苏晚晚：你想干什么？
    `.trim();

    try {
      // 选择模型
      const targetModel = MODEL_MAPPING[model] || MODEL_MAPPING[ModelType.FLASH];

      // 调用 DMXAPI 流式生成
      const response = await dmxApiClient.post(
        "/chat/completions",
        {
          model: targetModel,
          messages: [
            {
              role: "system",
              content: `${SYSTEM_PROMPT_BASE}\n请输出优雅、整洁的纯中文剧本内容，剔除所有格式化符号和英文标记。`,
            },
            { role: "user", content: promptText },
          ],
          temperature: 0.85,
          max_tokens: 4000,
          stream: true, // 流式输出
        },
        { responseType: "stream" }
      );

      // 处理流式响应
      let accumulatedText = "";
      for await (const chunk of this.streamParser(response.data)) {
        accumulatedText += chunk;
        yield GeminiService.cleanText(accumulatedText);
      }
    } catch (error) {
      console.error("生成剧本片段失败：", error);
      throw new Error(
        error instanceof Error ? `生成失败：${error.message}` : "生成剧本时发生未知错误"
      );
    }
  }

  /**
   * 生成分镜表（流式输出，适配 DMXAPI）
   */
  async *generateTechnicalShotListStream(scriptContent: string, referenceContent: string = ""): AsyncGenerator<string, void, unknown> {
    if (!scriptContent.trim()) throw new Error("剧本内容不能为空");

    const prompt = `
【分镜拆解 - 120s+ 工业标准】
将剧本拆解为 6 列分镜表。格式：镜号 | 时长（秒） | 视听语言 | 画面描述 | 原著台词 | Vidu提示词

【剧本内容】：
${scriptContent}

${referenceContent ? `【参考分镜标准】：\n${referenceContent}` : ""}

指标：总长>120秒。禁止 Markdown 符号。画面描述极致细腻。
输出示例：
01 | 8 | 全景+推镜头 | 暴雨倾盆，黑色宾利停在欧式别墅门口，车门打开，顾彦琛身着手工西装，撑着黑伞下车 | 顾彦琛：把她带出来。 | high-quality 2d anime, rain night, european villa
02 | 6 | 中景+固定镜头 | 苏晚晚蜷缩在沙发角落，穿着单薄的睡衣，身体微微发抖 | 苏晚晚：你想干什么？ | high-quality 2d anime, indoor, sofa, medium shot
    `.trim();

    try {
      const response = await dmxApiClient.post(
        "/chat/completions",
        {
          model: "claude-3-opus",
          messages: [
            {
              role: "system",
              content: "你只输出以'|'分隔的纯净数据行，严禁 Markdown 标记和英文标签。",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 6000,
          stream: true,
        },
        { responseType: "stream" }
      );

      let accumulatedText = "";
      for await (const chunk of this.streamParser(response.data)) {
        accumulatedText += chunk;
        yield accumulatedText;
      }
    } catch (error) {
      console.error("生成分镜表失败：", error);
      throw new Error(
        error instanceof Error ? `分镜表生成失败：${error.message}` : "生成分镜表时发生未知错误"
      );
    }
  }

  /**
   * 生成完整大纲（流式输出）
   */
  async *generateFullOutlineStream(mode: AudienceMode, content: string, deep: boolean, referenceContent: string = ""): AsyncGenerator<string, void, unknown> {
    if (!content.trim()) throw new Error("小说内容不能为空");

    const prompt = `为${mode === AudienceMode.MALE ? "男频" : "女频"}小说提取全案大纲。${deep ? '深度模式。' : ''} ${referenceContent ? `参考：${referenceContent}` : ""}\n\n内容：${content.substring(0, 8000)}`;

    try {
      const response = await dmxApiClient.post(
        "/chat/completions",
        {
          model: "claude-3-sonnet",
          messages: [
            { role: "system", content: SYSTEM_PROMPT_BASE },
            { role: "user", content: prompt },
          ],
          temperature: 0.6,
          max_tokens: 3000,
          stream: true,
        },
        { responseType: "stream" }
      );

      let accumulatedText = "";
      for await (const chunk of this.streamParser(response.data)) {
        accumulatedText += chunk;
        yield GeminiService.cleanText(accumulatedText);
      }
    } catch (error) {
      console.error("生成大纲失败：", error);
      throw new Error("大纲生成失败，请重试");
    }
  }

  /**
   * 提取角色设定（流式输出）
   */
  async *extractCharactersStream(content: string, referenceContent: string = ""): AsyncGenerator<string, void, unknown> {
    if (!content.trim()) throw new Error("小说内容不能为空");

    const prompt = `提取角色详细设定档案。${referenceContent ? `参考格式：${referenceContent}` : ""}\n\n内容：${content.substring(0, 6000)}`;

    try {
      const response = await dmxApiClient.post(
        "/chat/completions",
        {
          model: "claude-3-sonnet",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.5,
          max_tokens: 4000,
          stream: true,
        },
        { responseType: "stream" }
      );

      let accumulatedText = "";
      for await (const chunk of this.streamParser(response.data)) {
        accumulatedText += chunk;
        yield GeminiService.cleanText(accumulatedText);
      }
    } catch (error) {
      console.error("提取角色设定失败：", error);
      throw new Error("角色设定提取失败，请重试");
    }
  }

  /**
   * 生成角色小传（流式输出）
   */
  async *generateCharacterBioStream(name: string, desc: string, source: string, referenceContent: string = ""): AsyncGenerator<string, void, unknown> {
    if (!name.trim() || !source.trim()) throw new Error("角色名称和小说内容不能为空");

    const prompt = `为【${name}】编写深度小传。${referenceContent ? `参考风格：${referenceContent}` : ""}\n\n依据：${source.substring(0, 4000)}`;

    try {
      const response = await dmxApiClient.post(
        "/chat/completions",
        {
          model: "claude-3-opus",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.75,
          max_tokens: 3000,
          stream: true,
        },
        { responseType: "stream" }
      );

      let accumulatedText = "";
      for await (const chunk of this.streamParser(response.data)) {
        accumulatedText += chunk;
        yield GeminiService.cleanText(accumulatedText);
      }
    } catch (error) {
      console.error("生成角色小传失败：", error);
      throw new Error("角色小传生成失败，请重试");
    }
  }

  /**
   * 生成角色图片（适配 DMXAPI 图片生成）
   */
  async generateCharacterImage(prompt: string, mode: AudienceMode): Promise<string> {
    if (!prompt.trim()) throw new Error("图片描述词不能为空");

    // 优化图片提示词
    const style = mode === AudienceMode.MALE
      ? "shounen jump style, dynamic pose, bold lines"
      : "shoujo style, soft lighting, delicate lines";

    const fullPrompt = `High-end 2D Anime portrait, character design sheet, detailed, ${style}, ${prompt}, best quality, 8k resolution`;

    try {
      // 调用 DMXAPI 图片生成接口
      const response = await dmxApiClient.post("/images/generations", {
        prompt: fullPrompt,
        n: 1,
        size: "1024x1024",
        model: "dall-e-3",
      });

      if (response.data.data?.[0]?.url) {
        return response.data.data[0].url;
      } else if (response.data.data?.[0]?.b64_json) {
        return `data:image/png;base64,${response.data.data[0].b64_json}`;
      }

      throw new Error("未生成有效图片");
    } catch (error) {
      console.error("生成角色图片失败：", error);
      throw new Error(
        error instanceof Error ? `图片生成失败：${error.message}` : "生成角色图片时发生未知错误"
      );
    }
  }

  /**
   * 流式响应解析器（处理 DMXAPI 的 SSE 格式）
   */
  private async *streamParser(stream: NodeJS.ReadableStream): AsyncGenerator<string> {
    let buffer = "";
    for await (const chunk of stream) {
      const chunkStr = chunk.toString("utf-8");
      buffer += chunkStr;

      // 按 SSE 格式分割（data: ...\n\n）
      const lines = buffer.split("\n\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line || line === "data: [DONE]") continue;

        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content || "";
            if (content) yield content;
          } catch (parseError) {
            console.warn("解析流式响应失败：", parseError);
            continue;
          }
        }
      }

      // 更新缓冲区（保留未处理的最后一行）
      buffer = lines[lines.length - 1];
    }
  }
}
