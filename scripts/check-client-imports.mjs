#!/usr/bin/env node
/**
 * Detecta módulos de servidor filtrados al bundle del navegador.
 *
 * Recorre el grafo de importaciones desde cada archivo marcado con 'use client'
 * y falla si alguno alcanza, directa o transitivamente, un módulo que dependa de
 * `better-sqlite3` o de builtins de Node. Ese es el error
 * «Module not found: Can't resolve 'fs'», que solo aparece en `next build` —
 * y `next build` no puede correrse en cualquier entorno (necesita el binario
 * SWC de la plataforma). Este chequeo sí corre en cualquier sitio.
 *
 * Uso:  node scripts/check-client-imports.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/** Paquetes y builtins que jamás deben acabar en el navegador. */
const SERVER_ONLY = [
  'better-sqlite3', 'server-only', 'bcryptjs',
  'fs', 'node:fs', 'path', 'node:path', 'crypto', 'node:crypto',
  'child_process', 'node:child_process', 'net', 'node:net',
];

const EXTS = ['.ts', '.tsx', '.js', '.jsx'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}

/** Resuelve un especificador a una ruta de archivo dentro de src/, o null. */
function resolve(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;                       // paquete de node_modules

  for (const ext of ['', ...EXTS]) {
    const p = base + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  for (const ext of EXTS) {
    const p = path.join(base, 'index' + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;

function importsOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const specs = [];
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src))) specs.push(m[1] || m[2]);
  // `import 'x'` sin cláusula from
  for (const mm of src.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)) specs.push(mm[1]);
  return specs;
}

const isClient = f => /^\s*(['"])use client\1/m.test(fs.readFileSync(f, 'utf8').trimStart().slice(0, 200));

const files = walk(SRC);
const clientEntries = files.filter(isClient);

const violations = [];

for (const entry of clientEntries) {
  // BFS por el grafo, guardando la cadena para poder reportarla.
  const seen = new Set([entry]);
  const queue = [[entry, [entry]]];

  while (queue.length) {
    const [file, chain] = queue.shift();

    for (const spec of importsOf(file)) {
      const bare = spec.replace(/^node:/, '').split('/')[0];
      if (SERVER_ONLY.includes(spec) || SERVER_ONLY.includes(bare)) {
        violations.push({ entry, chain: [...chain, spec] });
        continue;
      }
      const next = resolve(spec, file);
      if (!next || seen.has(next)) continue;
      seen.add(next);
      queue.push([next, [...chain, next]]);
    }
  }
}

const rel = p => (p.startsWith('/') ? path.relative(ROOT, p) : p);

if (violations.length === 0) {
  console.log(`OK · ${clientEntries.length} módulos de cliente revisados, ninguno alcanza código de servidor.`);
  process.exit(0);
}

console.error(`\n${violations.length} fuga(s) de código de servidor al bundle de cliente:\n`);
for (const v of violations) {
  console.error(`  ${rel(v.entry)}`);
  console.error(`    ${v.chain.map(rel).join('\n      → ')}\n`);
}
console.error('Mueve las constantes y tipos puros a un módulo isomórfico (p. ej. src/lib/cuentasDomain.ts)');
console.error('y deja el acceso a datos en un módulo importado solo desde route handlers.\n');
process.exit(1);
