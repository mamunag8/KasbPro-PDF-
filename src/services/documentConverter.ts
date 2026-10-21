import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  ConvertedDocPreview,
  ExtractedTable,
  OfficeSheetPreview,
} from '../types/pdf';

export function detectFileFormat(
  fileName: string
): 'pdf' | 'docx' | 'xlsx' | 'csv' | 'md' | 'html' | 'txt' | 'image' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') return 'xlsx';
  if (ext === 'csv' || ext === 'tsv') return 'csv';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  return 'txt';
}

export async function parseOfficeOrTextFile(
  file: File
): Promise<ConvertedDocPreview> {
  const format = detectFileFormat(file.name);
  const buffer = await file.arrayBuffer();

  if (format === 'xlsx' || format === 'csv') {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheets: OfficeSheetPreview[] = [];
    const tables: ExtractedTable[] = [];

    workbook.SheetNames.forEach((sheetName, idx) => {
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
      });

      const cleanedRows = rawRows
        .map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '').trim()) : []))
        .filter((r) => r.some((cell) => cell.length > 0));

      if (cleanedRows.length > 0) {
        const headers = cleanedRows[0];
        const bodyRows = cleanedRows.slice(1);
        sheets.push({
          name: sheetName,
          headers,
          rows: bodyRows,
        });
        tables.push({
          id: `sheet-${idx + 1}`,
          pageNumber: idx + 1,
          title: `Sheet: ${sheetName}`,
          rows: cleanedRows,
        });
      }
    });

    return {
      sourceFileName: file.name,
      sourceFormat: format,
      sheets,
      tables,
      orientation:
        tables.some((t) => (t.rows[0]?.length || 0) > 5) ? 'landscape' : 'portrait',
      tableTheme: 'grid',
    };
  }

  if (format === 'docx') {
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    const html = result.value || '<p>Empty document</p>';
    const parser = new DOMParser();
    const dom = parser.parseFromString(html, 'text/html');
    const tables: ExtractedTable[] = [];

    dom.querySelectorAll('table').forEach((tbl, idx) => {
      const rows: string[][] = [];
      tbl.querySelectorAll('tr').forEach((tr) => {
        const cells: string[] = [];
        tr.querySelectorAll('th, td').forEach((td) => {
          cells.push((td.textContent || '').trim());
        });
        if (cells.length > 0) rows.push(cells);
      });
      if (rows.length > 0) {
        tables.push({
          id: `docx-tbl-${idx + 1}`,
          pageNumber: 1,
          title: `Word Table ${idx + 1}`,
          rows,
        });
      }
    });

    return {
      sourceFileName: file.name,
      sourceFormat: 'docx',
      htmlContent: html,
      tables,
      orientation: 'portrait',
      tableTheme: 'grid',
    };
  }

  if (format === 'image') {
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
    return {
      sourceFileName: file.name,
      sourceFormat: 'image',
      htmlContent: `<div style="text-align:center"><img src="${dataUrl}" style="max-width:100%;height:auto;" /></div>`,
      tables: [],
      orientation: 'portrait',
      tableTheme: 'grid',
    };
  }

  // Markdown, HTML, or Plain Text (including Markdown pipe tables)
  const text = new TextDecoder('utf-8').decode(buffer);
  const tables: ExtractedTable[] = [];
  const lines = text.split(/\r?\n/);

  let currentMdTable: string[][] = [];
  let tblCount = 1;
  const flushMdTable = () => {
    if (currentMdTable.length >= 2) {
      tables.push({
        id: `md-tbl-${tblCount++}`,
        pageNumber: 1,
        title: `Document Table ${tblCount - 1}`,
        rows: currentMdTable,
      });
    }
    currentMdTable = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Skip separator row like |---|---|
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) continue;
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      currentMdTable.push(cells);
    } else {
      flushMdTable();
    }
  }
  flushMdTable();

  const escapedHtml =
    format === 'html'
      ? text
      : `<div class="space-y-3">${lines
          .map((l) => {
            if (l.startsWith('# ')) return `<h1>${l.slice(2)}</h1>`;
            if (l.startsWith('## ')) return `<h2>${l.slice(3)}</h2>`;
            if (l.startsWith('### ')) return `<h3>${l.slice(4)}</h3>`;
            return `<p>${l}</p>`;
          })
          .join('')}</div>`;

  return {
    sourceFileName: file.name,
    sourceFormat: format === 'pdf' ? 'txt' : format,
    htmlContent: escapedHtml,
    tables,
    orientation: 'portrait',
    tableTheme: 'grid',
  };
}

