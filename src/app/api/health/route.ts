import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';


export async function GET() {
  try {
    const supabase = sb();
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
