import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";

// 你提供的 API 地址和密钥
const API_BASE_URL = 'https://www.dmxapi.cn';
const API_KEY = 'sk-56iBqzyCSBRB17iQSW2MILO0d1P2UgC8miT6BbvoEvPYI5Nw';

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { prompt, config, systemInstruction, stream: shouldStream, model: requestedModel } = await req.json();
    const modelName = requestedModel || 'gemini-3-flash-preview';

    // 构造请求体
    const requestBody = {
      model: modelName,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ],
      stream: shouldStream,
      ...config
    };

    // 调用你的 API
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API 请求失败，状态码: ${response.status}`);
    }

    // 处理流式响应
    if (shouldStream) {
      return new Response(response.body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    } 
    // 处理非流式响应
    else {
      const data = await response.json();
      // 兼容文本和图片生成的返回格式
      if (modelName.includes('image')) {
        return NextResponse.json({ 
          image: data.image || `data:image/png;base64,${data.base64}` 
        });
      } else {
        return NextResponse.json({ 
          text: data.choices?.[0]?.message?.content || data.text 
        });
      }
    }

  } catch (error: any) {
    console.error("API 调用错误:", error);
    return NextResponse.json({
      error: {
        code: 500,
        message: error.message || "API 请求失败",
        status: "INTERNAL"
      }
    }, { status: 500 });
  }
}
