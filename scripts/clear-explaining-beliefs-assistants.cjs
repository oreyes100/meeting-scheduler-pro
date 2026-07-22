// Idempotent. Clears assistant_user_id from future explaining_beliefs parts.
// Run from project root: node scripts/clear-explaining-beliefs-assistants.cjs
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing env vars'); process.exit(1); }

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function run() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: futureMeetings } = await supabase.from('meetings').select('id').gte('date', today);
  const ids = (futureMeetings || []).map(m => m.id);
  if (!ids.length) { console.log('No future meetings.'); return; }

  const { data, error } = await supabase
    .from('meeting_parts')
    .update({ assistant_user_id: null })
    .eq('student_part_type', 'explaining_beliefs')
    .not('assistant_user_id', 'is', null)
    .in('meeting_id', ids)
    .select('id');

  if (error) { console.error('Error:', error); process.exit(1); }
  console.log(`Assistants cleared: ${(data || []).length}`);
  console.log('Done. Run again to confirm idempotence (should show 0).');
}

run().catch(err => { console.error(err); process.exit(1); });
