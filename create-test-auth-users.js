// create-test-auth-users.js
// Creates Supabase Auth users for test emails with specified passwords
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

// Test users to create: email -> password
const testUsers = [
  { email: 'test@example.com', password: 'TestPassword123!' },
  { email: 'assistantA@example.com', password: 'AssistantAPassword123!' },
  { email: 'assistantB@example.com', password: 'AssistantBPassword123!' },
  { email: 'assistantC@example.com', password: 'AssistantCPassword123!' },
];

async function createAuthUsers() {
  console.log('🔄 Creating Supabase Auth users for test emails...');
  
  const results = [];
  
  for (const user of testUsers) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // Skip email confirmation for testing
      });
      
      if (error) {
        console.error(`❌ Failed to create user ${user.email}:`, error.message);
        results.push({ email: user.email, success: false, error: error.message });
      } else {
        console.log(`✅ Created auth user: ${user.email}`);
        results.push({ email: user.email, success: true, userId: data.user.id });
      }
    } catch (err) {
      console.error(`❌ Error creating user ${user.email}:`, err.message);
      results.push({ email: user.email, success: false, error: err.message });
    }
  }
  
  // Summary
  console.log('\n📊 Summary:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n⚠️  Failed users:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.email}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All test auth users created successfully!');
    console.log('\n🔑 Test Credentials:');
    testUsers.forEach(user => {
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log('   ---');
    });
    console.log('💡 You can now log in at http://localhost:3000');
  }
}

createAuthUsers();