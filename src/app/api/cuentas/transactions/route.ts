import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated, canAccessCuentas } from '@/lib/serverContext';

export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!canAccessCuentas(ctx)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // YYYY-MM

  const db = getDb();
  let rows: object[];

  if (month) {
    rows = db.prepare(`
      SELECT * FROM cuentas_transactions
      WHERE congregation_id = ? AND strftime('%Y-%m', date) = ?
      ORDER BY date ASC, created_at ASC
    `).all(ctx.congreId, month) as object[];
  } else {
    rows = db.prepare(`
      SELECT * FROM cuentas_transactions
      WHERE congregation_id = ?
      ORDER BY date DESC, created_at DESC
      LIMIT 500
    `).all(ctx.congreId) as object[];
  }

  return NextResponse.json({ transactions: rows });
}

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!canAccessCuentas(ctx)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await request.json();
  const { date, type, account, destination_account, ct_code, description, amount, receipt_ref, notes } = body;

  if (!date || !type || !account || !description || amount == null) {
    return NextResponse.json({ error: 'date, type, account, description y amount son requeridos' }, { status: 400 });
  }
  if (!['entrada', 'salida', 'transferencia'].includes(type)) {
    return NextResponse.json({ error: 'type inválido' }, { status: 400 });
  }
  if (!['recibido', 'principal', 'secundaria'].includes(account)) {
    return NextResponse.json({ error: 'account inválido' }, { status: 400 });
  }
  if (type === 'transferencia' && !destination_account) {
    return NextResponse.json({ error: 'destination_account requerido para transferencias' }, { status: 400 });
  }
  if (Number(amount) <= 0) {
    return NextResponse.json({ error: 'amount debe ser mayor a 0' }, { status: 400 });
  }

  const db = getDb();
  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO cuentas_transactions
        (id, date, type, account, destination_account, ct_code, description, amount, receipt_ref, notes, created_by, congregation_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, date, type, account,
      destination_account || null,
      ct_code || null,
      description,
      Number(amount),
      receipt_ref || null,
      notes || null,
      ctx.userId,
      ctx.congreId,
    );
    const row = db.prepare(`SELECT * FROM cuentas_transactions WHERE id = ?`).get(id);
    return NextResponse.json({ transaction: row });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!canAccessCuentas(ctx)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await request.json();
  const { id, date, type, account, destination_account, ct_code, description, amount, receipt_ref, notes } = body;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const db = getDb();
  const existing = db.prepare(
    `SELECT id FROM cuentas_transactions WHERE id = ? AND congregation_id = ?`
  ).get(id, ctx.congreId);
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  try {
    db.prepare(`
      UPDATE cuentas_transactions SET
        date = ?, type = ?, account = ?, destination_account = ?,
        ct_code = ?, description = ?, amount = ?, receipt_ref = ?, notes = ?,
        updated_at = datetime('now')
      WHERE id = ? AND congregation_id = ?
    `).run(
      date, type, account,
      destination_account || null,
      ct_code || null,
      description,
      Number(amount),
      receipt_ref || null,
      notes || null,
      id, ctx.congreId,
    );
    const row = db.prepare(`SELECT * FROM cuentas_transactions WHERE id = ?`).get(id);
    return NextResponse.json({ transaction: row });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!canAccessCuentas(ctx)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const db = getDb();
  const result = db.prepare(
    `DELETE FROM cuentas_transactions WHERE id = ? AND congregation_id = ?`
  ).run(id, ctx.congreId);

  if (result.changes === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ success: true });
}
