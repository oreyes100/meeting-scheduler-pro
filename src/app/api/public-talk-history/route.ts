import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext } from '@/lib/serverContext';

// TODO: public_talk_history table needs congregation_id column before filtering can be applied
export async function GET() {
  try {
    await getSessionContext();
    const { data, error } = await sb()
      .from('public_talk_history')
      .select('*, outline:public_talk_outlines(number, title)')
      .order('date', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ history: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
