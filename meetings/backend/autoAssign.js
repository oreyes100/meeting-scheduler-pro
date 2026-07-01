import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { runAutoAssignment } from '../../src/services/auto-assign-service.js';

// Load environment variables from .env and .env.local files
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Automatically assigns users to a meeting. Refactored to delegate logic
 * to the shared runAutoAssignment service.
 * 
 * @param {string} meetingId 
 */
export async function autoAssign(meetingId) {
  return runAutoAssignment(meetingId, supabase);
}
