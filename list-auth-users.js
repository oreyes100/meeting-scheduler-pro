// list-auth-users.js
// Lists all Supabase Auth users to see what exists
// Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Initialize Supabase client with service role key (admin privileges)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function listUsers() {
  console.log('🔄 Listing all Supabase Auth users...');
  
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Failed to list users:', error.message);
      process.exit(1);
    }
    
    console.log(`\n📊 Found ${data.users.length} user(s):\n`);
    
    data.users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      
      // Safe date formatting
      let createdDate = 'Invalid date';
      if (user.created_at) {
        try {
          createdDate = new Date(user.created_at * 1000).toISOString();
        } catch (e) {
          createdDate = user.created_at;
        }
      }
      console.log(`   Created: ${createdDate}`);
      
      let confirmedDate = 'Never';
      if (user.email_confirmed_at) {
        try {
          confirmedDate = new Date(user.email_confirmed_at * 1000).toISOString();
        } catch (e) {
          confirmedDate = user.email_confirmed_at;
        }
      }
      console.log(`   Email Confirmed: ${confirmedDate}`);
      
      let phoneConfirmed = 'Never';
      if (user.phone_confirmed_at) {
        try {
          phoneConfirmed = new Date(user.phone_confirmed_at * 1000).toISOString();
        } catch (e) {
          phoneConfirmed = user.phone_confirmed_at;
        }
      }
      console.log(`   Phone Confirmed: ${phoneConfirmed}`);
      console.log('   ---');
    });
    
    // Check specifically for our test emails
    const testEmails = [
      'test@example.com',
      'assistantA@example.com',
      'assistantB@example.com',
      'assistantC@example.com'
    ];
    
    console.log('\n🔍 Checking for test emails:');
    testEmails.forEach(email => {
      const found = data.users.some(u => u.email === email);
      console.log(`   ${email}: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    });
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

listUsers();