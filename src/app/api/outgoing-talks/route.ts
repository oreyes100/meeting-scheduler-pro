import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('outgoing_talks')
      .select(`*, user:users!outgoing_talks_user_id_fkey(id, first_name, last_name, name)`)
      .order('week_date', { ascending: true });
    if (error) throw error;
    const talks = (data || []).map(t => ({ ...t, user: Array.isArray(t.user) ? t.user[0] : t.user }));
    return NextResponse.json({ talks });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { data, error } = await supabase
      .from('outgoing_talks')
      .insert({ week_date: body.week_date, user_id: body.user_id, congregation_name: body.congregation_name, talk_number: body.talk_number || null, notes: body.notes || null })
      .select(`*, user:users!outgoing_talks_user_id_fkey(id, first_name, last_name, name)`)
      .single();
    if (error) throw error;
    return NextResponse.json({ talk: { ...data, user: Array.isArray(data.user) ? data.user[0] : data.user } });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
