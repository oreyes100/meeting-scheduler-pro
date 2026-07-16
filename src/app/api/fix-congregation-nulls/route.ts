import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/serverContext';
import { sb } from '@/lib/crud';

export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx.isSuperAdmin) return NextResponse.json({ error: 'Super-admin required' }, { status: 403 });

  const { data: defaultCongre } = await sb()
    .from('congregations')
    .select('id')
    .eq('name', 'La Estación')
    .limit(1)
    .single();

  if (!defaultCongre?.id) return NextResponse.json({ error: 'Default congregation not found' }, { status: 500 });

  const tables = [
    'meetings', 'weekend_meetings', 'field_service_groups', 'field_service_meetings',
    'field_service_reports', 'territories', 'public_speakers', 'outgoing_talks',
    'pw_locations', 'congregation_tasks', 'cleaning_assignments', 'maintenance_tasks',
    'circuit_overseer_visits', 'memorial_roles', 'congregation_events', 'congregation_roles',
    'meeting_attendance', 'users',
  ];

  const results: Record<string, number> = {};
  for (const table of tables) {
    const { data } = await sb()
      .from(table)
      .update({ congregation_id: defaultCongre.id })
      .is('congregation_id', null)
      .select('id');
    results[table] = data?.length ?? 0;
  }

  return NextResponse.json({ fixed: results, default_congregation_id: defaultCongre.id });
}
