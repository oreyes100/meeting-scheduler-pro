import { NextResponse } from 'next/server';

// Migration route not available in VPS variant (data imported via import-to-sqlite.cjs)
export async function POST() {
  return NextResponse.json({ error: 'Migration not available in VPS variant' }, { status: 410 });
}
