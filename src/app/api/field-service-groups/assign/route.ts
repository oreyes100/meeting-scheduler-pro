import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';

// Asigna un publicador a un grupo de predicación (o lo quita de todos si group_id null)
export async function POST(request: Request) {
  try {
    const { user_id, group_id } = await request.json();
    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    const supabase = sb();

    // Quitar membresías previas
    const { error: delErr } = await supabase.from('field_service_group_members').delete().eq('user_id', user_id);
    if (delErr) throw delErr;

    if (group_id) {
      const { error } = await supabase.from('field_service_group_members').insert({ user_id, group_id, role: 'member' });
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
