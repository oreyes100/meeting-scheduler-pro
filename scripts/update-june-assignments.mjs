// One-off: update June 2026 meetings with assignments + titles/durations
// from the printed program the user provided.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

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

// 1. Load all users, build a normalized lookup keyed by display_name (and
//    aliases for fuzzy matching).
const { data: users, error: uErr } = await sb.from('users').select('id, first_name, last_name, display_name, gender').eq('is_active', true);
if (uErr) { console.error(uErr); process.exit(1); }

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.\s,]/g, '').trim();
}
const userByNorm = new Map();
for (const u of users) {
  const candidates = [u.display_name, `${u.first_name} ${u.last_name}`, u.first_name, u.last_name].filter(Boolean);
  for (const c of candidates) {
    userByNorm.set(normalize(c), u);
  }
}
const findUser = (displayName) => {
  if (!displayName) return null;
  const u = userByNorm.get(normalize(displayName));
  if (!u) console.warn(`  ⚠️  Not found: ${displayName}`);
  return u;
};

// 2. Load meetings
const { data: meetings } = await sb.from('meetings').select('id, date').gte('date', '2026-06-01').lte('date', '2026-06-22').order('date');
const mid = (d) => meetings.find(m => m.date === d)?.id;

// 3. Define the desired state per meeting. This is the source of truth from
//    the image the user sent.
const PLAN = {
  '2026-06-01': {
    meeting: {
      chairman: 'Emmanuel Rendón',
      opening_prayer: 'Emmanuel Rendón',
      closing_prayer: 'Daniel García',
      cbs_conductor: 'Xavier Angeles',
      cbs_reader: 'Erick Rauda',
    },
    parts: {
      1: { title: '“No te dejes intimidar [...], porque ‘yo estoy contigo’”', assignee: 'Alejandro Guido' },
      2: { title: 'Busquemos perlas escondidas: Jeremías 1-3', assignee: 'Israel Martínez' },
      3: { title: 'Lectura de la Biblia: Jer 3:14-25', assignee: 'Miguel A. Cortes' },
      4: { title: 'Empiece conversaciones (DE CASA EN CASA)', student: 'Rubí Hernández', assistant: 'Rosario Rosales' },
      5: { title: 'Haga revisitas (DE CASA EN CASA)', student: 'Isabel Velázquez', assistant: 'Martha E. Juárez' },
      6: { title: 'Haga discípulos', student: 'Hector Morales', assistant: 'Jamin Rendón' },
      7: { title: '¡Sé valiente como Jeremías!', assignee: 'Martin Morales' },
      8: { title: '“Listos para presentar una defensa [...] con apacibilidad y profundo respeto”', assignee: 'Jorge Reyes' },
    },
    // CBS is part 9 — separate from the part-type loop because it's stored
    // on the meetings row, not on a meeting_part.
  },
  '2026-06-08': {
    meeting: {
      chairman: 'Xavier Angeles',
      opening_prayer: 'Xavier Angeles',
      closing_prayer: 'David Morales',
      cbs_conductor: 'Martin Morales',
      cbs_reader: 'Aarón Angeles',
    },
    parts: {
      1: { title: 'No nos enfermemos espiritualmente como les pasó a los de Judá', assignee: 'Israel Martínez' },
      2: { title: 'Busquemos perlas escondidas: Jeremías 4-6', assignee: 'Daniel García' },
      3: { title: 'Lectura de la Biblia: Jer 5:1-11', assignee: null }, // Sala principal — unassigned
      4: { title: 'Empiece conversaciones (PREDICACIÓN PÚBLICA)', student: 'Rocío Ávila', assistant: 'Ángela Pineda Olorza' },
      5: { title: 'Empiece conversaciones (DE CASA EN CASA)', student: 'Lucero Hernández', assistant: 'Domitila Hernández' },
      6: { title: 'Haga revisitas (PREDICACIÓN INFORMAL)', student: 'Edgar Moreno', assistant: 'Jose L. Aguilar' },
      7: { title: 'Explique sus creencias (Escenificación)', student: 'Gladys Rendón', assistant: 'Victoria Cruz' },
      8: { title: 'Proteja su corazón de la información falsa', assignee: 'Alejandro Guido' },
      9: { title: 'Necesidades de la congregación', assignee: 'Jorge Reyes' },
    },
  },
  '2026-06-15': {
    meeting: {
      chairman: 'Israel Martínez',
      opening_prayer: 'Jorge Reyes',
      closing_prayer: 'Emmanuel Rendón',
      cbs_conductor: 'Alejandro Guido',
      cbs_reader: 'Jamin Rendón',
    },
    parts: {
      1: { title: 'No respetaron el templo de Jehová', assignee: 'Jorge Reyes' },
      2: { title: 'Busquemos perlas escondidas: Jeremías 7, 8', assignee: 'David Morales' },
      3: { title: 'Lectura de la Biblia', assignee: 'Juan M. Zavala' },
      4: { title: 'Empiece conversaciones', student: 'Adriana Gaona', assistant: 'Gracia Sagrero' },
      5: { title: 'Haga revisitas', student: 'Karen Rauda', assistant: 'Yesenia Rendón' },
      6: { title: 'Haga discípulos', student: 'Anel Mendiola', assistant: 'Naidelith F. Gaona' },
      7: { title: '¿Cómo podemos demostrar que respetamos el Salón del Reino?', assignee: 'Martin Morales' },
      8: { title: 'Cómo usamos las donaciones: Mantenemos nuestros Salones del Reino en buen estado', assignee: 'Xavier Angeles' },
    },
  },
  '2026-06-22': {
    meeting: {
      chairman: 'Martin Morales',
      opening_prayer: 'Martin Morales',
      closing_prayer: 'Daniel García',
      cbs_conductor: 'Israel Martínez',
      cbs_reader: 'Francisco Moreno',
    },
    parts: {
      1: { title: '¿De qué presumirá usted?', assignee: 'Xavier Angeles' },
      2: { title: 'Busquemos perlas escondidas: Jeremías 9, 10', assignee: 'Alejandro Guido' },
      3: { title: 'Lectura de la Biblia', assignee: 'Nathan García' },
      4: { title: 'Empiece conversaciones', student: 'Nancy Morales', assistant: 'Elia Ortega' },
      5: { title: 'Empiece conversaciones', student: 'Yessica Hernández', assistant: 'Belén Orozco' },
      6: { title: 'Haga revisitas', student: 'Elizabeth Díaz', assistant: 'V. Lizeth Angeles' },
      7: { title: 'No nos dejemos engañar, apoyemos el Reino de Dios (Jer. 10:23)', assignee: 'Jorge Reyes' },
    },
  },
};

