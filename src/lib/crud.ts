import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function sb() {
  return createClient(supabaseUrl, supabaseKey);
}

const ALLOWED: Record<string, string[]> = {
  maintenance_tasks: ['title', 'category', 'link', 'description', 'done', 'assigned_to', 'sort_order'],
  circuit_overseer_visits: ['week_date', 'host_id', 'co_companions', 'wife_companions', 'activities', 'notes'],
  memorial_roles: ['name', 'positions', 'assigned_to', 'sort_order'],
  congregation_events: ['type', 'name', 'description', 'link', 'start_date', 'end_date', 'single_day', 'show_start_time', 'show_end_time', 'group_name'],
};

function pick(table: string, body: any) {
  const cols = ALLOWED[table] || [];
  const out: Record<string, any> = {};
  for (const c of cols) if (c in body) out[c] = body[c];
  return out;
}

export async function listRows(table: string, order = 'created_at', congregationId?: string | null) {
  try {
    let query = sb().from(table).select('*').order(order, { ascending: true });
    if (congregationId) query = query.eq('congregation_id', congregationId);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ rows: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function createRow(table: string, body: any, congregationId?: string | null) {
  try {
    const row = pick(table, body);
    if (congregationId) row.congregation_id = congregationId;
    const { data, error } = await sb().from(table).insert(row).select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function updateRow(table: string, id: string, body: any, congregationId?: string | null) {
  try {
    const patch = pick(table, body);
    const hasUpdatedAt = ['maintenance_tasks', 'circuit_overseer_visits'];
    if (hasUpdatedAt.includes(table)) patch.updated_at = new Date().toISOString();
    let query = sb().from(table).update(patch).eq('id', id);
    if (congregationId) query = query.eq('congregation_id', congregationId);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function deleteRow(table: string, id: string, congregationId?: string | null) {
  try {
    let query = sb().from(table).delete().eq('id', id);
    if (congregationId) query = query.eq('congregation_id', congregationId);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
