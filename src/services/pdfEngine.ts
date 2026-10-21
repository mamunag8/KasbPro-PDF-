import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
} from 'pdf-lib';
import type {
  AnnotationItem,
  ExtractedTable,
  OutlineNode,
  PageReflowContent,
  PdfTextItem,
} from '../types/pdf';

// Configure 100% local offline worker bundled by Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function loadPdfDocument(bytes: ArrayBuffer): Promise<pdfjsLib.PDFDocumentProxy> {
  const cloned = bytes.slice(0);
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(cloned),
    isEvalSupported: false,
  });
  return await loadingTask.promise;
}

export async function renderPdfPageToCanvas(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
  extraRotation = 0
): Promise<{ width: number; height: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  const baseRotation = (page.rotate + extraRotation) % 360;
  const viewport = page.getViewport({ scale, rotation: baseRotation });

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return { width: viewport.width, height: viewport.height };

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewport.width, viewport.height);

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  return { width: viewport.width, height: viewport.height };
}

export async function extractPageTextItems(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  extraRotation = 0
): Promise<PdfTextItem[]> {
  const page = await pdfDoc.getPage(pageNumber);
  const baseRotation = (page.rotate + extraRotation) % 360;
  const viewport = page.getViewport({ scale: 1, rotation: baseRotation });
  const textContent = await page.getTextContent();

  const items: PdfTextItem[] = [];
  let idx = 0;

  for (const rawItem of textContent.items) {
    if (!('str' in rawItem)) continue;
    const str = rawItem.str.trim();
    if (!str) continue;

    const tx = pdfjsLib.Util.transform(viewport.transform, rawItem.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]) || Math.abs(rawItem.height) || 12;
    const xPx = tx[4];
    const yPx = tx[5] - fontHeight;
    const wPx = rawItem.width || str.length * (fontHeight * 0.52);
    const hPx = fontHeight * 1.25;

    const x = Math.max(0, Math.min(98, (xPx / viewport.width) * 100));
    const y = Math.max(0, Math.min(98, (yPx / viewport.height) * 100));
    const width = Math.max(2, Math.min(100 - x, (wPx / viewport.width) * 100));
    const height = Math.max(1.4, Math.min(100 - y, (hPx / viewport.height) * 100));

    items.push({
      id: `p${pageNumber}-t${idx++}`,
      text: rawItem.str,
      x,
      y,
      width,
      height,
      fontSize: Math.round(fontHeight),
      fontName: rawItem.fontName,
    });
  }

  return items;
}

/**
 * Extracts structured tables from a PDF page by grouping text items into Y-rows and X-columns
 */