/**
 * Generates a high-precision vector PDF from any ConvertedDocPreview (Excel, Word, CSV, Markdown, Images)
 * maintaining all tables, cell borders, and repeating headers across pages.
 */
export async function convertPreviewToPdfBytes(
  preview: ConvertedDocPreview
): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: preview.orientation,
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 62, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(preview.sourceFileName, 36, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(180, 195, 220);
  doc.text(
    `Converted by KasbPro PDF Editor • ${preview.sourceFormat.toUpperCase()} Table-Preserving Engine`,
    36,
    49
  );

  let cursorY = 86;

  // If image format
  if (preview.sourceFormat === 'image' && preview.htmlContent) {
    const match = preview.htmlContent.match(/src="([^"]+)"/);
    if (match?.[1]) {
      const imgData = match[1];
      const formatType = imgData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(
        imgData,
        formatType,
        36,
        cursorY,
        pageWidth - 72,
        pageHeight - cursorY - 60
      );
    }
    const arrayBuf = doc.output('arraybuffer');
    return new Uint8Array(arrayBuf);
  }

  // If Word / Markdown / HTML has non-table paragraphs, render them in order alongside tables
  if (preview.htmlContent && preview.sourceFormat !== 'xlsx' && preview.sourceFormat !== 'csv') {
    const parser = new DOMParser();
    const dom = parser.parseFromString(preview.htmlContent, 'text/html');
    const children = Array.from(dom.body.children);

    const renderElements = children.length > 0 ? children : [dom.body];

    for (const el of renderElements) {
      const tag = el.tagName.toLowerCase();

      if (tag === 'table') {
        const rows: string[][] = [];
        el.querySelectorAll('tr').forEach((tr) => {
          const r: string[] = [];
          tr.querySelectorAll('th, td').forEach((td) => r.push((td.textContent || '').trim()));
          if (r.length > 0) rows.push(r);
        });
        if (rows.length > 0) {
          autoTable(doc, {
            startY: cursorY,
            head: [rows[0]],
            body: rows.slice(1),
            theme: preview.tableTheme,
            styles: { fontSize: 9.5, cellPadding: 6 },
            headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
            margin: { left: 36, right: 36 },
          });
          // @ts-expect-error jspdf-autotable attaches lastAutoTable
          cursorY = (doc.lastAutoTable?.finalY || cursorY + 60) + 22;
        }
        continue;
      }

      const text = (el.textContent || '').trim();
      if (!text) continue;

      const isH1 = tag === 'h1';
      const isH2 = tag === 'h2' || tag === 'h3';
      doc.setFont('helvetica', isH1 || isH2 ? 'bold' : 'normal');
      doc.setFontSize(isH1 ? 16 : isH2 ? 13 : 10.5);
      doc.setTextColor(isH1 || isH2 ? 15 : 40, isH1 || isH2 ? 23 : 48, isH1 || isH2 ? 42 : 60);

      const wrapped: string[] = doc.splitTextToSize(text, pageWidth - 72);
      for (const line of wrapped) {
        if (cursorY > pageHeight - 50) {
          doc.addPage();
          cursorY = 48;
        }
        doc.text(line, 36, cursorY);
        cursorY += isH1 ? 22 : isH2 ? 18 : 15;
      }
      cursorY += 6;
    }
  }

  // Render any sheets or standalone tables (e.g., from XLSX, CSV, or Markdown tables)
  if (
    preview.tables.length > 0 &&
    (preview.sourceFormat === 'xlsx' ||
      preview.sourceFormat === 'csv' ||
      preview.sourceFormat === 'md' ||
      preview.sourceFormat === 'txt')
  ) {
    preview.tables.forEach((tbl, idx) => {
      if (idx > 0) {
        doc.addPage();
        cursorY = 48;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(tbl.title, 36, cursorY);
      cursorY += 14;

      const head = tbl.rows.length > 0 ? [tbl.rows[0]] : [['Column 1']];
      const body = tbl.rows.length > 1 ? tbl.rows.slice(1) : [];

      autoTable(doc, {
        startY: cursorY,
        head,
        body,
        theme: preview.tableTheme,
        styles: {
          fontSize: 9.5,
          cellPadding: 6,
          lineColor: [203, 213, 225],
          lineWidth: 0.6,
        },
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles:
          preview.tableTheme === 'striped' ? { fillColor: [241, 245, 249] } : undefined,
        margin: { left: 36, right: 36 },
        showHead: 'everyPage',
      });

      // @ts-expect-error jspdf-autotable attaches lastAutoTable
      cursorY = (doc.lastAutoTable?.finalY || cursorY + 80) + 28;
    });
  }

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

/**
 * Exports extracted PDF or OCR tables directly to an Excel (.xlsx) or CSV file
 */
export function exportTablesToExcel(tables: ExtractedTable[], baseFileName: string): void {
  const wb = XLSX.utils.book_new();
  tables.forEach((tbl, idx) => {
    const ws = XLSX.utils.aoa_to_sheet(tbl.rows);
    const safeName = (tbl.title || `Table_${idx + 1}`)
      .replace(/[\\/?*[\]:]/g, '_')
      .slice(0, 28);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });
  XLSX.writeFile(wb, `${baseFileName.replace(/\.[^.]+$/, '')}_Tables.xlsx`);
}

export function exportTableToCsv(table: ExtractedTable, baseFileName: string): void {
  const ws = XLSX.utils.aoa_to_sheet(table.rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseFileName.replace(/\.[^.]+$/, '')}_p${table.pageNumber}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generates a realistic multi-sheet Sample Excel Financial & Project Schedule Preview
 * so users can immediately test Office-to-PDF conversion with full table preservation
 */
export function createSampleOfficeWorkbookPreview(): ConvertedDocPreview {
  const sheets: OfficeSheetPreview[] = [
    {
      name: 'Q4 Budget & Expenses',
      headers: ['Cost Center', 'Department', 'Q3 Actual', 'Q4 Budget', 'Variance', 'Approval Status'],
      rows: [
        ['CC-101', 'Cloud & Edge R&D', '$142,500', '$155,000', '+8.7%', 'Approved'],
        ['CC-104', 'Mobile Engineering (iOS/Android)', '$98,200', '$112,000', '+14.0%', 'Approved'],
        ['CC-108', 'Enterprise Security Audit', '$44,000', '$45,000', '+2.2%', 'Completed'],
        ['CC-112', 'Multilingual Localization (12 Langs)', '$28,400', '$31,000', '+9.1%', 'Approved'],
        ['CC-119', 'Customer Success & Docs', '$61,800', '$64,500', '+4.3%', 'Pending Sign-off'],
        ['TOTAL', 'All Active Departments', '$374,900', '$407,500', '+8.6%', 'Verified'],
      ],
    },
    {
      name: 'Product Release Roadmap',
      headers: ['Milestone ID', 'Deliverable', 'Target Platform', 'Owner', 'Target Date'],
      rows: [
        ['MS-01', 'Offline PDF Engine & Book Spread', 'Web / Android / iOS', 'Core Team', '2026-Q4'],
        ['MS-02', 'Excel & Word Table-Preserving PDF', 'All Devices', 'Converter Team', '2026-Q4'],
        ['MS-03', 'Offline OCR & Table Grid Extractor', 'All Devices', 'Vision Team', '2026-Q4'],
        ['MS-04', 'Google Drive & WebDAV Cloud Sync', 'All Devices', 'Sync Team', '2026-Q4'],
      ],
    },
  ];

  const tables: ExtractedTable[] = sheets.map((s, idx) => ({
    id: `sample-sheet-${idx + 1}`,
    pageNumber: idx + 1,
    title: `Sheet: ${s.name}`,
    rows: [s.headers, ...s.rows],
  }));

  return {
    sourceFileName: 'KasbPro_Q4_Financial_Schedule.xlsx',
    sourceFormat: 'xlsx',
    sheets,
    tables,
    orientation: 'landscape',
    tableTheme: 'grid',
  };
}
