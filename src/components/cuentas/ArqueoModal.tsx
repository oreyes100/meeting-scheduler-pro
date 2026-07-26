'use client';

import React, { useMemo, useState } from 'react';
import { X, Printer, RotateCcw, Check } from 'lucide-react';
import { money } from './types';

/** Denominaciones de curso legal en México. */
const BILLS = [1000, 500, 200, 100, 50, 20];
const COINS = [20, 10, 5, 2, 1, 0.5];

/**
 * Arqueo de caja: conteo físico de efectivo contrastado con el saldo en sistema
 * de la Cuenta Principal. Si hay diferencia, permite registrarla como asiento.
 */
export function ArqueoModal({ systemBalance, onClose, onRegisterDiff }: {
  systemBalance: number;
  onClose: () => void;
  onRegisterDiff: (diff: number, note: string) => void;
}) {
  const [bills, setBills] = useState<Record<number, number>>({});
  const [coins, setCoins] = useState<Record<number, number>>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [responsible, setResponsible] = useState('');

  const billsTotal = useMemo(
    () => BILLS.reduce((s, d) => s + d * (bills[d] || 0), 0), [bills]);
  const coinsTotal = useMemo(
    () => COINS.reduce((s, d) => s + d * (coins[d] || 0), 0), [coins]);

  const counted = Math.round((billsTotal + coinsTotal) * 100) / 100;
  const diff = Math.round((counted - systemBalance) * 100) / 100;

  const input = 'w-20 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm text-right';

  const rows = (denoms: number[], state: Record<number, number>, set: (v: Record<number, number>) => void) =>
    denoms.map(d => (
      <tr key={d} className="border-t border-gray-100 dark:border-gray-700">
        <td className="px-2 py-1">${d.toFixed(2)}</td>
        <td className="px-2 py-1 text-right">
          <input type="number" min="0" step="1" value={state[d] ?? ''} className={input}
                 onChange={e => set({ ...state, [d]: Math.max(0, parseInt(e.target.value) || 0) })} />
        </td>
        <td className="px-2 py-1 text-right tabular-nums">{money(d * (state[d] || 0))}</td>
      </tr>
    ));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h3 className="font-semibold text-sm">Arqueo de Caja — Corte de efectivo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                     className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Responsable</label>
              <input value={responsible} onChange={e => setResponsible(e.target.value)}
                     placeholder="Nombre de quien realiza el corte"
                     className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-900/25 border border-sky-200 dark:border-sky-800">
            <p className="text-xs text-sky-700 dark:text-sky-300">Saldo en sistema (Cuenta Principal)</p>
            <p className="text-xl font-bold text-sky-800 dark:text-sky-300">{money(systemBalance)}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold mb-1">Billetes</p>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 dark:text-gray-400">
                  <tr><th className="px-2 text-left font-normal">Denom.</th>
                      <th className="px-2 text-right font-normal">Cant.</th>
                      <th className="px-2 text-right font-normal">Subtotal</th></tr>
                </thead>
                <tbody>
                  {rows(BILLS, bills, setBills)}
                  <tr className="border-t border-gray-300 dark:border-gray-600 font-semibold">
                    <td className="px-2 py-1" colSpan={2}>Subtotal billetes</td>
                    <td className="px-2 py-1 text-right tabular-nums">{money(billsTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <p className="text-xs font-semibold mb-1">Monedas</p>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 dark:text-gray-400">
                  <tr><th className="px-2 text-left font-normal">Denom.</th>
                      <th className="px-2 text-right font-normal">Cant.</th>
                      <th className="px-2 text-right font-normal">Subtotal</th></tr>
                </thead>
                <tbody>
                  {rows(COINS, coins, setCoins)}
                  <tr className="border-t border-gray-300 dark:border-gray-600 font-semibold">
                    <td className="px-2 py-1" colSpan={2}>Subtotal monedas</td>
                    <td className="px-2 py-1 text-right tabular-nums">{money(coinsTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total contado</p>
              <p className="text-xl font-bold">{money(counted)}</p>
            </div>
            <div className={`p-3 rounded-lg border ${
              Math.abs(diff) < 0.01
                ? 'bg-emerald-50 dark:bg-emerald-900/25 border-emerald-300 dark:border-emerald-700'
                : 'bg-red-50 dark:bg-red-900/25 border-red-300 dark:border-red-700'}`}>
              <p className="text-xs text-gray-500 dark:text-gray-400">Diferencia vs sistema</p>
              <p className={`text-xl font-bold ${Math.abs(diff) < 0.01
                ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {money(diff)}
              </p>
            </div>
          </div>

          {Math.abs(diff) >= 0.01 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {diff > 0
                ? 'Hay más efectivo del que registra el sistema: se asentaría como ingreso de ajuste.'
                : 'Falta efectivo respecto al sistema: se asentaría como gasto de ajuste.'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
          <button onClick={() => { setBills({}); setCoins({}); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">
            <RotateCcw size={13} /> Limpiar
          </button>
          <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600">
            <Printer size={13} /> Imprimir
          </button>
          <button
            disabled={Math.abs(diff) < 0.01}
            onClick={() => onRegisterDiff(diff, `Arqueo de caja ${date}${responsible ? ` — ${responsible}` : ''}`)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed">
            <Check size={13} /> Registrar diferencia
          </button>
        </div>
      </div>
    </div>
  );
}