export function detectTablesFromTextItems(
  pageNumber: number,
  items: PdfTextItem[]
): ExtractedTable[] {
  if (items.length < 4) return [];

  // Sort items top-to-bottom, then left-to-right
  const sorted = [...items].sort((a, b) =>
    Math.abs(a.y - b.y) < 1.2 ? a.x - b.x : a.y - b.y
  );

  // Group into rows where Y coordinate is within 1.35% of page height
  const rowClusters: PdfTextItem[][] = [];
  for (const item of sorted) {
    const lastRow = rowClusters[rowClusters.length - 1];
    if (lastRow && Math.abs(lastRow[0].y - item.y) <= 1.35) {
      lastRow.push(item);
    } else {
      rowClusters.push([item]);
    }
  }

  // Sort items in each row by X and merge closely adjacent fragments in the same column
  const normalizedRows: Array<{ y: number; cells: Array<{ x: number; text: string }> }> = [];
  for (const row of rowClusters) {
    row.sort((a, b) => a.x - b.x);
    const cells: Array<{ x: number; endX: number; text: string }> = [];
    for (const frag of row) {
      const prev = cells[cells.length - 1];
      if (prev && frag.x - prev.endX < 0.8) {
        prev.text = `${prev.text} ${frag.text}`.trim();
        prev.endX = Math.max(prev.endX, frag.x + frag.width);
      } else {
        cells.push({
          x: frag.x,
          endX: frag.x + frag.width,
          text: frag.text.trim(),
        });
      }
    }
    if (cells.length > 0) {
      normalizedRows.push({ y: row[0].y, cells });
    }
  }

  // Find contiguous runs of rows that have >= 2 columns
  const tables: ExtractedTable[] = [];
  let currentRun: Array<{ y: number; cells: Array<{ x: number; text: string }> }> = [];
  let tableIdx = 1;

  const flushRun = () => {
    if (currentRun.length >= 2) {
      // Determine canonical column X anchors
      const colAnchors: number[] = [];
      for (const r of currentRun) {
        for (const c of r.cells) {
          const match = colAnchors.find((ax) => Math.abs(ax - c.x) < 6.5);
          if (match === undefined) {
            colAnchors.push(c.x);
          }
        }
      }
      colAnchors.sort((a, b) => a - b);

      if (colAnchors.length >= 2 && colAnchors.length <= 12) {
        const matrix: string[][] = currentRun.map((r) => {
          const rowArr = new Array(colAnchors.length).fill('');
          for (const c of r.cells) {
            let bestCol = 0;
            let bestDist = Infinity;
            colAnchors.forEach((ax, idx) => {
              const dist = Math.abs(ax - c.x);
              if (dist < bestDist) {
                bestDist = dist;
                bestCol = idx;
              }
            });
            rowArr[bestCol] = rowArr[bestCol]
              ? `${rowArr[bestCol]} ${c.text}`
              : c.text;
          }
          return rowArr;
        });

        tables.push({
          id: `table-p${pageNumber}-${tableIdx++}`,
          pageNumber,
          title: `Page ${pageNumber} • Table ${tableIdx - 1}`,
          rows: matrix,
        });
      }
    }
    currentRun = [];
  };

  for (const r of normalizedRows) {
    if (r.cells.length >= 2) {
      const prevRow = currentRun[currentRun.length - 1];
      if (prevRow && r.y - prevRow.y > 8.5) {
        flushRun();
      }
      currentRun.push(r);
    } else {
      flushRun();
    }
  }
  flushRun();

  return tables;
}

/**
 * Extracts Book Content / Table of Contents from native PDF bookmarks OR auto-detects chapters & headings
 */
export async function extractBookOutline(
  pdfDoc: pdfjsLib.PDFDocumentProxy
): Promise<OutlineNode[]> {
  try {
    const rawOutline = await pdfDoc.getOutline();
    if (rawOutline && rawOutline.length > 0) {
      const nodes: OutlineNode[] = [];
      let counter = 1;
      for (const item of rawOutline) {
        let pageNum = 1;
        try {
          if (typeof item.dest === 'string') {
            const dest = await pdfDoc.getDestination(item.dest);
            if (dest && dest[0]) {
              pageNum = (await pdfDoc.getPageIndex(dest[0])) + 1;
            }
          } else if (Array.isArray(item.dest) && item.dest[0]) {
            pageNum = (await pdfDoc.getPageIndex(item.dest[0])) + 1;
          }
        } catch {
          pageNum = 1;
        }
        nodes.push({
          id: `toc-${counter++}`,
          title: item.title || `Section ${counter}`,
          pageNumber: pageNum,
          level: 0,
        });
      }
      if (nodes.length > 0) return nodes;
    }
  } catch {
    // Fall back to heading discovery
  }

  // Fallback: Auto-detect Chapters & Headings by scanning font sizes and chapter patterns
  const detected: OutlineNode[] = [];
  const maxScanPages = Math.min(pdfDoc.numPages, 60);

  for (let p = 1; p <= maxScanPages; p++) {
    const items = await extractPageTextItems(pdfDoc, p);
    if (items.length === 0) continue;

    // Group items into lines by Y
    const lines: Array<{ y: number; maxFont: number; text: string }> = [];
    const sorted = [...items].sort((a, b) =>
      Math.abs(a.y - b.y) < 1.2 ? a.x - b.x : a.y - b.y
    );

    for (const it of sorted) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - it.y) <= 1.2) {
        last.text = `${last.text} ${it.text}`.trim();
        last.maxFont = Math.max(last.maxFont, it.fontSize);
      } else {
        lines.push({ y: it.y, maxFont: it.fontSize, text: it.text.trim() });
      }
    }

    for (const line of lines) {
      const clean = line.text.trim();
      if (clean.length < 3 || clean.length > 95) continue;
      const isChapterPattern =
        /^(chapter|section|part|module|appendix|فصل|القسم|\d+\.\s+[A-Z])/i.test(clean);
      if (line.maxFont >= 15 || isChapterPattern) {
        const level = line.maxFont >= 18 ? 0 : line.maxFont >= 15 ? 1 : 2;
        if (!detected.some((d) => d.title === clean && d.pageNumber === p)) {
          detected.push({
            id: `auto-toc-p${p}-${detected.length + 1}`,
            title: clean,
            pageNumber: p,
            level,
          });
        }
      }
    }
  }

  if (detected.length === 0) {
    for (let p = 1; p <= pdfDoc.numPages; p++) {
      detected.push({
        id: `page-toc-${p}`,
        title: `Page ${p}`,
        pageNumber: p,
        level: 0,
      });
    }
  }

  return detected;
}

