
import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import { supabase } from "../../../lib/supabase";

export async function GET(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get('sourceId');

  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('user_id', userId)
    .eq('source_id', sourceId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { sourceId, episodes, content, continuityStatus } = await req.json();
    const { data, error } = await supabase
      .from('scripts')
      .insert({
        user_id: userId,
        source_id: sourceId,
        episodes,
        content,
        continuity_status: continuityStatus // 数据库字段通常是下划线
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, content, continuityStatus } = await req.json();
    const { data, error } = await supabase
      .from('scripts')
      .update({ 
        content, 
        continuity_status: continuityStatus,
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
