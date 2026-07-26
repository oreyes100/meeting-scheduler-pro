#!/usr/bin/env node
/**
 * Compara la base de datos real contra `src/lib/schema.sql`.
 *
 * Motivo: `CREATE TABLE IF NOT EXISTS` no toca una tabla que ya existe con otra
 * forma, así que la base puede quedar desincronizada del schema sin ningún
 * aviso. Peor: un índice que referencia una columna inexistente aborta el resto
 * del script y deja tablas posteriores sin crear. Este chequeo lo destapa.
 *
 * Uso:  node scripts/check-schema.mjs [ruta-a-la-bd]
 *       DB_PATH=/opt/msp/data/msp.db node scripts/check-schema.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = process.argv[2] || process.env.DB_PATH || path.join(ROOT, 'data', 'msp.db');
const SCHEMA = path.join(ROOT, 'src', 'lib', 'schema.sql');

if (!fs.existsSync(DB_PATH)) {
  console.log(`Sin base de datos en ${DB_PATH} — nada que comparar (se creará al arrancar).`);
  process.exit(0);
}

/** Extrae { tabla: [columnas] } de las sentencias CREATE TABLE del schema. */
function declaredTables(sql) {
  const out = {};
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][\w]*)\s*\(([\s\S]*?)\n\);/gi;
  let m;
  while ((m = re.exec(sql))) {
    const [, name, body] = m;
    const cols = [];
    let depth = 0, line = '';
    for (const raw of body.split('\n')) {
      const l = raw.replace(/--.*$/, '').trim();
      if (!l) continue;
      line = l;
      depth += (l.match(/\(/g) || []).length - (l.match(/\)/g) || []).length;
      // Solo la primera palabra de una definición de columna al nivel base.
      if (depth <= 0) {
        const first = line.split(/[\s(]/)[0];
        if (first && !/^(PRIMARY|UNIQUE|FOREIGN|CHECK|CONSTRAINT)$/i.test(first)) {
          cols.push(first.replace(/[",]/g, ''));
        }
      }
    }
    out[name] = cols;
  }
  return out;
}

const declared = declaredTables(fs.readFileSync(SCHEMA, 'utf8'));
const db = new DatabaseSync(DB_PATH);

const actualTables = new Set(
  db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
);

const missingTables = [];
const missingCols = [];

for (const [table, cols] of Object.entries(declared)) {
  if (!actualTables.has(table)) { missingTables.push(table); continue; }
  const actual = new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name));
  const gone = cols.filter(c => !actual.has(c));
  if (gone.length) missingCols.push({ table, cols: gone });
}

if (!missingTables.length && !missingCols.length) {
  console.log(`OK · ${Object.keys(declared).length} tablas declaradas presentes y completas en ${path.relative(ROOT, DB_PATH) || DB_PATH}.`);
  process.exit(0);
}

console.error(`\nLa base de datos no coincide con el schema (${DB_PATH}):\n`);
if (missingTables.length) {
  console.error('  Tablas que faltan:');
  for (const t of missingTables) console.error(`    · ${t}`);
}
if (missingCols.length) {
  console.error('  Columnas que faltan:');
  for (const { table, cols } of missingCols) console.error(`    · ${table}: ${cols.join(', ')}`);
}
console.error('\nCausa habitual: la tabla ya existía con otra forma y CREATE TABLE IF NOT EXISTS');
console.error('no la modifica. Añade la migración en migrateCuentasLegacy() / runMigrations de');
console.error('src/lib/sqlite.ts, o borra la base si son datos desechables.\n');
process.exit(1);
