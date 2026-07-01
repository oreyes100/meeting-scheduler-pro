// Backfill song numbers for all meetings based on the PROGRAMS dictionary.
// Walks every meeting, resolves the program for its week, and writes
// song_opening/song_middle/song_closing to the meeting row.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { getProgram, getMondayOfWeek } from '../src/lib/programs.ts';

const envVars = {};
function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) envVars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv('.env'); loadEnv('.env.local');
const sb = createClient(envVars.SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

const { data: meetings, error } = await sb
  .from('meetings')
  .select('id, date, song_opening, song_middle, song_closing')
  .order('date');
if (error) { console.error(error); process.exit(1); }

let updated = 0;
let unchanged = 0;
let noProgram = 0;
for (const m of meetings) {
  const program = getProgram(m.date);
  const monday = getMondayOfWeek(m.date);
  const wantOpening = program.songOpening;
  const wantMiddle  = program.songMiddle;
  const wantClosing = program.songClosing;
  const isFallback = !program.mondayDate;
  if (isFallback && (m.song_opening ?? 0) === 1 && (m.song_middle ?? 0) === 1 && (m.song_closing ?? 0) === 1) {
    noProgram++;
    continue;
  }
  if (m.song_opening === wantOpening && m.song_middle === wantMiddle && m.song_closing === wantClosing) {
    unchanged++;
    continue;
  }
  const { error: uErr } = await sb.from('meetings').update({
    song_opening: wantOpening,
    song_middle:  wantMiddle,
    song_closing: wantClosing,
  }).eq('id', m.id);
  if (uErr) { console.error(`  err ${m.date}:`, uErr.message); continue; }
  console.log(`  ${m.date}  (monday=${monday})  →  ${wantOpening}, ${wantMiddle}, ${wantClosing}`);
  updated++;
}
console.log(`\nUpdated: ${updated}, Unchanged: ${unchanged}, Skipped (no program): ${noProgram}`);
