/**
 * Create first admin user in a fresh SQLite database.
 * Usage: node scripts/create-admin.cjs --email admin@example.com --password "secret123" --name "Nombre Apellido"
 * Optional: --congregation "Nombre Congregación"
 */
require('dotenv').config({ path: '.env.production' });
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const crypto = require('crypto');

const args = process.argv.slice(2);
function arg(flag) { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; }

const email = arg('--email');
const password = arg('--password');
const name = arg('--name');
const congreName = arg('--congregation') || 'Mi Congregación';

if (!email || !password || !name) {
  console.error('Usage: node scripts/create-admin.cjs --email EMAIL --password PASS --name "Nombre Apellido" [--congregation "Nombre"]');
  process.exit(1);
}

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'msp.db');
const SCHEMA  = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
const fs = require('fs');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(SCHEMA, 'utf8'));

const congreId = crypto.randomUUID();
const userId   = crypto.randomUUID();
const hash = bcrypt.hashSync(String(password), 10);

const nameParts = name.trim().split(' ');
const firstName = nameParts[0];
const lastName  = nameParts.slice(1).join(' ') || null;

db.transaction(() => {
  // Insert congregation if not exists
  const existing = db.prepare(`SELECT id FROM congregations WHERE name = ? LIMIT 1`).get(congreName);
  const cId = existing ? existing.id : congreId;
  if (!existing) {
    db.prepare(`INSERT INTO congregations (id, name, enabled) VALUES (?,?,1)`).run(cId, congreName);
    console.log(`Congregation created: ${congreName} (${cId})`);
  } else {
    console.log(`Using existing congregation: ${congreName} (${cId})`);
  }

  // Insert or update user
  const existingUser = db.prepare(`SELECT id FROM users WHERE lower(email) = ? OR lower(auth_email) = ? LIMIT 1`).get(email.toLowerCase(), email.toLowerCase());
  if (existingUser) {
    db.prepare(`UPDATE users SET password_hash = ?, app_role = 'admin', is_super_admin = 1, congregation_id = ? WHERE id = ?`).run(hash, cId, existingUser.id);
    console.log(`Updated existing user: ${email}`);
  } else {
    db.prepare(`
      INSERT INTO users (id, name, first_name, last_name, display_name, email, auth_email, app_role, permissions, password_hash, congregation_id, is_super_admin, is_active, status)
      VALUES (?,?,?,?,?,?,?,'admin','[]',?,?,1,1,'active')
    `).run(userId, name, firstName, lastName, name, email.toLowerCase(), email.toLowerCase(), hash, cId);
    console.log(`Admin created: ${email} (${userId})`);
  }
})();

db.close();
console.log('Done. You can now log in at /login with the email and password above.');
