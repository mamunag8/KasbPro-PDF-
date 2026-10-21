import React, { useEffect, useRef, useState } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Star,
  ScanText,
  FileEdit,
} from 'lucide-react';
import type {
  AnnotationItem,
  EditorTool,
  LanguageCode,
  PdfTextItem,
} from '../types/pdf';
import {
  extractPageTextItems,
  renderPdfPageToCanvas,
} from '../services/pdfEngine';
import { TRANSLATIONS } from '../i18n/translations';

interface CommonPdfViewportProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  currentPage: number;
  pageCount: number;
  onChangePage: (page: number) => void;
  zoom: number;
  onChangeZoom: (zoom: number) => void;
  rotation: number;
  activeTool: EditorTool;
  activeColor: string;
  annotations: AnnotationItem[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onAddAnnotation: (ann: AnnotationItem) => void;
  onUpdateAnnotation: (id: string, patch: Partial<AnnotationItem>) => void;
  onDeleteAnnotation: (id: string) => void;
  onRegionOcrSelected: (region: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  language: LanguageCode;
}

export const CommonPdfViewport: React.FC<CommonPdfViewportProps> = ({
  pdfDoc,
  currentPage,
  pageCount,
  onChangePage,
  zoom,
  onChangeZoom,
  rotation,
  activeTool,
  activeColor,
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onRegionOcrSelected,
  isBookmarked,
  onToggleBookmark,
  language,
}) => {
  const t = TRANSLATIONS[language];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const [surfaceSize, setSurfaceSize] = useState({ width: 680, height: 960 });
  const [textItems, setTextItems] = useState<PdfTextItem[]>([]);

  // Dragging / Drawing / Marquee state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [draggingAnnId, setDraggingAnnId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    renderPdfPageToCanvas(
      pdfDoc,
      currentPage,
      canvasRef.current,
      zoom * 1.25,
      rotation
    )
      .then((dims) => {
        if (!cancelled) setSurfaceSize(dims);
      })
      .catch(() => {});

    extractPageTextItems(pdfDoc, currentPage, rotation)
      .then((items) => {
        if (!cancelled) setTextItems(items);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, zoom, rotation]);

  const pageAnnotations = annotations.filter((a) => a.pageNumber === currentPage);

  const getRelativePercent = (clientX: number, clientY: number) => {
    if (!surfaceRef.current) return { x: 0, y: 0 };
    const rect = surfaceRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handleSurfaceMouseDown = (e: React.MouseEvent) => {
    if (e.target !== surfaceRef.current && e.target !== canvasRef.current) return;

    const pt = getRelativePercent(e.clientX, e.clientY);

    if (activeTool === 'select' || activeTool === 'pan') {
      onSelectAnnotation(null);
      return;
    }

    if (activeTool === 'add-text') {
      const id = `ann-${Date.now()}`;
      onAddAnnotation({
        id,
        pageNumber: currentPage,
        type: 'text',
        x: pt.x,
        y: pt.y,
        width: 28,
        height: 4.5,
        color: activeColor,
        fontSize: 13,
        text: 'Type text here...',
        createdAt: new Date().toISOString(),
      });
      onSelectAnnotation(id);
      return;
    }

    if (activeTool === 'note') {
      const id = `ann-${Date.now()}`;
      onAddAnnotation({
        id,
        pageNumber: currentPage,
        type: 'note',
        x: pt.x,
        y: pt.y,
        width: 26,
        height: 11,
        color: '#f59e0b',
        text: 'Action note: Review this section...',
        createdAt: new Date().toISOString(),
      });
      onSelectAnnotation(id);
      return;
    }

    if (activeTool === 'checkmark') {
      const id = `ann-${Date.now()}`;
      onAddAnnotation({
        id,
        pageNumber: currentPage,
        type: 'checkmark',
        x: pt.x - 1.5,
        y: pt.y - 1.5,
        width: 4,
        height: 3.5,
        color: activeColor,
        text: '✓',
        fontSize: 18,
        createdAt: new Date().toISOString(),
      });
      return;
    }

    if (activeTool === 'draw') {
      setIsDrawing(true);
      setFreehandPoints([pt]);
      return;
    }

    if (
      activeTool === 'highlight' ||
      activeTool === 'underline' ||
      activeTool === 'rect' ||
      activeTool === 'circle' ||
      activeTool === 'redact' ||
      activeTool === 'ocr-region'
    ) {
      setIsDrawing(true);
      setDrawStart(pt);
      setDrawCurrent(pt);
    }
  };

  const handleSurfaceMouseMove = (e: React.MouseEvent) => {
    const pt = getRelativePercent(e.clientX, e.clientY);

    if (draggingAnnId) {
      onUpdateAnnotation(draggingAnnId, {
        x: Math.max(0, Math.min(92, pt.x - dragOffset.dx)),
        y: Math.max(0, Math.min(94, pt.y - dragOffset.dy)),
      });
      return;
    }

    if (!isDrawing) return;

    if (activeTool === 'draw') {
      setFreehandPoints((prev) => [...prev, pt]);
      return;
    }

    if (drawStart) {
      setDrawCurrent(pt);
    }
  };

  const handleSurfaceMouseUp = () => {
    if (draggingAnnId) {
      setDraggingAnnId(null);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (activeTool === 'draw' && freehandPoints.length > 1) {
      const xs = freehandPoints.map((p) => p.x);
      const ys = freehandPoints.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      onAddAnnotation({
        id: `ann-${Date.now()}`,
        pageNumber: currentPage,
        type: 'draw',
        x: minX,
        y: minY,
        width: Math.max(2, maxX - minX),
        height: Math.max(2, maxY - minY),
        color: activeColor,
        strokeWidth: 2.5,
        points: freehandPoints,
        createdAt: new Date().toISOString(),
      });
      setFreehandPoints([]);
      return;
    }

    if (drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      const width = Math.max(3, Math.abs(drawCurrent.x - drawStart.x));
      const height = Math.max(2, Math.abs(drawCurrent.y - drawStart.y));

      if (activeTool === 'ocr-region') {
        onRegionOcrSelected({ x, y, width, height });
      } else if (
        activeTool === 'highlight' ||
        activeTool === 'underline' ||
        activeTool === 'rect' ||
        activeTool === 'circle' ||
        activeTool === 'redact'
      ) {
        onAddAnnotation({
          id: `ann-${Date.now()}`,
          pageNumber: currentPage,
          type: activeTool,
          x,
          y,
          width,
          height,
          color:
            activeTool === 'highlight'
              ? '#f59e0b'
              : activeTool === 'redact'
              ? '#000000'
              : activeColor,
          opacity: activeTool === 'highlight' ? 0.35 : 1,
          createdAt: new Date().toISOString(),
        });
      }
    }

    setDrawStart(null);
    setDrawCurrent(null);
  };

  /**
   * Clicking an existing PDF text item when in "Edit PDF Text" or "Highlight" mode
   */
  const handleClickExistingPdfText = (item: PdfTextItem) => {
    if (activeTool === 'edit-text') {
      const id = `replace-${Date.now()}`;
      onAddAnnotation({
        id,
        pageNumber: currentPage,
        type: 'replace-text',
        x: Math.max(0, item.x - 0.3),
        y: Math.max(0, item.y - 0.2),
        width: Math.max(item.width + 4, 22),
        height: Math.max(item.height + 0.8, 3.2),
        color: '#0f172a',
        backgroundColor: '#ffffff',
        fontSize: item.fontSize || 12,
        text: item.text,
        originalText: item.text,
        createdAt: new Date().toISOString(),
      });
      onSelectAnnotation(id);
    } else if (activeTool === 'highlight' || activeTool === 'underline') {
      onAddAnnotation({
        id: `markup-${Date.now()}`,
        pageNumber: currentPage,
        type: activeTool,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        color: activeTool === 'highlight' ? '#f59e0b' : activeColor,
        opacity: activeTool === 'highlight' ? 0.38 : 1,
        text: item.text,
        createdAt: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
      {/* Contextual Hint Banner when using Edit PDF Text or Region OCR */}
      {(activeTool === 'edit-text' || activeTool === 'ocr-region') && (
        <div className="bg-indigo-950/90 border-b border-indigo-500/30 px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-indigo-200 shrink-0">
          {activeTool === 'edit-text' ? (
            <>
              <FileEdit className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t.clickTextToEditHint}</span>
            </>
          ) : (
            <>
              <ScanText className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.dragRegionOcrHint}</span>
            </>
          )}
        </div>
      )}

      {/* Main Scrollable PDF Canvas Container */}
      <div className="flex-1 overflow-auto flex justify-center items-start p-4 sm:p-8">
        <div
          ref={surfaceRef}
          onMouseDown={handleSurfaceMouseDown}
          onMouseMove={handleSurfaceMouseMove}
          onMouseUp={handleSurfaceMouseUp}
          style={{
            width: `${surfaceSize.width}px`,
            height: `${surfaceSize.height}px`,
          }}
          className={`relative bg-white shadow-2xl rounded-sm select-none ${
            activeTool === 'pan'
              ? 'cursor-grab'
              : activeTool === 'ocr-region' ||
                activeTool === 'rect' ||
                activeTool === 'circle' ||
                activeTool === 'redact'
              ? 'cursor-crosshair'
              : 'cursor-default'
          }`}
        >
          <canvas ref={canvasRef} className="block pointer-events-none" />

          {/* Interactive Existing PDF Text Layer (for In-Place Text Editing & One-Click Highlight) */}
          {(activeTool === 'edit-text' ||
            activeTool === 'highlight' ||
            activeTool === 'underline') &&
            textItems.map((item) => (
              <div
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClickExistingPdfText(item);
                }}
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${item.width}%`,
                  height: `${item.height}%`,
                }}
                title={`Click to ${
                  activeTool === 'edit-text' ? 'edit text in-place' : activeTool
                }: "${item.text}"`}
                className={`absolute transition-colors cursor-pointer rounded-xs ${
                  activeTool === 'edit-text'
                    ? 'hover:bg-indigo-500/20 hover:outline-1 hover:outline-dashed hover:outline-indigo-600'
                    : 'hover:bg-amber-400/30'
                }`}
              />
            ))}

          {/* SVG Freehand Ink Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {pageAnnotations
              .filter((a) => a.type === 'draw' && a.points && a.points.length > 1)
              .map((ann) => (
                <polyline
                  key={ann.id}
                  fill="none"
                  stroke={ann.color}
                  strokeWidth={ann.strokeWidth || 2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={ann
                    .points!.map(
                      (p) =>
                        `${(p.x / 100) * surfaceSize.width},${
                          (p.y / 100) * surfaceSize.height
                        }`
                    )
                    .join(' ')}
                />
              ))}

            {isDrawing && activeTool === 'draw' && freehandPoints.length > 1 && (
              <polyline
                fill="none"
                stroke={activeColor}
                strokeWidth={2.5}
                strokeLinecap="round"
                points={freehandPoints
                  .map(
                    (p) =>
                      `${(p.x / 100) * surfaceSize.width},${
                        (p.y / 100) * surfaceSize.height
                      }`
                  )
                  .join(' ')}
              />
            )}
          </svg>

          {/* Active Marquee Selection Preview (OCR Region / Shapes / Highlight) */}
          {isDrawing && drawStart && drawCurrent && (
            <div
              style={{
                left: `${Math.min(drawStart.x, drawCurrent.x)}%`,
                top: `${Math.min(drawStart.y, drawCurrent.y)}%`,
                width: `${Math.abs(drawCurrent.x - drawStart.x)}%`,
                height: `${Math.abs(drawCurrent.y - drawStart.y)}%`,
              }}
              className={`absolute pointer-events-none ${
                activeTool === 'ocr-region'
                  ? 'border-2 border-dashed border-amber-500 bg-amber-400/20'
                  : activeTool === 'highlight'
                  ? 'bg-amber-400/35'
                  : 'border-2 border-indigo-600 bg-indigo-500/10'
              }`}
            />
          )}

          {/* Rendered Page Annotations (Text Replacements, Text Boxes, Notes, Tables, Signatures, Stamps, Shapes) */}
          {pageAnnotations.map((ann) => {
            if (ann.type === 'draw') return null;
            const isSelected = selectedAnnotationId === ann.id;

            const startDrag = (e: React.MouseEvent) => {
              e.stopPropagation();
              onSelectAnnotation(ann.id);
              const pt = getRelativePercent(e.clientX, e.clientY);
              setDragOffset({ dx: pt.x - ann.x, dy: pt.y - ann.y });
              setDraggingAnnId(ann.id);
            };

            return (
              <div
                key={ann.id}
                onMouseDown={startDrag}
                style={{
                  left: `${ann.x}%`,
                  top: `${ann.y}%`,
                  width: `${ann.width}%`,
                  minHeight: `${ann.height}%`,
                }}
                className={`absolute group ${
                  isSelected
                    ? 'ring-2 ring-indigo-500 z-20'
                    : 'hover:ring-1 hover:ring-indigo-400/70 z-10'
                }`}
              >
                {/* Delete Quick Button when selected */}
                {isSelected && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAnnotation(ann.id);
                    }}
                    className="absolute -top-6 end-0 bg-rose-600 text-white p-1 rounded shadow cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}

                {ann.type === 'highlight' && (
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundColor: ann.color,
                      opacity: ann.opacity ?? 0.35,
                    }}
                  />
                )}

                {ann.type === 'underline' && (
                  <div
                    className="w-full h-full border-b-2"
                    style={{ borderColor: ann.color }}
                  />
                )}

                {ann.type === 'redact' && (
                  <div className="w-full h-full bg-black flex items-center justify-center text-[9px] text-neutral-400 font-mono tracking-widest uppercase">
                    REDACTED
                  </div>
                )}

                {ann.type === 'rect' && (
                  <div
                    className="w-full h-full border-2"
                    style={{ borderColor: ann.color }}
                  />
                )}

                {ann.type === 'circle' && (
                  <div
                    className="w-full h-full border-2 rounded-full"
                    style={{ borderColor: ann.color }}
                  />
                )}

                {ann.type === 'checkmark' && (
                  <div
                    className="font-bold select-none leading-none"
                    style={{
                      color: ann.color,
                      fontSize: `${(ann.fontSize || 18) * zoom}px`,
                    }}
                  >
                    ✓
                  </div>
                )}

                {(ann.type === 'text' || ann.type === 'replace-text') && (
                  <input
                    type="text"
                    value={ann.text || ''}
                    onChange={(e) =>
                      onUpdateAnnotation(ann.id, { text: e.target.value })
                    }
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onSelectAnnotation(ann.id)}
                    style={{
                      color: ann.color || '#0f172a',
                      backgroundColor:
                        ann.type === 'replace-text'
                          ? ann.backgroundColor || '#ffffff'
                          : 'rgba(255,255,255,0.88)',
                      fontSize: `${Math.max(11, (ann.fontSize || 12) * zoom)}px`,
                    }}
                    className="w-full px-1 py-0.5 border border-indigo-400/50 rounded-xs focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans"
                  />
                )}

                {ann.type === 'note' && (
                  <div className="bg-amber-100 border border-amber-400 rounded-md p-1.5 shadow-md text-slate-900">
                    <div className="text-[9px] font-bold uppercase text-amber-800 mb-0.5">
                      Sticky Note
                    </div>
                    <textarea
                      value={ann.text || ''}
                      onChange={(e) =>
                        onUpdateAnnotation(ann.id, { text: e.target.value })
                      }
                      onMouseDown={(e) => e.stopPropagation()}
                      rows={2}
                      className="w-full bg-transparent text-xs text-slate-900 resize-none focus:outline-none"
                    />
                  </div>
                )}

                {ann.type === 'stamp' && (
                  <div
                    style={{
                      borderColor: ann.color,
                      color: ann.color,
                    }}
                    className="border-2 px-3 py-1 rounded font-extrabold tracking-widest uppercase text-center text-xs bg-white/85 shadow-sm"
                  >
                    {ann.text || ann.stampVariant || 'APPROVED'}
                  </div>
                )}

                {ann.type === 'signature' && (
                  <div className="bg-transparent p-1 flex items-center justify-center">
                    {ann.imageDataUrl ? (
                      <img
                        src={ann.imageDataUrl}
                        alt="Signature"
                        className="max-h-16 object-contain pointer-events-none"
                      />
                    ) : (
                      <span
                        style={{ color: ann.color }}
                        className="font-serif italic text-xl font-bold"
                      >
                        {ann.text || 'Signed'}
                      </span>
                    )}
                  </div>
                )}

                {/* Inline Editable Table Directly on the PDF Page */}
                {ann.type === 'table' && ann.tableData && (
                  <div
                    onMouseDown={(e) => e.stopPropagation()}
                    className="bg-white border border-slate-400 rounded shadow-lg overflow-hidden text-slate-900"
                  >
                    <div className="bg-indigo-900 text-white px-2 py-1 flex items-center justify-between text-[10px]">
                      <span
                        onMouseDown={startDrag}
                        className="font-semibold cursor-move"
                      >
                        ⠿ Inline PDF Table (Drag here)
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const cols = ann.tableData![0]?.length || 3;
                            onUpdateAnnotation(ann.id, {
                              tableData: [
                                ...ann.tableData!,
                                new Array(cols).fill('New Cell'),
                              ],
                              height: ann.height + 3.5,
                            });
                          }}
                          className="px-1.5 py-0.5 rounded bg-indigo-700 hover:bg-indigo-600 flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" /> Row
                        </button>
                        <button
                          onClick={() => {
                            onUpdateAnnotation(ann.id, {
                              tableData: ann.tableData!.map((r, idx) => [
                                ...r,
                                idx === 0 ? `Col ${r.length + 1}` : 'Value',
                              ]),
                              width: Math.min(92, ann.width + 10),
                            });
                          }}
                          className="px-1.5 py-0.5 rounded bg-indigo-700 hover:bg-indigo-600 flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" /> Col
                        </button>
                      </div>
                    </div>
                    <table className="w-full border-collapse text-xs">
                      <tbody>
                        {ann.tableData.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={
                              rIdx === 0
                                ? 'bg-indigo-950 text-white font-semibold'
                                : rIdx % 2 === 0
                                ? 'bg-slate-50'
                                : 'bg-white'
                            }
                          >
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className="border border-slate-300 p-0.5"
                              >
                                <input
                                  type="text"
                                  value={cell}
                                  onChange={(e) => {
                                    const copy = ann.tableData!.map((r) => [
                                      ...r,
                                    ]);
                                    copy[rIdx][cIdx] = e.target.value;
                                    onUpdateAnnotation(ann.id, {
                                      tableData: copy,
                                    });
                                  }}
                                  className={`w-full px-1 py-0.5 text-[11px] bg-transparent focus:outline-none ${
                                    rIdx === 0
                                      ? 'text-white font-bold'
                                      : 'text-slate-900'
                                  }`}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Floating Navigation & Zoom Pill */}
      <div className="bottom-4 inset-x-0 flex justify-center pointer-events-none pb-3 shrink-0">
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl px-3 py-1.5 shadow-2xl flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onChangePage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-35 text-slate-200 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-200 px-2">
              {t.pageOf
                .replace('{current}', String(currentPage))
                .replace('{total}', String(pageCount))}
            </span>
            <button
              onClick={() => onChangePage(Math.min(pageCount, currentPage + 1))}
              disabled={currentPage >= pageCount}
              className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-35 text-slate-200 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <div className="flex items-center gap-1">
            <button
              onClick={() => onChangeZoom(Math.max(0.5, Number((zoom - 0.15).toFixed(2))))}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-200 cursor-pointer"
              title={t.zoomOut}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="w-12 text-center font-mono text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => onChangeZoom(Math.min(2.5, Number((zoom + 0.15).toFixed(2))))}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-200 cursor-pointer"
              title={t.zoomIn}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => onChangeZoom(1)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
              title="Reset Zoom 100%"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <button
            onClick={onToggleBookmark}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${
              isBookmarked
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                isBookmarked ? 'fill-amber-400 text-amber-400' : ''
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
