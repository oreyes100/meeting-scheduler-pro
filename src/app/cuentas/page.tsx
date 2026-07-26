'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Plus, Pencil, Trash2,
  ChevronLeft, ChevronRight, X, Check, AlertCircle, Banknote,
} from 'lucide-react';
import { IconSidebar } from '@/components/IconSidebar';
import { SyncStatus } from '@/components/SyncStatus';
import { useTheme } from '@/lib/theme';

/* ── Types ─────────────────────────────────────────────────────────────────── */
type Account = 'recibido' | 'principal' | 'secundaria';
type TxType  = 'entrada' | 'salida' | 'transferencia';

interface CtCode {
  id: string; code: string; description: string;
  default_account: Account; default_type: TxType; sort_order: number;
}

interface Transaction {
  id: string; date: string; type: TxType; account: Account;
  destination_account: Account | null; ct_code: string | null;
  description: string; amount: number; receipt_ref: string | null; notes: string | null;
}

interface Balance { recibido: number; principal: number; secundaria: number; }

interface MonthTotals {
  entradas: Balance;
  salidas: Balance;
}

/* ── Constants ──────────────────────────────────────────────────────────────── */
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const ACCOUNT_LABELS: Record<Account, string> = {
  recibido:   'Recibido (Donaciones)',
  principal:  'Cuenta Principal (Caja)',
  secundaria: 'Cuenta Secundaria',
};

const ACCOUNT_COLORS: Record<Account, string> = {
  recibido:   'text-emerald-600 dark:text-emerald-400',
  principal:  'text-sky-600 dark:text-sky-400',
  secundaria: 'text-violet-600 dark:text-violet-400',
};

const TYPE_LABELS: Record<TxType, string> = {
  entrada:        'Entrada (Ingreso)',
  salida:         'Salida (Gasto)',
  transferencia:  'Transferencia',
};

