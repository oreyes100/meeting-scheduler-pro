import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Restore meeting_parts from the latest snapshot (undo rebuild).
// Finds the latest unrestored snapshot, deletes current parts,
// re-inserts the snapshot data, and restores songs.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Find the latest unrestored snapshot for this meeting
    const { data: snapshot, error: snapFetchError } = await supabase
      .from('part_snapshots')
      .select('*')
      .eq('meeting_id', id)
      .eq('restored', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapFetchError) throw snapFetchError;
    if (!snapshot) {
      return NextResponse.json({ error: 'No snapshot found to restore' }, { status: 404 });
    }

    const snapshotData = snapshot.snapshot_data as {
      parts: Record<string, unknown>[];
      songs?: { song_opening?: number; song_middle?: number; song_closing?: number };
    };

    // 2. Delete current meeting_parts
    const { error: dError } = await supabase
      .from('meeting_parts')
      .delete()
      .eq('meeting_id', id);
    if (dError) throw dError;

    // 3. Re-insert parts from snapshot (strip id so Supabase generates fresh UUIDs)
    const partsToRestore = (snapshotData.parts || []).map((p: Record<string, unknown>) => {
      const { id: _oldId, meeting_id: _mId, ...rest } = p;
      return { ...rest, meeting_id: id };
    });

    if (partsToRestore.length > 0) {
      const { error: iError } = await supabase
        .from('meeting_parts')
        .insert(partsToRestore);
      if (iError) throw iError;
    }

    // 4. Restore songs if snapshot has them
    if (snapshotData.songs) {
      await supabase
        .from('meetings')
        .update({
          song_opening: snapshotData.songs.song_opening ?? null,
          song_middle: snapshotData.songs.song_middle ?? null,
          song_closing: snapshotData.songs.song_closing ?? null,
        })
        .eq('id', id);
    }

    // 5. Mark snapshot as restored
    await supabase
      .from('part_snapshots')
      .update({ restored: true, restored_at: new Date().toISOString() })
      .eq('id', snapshot.id);

    return NextResponse.json({
      success: true,
      partsRestored: partsToRestore.length,
      snapshotId: snapshot.id,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to undo rebuild';
    console.error('undo-rebuild error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
