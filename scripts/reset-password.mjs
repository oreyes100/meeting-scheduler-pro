#!/usr/bin/env node
/**
 * Restablece la contraseña de un usuario en la base local.
 *
 * Uso:
 *   node scripts/reset-password.mjs <identificador> <contraseña-nueva>
 *   node scripts/reset-password.mjs oreyes100@gmail.com 'MiClaveSegura1'
 *   node scripts/reset-password.mjs --list          (lista usuarios con acceso)
 *
 * El identificador puede ser el correo de acceso, el correo o el nombre de
 * usuario: los mismos tres campos que acepta la pantalla de entrada.
 *
 * Ejecútalo siempre en tu máquina, con el servidor detenido. La base es un
 * archivo binario; escribirla desde dos procesos a la vez la desincroniza.
 */
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'msp.db');

if (!fs.existsSync(DB_PATH)) {
  console.error(`No existe la base en ${DB_PATH}`);
  process.exit(2);
}

/** Abre la base con el driver que haya disponible. */
async function openDb(file) {
  try {
    const { default: Database } = await import('better-sqlite3');
    return new Database(file);
  } catch {
    const { DatabaseSync } = await import('node:sqlite');
    return new DatabaseSync(file);
  }
}

const db = await openDb(DB_PATH);
const [identifier, password] = process.argv.slice(2);

/* ── Listado ────────────────────────────────────────────────────────────────── */

if (identifier === '--list' || !identifier) {
  const rows = db.prepare(`
    SELECT name, auth_email, username, app_role, is_super_admin, disable_app_access,
           CASE WHEN password_hash IS NULL THEN 0 ELSE 1 END AS tiene_clave
    FROM users
    WHERE password_hash IS NOT NULL OR auth_email IS NOT NULL
    ORDER BY is_super_admin DESC, app_role, name
    LIMIT 40
  `).all();

  console.log(`\nUsuarios con acceso en ${DB_PATH}:\n`);
  for (const r of rows) {
    const flags = [
      r.is_super_admin ? 'superadmin' : r.app_role,
      r.tiene_clave ? 'con contraseña' : 'SIN CONTRASEÑA',
      r.disable_app_access ? 'ACCESO DESACTIVADO' : null,
    ].filter(Boolean).join(' · ');
    console.log(`  ${(r.auth_email || r.username || '—').padEnd(34)} ${r.name.padEnd(26)} ${flags}`);
  }
  console.log(`\nPara cambiar una: node scripts/reset-password.mjs <identificador> '<contraseña>'\n`);
  process.exit(0);
}

if (!password) {
  console.error('Falta la contraseña nueva.\n');
  console.error("  node scripts/reset-password.mjs oreyes100@gmail.com 'MiClaveSegura1'\n");
  process.exit(2);
}
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.');
  process.exit(2);
}

/* ── Cambio ─────────────────────────────────────────────────────────────────── */

const id = identifier.trim().toLowerCase();
const user = db.prepare(`
  SELECT id, name, auth_email, username, app_role, is_super_admin,
         disable_app_access, congregation_id
  FROM users
  WHERE lower(auth_email) = ? OR lower(email) = ? OR lower(username) = ?
  LIMIT 1
`).get(id, id, id);

if (!user) {
  console.error(`\nNo hay ningún usuario con «${identifier}» en ${DB_PATH}.`);
  console.error('Ejecuta  node scripts/reset-password.mjs --list  para ver los disponibles.\n');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);

// Comprobación inmediata: si esto falla, el cambio no ha servido de nada.
const check = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
if (!bcrypt.compareSync(password, check.password_hash)) {
  console.error('\nEl cambio no se guardó correctamente. Revisa permisos de escritura sobre la base.\n');
  process.exit(1);
}

console.log(`\nContraseña actualizada para ${user.name} (${user.auth_email || user.username}).`);
console.log(`  Rol            : ${user.is_super_admin ? 'superadmin' : user.app_role}`);
console.log(`  Congregación   : ${user.congregation_id ?? '— sin asignar —'}`);

if (user.disable_app_access) {
  console.log('\n  AVISO: este usuario tiene el acceso desactivado y seguirá sin poder entrar.');
  console.log('         Quítalo desde Privilegios o con: UPDATE users SET disable_app_access=0 WHERE id=…');
}
if (!user.congregation_id && !user.is_super_admin) {
  console.log('\n  AVISO: sin congregación asignada, la entrada se rechaza aunque la clave sea correcta.');
}

console.log('\nReinicia el servidor y vuelve a entrar.\n');
