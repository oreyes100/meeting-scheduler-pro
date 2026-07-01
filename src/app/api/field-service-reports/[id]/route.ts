import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { id } = await params;
    const body = await request.json();

    const { error } = await supabase
      .from('field_service_reports')
      .update({
        participated: body.participated ?? false,
        is_auxiliary_pioneer: body.is_auxiliary_pioneer ?? false,
        hours: body.hours ?? null,
        bible_studies: body.bible_studies ?? null,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update report';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { id } = await params;

    const { error } = await supabase.from('field_service_reports').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete report';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