/**
 * Extracts structured Reflow Content (Headings, Paragraphs, and Tables) for Comfort Reading Mode
 */
export async function extractPageReflowContent(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<PageReflowContent> {
  const items = await extractPageTextItems(pdfDoc, pageNumber);
  const tables = detectTablesFromTextItems(pageNumber, items);

  const sorted = [...items].sort((a, b) =>
    Math.abs(a.y - b.y) < 1.2 ? a.x - b.x : a.y - b.y
  );

  const lines: Array<{ y: number; fontSize: number; text: string }> = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= 1.2) {
      last.text = `${last.text} ${it.text}`.trim();
      last.fontSize = Math.max(last.fontSize, it.fontSize);
    } else {
      lines.push({ y: it.y, fontSize: it.fontSize, text: it.text.trim() });
    }
  }

  const headings: string[] = [];
  const paragraphs: string[] = [];
  let currentPara = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.text) continue;

    if (line.fontSize >= 15) {
      if (currentPara) {
        paragraphs.push(currentPara.trim());
        currentPara = '';
      }
      headings.push(line.text);
      paragraphs.push(`## ${line.text}`);
    } else {
      const prevLine = i > 0 ? lines[i - 1] : null;
      if (prevLine && line.y - prevLine.y > 3.8 && currentPara) {
        paragraphs.push(currentPara.trim());
        currentPara = line.text;
      } else {
        currentPara = currentPara ? `${currentPara} ${line.text}` : line.text;
      }
    }
  }

  if (currentPara) {
    paragraphs.push(currentPara.trim());
  }

  return {
    pageNumber,
    headings,
    paragraphs,
    tables,
    rawText: lines.map((l) => l.text).join('\n'),
  };
}

function hexToRgbColor(hex: string) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
}

/**
 * Exports the PDF with all user annotations, text replacements, tables, signatures, stamps, and page rotations baked in
 */
