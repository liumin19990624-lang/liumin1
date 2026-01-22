
import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@clerk/nextjs/server";
import { supabase } from "../../../lib/supabase";

export async function GET() {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from('character_visuals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { descending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, description, imageUrl } = await req.json();
    const { data, error } = await supabase
      .from('character_visuals')
      .insert({
        user_id: userId,
        name,
        description,
        image_url: imageUrl
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  const { error } = await supabase
    .from('character_visuals')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
