
import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import { supabase } from "../../../../lib/supabase";

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { blockId, shotDescription, imageUrl } = await req.json();

    // 1. 先获取当前的 block 数据
    const { data: block, error: fetchError } = await supabase
      .from('scripts')
      .select('scene_images')
      .eq('id', blockId)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    // 2. 追加新的图片数据
    const newImage = {
      id: Math.random().toString(36).substring(7),
      shotDescription,
      imageUrl,
      created_at: new Date().toISOString()
    };

    const updatedImages = block.scene_images ? [...block.scene_images, newImage] : [newImage];

    // 3. 写回数据库
    const { data: updatedBlock, error: updateError } = await supabase
      .from('scripts')
      .update({ scene_images: updatedImages })
      .eq('id', blockId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 格式化返回，确保字段名一致（数据库通常是下划线，前端是骆驼拼写）
    return NextResponse.json({
      ...updatedBlock,
      sceneImages: updatedBlock.scene_images
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
