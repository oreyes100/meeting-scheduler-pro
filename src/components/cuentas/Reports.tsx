'use client';

import React from 'react';
import {
  ACCOUNTS, ACCOUNT_LABELS, ACCOUNT_ACCENT, money, num,
  type S26, type S30, type S25c, type Summary, type Reconcile, type CuentasConfig,
} from './types';

/* ── Encabezado oficial compartido por los tres formularios ─────────────────── */

export function FormHeader({ title, subtitle, cfg, right }: {
  title: string; subtitle?: string; cfg: CuentasConfig; right?: string;
}) {
  return (
    <div className="text-center mb-4">
      <h2 className="font-bold text-base tracking-wide">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      <p className="text-xs mt-1">
        TESTIGOS DE JEHOVÁ — Congregación <strong>{cfg.label || '—'}</strong>
        {cfg.city ? ` — ${cfg.city}` : ''}{cfg.state ? `, ${cfg.state}` : ''}
      </p>
      {right && <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">{right}</p>}
    </div>
  );
}

/* ── S-26: Hoja de cuentas (grid oficial de 10 columnas) ────────────────────── */

export function S26Sheet({ s26, official = false }: { s26: S26; official?: boolean }) {
  const cell = 'px-2 py-1 text-right tabular-nums';
  const border = 'border border-gray-300 dark:border-gray-600';

  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-xs ${border}`} style={{ borderCollapse: 'collapse' }}>
        <thead>
          {/* Encabezado de dos niveles: 4 columnas simples con rowSpan y 3 cuentas
              con colSpan=2 (Entrada / Salida), igual que el formulario impreso. */}
          <tr className="bg-gray-100 dark:bg-gray-700">
            <th rowSpan={2} className={`${border} px-2 py-1`}>FECHA</th>
            <th rowSpan={2} className={`${border} px-2 py-1 text-left`}>DESCRIPCIÓN DE TRANSACCIÓN</th>
            <th rowSpan={2} className={`${border} px-2 py-1`}>CT</th>
            <th colSpan={2} className={`${border} px-2 py-1`}>RECIBIDO</th>
            <th colSpan={2} className={`${border} px-2 py-1`}>CUENTA PRINCIPAL</th>
            <th colSpan={2} className={`${border} px-2 py-1`}>CUENTA SECUNDARIA</th>
            <th rowSpan={2} className={`${border} px-2 py-1`}>SALDO</th>
          </tr>
          <tr className="bg-gray-100 dark:bg-gray-700">
            {ACCOUNTS.map(a => (
              <React.Fragment key={a}>
                <th className={`${border} px-2 py-0.5 font-normal`}>Entrada</th>
                <th className={`${border} px-2 py-0.5 font-normal`}>Salida</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Saldo inicial del mes */}
          <tr className="bg-gray-50 dark:bg-gray-800/60 font-semibold">
            <td className={`${border} px-2 py-1`} colSpan={3}>
              {s26.monthLabel.toUpperCase()} — SALDO INICIAL
            </td>
            <td className={border} colSpan={6} />
            <td className={`${border} ${cell}`}>{s26.openingTotal.toFixed(2)}</td>
          </tr>

          {s26.rows.map(r => (
            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
              <td className={`${border} px-2 py-1 text-center`}>{Number(r.date.slice(8, 10))}</td>
              <td className={`${border} px-2 py-1`}>{r.description}</td>
              <td className={`${border} px-2 py-1 text-center font-medium`}>{r.code || ''}</td>
              {ACCOUNTS.map(a => (
                <React.Fragment key={a}>
                  <td className={`${border} ${cell} text-emerald-700 dark:text-emerald-400`}>{num(r.cols[a].in)}</td>
                  <td className={`${border} ${cell} text-red-700 dark:text-red-400`}>{num(r.cols[a].out)}</td>
                </React.Fragment>
              ))}
              <td className={`${border} ${cell} font-medium`}>{r.saldo.toFixed(2)}</td>
            </tr>
          ))}

          {s26.rows.length === 0 && (
            <tr>
              <td className={`${border} px-2 py-6 text-center text-gray-400`} colSpan={10}>
                Sin transacciones en este mes.
              </td>
            </tr>
          )}

          {/* Relleno de filas vacías para que el formulario impreso conserve su alto */}
          {official && Array.from({ length: Math.max(0, 26 - s26.rows.length) }).map((_, i) => (
            <tr key={`pad-${i}`}><td className={border} colSpan={10}>&nbsp;</td></tr>
          ))}

          <tr className="bg-gray-100 dark:bg-gray-700 font-semibold">
            <td className={`${border} px-2 py-1`} colSpan={3}>TOTALES DE TODAS LAS COLUMNAS ▶</td>
            {ACCOUNTS.map(a => (
              <React.Fragment key={a}>
                <td className={`${border} ${cell}`}>{s26.totals[a].in.toFixed(2)}</td>
                <td className={`${border} ${cell}`}>{s26.totals[a].out.toFixed(2)}</td>
              </React.Fragment>
            ))}
            <td className={`${border} ${cell}`}>{s26.closingTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Tarjetas de saldo por cuenta + total general. */
export function BalanceCards({ s26 }: { s26: S26 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {ACCOUNTS.map(a => (
        <div key={a} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate">
            {ACCOUNT_LABELS[a]}
          </p>
          <p className={`text-lg font-bold mt-1 ${s26.closing[a] < 0 ? 'text-red-600 dark:text-red-400' : ACCOUNT_ACCENT[a]}`}>
            {money(s26.closing[a])}
          </p>
        </div>
      ))}
      <div className="bg-emerald-50 dark:bg-emerald-900/25 rounded-xl border border-emerald-200 dark:border-emerald-800 p-3">
        <p className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Total general</p>
        <p className="text-lg font-bold mt-1 text-emerald-700 dark:text-emerald-400">{money(s26.closingTotal)}</p>
      </div>
    </div>
  );
}

/* ── S-30: Informe mensual ──────────────────────────────────────────────────── */

function Block({ tag, title, children }: { tag: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-sky-800 dark:bg-sky-900 text-white px-3 py-1 text-xs font-semibold tracking-wide">
        ({tag}) {title}
      </div>
      <table className="w-full text-xs">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <tr className={strong ? 'font-semibold bg-gray-50 dark:bg-gray-800/60' : ''}>
      <td className="px-3 py-1 border-t border-gray-100 dark:border-gray-700">{label}</td>
      <td className="px-3 py-1 border-t border-gray-100 dark:border-gray-700 text-right tabular-nums w-40">
        {money(value)}
      </td>
    </tr>
  );
}

export function S30Report({ s30 }: { s30: S30 }) {
  return (
    <div>
      {!s30.reconciled && (
        <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/25 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 text-xs">
          <strong>La conciliación no cuadra.</strong> (k) {money(s30.k)} debería igualar (e) {money(s30.e)}.
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        PÁGINA 1 — INFORME FINANCIERO · Año de servicio {s30.serviceYear}
      </p>

      <Block tag="a" title="FONDOS A COMIENZO DE MES">
        <Line label="Fondos en todas las cuentas al inicio del mes" value={s30.a} strong />
      </Block>

      <Block tag="b" title="RECIBIDO POR LA CONGREGACIÓN">
        {s30.incomeByCode.map(r => (
          <Line key={r.code} label={`${r.code} — ${r.description}`} value={r.total} />
        ))}
        {s30.incomeByCode.length === 0 && <Line label="Sin ingresos registrados" value={0} />}
        <Line label="TOTAL RECIBIDO" value={s30.b} strong />
      </Block>

      <Block tag="c" title="GASTOS DE LA CONGREGACIÓN">
        {s30.expenseByCode.map(r => (
          <Line key={r.code} label={`${r.code} — ${r.description}`} value={r.total} />
        ))}
        {s30.expenseByCode.length === 0 && <Line label="Sin gastos registrados" value={0} />}
        <Line label="TOTAL DE GASTOS" value={s30.c} strong />
      </Block>

      <Block tag="d" title="SOBRANTE / DÉFICIT  [(b) − (c)]">
        <Line label="Sobrante (déficit) del mes" value={s30.d} strong />
      </Block>

      <Block tag="e" title="FONDOS A FIN DE MES  [(a) + (d)]">
        <Line label="Total fondos al cierre del mes" value={s30.e} strong />
      </Block>

      <Block tag="f" title="FONDOS RESERVADOS PARA PROPÓSITOS ESPECIALES">
        <Line label="Contribuciones para Salones del Reino (DK)" value={s30.box_kingdom} />
        <Line label="Otras reservas" value={s30.other_reserves} />
        <Line label="TOTAL RESERVADO" value={s30.f} strong />
      </Block>

      <Block tag="g" title="FONDOS DISPONIBLES  [(e) − (f)]">
        <Line label="Fondos disponibles para la obra" value={s30.g} strong />
      </Block>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-5 mb-2">PÁGINA 2 — CONCILIACIÓN</p>

      <Block tag="h" title="TOTAL DE FONDOS A COMIENZO DE MES">
        <Line label="Mismo que (a)" value={s30.h} strong />
      </Block>
      <Block tag="i" title="RECIBIDO">
        <Line label="Total de ingresos del mes" value={s30.i} strong />
      </Block>
      <Block tag="j" title="DESEMBOLSOS">
        <Line label="Total de gastos del mes" value={s30.j} strong />
      </Block>
      <Block tag="k" title="TOTAL DE FONDOS A FIN DE MES  [(h) + (i) − (j)]">
        <Line label={`Debe coincidir con (e)${s30.reconciled ? ' ✓' : ' ✗'}`} value={s30.k} strong />
      </Block>

      <div className="mb-3 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-semibold">
          Detalle de Cajas de Contribuciones
        </div>
        <table className="w-full text-xs"><tbody>
          <Line label="Obra Mundial (DO)" value={s30.box_worldwide} />
          <Line label="Salones del Reino (DK)" value={s30.box_kingdom} />
        </tbody></table>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-semibold">MOVIMIENTOS POR CUENTA</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400">
              <th className="px-3 py-1 text-left font-normal">Cuenta</th>
              <th className="px-3 py-1 text-right font-normal">Saldo Anterior</th>
              <th className="px-3 py-1 text-right font-normal">Ingresos</th>
              <th className="px-3 py-1 text-right font-normal">Egresos</th>
              <th className="px-3 py-1 text-right font-normal">Saldo Actual</th>
            </tr>
          </thead>
          <tbody>
            {s30.movements.map(m => (
              <tr key={m.account} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-3 py-1">{m.label}</td>
                <td className="px-3 py-1 text-right tabular-nums">{money(m.previous)}</td>
                <td className="px-3 py-1 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{money(m.income)}</td>
                <td className="px-3 py-1 text-right tabular-nums text-red-700 dark:text-red-400">{money(m.expense)}</td>
                <td className={`px-3 py-1 text-right tabular-nums font-semibold ${m.current < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {money(m.current)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── S-25c: Auditoría trimestral ────────────────────────────────────────────── */

export function S25cReport({ s25c }: { s25c: S25c }) {
  const border = 'border border-gray-300 dark:border-gray-600';

  return (
    <div className="text-xs space-y-4">
      <p className="text-center">
        <strong>Trimestre auditado:</strong> {s25c.months[0]?.label} hasta {s25c.months[2]?.label}
      </p>

      <p className="text-justify text-gray-600 dark:text-gray-400 leading-relaxed">
        Para comenzar la auditoría trimestral, el siervo de cuentas debe suministrar el archivo actual
        de las cuentas de la congregación y el archivo de aprobaciones vigentes. El secretario debe
        suministrar las copias de todas las donaciones anotadas en los formularios <em>Registro de
        transacción</em> (S-24) de los meses auditados. El auditor deberá disponer de las
        <em> Instrucciones para la contabilidad de la congregación</em> (S-27c).
      </p>

      <div>
        <p className="font-semibold mb-1">VERIFICACIÓN DE LAS DONACIONES</p>
        <ol className="list-decimal ml-5 space-y-1 text-gray-600 dark:text-gray-400">
          <li>Sume, por mes, las copias de los formularios <em>Registro de transacción</em> (S-24) y compare
            el total de cada mes con la columna «Recibido/Entrada» de la <em>Hoja de cuentas</em> (S-26).</li>
          <li>¿Se registran todas las donaciones en la <em>Hoja de cuentas</em>?</li>
          <li>¿Se anotan correctamente los códigos de las entradas?</li>
          <li>¿Se hacen los depósitos semanalmente?</li>
        </ol>
      </div>

      <div>
        <p className="font-semibold mb-1">VERIFICACIÓN DE LOS DESEMBOLSOS</p>
        <ol className="list-decimal ml-5 space-y-1 text-gray-600 dark:text-gray-400">
          <li>¿Hay una factura, resolución u otro documento justificativo para todos los pagos anotados?</li>
          <li>¿Aprueba el coordinador del cuerpo de ancianos todas las facturas y recibos?</li>
          <li>¿Se envían a la sucursal todas las donaciones recogidas para la obra mundial?</li>
          <li>¿Se abonan lo antes posible todos los cargos de la sucursal?</li>
          <li>Compare el <em>Registro de traspaso de fondos</em> (TO-62) de cada mes con el acuse de recibo.</li>
          <li>¿Se envían a la sucursal, como donación para la obra mundial, los fondos que superan el saldo máximo?</li>
        </ol>
      </div>

      <div>
        <p className="font-semibold mb-1">DATOS DEL SISTEMA PARA LA AUDITORÍA</p>
        <table className={`w-full ${border}`} style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className={`${border} px-2 py-1 text-left`}>Mes</th>
              <th className={`${border} px-2 py-1 text-right`}>Recibido (Entrada)</th>
              <th className={`${border} px-2 py-1 text-right`}>Desembolsos</th>
              <th className={`${border} px-2 py-1 text-right`}>Donaciones OM</th>
              <th className={`${border} px-2 py-1 text-right`}>Remesas OM</th>
            </tr>
          </thead>
          <tbody>
            {s25c.months.map(m => (
              <tr key={m.ym}>
                <td className={`${border} px-2 py-1`}>{m.label}</td>
                <td className={`${border} px-2 py-1 text-right tabular-nums`}>{money(m.income)}</td>
                <td className={`${border} px-2 py-1 text-right tabular-nums`}>{money(m.expense)}</td>
                <td className={`${border} px-2 py-1 text-right tabular-nums`}>{money(m.omIncome)}</td>
                <td className={`${border} px-2 py-1 text-right tabular-nums`}>{money(m.omRemit)}</td>
              </tr>
            ))}
            <tr className="bg-gray-100 dark:bg-gray-700 font-semibold">
              <td className={`${border} px-2 py-1`}>Total del trimestre</td>
              <td className={`${border} px-2 py-1 text-right tabular-nums`}>{money(s25c.totals.income)}</td>
              <td className={`${border} px-2 py-1 text-right tabular-nums`}>{money(s25c.totals.expense)}</td>
              <td className={`${border} px-2 py-1 text-right tabular-nums`}>{money(s25c.totals.omIncome)}</td>
              <td className={`${border} px-2 py-1 text-right tabular-nums`}>{money(s25c.totals.omRemit)}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-2">
          Fondos al inicio del trimestre: <strong>{money(s25c.openingFunds)}</strong> ·
          Fondos al final del trimestre: <strong>{money(s25c.closingFunds)}</strong>
        </p>
        <p className={s25c.reconciled ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
          {s25c.reconciled ? '✓' : '✗'} CONCILIACIÓN: Fondos finales = Fondos iniciales + Ingresos − Gastos
        </p>
      </div>
    </div>
  );
}

/* ── Relación I/E: gráfico de barras SVG (sin dependencias) ─────────────────── */

export function IncomeExpenseChart({ summary }: { summary: Summary }) {
  const W = 760, H = 260, PAD_L = 56, PAD_B = 28, PAD_T = 12;
  const max = Math.max(1, ...summary.months.flatMap(m => [m.income, m.expense]));
  const plotW = W - PAD_L - 8, plotH = H - PAD_B - PAD_T;
  const slot = plotW / summary.months.length;
  const barW = Math.max(4, slot / 2 - 3);
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-emerald-500" /> Ingresos {money(summary.totals.income)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-red-500" /> Egresos {money(summary.totals.expense)}
        </span>
        <span className={`font-semibold ${summary.totals.net < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400'}`}>
          Neto {money(summary.totals.net)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px]" role="img"
             aria-label={`Ingresos y egresos por mes del año de servicio ${summary.serviceYear}`}>
          {[0, 0.25, 0.5, 0.75, 1].map(f => (
            <g key={f}>
              <line x1={PAD_L} x2={W - 8} y1={y(max * f)} y2={y(max * f)}
                    stroke="currentColor" strokeOpacity={0.15} />
              <text x={PAD_L - 6} y={y(max * f) + 3} textAnchor="end"
                    fontSize={9} fill="currentColor" fillOpacity={0.55}>
                {Math.round(max * f).toLocaleString('es-MX')}
              </text>
            </g>
          ))}

          {summary.months.map((m, i) => {
            const x0 = PAD_L + i * slot;
            return (
              <g key={m.ym}>
                <rect x={x0 + 2} y={y(m.income)} width={barW} height={PAD_T + plotH - y(m.income)}
                      className="fill-emerald-500" rx={2}>
                  <title>{`${m.label} · Ingresos ${money(m.income)}`}</title>
                </rect>
                <rect x={x0 + barW + 5} y={y(m.expense)} width={barW} height={PAD_T + plotH - y(m.expense)}
                      className="fill-red-500" rx={2}>
                  <title>{`${m.label} · Egresos ${money(m.expense)}`}</title>
                </rect>
                <text x={x0 + slot / 2} y={H - 10} textAnchor="middle" fontSize={9}
                      fill="currentColor" fillOpacity={0.65}>{m.short}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="px-2 py-1 text-left font-normal">Mes</th>
              <th className="px-2 py-1 text-right font-normal">Ingresos</th>
              <th className="px-2 py-1 text-right font-normal">Egresos</th>
              <th className="px-2 py-1 text-right font-normal">Neto</th>
            </tr>
          </thead>
          <tbody>
            {summary.months.map(m => (
              <tr key={m.ym} className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-2 py-1">{m.label}</td>
                <td className="px-2 py-1 text-right tabular-nums">{money(m.income)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{money(m.expense)}</td>
                <td className={`px-2 py-1 text-right tabular-nums ${m.net < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {money(m.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Análisis contables ─────────────────────────────────────────────────────── */

export function ReconcilePanel({ rec }: { rec: Reconcile }) {
  return (
    <div className="space-y-2">
      <div className={`p-3 rounded-lg border text-sm font-medium ${
        rec.allOk
          ? 'bg-emerald-50 dark:bg-emerald-900/25 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
          : 'bg-amber-50 dark:bg-amber-900/25 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'}`}>
        {rec.allOk
          ? `Sin incidencias en ${rec.monthLabel}.`
          : `Hay observaciones en ${rec.monthLabel}. Revísalas abajo.`}
      </div>

      {rec.checks.map(c => (
        <div key={c.label}
             className="flex items-start gap-2 p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <span className={`mt-0.5 shrink-0 font-bold ${c.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
            {c.ok ? '✓' : '!'}
          </span>
          <div className="min-w-0">
            <p className="text-sm">{c.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{c.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
