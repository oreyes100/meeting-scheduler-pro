// Crea cuenta de acceso (usuario+contraseña) para todos los publicadores
// excepto Jorge Reyes (admin) y filas de prueba sin apellido.
// usuario = nombre+apellido, contraseña = apellido+nombre (normalizados, sin acentos/espacios).
import fs from 'node:fs';

const envText = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL_ = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const EXCLUDE_ID = '5ec2a6ba-08a5-4844-84a2-a64280629bb6'; // Jorge Reyes (admin)

function norm(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  const res = await fetch(`${URL_}/rest/v1/users?select=id,first_name,last_name&order=last_name`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const rows = await res.json();

  const usedUsernames = new Set();
  const results = [];

  for (const row of rows) {
    if (row.id === EXCLUDE_ID) continue;
    if (!row.first_name || !row.last_name) continue;

    let username = norm(row.first_name) + norm(row.last_name);
    if (!username) continue;
    let suffix = 1;
    let finalUsername = username;
    while (usedUsernames.has(finalUsername)) { suffix++; finalUsername = username + suffix; }
    usedUsernames.add(finalUsername);

    const password = norm(row.last_name) + norm(row.first_name);
    const authEmail = `${finalUsername}@congregacion.local`;

    // Crear en Supabase Auth
    const createRes = await fetch(`${URL_}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password, email_confirm: true }),
    });
    const created = await createRes.json();
    if (!createRes.ok) {
      results.push({ name: `${row.first_name} ${row.last_name}`, username: finalUsername, password, status: `ERROR: ${created.msg || created.error_description || JSON.stringify(created)}` });
      continue;
    }

    // Vincular en tabla users
    const patchRes = await fetch(`${URL_}/rest/v1/users?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ username: finalUsername, auth_email: authEmail, app_role: 'publisher' }),
    });

    results.push({
      name: `${row.first_name} ${row.last_name}`,
      username: finalUsername,
      password,
      status: patchRes.ok ? 'OK' : `LINK_ERROR (${patchRes.status})`,
    });
  }

  const csv = ['nombre,usuario,contrasena,estado', ...results.map(r => `"${r.name}","${r.username}","${r.password}","${r.status}"`)].join('\n');
  const outPath = `${process.env.HOME}/Desktop/credenciales_publicadores.csv`;
  fs.writeFileSync(outPath, csv);

  const ok = results.filter(r => r.status === 'OK').length;
  console.log(`Creados: ${ok}/${results.length}`);
  console.log(`CSV guardado en: ${outPath}`);
  const errors = results.filter(r => r.status !== 'OK');
  if (errors.length) { console.log('Errores:'); errors.forEach(e => console.log(' -', e.name, e.status)); }
}

main();
