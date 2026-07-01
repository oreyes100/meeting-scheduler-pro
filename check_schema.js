import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function checkSchema() {
  try {
    const { data: cols, error } = await supabase
      .from('information_schema.columns')
      .select('table_name, column_name, data_type')
      .eq('table_schema', 'public');

    if (error) throw error;

    const tables = {};
    cols.forEach(c => {
      if (!tables[c.table_name]) tables[c.table_name] = [];
      tables[c.table_name].push(`${c.column_name} (${c.data_type})`);
    });
    console.log(JSON.stringify(tables, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkSchema();
