// reset-test-passwords.js
// Resets passwords for existing Supabase Auth users
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

// Test users to reset: email -> new password
const testUsers = [
  { email: 'test@example.com', password: 'TestPassword123!' },
  { email: 'assistantA@example.com', password: 'AssistantAPassword123!' },
  { email: 'assistantB@example.com', password: 'AssistantBPassword123!' },
  { email: 'assistantC@example.com', password: 'AssistantCPassword123!' },
];

async function resetPasswords() {
  console.log('🔄 Resetting passwords for existing Supabase Auth users...');
  
  const results = [];
  
  for (const user of testUsers) {
    try {
      // First, get the user by email
      const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error(`❌ Failed to list users:`, listError.message);
        results.push({ email: user.email, success: false, error: listError.message });
        continue;
      }
      
      // Find the user with matching email
      const targetUser = usersData.users.find(u => u.email === user.email);
      
      if (!targetUser) {
        console.error(`❌ User not found: ${user.email}`);
        results.push({ email: user.email, success: false, error: 'User not found' });
        continue;
      }
      
      // Update the password
      const { error } = await supabase.auth.admin.updateUserById(
        targetUser.id,
        { password: user.password }
      );
      
      if (error) {
        console.error(`❌ Failed to reset password for ${user.email}:`, error.message);
        results.push({ email: user.email, success: false, error: error.message });
      } else {
        console.log(`✅ Reset password for: ${user.email}`);
        results.push({ email: user.email, success: true, userId: targetUser.id });
      }
    } catch (err) {
      console.error(`❌ Error processing user ${user.email}:`, err.message);
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
    console.log('\n🎉 All test user passwords reset successfully!');
    console.log('\n🔑 Test Credentials:');
    testUsers.forEach(user => {
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log('   ---');
    });
    console.log('💡 You can now log in at http://localhost:3000');
  }
}

resetPasswords();