export async function exportAnnotatedPdf(
  sourceBytes: ArrayBuffer,
  annotations: AnnotationItem[],
  pageRotations: Record<number, number>
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(sourceBytes.slice(0));
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();

  pages.forEach((page, idx) => {
    const pageNum = idx + 1;
    const extraRot = pageRotations[pageNum] || 0;
    if (extraRot) {
      const currentRot = page.getRotation().angle;
      page.setRotation(degrees((currentRot + extraRot) % 360));
    }
  });

  for (const ann of annotations) {
    if (ann.pageNumber < 1 || ann.pageNumber > pages.length) continue;
    const page = pages[ann.pageNumber - 1];
    const { width: pw, height: ph } = page.getSize();

    const x = (ann.x / 100) * pw;
    const w = (ann.width / 100) * pw;
    const h = (ann.height / 100) * ph;
    // PDF coordinates start from bottom-left
    const y = ph - (ann.y / 100) * ph - h;

    const colorRgb = hexToRgbColor(ann.color || '#4f46e5');

    if (ann.type === 'highlight') {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        color: colorRgb,
        opacity: ann.opacity ?? 0.35,
      });
    } else if (ann.type === 'underline' || ann.type === 'strikethrough') {
      const lineY = ann.type === 'underline' ? y : y + h / 2;
      page.drawLine({
        start: { x, y: lineY },
        end: { x: x + w, y: lineY },
        thickness: 2,
        color: colorRgb,
      });
    } else if (ann.type === 'redact') {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        color: rgb(0, 0, 0),
        opacity: 1,
      });
    } else if (ann.type === 'replace-text' || ann.type === 'text') {
      if (ann.type === 'replace-text' || ann.backgroundColor) {
        page.drawRectangle({
          x: x - 2,
          y: y - 2,
          width: w + 4,
          height: h + 4,
          color: hexToRgbColor(ann.backgroundColor || '#ffffff'),
          opacity: 1,
        });
      }
      if (ann.text) {
        const fSize = ann.fontSize || 12;
        page.drawText(ann.text, {
          x: x + 2,
          y: y + Math.max(2, h - fSize - 2),
          size: fSize,
          font: fontRegular,
          color: colorRgb,
        });
      }
    } else if (ann.type === 'note') {
      page.drawRectangle({
        x,
        y,
        width: Math.max(w, 120),
        height: Math.max(h, 52),
        color: rgb(1, 0.96, 0.72),
        borderColor: rgb(0.92, 0.75, 0.15),
        borderWidth: 1,
        opacity: 0.95,
      });
      if (ann.text) {
        page.drawText(ann.text.slice(0, 140), {
          x: x + 6,
          y: y + Math.max(10, h - 16),
          size: 9.5,
          font: fontRegular,
          color: rgb(0.15, 0.15, 0.15),
          maxWidth: Math.max(w - 12, 108),
        });
      }
    } else if (ann.type === 'checkmark') {
      page.drawText('YES / X', {
        x,
        y: y + 2,
        size: Math.max(12, ann.fontSize || 15),
        font: fontBold,
        color: colorRgb,
      });
    } else if (ann.type === 'rect') {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        borderColor: colorRgb,
        borderWidth: ann.strokeWidth || 2,
        opacity: 0,
      });
    } else if (ann.type === 'circle') {
      page.drawEllipse({
        x: x + w / 2,
        y: y + h / 2,
        xScale: w / 2,
        yScale: h / 2,
        borderColor: colorRgb,
        borderWidth: ann.strokeWidth || 2,
      });
    } else if (ann.type === 'stamp') {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        borderColor: colorRgb,
        borderWidth: 2.5,
        color: colorRgb,
        opacity: 0.08,
      });
      const label = ann.text || ann.stampVariant || 'APPROVED';
      page.drawText(label, {
        x: x + 10,
        y: y + h / 2 - 6,
        size: 13,
        font: fontBold,
        color: colorRgb,
      });
    } else if (ann.type === 'signature' && ann.imageDataUrl) {
      try {
        const pngImage = await pdfDoc.embedPng(ann.imageDataUrl);
        page.drawImage(pngImage, {
          x,
          y,
          width: w,
          height: h,
        });
      } catch {
        // Fallback if text signature
        if (ann.text) {
          page.drawText(ann.text, {
            x,
            y: y + h / 2,
            size: 18,
            font: fontBold,
            color: colorRgb,
          });
        }
      }
    } else if (ann.type === 'table' && ann.tableData && ann.tableData.length > 0) {
      const rows = ann.tableData;
      const numRows = rows.length;
      const numCols = Math.max(...rows.map((r) => r.length), 1);
      const cellW = w / numCols;
      const cellH = h / numRows;

      for (let rIdx = 0; rIdx < numRows; rIdx++) {
        for (let cIdx = 0; cIdx < numCols; cIdx++) {
          const cellX = x + cIdx * cellW;
          const cellY = y + h - (rIdx + 1) * cellH;
          const isHeader = rIdx === 0;

          page.drawRectangle({
            x: cellX,
            y: cellY,
            width: cellW,
            height: cellH,
            color: isHeader ? rgb(0.19, 0.25, 0.55) : rgb(1, 1, 1),
            borderColor: rgb(0.75, 0.78, 0.84),
            borderWidth: 0.8,
          });

          const cellText = (rows[rIdx]?.[cIdx] ?? '').slice(0, 42);
          if (cellText) {
            page.drawText(cellText, {
              x: cellX + 4,
              y: cellY + Math.max(4, cellH / 2 - 4),
              size: 9,
              font: isHeader ? fontBold : fontRegular,
              color: isHeader ? rgb(1, 1, 1) : rgb(0.12, 0.15, 0.2),
            });
          }
        }
      }
    } else if (ann.type === 'draw' && ann.points && ann.points.length > 1) {
      for (let i = 1; i < ann.points.length; i++) {
        const p1 = ann.points[i - 1];
        const p2 = ann.points[i];
        page.drawLine({
          start: { x: (p1.x / 100) * pw, y: ph - (p1.y / 100) * ph },
          end: { x: (p2.x / 100) * pw, y: ph - (p2.y / 100) * ph },
          thickness: ann.strokeWidth || 2.2,
          color: colorRgb,
        });
      }
    }
  }

  return await pdfDoc.save();
}

