'use client';

// Botón de imprimir/exportar reutilizable: Imprimir, XLSX, PDF, DOCX.
// El dropdown usa position:fixed para no ser clippeado por contenedores overflow:hidden.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, FileSpreadsheet, FileText, File, ChevronDown } from 'lucide-react';
import { printTableReport, type PrintTableOptions } from '@/lib/printReport';
import { exportXlsx, exportPdf, exportDocx } from '@/lib/exportReport';

export function ExportMenu({ getData, className }: { getData: () => PrintTableOptions; className?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  // Precargar módulos al montar para que el dynamic import sea instant al hacer clic.
  // Sin esto, el user-gesture window de Chrome (~1s) expira antes de la descarga.
  useEffect(() => {
    import('xlsx').catch(() => {});
    import('jspdf').catch(() => {});
    import('jspdf-autotable').catch(() => {});
    import('docx').catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideRoot = btnRef.current?.closest('[data-export-menu="root"]')?.contains(target);
      const insideDropdown = (document.querySelector('[data-export-menu="dropdown"]') as HTMLElement | null)?.contains(target);
      if (!insideRoot && !insideDropdown) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen(true);
  };

  const runExport = async (fn: (d: PrintTableOptions) => void | Promise<void>) => {
    setOpen(false);
    setBusy(true);
    try {
      console.log('[ExportMenu] getData...');
      const data = getData();
      console.log('[ExportMenu] rows:', data.rows.length, 'cols:', data.columns.length);
      await fn(data);
      console.log('[ExportMenu] done');
    } catch (e) {
      console.error('[ExportMenu] Export falló:', e);
      alert(`Error al exportar:\n${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(false);
  };

  const itemCls = 'flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap';

  const dropdown = open ? (
    <div
      data-export-menu="dropdown"
      style={{ position: 'fixed', top: dropPos.top, right: dropPos.right, zIndex: 9999 }}
      className="w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden"
    >
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
  ) : null;

  return (
    <div data-export-menu="root" className={className}>
      <button
        ref={btnRef}
        onClick={toggle}
        disabled={busy}
        className="flex items-center gap-1 p-1.5 hover:bg-white/10 rounded disabled:opacity-50"
        title="Imprimir / Exportar"
      >
        <Printer size={18} />
        <ChevronDown size={12} />
      </button>
      {typeof document !== 'undefined' && dropdown && createPortal(dropdown, document.body)}
    </div>
  );
}
