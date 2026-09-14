import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext } from '@/lib/serverContext';

export interface RoleDef {
  role_key: string;
  label: string;
  category: string;
  sub_label?: string;
}

export const ROLES_CATALOG: RoleDef[] = [
  // Cuerpo de Ancianos
  { role_key: 'elders_coordinator',        label: 'Coordinador del Cuerpo de Ancianos',    category: 'Cuerpo de Ancianos' },
  { role_key: 'watchtower_conductor',      label: 'Conductor del Estudio de la Atalaya',   category: 'Cuerpo de Ancianos' },
  { role_key: 'secretary',                 label: 'Secretario',                            category: 'Cuerpo de Ancianos' },
  { role_key: 'service_overseer',          label: 'Superintendente de Servicio',           category: 'Cuerpo de Ancianos' },
  { role_key: 'life_ministry_coordinator', label: 'Coordinador VMC',                       category: 'Cuerpo de Ancianos' },
  // Secretaría
  { role_key: 'report_submission',         label: 'Envío de Informes',                     category: 'Secretaría' },
  { role_key: 'pioneer_analysis',          label: 'Analizar – Actividad de los Precursores', category: 'Secretaría' },
  { role_key: 'readers',                   label: 'Lectores',                              category: 'Secretaría', sub_label: 'S-21' },
  { role_key: 'publisher_cards',           label: 'Tarjetas de Publicador',                category: 'Secretaría', sub_label: 'S-21' },
  { role_key: 'congregation_archive',      label: 'Archivo de Congregación',               category: 'Secretaría', sub_label: 'S-61' },
  { role_key: 'correspondence',            label: 'Envío de Correspondencia',              category: 'Secretaría' },
  // Vida y Ministerio Cristiano
  { role_key: 'midweek_overseer',          label: 'Superintendente Reunión VMC',           category: 'Vida y Ministerio Cristiano' },
  { role_key: 'board_overseer',            label: 'Tablero',                               category: 'Vida y Ministerio Cristiano' },
  { role_key: 'aux_hall_overseer',         label: 'Sala Auxiliar',                         category: 'Vida y Ministerio Cristiano' },
  { role_key: 'auxiliary_counselor',       label: 'Consejero Auxiliar',                    category: 'Vida y Ministerio Cristiano' },
  // Servicio de Campo
  { role_key: 'pioneer_analysis_svc',      label: 'Analizar – Actividad de los Precursores', category: 'Servicio de Campo' },
  { role_key: 'reading_school',            label: 'Escuela de Lectura y Escritura',        category: 'Servicio de Campo' },
  { role_key: 'group_visits',              label: 'Visita a los Grupos',                   category: 'Servicio de Campo' },
  { role_key: 'co_visit_organizer',        label: 'Organizar Visita del SC',               category: 'Servicio de Campo' },
  { role_key: 'pioneer_training',          label: 'Capacitación P.P',                      category: 'Servicio de Campo' },
  // Reuniones y Salón
  { role_key: 'weekend_chairman',          label: 'Presidente (Fin de Semana)',            category: 'Reuniones y Salón' },
  { role_key: 'av_overseer',               label: 'Audio y Video',                         category: 'Reuniones y Salón' },
  { role_key: 'platform_overseer',         label: 'Plataforma',                            category: 'Reuniones y Salón' },
  { role_key: 'attendants_overseer',       label: 'Acomodadores',                          category: 'Reuniones y Salón' },
  { role_key: 'cleaning_overseer',         label: 'Limpieza',                              category: 'Reuniones y Salón' },
  // Administración
  { role_key: 'accounts_servant',          label: 'Intervención de Cuentas',               category: 'Administración' },
  { role_key: 'literature_servant',        label: 'Siervo de Publicaciones',               category: 'Administración' },
  { role_key: 'accounting',                label: 'Contabilidad',                          category: 'Administración' },
  { role_key: 'library',                   label: 'Biblioteca',                            category: 'Administración' },
  // Custom
  { role_key: 'custom',                    label: 'Personalizado',                         category: 'Otros' },
];

type Row = Record<string, unknown>;
type UserRow = { id: string; first_name: string | null; last_name: string | null; display_name: string | null };

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const scoped = sb().from('congregation_roles').select('*');
    const { data: existingRows, error } = ctx.congreId
      ? await scoped.eq('congregation_id', ctx.congreId)
      : await scoped.is('congregation_id', null);
    if (error) throw error;

    const rows = (existingRows || []) as Row[];
    const byKey: Record<string, Row> = Object.fromEntries(rows.map(r => [r.role_key as string, r]));

    const ids = new Set<string>();
    for (const r of rows) {
      for (const k of ['person_id', 'assistant_1_id', 'assistant_2_id']) {
        if (r[k]) ids.add(r[k] as string);
      }
    }
    const usersById: Record<string, UserRow> = {};
    if (ids.size > 0) {
      const { data: us } = await sb()
        .from('users')
        .select('id, first_name, last_name, display_name')
        .in('id', Array.from(ids));
      for (const u of (us || []) as UserRow[]) usersById[u.id] = u;
    }
    const roleUser = (id: string | null) => (id ? (usersById[id] ?? null) : null);

    const roles = ROLES_CATALOG.map(def => {
      const row = byKey[def.role_key];
      return {
        role_key: def.role_key,
        label: def.label,
        category: def.category,
        sub_label: def.sub_label ?? null,
        custom_label: (row?.custom_label as string | null) ?? null,
        person: roleUser((row?.person_id as string | null) ?? null),
        assistant_1: roleUser((row?.assistant_1_id as string | null) ?? null),
        assistant_2: roleUser((row?.assistant_2_id as string | null) ?? null),
      };
    });

    return NextResponse.json({ roles });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await request.json();
    const { role_key, person_id, assistant_1_id, assistant_2_id, custom_label } = body;
    if (!role_key) return NextResponse.json({ error: 'role_key is required' }, { status: 400 });

    const def = ROLES_CATALOG.find(r => r.role_key === role_key);
    const patch: Record<string, unknown> = {
      role_key,
      label: def?.label ?? role_key,
      updated_at: new Date().toISOString(),
    };
    if ('person_id' in body) patch.person_id = person_id ?? null;
    if ('assistant_1_id' in body) patch.assistant_1_id = assistant_1_id ?? null;
    if ('assistant_2_id' in body) patch.assistant_2_id = assistant_2_id ?? null;
    if ('custom_label' in body) patch.custom_label = custom_label ?? null;
    if (ctx.congreId) patch.congregation_id = ctx.congreId;

    // Nota: en Supabase el PK de congregation_roles es role_key (no compuesto),
    // así que el upsert es por role_key (limitación preexistente del esquema).
    const { error } = await sb().from('congregation_roles').upsert([patch], { onConflict: 'role_key' });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