export async function insertBlankPageInPdf(
  sourceBytes: ArrayBuffer,
  afterPageNumber: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(sourceBytes.slice(0));
  const pages = pdfDoc.getPages();
  const refPage = pages[Math.min(Math.max(0, afterPageNumber - 1), pages.length - 1)];
  const { width, height } = refPage ? refPage.getSize() : { width: 595.28, height: 841.89 };
  pdfDoc.insertPage(Math.min(afterPageNumber, pages.length), [width, height]);
  return await pdfDoc.save();
}

export async function deletePageFromPdf(
  sourceBytes: ArrayBuffer,
  pageNumberToRemove: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(sourceBytes.slice(0));
  if (pdfDoc.getPageCount() <= 1) {
    return await pdfDoc.save();
  }
  pdfDoc.removePage(pageNumberToRemove - 1);
  return await pdfDoc.save();
}

export async function mergePdfBuffers(buffers: ArrayBuffer[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf.slice(0));
    const copied = await merged.copyPages(src, src.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
  }
  return await merged.save();
}

export async function extractPdfPageRange(
  sourceBytes: ArrayBuffer,
  rangeText: string
): Promise<Uint8Array> {
  const src = await PDFDocument.load(sourceBytes.slice(0));
  const total = src.getPageCount();
  const targetIndices: number[] = [];

  const parts = rangeText.split(',').map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const s = Math.max(1, parseInt(startStr, 10));
      const e = Math.min(total, parseInt(endStr, 10));
      if (!isNaN(s) && !isNaN(e) && s <= e) {
        for (let p = s; p <= e; p++) targetIndices.push(p - 1);
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p) && p >= 1 && p <= total) {
        targetIndices.push(p - 1);
      }
    }
  }

  const out = await PDFDocument.create();
  const indices = targetIndices.length > 0 ? targetIndices : [0];
  const copied = await out.copyPages(src, indices);
  copied.forEach((p) => out.addPage(p));
  return await out.save();
}

export async function applyWatermarkAndPageNumbers(
  sourceBytes: ArrayBuffer,
  options: {
    watermarkText?: string;
    addPageNumbers: boolean;
    headerText?: string;
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(sourceBytes.slice(0));
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    if (options.watermarkText?.trim()) {
      page.drawText(options.watermarkText.trim(), {
        x: width * 0.18,
        y: height * 0.42,
        size: 44,
        font: fontBold,
        color: rgb(0.45, 0.5, 0.65),
        opacity: 0.16,
        rotate: degrees(32),
      });
    }
    if (options.headerText?.trim()) {
      page.drawText(options.headerText.trim(), {
        x: 40,
        y: height - 26,
        size: 9.5,
        font: fontReg,
        color: rgb(0.38, 0.42, 0.5),
      });
    }
    if (options.addPageNumbers) {
      const label = `Page ${i + 1} of ${pages.length}`;
      page.drawText(label, {
        x: width / 2 - 28,
        y: 20,
        size: 9.5,
        font: fontReg,
        color: rgb(0.35, 0.38, 0.45),
      });
    }
  });

  return await pdfDoc.save();
}

