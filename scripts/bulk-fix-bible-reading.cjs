// Move 1 bulk-fix: run from project root with: node scripts/bulk-fix-bible-reading.js
// Idempotent. Safe to run multiple times.
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'); process.exit(1); }

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function run() {
  // 1. Force can_do_bible_reading=false for all women
  const { data: womenFixed, error: e1 } = await supabase
    .from('users')
    .update({ can_do_bible_reading: false })
    .eq('gender', 'female')
    .eq('can_do_bible_reading', true)
    .select('id');
  if (e1) { console.error('Error updating women:', e1); process.exit(1); }
  console.log(`Women can_do_bible_reading→false: ${(womenFixed || []).length}`);

  // 2. Get female user ids
  const { data: women, error: e2 } = await supabase.from('users').select('id').eq('gender', 'female');
  if (e2) { console.error('Error fetching women:', e2); process.exit(1); }
  const femaleIds = (women || []).map(u => u.id);
  console.log(`Total female users: ${femaleIds.length}`);

  if (femaleIds.length > 0) {
    // 3. Clear bible_reading parts assigned to women (only FUTURE meetings — don't touch history)
    const today = new Date().toISOString().slice(0, 10);
    const { data: futureMeetings } = await supabase.from('meetings').select('id').gte('date', today);
    const futureMeetingIds = (futureMeetings || []).map(m => m.id);

    if (futureMeetingIds.length > 0) {
      const { data: partsFixed, error: e3 } = await supabase
        .from('meeting_parts')
        .update({ assigned_user_id: null })
        .eq('part_type', 'bible_reading')
        .in('meeting_id', futureMeetingIds)
        .in('assigned_user_id', femaleIds)
        .select('id');
      if (e3) { console.error('Error clearing bible reading assignments:', e3); process.exit(1); }
      console.log(`Bible reading parts cleared (assigned_user_id): ${(partsFixed || []).length}`);

      // student_id column may not exist in this schema — skip if absent
      try {
        const { data: studentFixed, error: e4 } = await supabase
          .from('meeting_parts')
          .update({ student_id: null })
          .eq('part_type', 'bible_reading')
          .in('meeting_id', futureMeetingIds)
          .in('student_id', femaleIds)
          .select('id');
        if (e4 && e4.code !== 'PGRST204') { console.error('Error clearing bible reading student_id:', e4); process.exit(1); }
        if (!e4) console.log(`Bible reading parts cleared (student_id): ${(studentFixed || []).length}`);
        else console.log('student_id column not found — skipped (not in schema).');
      } catch (_) { console.log('student_id column not found — skipped.'); }
    } else {
      console.log('No future meetings found — no parts to clear.');
    }
  }

  // 4. Deduplicate meetings: find (date, congregation_id) pairs with >1 meeting
  const { data: allMeetings, error: e5 } = await supabase
    .from('meetings')
    .select('id, date, congregation_id')
    .order('date', { ascending: true });
  if (e5) { console.error('Error fetching meetings:', e5); process.exit(1); }

  // Group by date+congregation
  const groups = {};
  for (const m of (allMeetings || [])) {
    const key = `${m.date}|${m.congregation_id}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }

  let duplicatesRemoved = 0;
  for (const [key, group] of Object.entries(groups)) {
    if (group.length <= 1) continue;
    console.log(`\nDuplicate group: ${key} — ${group.length} meetings`);

    // Get parts count for each
    const withParts = await Promise.all(group.map(async (m) => {
      const { count } = await supabase
        .from('meeting_parts')
        .select('id', { count: 'exact', head: true })
        .eq('meeting_id', m.id)
        .not('assigned_user_id', 'is', null);
      return { ...m, assignedCount: count || 0 };
    }));

    withParts.sort((a, b) => b.assignedCount - a.assignedCount || a.id.localeCompare(b.id));
    const [keeper, ...toDelete] = withParts;

    console.log(`  Keeper: ${keeper.id} (${keeper.assignedCount} assigned parts)`);
    for (const dup of toDelete) {
      console.log(`  Deleting: ${dup.id} (${dup.assignedCount} assigned parts)`);
      if (dup.assignedCount > 0) {
        console.error(`  ABORT: duplicate also has assigned parts! IDs: ${keeper.id} vs ${dup.id} — not deleting. Fix manually.`);
        continue;
      }
      const { error: delParts } = await supabase.from('meeting_parts').delete().eq('meeting_id', dup.id);
      if (delParts) { console.error('Error deleting parts:', delParts); continue; }
      const { error: delMeeting } = await supabase.from('meetings').delete().eq('id', dup.id);
      if (delMeeting) { console.error('Error deleting meeting:', delMeeting); continue; }
      duplicatesRemoved++;
      console.log(`  Deleted duplicate ${dup.id}`);
    }
  }
  console.log(`\nDuplicates removed: ${duplicatesRemoved}`);
  console.log('\nDone. Run again to confirm idempotence (all counts should be 0).');
}

run().catch(err => { console.error(err); process.exit(1); });
