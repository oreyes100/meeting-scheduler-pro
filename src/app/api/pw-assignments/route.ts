import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext } from '@/lib/serverContext';

// TODO: pw_assignments table needs congregation_id column before filtering can be applied
export async function GET(request: Request) {
  try {
    await getSessionContext();
    const { searchParams } = new URL(request.url);
    const weekDate = searchParams.get('week');

    let query = sb()
      .from('pw_assignments')
      .select(`
        *,
        user:users!pw_assignments_user_id_fkey(id, first_name, last_name, name),
        shift:pw_shifts!pw_assignments_shift_id_fkey(id, location_id, day_of_week, start_time, end_time, persons_needed)
      `);

    if (weekDate) {
      query = query.eq('week_date', weekDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    const assignments = (data || []).map(a => ({
      ...a,
      user: Array.isArray(a.user) ? a.user[0] : a.user,
      shift: Array.isArray(a.shift) ? a.shift[0] : a.shift,
    }));

    return NextResponse.json({ assignments });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch assignments';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await getSessionContext();
    const body = await request.json();

    const { data, error } = await sb()
      .from('pw_assignments')
      .insert({
        shift_id: body.shift_id,
        week_date: body.week_date,
        user_id: body.user_id,
      })
      .select(`
        *,
        user:users!pw_assignments_user_id_fkey(id, first_name, last_name, name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({
      assignment: { ...data, user: Array.isArray(data.user) ? data.user[0] : data.user },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create assignment';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await getSessionContext();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { error } = await sb().from('pw_assignments').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete assignment';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
