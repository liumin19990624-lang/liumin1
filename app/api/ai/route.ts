
// This file has been deprecated in favor of /app/api/chat/route.ts
// to unify the credit-deduction and proxy logic.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: "Please use /api/chat instead." }, { status: 404 });
}
