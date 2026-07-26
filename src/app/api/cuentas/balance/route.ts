import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated, canAccessCuentas } from '@/lib/serverContext';

/** Computes the S-30 monthly balance for a congregation up to (and including) a given month. */
export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!canAccessCuentas(ctx)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // YYYY-MM; if null → running totals to today
  const upToDate = month ? `${month}-31` : '9999-12-31';

  const db = getDb();

  // Running balance per account from all transactions up to month
  type TxRow = { account: string; destination_account: string | null; type: string; amount: number };
  const allTx = db.prepare(`
    SELECT account, destination_account, type, amount
    FROM cuentas_transactions
    WHERE congregation_id = ? AND date <= ?
    ORDER BY date ASC, created_at ASC
  `).all(ctx.congreId, upToDate) as TxRow[];

  const balance: Record<string, number> = { recibido: 0, principal: 0, secundaria: 0 };

  for (const tx of allTx) {
    if (tx.type === 'entrada') {
      balance[tx.account] = (balance[tx.account] ?? 0) + tx.amount;
    } else if (tx.type === 'salida') {
      balance[tx.account] = (balance[tx.account] ?? 0) - tx.amount;
    } else if (tx.type === 'transferencia' && tx.destination_account) {
      balance[tx.account] = (balance[tx.account] ?? 0) - tx.amount;
      balance[tx.destination_account] = (balance[tx.destination_account] ?? 0) + tx.amount;
    }
  }

  // Monthly totals for the selected month (for S-30 report lines)
  let monthTotals = null;
  if (month) {
    type MonthRow = { account: string; destination_account: string | null; type: string; total: number };
    const monthTx = db.prepare(`
      SELECT account, destination_account, type, SUM(amount) as total
      FROM cuentas_transactions
      WHERE congregation_id = ? AND strftime('%Y-%m', date) = ?
      GROUP BY account, destination_account, type
    `).all(ctx.congreId, month) as MonthRow[];

    const inc: Record<string, number> = { recibido: 0, principal: 0, secundaria: 0 };
    const out: Record<string, number> = { recibido: 0, principal: 0, secundaria: 0 };

    for (const r of monthTx) {
      if (r.type === 'entrada') inc[r.account] = (inc[r.account] ?? 0) + r.total;
      else if (r.type === 'salida') out[r.account] = (out[r.account] ?? 0) + r.total;
      else if (r.type === 'transferencia' && r.destination_account) {
        out[r.account] = (out[r.account] ?? 0) + r.total;
        inc[r.destination_account] = (inc[r.destination_account] ?? 0) + r.total;
      }
    }
    monthTotals = { entradas: inc, salidas: out };
  }

  return NextResponse.json({ balance, month_totals: monthTotals, month });
}