async function apply() {
  for (const [date, plan] of Object.entries(PLAN)) {
    const mId = mid(date);
    if (!mId) { console.error(`No meeting for ${date}`); continue; }
    console.log(`\n📅 ${date} (${mId.slice(0,8)})`);

    // Load existing parts
    const { data: parts, error: pErr } = await sb.from('meeting_parts').select('*').eq('meeting_id', mId).order('part_number');
    if (pErr) { console.error(pErr); continue; }
    const existingByNumber = new Map(parts.map(p => [p.part_number, p]));

    // Update meeting-level fields
    const m = plan.meeting;
    const meetingUpdate = {};
    if (m.chairman) meetingUpdate.chairman_id = findUser(m.chairman)?.id || null;
    if (m.opening_prayer) meetingUpdate.opening_prayer_id = findUser(m.opening_prayer)?.id || null;
    if (m.closing_prayer) meetingUpdate.closing_prayer_id = findUser(m.closing_prayer)?.id || null;
    if (m.cbs_conductor) meetingUpdate['cbs_conducer_id'] = findUser(m.cbs_conductor)?.id || null;
    if (m.cbs_reader) meetingUpdate.cbs_reader_id = findUser(m.cbs_reader)?.id || null;
    if (Object.keys(meetingUpdate).length) {
      const { error: mErr } = await sb.from('meetings').update(meetingUpdate).eq('id', mId);
      if (mErr) { console.error(`  meeting update err:`, mErr); }
      else console.log(`  ✅ Meeting: chairman=${m.chairman}, prayers=${m.opening_prayer}/${m.closing_prayer}, cbs=${m.cbs_conductor}/${m.cbs_reader}`);
    }

    // For 2026-06-15 we need to ADD part #8 (currently DB only has 1..7 + 8=CBS).
    // The CBS part in DB is part_number=8; we need to renumber to 9 and insert
    // new part #8 in between.
    if (date === '2026-06-15') {
      const cbs = parts.find(p => p.part_type === 'cbs');
      if (cbs && cbs.part_number === 8) {
        // Insert new part 8 first (give it a temporary id we can shift)
        const newPart = {
          meeting_id: mId,
          part_number: 8,
          part_type: 'living_part',
          class_type: 'main',
          role: 'speaker',
          title: 'Cómo usamos las donaciones: Mantenemos nuestros Salones del Reino en buen estado',
          duration_minutes: 10,
          assigned_user_id: findUser('Xavier Angeles')?.id || null,
        };
        const { data: inserted, error: iErr } = await sb.from('meeting_parts').insert(newPart).select().single();
        if (iErr) { console.error(`  insert part 8 err:`, iErr); }
        else { console.log(`  ✅ Inserted new living part #8`); }
        // Now move the CBS to part_number 9
        const { error: uErr } = await sb.from('meeting_parts').update({ part_number: 9 }).eq('id', cbs.id);
        if (uErr) { console.error(`  renumber cbs err:`, uErr); }
        else { console.log(`  ✅ Renumbered CBS from 8 → 9`); }
        // Refresh
        const { data: refreshed } = await sb.from('meeting_parts').select('*').eq('meeting_id', mId).order('part_number');
        existingByNumber.clear();
        for (const p of refreshed) existingByNumber.set(p.part_number, p);
      }
    }

    // Apply each planned part
    for (const [numStr, spec] of Object.entries(plan.parts)) {
      const num = Number(numStr);
      const part = existingByNumber.get(num);
      if (!part) { console.warn(`  ⚠️  Part #${num} not found in DB`); continue; }

      const update = {};
      if (spec.title && spec.title !== part.title) update.title = spec.title;
      const assigneeId = spec.assignee ? findUser(spec.assignee)?.id || null : null;
      const studentId = spec.student ? findUser(spec.student)?.id || null : null;
      const assistantId = spec.assistant ? findUser(spec.assistant)?.id || null : null;
      const newAssigned = spec.assignee !== undefined ? assigneeId : studentId;
      if (newAssigned !== part.assigned_user_id) update.assigned_user_id = newAssigned;
      if (spec.assistant !== undefined && assistantId !== part.assistant_user_id) update.assistant_user_id = assistantId;

      if (Object.keys(update).length) {
        const { error: uErr } = await sb.from('meeting_parts').update(update).eq('id', part.id);
        if (uErr) { console.error(`  part #${num} err:`, uErr); }
        else {
          const who = spec.student ? `${spec.student} + ${spec.assistant}` : spec.assignee || '(unassigned)';
          console.log(`  ✅ Part #${num}: ${who}`);
        }
      } else {
        console.log(`  ·  Part #${num} unchanged`);
      }
    }

    // Log to part_history so future auto-assign runs respect these roles.
    // NOTE: part_history.role is currently restricted to ('speaker','student')
    // and the table is missing the part_type / assigned_date columns that
    // auto-assign-service.js writes — so we only log student parts (role
    // 'student') here. The full per-role fix needs a separate migration.
    const { data: finalParts } = await sb.from('meeting_parts').select('*').eq('meeting_id', mId).order('part_number');
    const historyRows = [];
    for (const p of finalParts) {
      if (p.assigned_user_id && p.part_type === 'student_part') {
        historyRows.push({ meeting_id: mId, user_id: p.assigned_user_id, role: 'student', class_type: p.class_type });
      }
    }
    if (historyRows.length) {
      await sb.from('part_history').delete().eq('meeting_id', mId);
      const { error: hErr } = await sb.from('part_history').insert(historyRows);
      if (hErr) console.error(`  history err:`, hErr);
      else console.log(`  📝 Wrote ${historyRows.length} part_history rows (student parts only)`);
    }
  }
}

apply().catch(e => { console.error(e); process.exit(1); });