/**
 * Generates a rich 5-page Interactive Starter Handbook & Book Demo PDF offline
 */
export async function createStarterHandbookPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);

  const drawHeaderBanner = (
    page: ReturnType<typeof doc.addPage>,
    chapterLabel: string,
    title: string,
    subtitle: string
  ) => {
    const { width, height } = page.getSize();
    page.drawRectangle({
      x: 0,
      y: height - 96,
      width,
      height: 96,
      color: rgb(0.09, 0.13, 0.26),
    });
    page.drawText(chapterLabel, {
      x: 42,
      y: height - 34,
      size: 10,
      font: fontBold,
      color: rgb(0.51, 0.55, 0.97),
    });
    page.drawText(title, {
      x: 42,
      y: height - 58,
      size: 20,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText(subtitle, {
      x: 42,
      y: height - 78,
      size: 10.5,
      font: fontReg,
      color: rgb(0.78, 0.82, 0.92),
    });
  };

  // PAGE 1: Cover & Chapter 1
  const p1 = doc.addPage([595.28, 841.89]);
  drawHeaderBanner(
    p1,
    'KASBPRO PDF EDITOR • 100% FREE & OFFLINE SUITE',
    'Chapter 1: Executive Guide & Actionable Workspace',
    'Viewer • Book Reader • In-Place Text Editor • Table-Preserving Converter • Offline OCR'
  );

  p1.drawText('1.1 Welcome to KasbPro PDF Editor', {
    x: 42,
    y: 710,
    size: 16,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.28),
  });

  const p1IntroLines = [
    'KasbPro PDF Editor is engineered for fast day-to-day document tasks on Web, Android, and iOS.',
    'All features are 100% free with zero advertisements, zero paywalls, and full offline execution.',
    'Click any text line below using "Edit PDF Text" in the toolbar to modify existing text in-place!',
  ];
  p1IntroLines.forEach((line, idx) => {
    p1.drawText(line, {
      x: 42,
      y: 684 - idx * 18,
      size: 11,
      font: fontReg,
      color: rgb(0.22, 0.26, 0.34),
    });
  });

  p1.drawText('1.2 Actionable Capabilities Summary Table', {
    x: 42,
    y: 610,
    size: 15,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.28),
  });

  const p1Table = [
    ['ModuleCode', 'FeatureArea', 'OfflineEngine', 'Status'],
    ['MOD-01', 'Common PDF Editor & In-Place Text', 'PDF.js + pdf-lib', 'Active'],
    ['MOD-02', 'Book Content & 2-Page Spread', 'Auto-TOC + Spine View', 'Active'],
    ['MOD-03', 'Comfort Reflow & Read Aloud TTS', 'Sepia/Night + Speech', 'Active'],
    ['MOD-04', 'Word & Excel Table Converter', 'SheetJS + AutoTable', 'Active'],
    ['MOD-05', 'Offline OCR & Table Extractor', 'Tesseract + Grid Scan', 'Active'],
    ['MOD-06', 'Google Drive & Multi-Cloud Sync', 'IndexedDB + Cloud API', 'Active'],
  ];

  p1Table.forEach((row, rIdx) => {
    const rowY = 576 - rIdx * 26;
    const isHead = rIdx === 0;
    p1.drawRectangle({
      x: 42,
      y: rowY - 6,
      width: 510,
      height: 24,
      color: isHead ? rgb(0.19, 0.24, 0.48) : rIdx % 2 === 0 ? rgb(0.95, 0.97, 1) : rgb(1, 1, 1),
      borderColor: rgb(0.82, 0.85, 0.91),
      borderWidth: 0.7,
    });
    const colX = [50, 145, 345, 485];
    row.forEach((cell, cIdx) => {
      p1.drawText(cell, {
        x: colX[cIdx],
        y: rowY + cIdx * 0.03,
        size: 10,
        font: isHead ? fontBold : fontReg,
        color: isHead ? rgb(1, 1, 1) : rgb(0.15, 0.18, 0.24),
      });
    });
  });

  p1.drawText('1.3 Quick Signature & Stamp Test Zone', {
    x: 42,
    y: 365,
    size: 15,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.28),
  });

  p1.drawRectangle({
    x: 42,
    y: 250,
    width: 240,
    height: 95,
    borderColor: rgb(0.6, 0.65, 0.78),
    borderWidth: 1.2,
    color: rgb(0.98, 0.99, 1),
  });
  p1.drawText('Authorized Signature Area', {
    x: 56,
    y: 324,
    size: 10.5,
    font: fontBold,
    color: rgb(0.35, 0.4, 0.52),
  });
  p1.drawText('Use the "Signature" tool to place your sign here.', {
    x: 56,
    y: 266,
    size: 9.5,
    font: fontReg,
    color: rgb(0.45, 0.5, 0.6),
  });

  p1.drawRectangle({
    x: 312,
    y: 250,
    width: 240,
    height: 95,
    borderColor: rgb(0.6, 0.65, 0.78),
    borderWidth: 1.2,
    color: rgb(0.98, 0.99, 1),
  });
  p1.drawText('Official Stamp Area', {
    x: 326,
    y: 324,
    size: 10.5,
    font: fontBold,
    color: rgb(0.35, 0.4, 0.52),
  });
  p1.drawText('Use the "Stamp" tool (APPROVED / PAID / DRAFT).', {
    x: 326,
    y: 266,
    size: 9.5,
    font: fontReg,
    color: rgb(0.45, 0.5, 0.6),
  });

  // PAGE 2: Chapter 2 — Financial & Inventory Tables
  const p2 = doc.addPage([595.28, 841.89]);
  drawHeaderBanner(
    p2,
    'CHAPTER 2 • STRUCTURED DATA & TABLE PRESERVATION',
    'Chapter 2: Financial & Operations Tables',
    'Test table extraction to Excel/CSV, OCR region table capture, and Reading Mode table reflow'
  );

  p2.drawText('2.1 Q4 Regional Revenue & Margin Breakdown', {
    x: 42,
    y: 710,
    size: 16,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.28),
  });

  const p2Table1 = [
    ['Region', 'UnitsSold', 'GrossRevenue', 'NetProfit', 'YoYGrowth'],
    ['NorthAmerica', '14,820', '$1,482,000', '$412,500', '+18.4%'],
    ['EuropeWest', '11,340', '$1,134,000', '$318,900', '+14.2%'],
    ['MiddleEastMENA', '9,650', '$965,000', '$289,500', '+24.7%'],
    ['AsiaPacific', '16,210', '$1,621,000', '$486,300', '+29.1%'],
    ['LatinAmerica', '6,490', '$649,000', '$175,200', '+11.8%'],
  ];

  p2Table1.forEach((row, rIdx) => {
    const rowY = 674 - rIdx * 28;
    const isHead = rIdx === 0;
    p2.drawRectangle({
      x: 42,
      y: rowY - 7,
      width: 510,
      height: 26,
      color: isHead ? rgb(0.08, 0.38, 0.32) : rIdx % 2 === 0 ? rgb(0.95, 0.99, 0.97) : rgb(1, 1, 1),
      borderColor: rgb(0.78, 0.86, 0.82),
      borderWidth: 0.7,
    });
    const colX = [50, 175, 275, 385, 480];
    row.forEach((cell, cIdx) => {
      p2.drawText(cell, {
        x: colX[cIdx],
        y: rowY + cIdx * 0.03,
        size: 10.5,
        font: isHead ? fontBold : fontReg,
        color: isHead ? rgb(1, 1, 1) : rgb(0.14, 0.2, 0.18),
      });
    });
  });

  p2.drawText('2.2 Document Conversion Format Matrix', {
    x: 42,
    y: 470,
    size: 16,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.28),
  });

  const p2Table2 = [
    ['Format', 'Extension', 'TablePreservation', 'SearchablePDF'],
    ['ExcelWorkbook', '.xlsx / .xls', 'Multi-Sheet AutoTable', 'Yes (Vector)'],
    ['CommaSeparated', '.csv / .tsv', 'Full Grid + Headers', 'Yes (Vector)'],
    ['WordDocument', '.docx', 'Semantic Tables + Lists', 'Yes (Vector)'],
    ['ScannedImages', '.png / .jpg', 'OCR Grid Reconstruction', 'Yes (OCR Layer)'],
  ];

  p2Table2.forEach((row, rIdx) => {
    const rowY = 434 - rIdx * 28;
    const isHead = rIdx === 0;
    p2.drawRectangle({
      x: 42,
      y: rowY - 7,
      width: 510,
      height: 26,
      color: isHead ? rgb(0.24, 0.2, 0.52) : rIdx % 2 === 0 ? rgb(0.96, 0.96, 1) : rgb(1, 1, 1),
      borderColor: rgb(0.82, 0.82, 0.92),
      borderWidth: 0.7,
    });
    const colX = [50, 175, 295, 445];
    row.forEach((cell, cIdx) => {
      p2.drawText(cell, {
        x: colX[cIdx],
        y: rowY + cIdx * 0.03,
        size: 10.5,
        font: isHead ? fontBold : fontReg,
        color: isHead ? rgb(1, 1, 1) : rgb(0.18, 0.18, 0.28),
      });
    });
  });

  // PAGE 3: Chapter 3 — Book Reader & Comfort Reading Mode Showcase
  const p3 = doc.addPage([595.28, 841.89]);
  drawHeaderBanner(
    p3,
    'CHAPTER 3 • BOOK READER & COMFORT REFLOW MODE',
    'Chapter 3: The Art of Deep Focus & Book Reading',
    'Switch to "Book Mode" for 2-Page Spread or "Reading Mode" for Sepia/Night & Read Aloud TTS'
  );

  p3.drawText('3.1 Designing Distraction-Free Digital Books', {
    x: 42,
    y: 710,
    size: 16,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.28),
  });

  const bookParagraphs = [
    'Long-form technical books, research monographs, and financial reports demand more than a',
    'basic scrolling viewport. When readers navigate hundreds of pages, spatial memory plays a',
    'vital role in comprehension. By offering a dedicated Two-Page Book Spread alongside an',
    'always-accessible Book Content (Table of Contents) drawer, KasbPro bridges the tactile',
    'clarity of physical books with instant digital search and annotation.',
    '',
    '3.2 Eye-Care Reflow & Offline Voice Synthesis',
    'When reading on mobile devices or during evening study sessions, fixed-layout PDF columns',
    'often require constant pinching and horizontal panning. Comfort Reading Mode automatically',
    'extracts headings, paragraphs, and structured data tables into a responsive typography layout',
    'with Warm Sepia, Crisp Day, Night Dark, and Sage Green themes—plus built-in Read Aloud TTS.',
  ];

  bookParagraphs.forEach((line, idx) => {
    const isSubhead = line.startsWith('3.2');
    p3.drawText(line, {
      x: 42,
      y: 682 - idx * 22,
      size: isSubhead ? 16 : 11.5,
      font: isSubhead ? fontBold : fontReg,
      color: isSubhead ? rgb(0.12, 0.16, 0.28) : rgb(0.2, 0.24, 0.32),
    });
  });

  for (let i = 1; i <= 5; i++) {
    const pNum = i <= 2 ? i : 3;
    const targetPage = i === 1 ? p1 : i === 2 ? p2 : p3;
    if (i <= 3) {
      targetPage.drawText(`KasbPro Official Handbook • Page ${pNum} of 3`, {
        x: 215,
        y: 22,
        size: 9.5,
        font: fontReg,
        color: rgb(0.45, 0.5, 0.6),
      });
    }
  }

  return await doc.save();
}
