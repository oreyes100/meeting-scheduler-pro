'use client';

// Botón de imprimir/exportar reutilizable: Imprimir, XLSX, PDF, DOCX.
// Recibe un getData() que produce los datos de la tabla al momento del clic,
// así siempre exporta el estado actual de la página.
import React, { useEffect, useRef, useState } from 'react';
import { Printer, FileSpreadsheet, FileText, File, ChevronDown } from 'lucide-react';
import { printTableReport, type PrintTableOptions } from '@/lib/printReport';
import { exportXlsx, exportPdf, exportDocx } from '@/lib/exportReport';

export function ExportMenu({ getData, className }: { getData: () => PrintTableOptions; className?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const runExport = async (fn: (d: PrintTableOptions) => void | Promise<void>) => {
    setOpen(false);
    setBusy(true);
    try { await fn(getData()); } catch (e) { console.error('Export falló:', e); }
    setBusy(false);
  };

  const itemCls = 'flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700';

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="flex items-center gap-1 p-1.5 hover:bg-white/10 rounded disabled:opacity-50"
        title="Imprimir / Exportar"
      >
        <Printer size={18} />
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
          <button className={itemCls} onClick={() => runExport(printTableReport)}>
            <Printer size={15} /> Imprimir
          </button>
          <button className={itemCls} onClick={() => runExport(exportXlsx)}>
            <FileSpreadsheet size={15} /> Excel (.xlsx)
          </button>
          <button className={itemCls} onClick={() => runExport(exportPdf)}>
            <FileText size={15} /> PDF (.pdf)
          </button>
          <button className={itemCls} onClick={() => runExport(exportDocx)}>
            <File size={15} /> Word (.docx)
          </button>
        </div>
      )}
    </div>
  );
}
