// Exportación de reportes tabulares a XLSX, PDF y DOCX.
// Comparte la misma forma de datos que printTableReport (printReport.ts).
// Las librerías se cargan con import() dinámico para no engordar el bundle inicial.
import type { PrintTableOptions } from './printReport';

const TEAL: [number, number, number] = [61, 125, 142]; // #3d7d8e — mismo teal que impresión

function fileBase(title: string, subtitle?: string): string {
  return `${title}${subtitle ? ` - ${subtitle}` : ''}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_');
}

function cellText(c: string | number | null | undefined): string {
  return c == null ? '' : String(c);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportXlsx({ title, subtitle, columns, rows }: PrintTableOptions) {
  const XLSX = await import('xlsx');
  const data = [columns, ...rows.map(r => r.map(cellText))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  // Anchos de columna aproximados al contenido
  ws['!cols'] = columns.map((c, i) => ({
    wch: Math.min(40, Math.max(c.length, ...rows.map(r => cellText(r[i]).length)) + 2),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, subtitle ? subtitle.slice(0, 31) : 'Reporte');
  XLSX.writeFile(wb, `${fileBase(title, subtitle)}.xlsx`);
}

export async function exportPdf({ title, congName, subtitle, columns, rows }: PrintTableOptions) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(congName, doc.internal.pageSize.getWidth() - 14, 16, { align: 'right' });
  if (subtitle) doc.text(subtitle, 14, 23);
  doc.setTextColor(0);
  autoTable(doc, {
    startY: subtitle ? 27 : 21,
    head: [columns],
    body: rows.map(r => r.map(cellText)),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: TEAL, textColor: 255 },
    alternateRowStyles: { fillColor: [238, 244, 246] },
  });
  doc.save(`${fileBase(title, subtitle)}.pdf`);
}

export async function exportDocx({ title, congName, subtitle, columns, rows }: PrintTableOptions) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, HeadingLevel, ShadingType,
  } = await import('docx');

  const headerRow = new TableRow({
    children: columns.map(c => new TableCell({
      shading: { type: ShadingType.CLEAR, fill: '3d7d8e' },
      children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, color: 'FFFFFF', size: 18 })] })],
    })),
  });
  const bodyRows = rows.map((r, i) => new TableRow({
    children: r.map(c => new TableCell({
      shading: i % 2 === 1 ? { type: ShadingType.CLEAR, fill: 'EEF4F6' } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text: cellText(c), size: 18 })] })],
    })),
  }));

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: congName, bold: true, size: 22 })] }),
        ...(subtitle ? [new Paragraph({ children: [new TextRun({ text: subtitle, color: '555555', size: 20 })] })] : []),
        new Paragraph({ text: '' }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] }),
      ],
    }],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${fileBase(title, subtitle)}.docx`);
}