function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function prevMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_ES[m - 1]} ${y}`;
}

function fmt(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

/* ── Blank form ─────────────────────────────────────────────────────────────── */
const blank = (): Omit<Transaction,'id'|'receipt_ref'|'notes'> & { receipt_ref: string; notes: string } => ({
  date: new Date().toISOString().slice(0, 10),
  type: 'entrada',
  account: 'recibido',
  destination_account: null,
  ct_code: '',
  description: '',
  amount: 0,
  receipt_ref: '',
  notes: '',
});

/* ── Tab type ───────────────────────────────────────────────────────────────── */
type Tab = 's26' | 's30';

/* ── Page ───────────────────────────────────────────────────────────────────── */
export default function CuentasPage() {
  useTheme();

  const [tab, setTab] = useState<Tab>('s26');
  const [month, setMonth] = useState(currentYearMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ctCodes, setCtCodes] = useState<CtCode[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [monthTotals, setMonthTotals] = useState<MonthTotals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState(blank());
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  /* ── Fetch ─────────────────────────────────────────────────────────────────── */
  const loadCtCodes = useCallback(async () => {
    const res = await fetch('/api/cuentas/ct-codes');
    if (res.ok) { const d = await res.json(); setCtCodes(d.ct_codes || []); }
  }, []);

  const loadData = useCallback(async (m: string) => {
    setLoading(true); setError(null);
    try {
      const [txRes, balRes] = await Promise.all([
        fetch(`/api/cuentas/transactions?month=${m}`),
        fetch(`/api/cuentas/balance?month=${m}`),
      ]);
      if (!txRes.ok || !balRes.ok) throw new Error('Error cargando datos');
      const txData = await txRes.json();
      const balData = await balRes.json();
      setTransactions(txData.transactions || []);
      setBalance(balData.balance || null);
      setMonthTotals(balData.month_totals || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCtCodes(); }, [loadCtCodes]);
  useEffect(() => { loadData(month); }, [month, loadData]);

  /* ── Form helpers ───────────────────────────────────────────────────────────── */
  function openAdd() {
    setForm(blank()); setEditId(null); setFormErr(null); setModal('add');
  }

  function openEdit(tx: Transaction) {
    setForm({
      date: tx.date, type: tx.type, account: tx.account,
      destination_account: tx.destination_account,
      ct_code: tx.ct_code || '',
      description: tx.description,
      amount: tx.amount,
      receipt_ref: tx.receipt_ref || '',
      notes: tx.notes || '',
    });
    setEditId(tx.id); setFormErr(null); setModal('edit');
  }

  function applyCtCode(code: string) {
    const ct = ctCodes.find(c => c.code === code);
    if (ct) {
      setForm(f => ({
        ...f,
        ct_code: code,
        account: ct.default_account,
        type: ct.default_type,
        destination_account: ct.default_type === 'transferencia' ? f.destination_account : null,
      }));
    } else {
      setForm(f => ({ ...f, ct_code: code }));
    }
  }

  async function save() {
    setFormErr(null);
    if (!form.date || !form.description || form.amount <= 0) {
      setFormErr('Fecha, descripción y monto son requeridos'); return;
    }
    if (form.type === 'transferencia' && !form.destination_account) {
      setFormErr('Selecciona la cuenta destino'); return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        amount: Number(form.amount),
        destination_account: form.type === 'transferencia' ? form.destination_account : null,
        ct_code: form.ct_code || null,
        receipt_ref: form.receipt_ref || null,
        notes: form.notes || null,
        ...(modal === 'edit' ? { id: editId } : {}),
      };
      const res = await fetch('/api/cuentas/transactions', {
        method: modal === 'add' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error guardando');
      setModal(null);
      loadData(month);
    } catch (e: unknown) {
      setFormErr(e instanceof Error ? e.message : 'Error');
    } finally { setSaving(false); }
  }

  async function deleteTx(id: string) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/cuentas/transactions?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      loadData(month);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error eliminando');
    } finally { setDeleting(null); }
  }

  /* ── Render ─────────────────────────────────────────────────────────────────── */
  const inputCls = 'w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 text-gray-900 dark:text-gray-100';
  const lblCls = 'block text-xs text-gray-500 dark:text-gray-400 mb-1';

  // Totals for month
  const monthIn  = transactions.filter(t => t.type === 'entrada').reduce((s, t) => s + t.amount, 0);
  const monthOut = transactions.filter(t => t.type === 'salida').reduce((s, t) => s + t.amount, 0);
  const monthXfr = transactions.filter(t => t.type === 'transferencia').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <IconSidebar />
      <SyncStatus />

      <div className="flex-1 flex flex-col overflow-hidden pb-[52px] md:pb-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 dark:from-emerald-800 dark:to-emerald-950 text-white px-4 py-2 shrink-0 flex items-center gap-3">
          <Banknote size={18} />
          <h1 className="font-bold text-base">Cuentas de la Congregación</h1>

          {/* Month nav */}
          <div className="ml-auto flex items-center gap-1 bg-white/10 rounded-lg px-1">
            <button onClick={() => setMonth(prevMonth(month))} className="p-1 hover:bg-white/20 rounded">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium px-1 min-w-[140px] text-center">{monthLabel(month)}</span>
            <button onClick={() => setMonth(nextMonth(month))} className="p-1 hover:bg-white/20 rounded">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
          {([['s26', '📋 Hoja S-26'], ['s30', '📊 Resumen S-30']] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                ${tab === key
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* ── S-26 Tab ──────────────────────────────────────────────────── */}
          {tab === 's26' && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(ACCOUNT_LABELS) as [Account, string][]).map(([acc, label]) => (
                  <div key={acc} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
                    <p className={`text-lg font-bold mt-1 ${ACCOUNT_COLORS[acc]}`}>
                      {balance ? fmt(balance[acc]) : '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Saldo acumulado</p>
                  </div>
                ))}
              </div>

              {/* Month totals row */}
              <div className="flex gap-3 text-sm">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <ArrowDownCircle size={14} /> Entradas: <strong>{fmt(monthIn)}</strong>
                </span>
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <ArrowUpCircle size={14} /> Salidas: <strong>{fmt(monthOut)}</strong>
                </span>
                {monthXfr > 0 && (
                  <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                    <ArrowLeftRight size={14} /> Transferencias: <strong>{fmt(monthXfr)}</strong>
                  </span>
                )}
              </div>

              {/* Add button */}
              <div className="flex justify-end">
                <button
                  onClick={openAdd}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-2 rounded-lg"
                >
                  <Plus size={14} /> Nueva transacción
                </button>
              </div>

              {/* Transactions table */}
              {loading ? (
                <p className="text-sm text-gray-400 text-center py-10">Cargando…</p>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">Sin transacciones este mes.</p>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-left">CT</th>
                        <th className="px-3 py-2 text-left">Descripción</th>
                        <th className="px-3 py-2 text-left">Cuenta</th>
                        <th className="px-3 py-2 text-right">Entrada</th>
                        <th className="px-3 py-2 text-right">Salida</th>
                        <th className="px-3 py-2 text-center">Tipo</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {transactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-500">{tx.date}</td>
                          <td className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300">{tx.ct_code || '—'}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate">{tx.description}</td>
                          <td className={`px-3 py-2 text-xs ${ACCOUNT_COLORS[tx.account]}`}>
                            {ACCOUNT_LABELS[tx.account]}
                            {tx.type === 'transferencia' && tx.destination_account && (
                              <span className="text-gray-400"> → {ACCOUNT_LABELS[tx.destination_account]}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                            {tx.type === 'entrada' ? fmt(tx.amount) :
                             tx.type === 'transferencia' ? <span className="text-violet-500">{fmt(tx.amount)}</span> : ''}
                          </td>
                          <td className="px-3 py-2 text-right text-red-600 dark:text-red-400 font-medium">
                            {tx.type === 'salida' ? fmt(tx.amount) : ''}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {tx.type === 'entrada'       && <ArrowDownCircle size={14} className="text-emerald-500 mx-auto" />}
                            {tx.type === 'salida'        && <ArrowUpCircle   size={14} className="text-red-500 mx-auto" />}
                            {tx.type === 'transferencia' && <ArrowLeftRight  size={14} className="text-violet-500 mx-auto" />}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => openEdit(tx)} className="p-1 hover:text-emerald-600 text-gray-400">
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => deleteTx(tx.id)}
                                disabled={deleting === tx.id}
                                className="p-1 hover:text-red-600 text-gray-400 disabled:opacity-40"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── S-30 Tab ──────────────────────────────────────────────────── */}
          {tab === 's30' && (
            <div className="space-y-4">
              <h2 className="font-semibold text-base">Informe Mensual S-30 — {monthLabel(month)}</h2>

              {(Object.entries(ACCOUNT_LABELS) as [Account, string][]).map(([acc, label]) => {
                const inp = monthTotals?.entradas[acc] ?? 0;
                const out = monthTotals?.salidas[acc] ?? 0;
                const bal = balance?.[acc] ?? 0;
                return (
                  <div key={acc} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className={`px-4 py-2 text-sm font-semibold ${ACCOUNT_COLORS[acc]} bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700`}>
                      {label}
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 text-center">
                      <div className="p-4">
                        <p className="text-xs text-gray-400 mb-1">Entradas del mes</p>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmt(inp)}</p>
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-gray-400 mb-1">Salidas del mes</p>
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{fmt(out)}</p>
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-gray-400 mb-1">Saldo acumulado</p>
                        <p className={`text-lg font-bold ${bal >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-red-600'}`}>{fmt(bal)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Total */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">Total General</span>
                <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {balance ? fmt(balance.recibido + balance.principal + balance.secundaria) : '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-sm">
                {modal === 'add' ? 'Nueva transacción' : 'Editar transacción'}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>

            <div className="p-4 space-y-3">
              {formErr && (
                <div className="flex items-center gap-2 p-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-xs">
                  <AlertCircle size={13} /> {formErr}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lblCls}>Fecha *</label>
                  <input type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className={lblCls}>Monto ($) *</label>
                  <input type="number" min="0.01" step="0.01" value={form.amount || ''}
                    onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    className={inputCls} />
                </div>
              </div>

              <div>
                <label className={lblCls}>Tipo *</label>
                <select value={form.type}
                  onChange={e => setForm(f => ({
                    ...f, type: e.target.value as TxType,
                    destination_account: e.target.value === 'transferencia' ? (f.destination_account ?? 'principal') : null,
                  }))}
                  className={inputCls}>
                  {(Object.entries(TYPE_LABELS) as [TxType, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div className={`grid gap-3 ${form.type === 'transferencia' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className={lblCls}>{form.type === 'transferencia' ? 'Cuenta origen *' : 'Cuenta *'}</label>
                  <select value={form.account}
                    onChange={e => setForm(f => ({ ...f, account: e.target.value as Account }))}
                    className={inputCls}>
                    {(Object.entries(ACCOUNT_LABELS) as [Account, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                {form.type === 'transferencia' && (
                  <div>
                    <label className={lblCls}>Cuenta destino *</label>
                    <select value={form.destination_account ?? ''}
                      onChange={e => setForm(f => ({ ...f, destination_account: e.target.value as Account }))}
                      className={inputCls}>
                      <option value="">Seleccionar…</option>
                      {(Object.entries(ACCOUNT_LABELS) as [Account, string][])
                        .filter(([v]) => v !== form.account)
                        .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className={lblCls}>Código CT</label>
                <select value={form.ct_code ?? ''}
                  onChange={e => applyCtCode(e.target.value)}
                  className={inputCls}>
                  <option value="">Sin código CT</option>
                  {ctCodes.map(c => (
                    <option key={c.id} value={c.code}>{c.code} — {c.description}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={lblCls}>Descripción *</label>
                <input value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descripción de la transacción"
                  className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lblCls}>No. de recibo / comprobante</label>
                  <input value={form.receipt_ref}
                    onChange={e => setForm(f => ({ ...f, receipt_ref: e.target.value }))}
                    placeholder="Ej. 0042"
                    className={inputCls} />
                </div>
                <div>
                  <label className={lblCls}>Notas</label>
                  <input value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Observaciones"
                    className={inputCls} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setModal(null)}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">
                Cancelar
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50">
                <Check size={13} /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
