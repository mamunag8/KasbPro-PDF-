import React, { useEffect, useState } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import {
  Check,
  Copy,
  FileSpreadsheet,
  PlusCircle,
  ScanText,
  Sparkles,
  Table2,
  X,
} from 'lucide-react';
import type { ExtractedTable } from '../types/pdf';
import {
  runOfflinePageOrRegionOcr,
  type OcrScanResult,
} from '../services/ocrEngine';
import {
  exportTablesToExcel,
  exportTableToCsv,
} from '../services/documentConverter';
import { SUPPORTED_LANGUAGES } from '../i18n/translations';

interface OcrAndTableModalProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  currentPage: number;
  initialRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  defaultOcrLang: string;
  docName: string;
  onClose: () => void;
  onInsertRecognizedTextOnPage: (text: string) => void;
  onInsertExtractedTableOnPage: (table: ExtractedTable) => void;
}

export const OcrAndTableModal: React.FC<OcrAndTableModalProps> = ({
  pdfDoc,
  currentPage,
  initialRegion,
  defaultOcrLang,
  docName,
  onClose,
  onInsertRecognizedTextOnPage,
  onInsertExtractedTableOnPage,
}) => {
  const [ocrLang, setOcrLang] = useState(defaultOcrLang || 'eng');
  const [enhanceScan, setEnhanceScan] = useState(true);
  const [binarize, setBinarize] = useState(false);
  const [forceVisualOcr, setForceVisualOcr] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<OcrScanResult | null>(null);
  const [copied, setCopied] = useState(false);

  const executeScan = async () => {
    if (!pdfDoc) return;
    setIsRunning(true);
    setProgress(5);
    setStatusText('Initializing offline OCR & table detector...');
    try {
      const scanRes = await runOfflinePageOrRegionOcr(
        pdfDoc,
        currentPage,
        {
          language: ocrLang,
          enhanceScan,
          binarize,
          region: initialRegion || undefined,
          forceVisualOcr,
        },
        (pct, msg) => {
          setProgress(pct);
          setStatusText(msg);
        }
      );
      setResult(scanRes);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    executeScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <ScanText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Offline OCR & Structured Table Extractor (Page {currentPage})
              </h3>
              <p className="text-xs text-slate-400">
                {initialRegion
                  ? 'Scanning selected marquee area on page'
                  : 'Scanning full page for text and multi-column tables'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scan Options Bar */}
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-slate-300">
              <span>OCR Script:</span>
              <select
                value={ocrLang}
                onChange={(e) => setOcrLang(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.ocrLang}>
                    {l.name} ({l.nativeName})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enhanceScan}
                onChange={(e) => setEnhanceScan(e.target.checked)}
                className="rounded accent-indigo-500"
              />
              <span>Auto-Contrast Cleanup</span>
            </label>

            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={binarize}
                onChange={(e) => setBinarize(e.target.checked)}
                className="rounded accent-indigo-500"
              />
              <span>Binarize Scan (B&W)</span>
            </label>

            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={forceVisualOcr}
                onChange={(e) => setForceVisualOcr(e.target.checked)}
                className="rounded accent-indigo-500"
              />
              <span>Force Optical Tesseract</span>
            </label>
          </div>

          <button
            onClick={executeScan}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRunning ? 'Scanning...' : 'Re-Scan Page'}</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isRunning && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
                <span>{statusText}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {result && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left: Processed Scan Surface Preview */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col items-center">
                <div className="w-full flex items-center justify-between text-[11px] text-slate-400 mb-2">
                  <span>Pre-Processed Scan Surface</span>
                  <span className="text-emerald-400 font-semibold">
                    {result.confidence}% Conf
                  </span>
                </div>
                <img
                  src={result.processedImageDataUrl}
                  alt="Processed OCR Scan"
                  className="max-h-72 object-contain rounded border border-slate-800 bg-white"
                />
              </div>

              {/* Right 2 Cols: Recognized Text + Structured Tables */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Recognized Editable Text
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(result.text);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1800);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copied ? 'Copied' : 'Copy Text'}</span>
                      </button>

                      <button
                        onClick={() => {
                          onInsertRecognizedTextOnPage(result.text.slice(0, 180));
                          onClose();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Insert as Editable Box</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={result.text}
                    onChange={(e) =>
                      setResult({ ...result, text: e.target.value })
                    }
                    rows={6}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 font-mono leading-relaxed focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Detected Tables Section */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Table2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Extracted Structured Tables ({result.tables.length})
                      </span>
                    </div>

                    {result.tables.length > 0 && (
                      <button
                        onClick={() =>
                          exportTablesToExcel(result.tables, docName)
                        }
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Download All as Excel (.xlsx)</span>
                      </button>
                    )}
                  </div>

                  {result.tables.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No multi-column table grid detected on this page.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {result.tables.map((tbl) => (
                        <div
                          key={tbl.id}
                          className="border border-slate-800 rounded-lg overflow-hidden"
                        >
                          <div className="bg-slate-900 px-3 py-1.5 flex items-center justify-between text-xs">
                            <span className="font-semibold text-indigo-300">
                              {tbl.title}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => exportTableToCsv(tbl, docName)}
                                className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                              >
                                Export CSV
                              </button>
                              <button
                                onClick={() => {
                                  onInsertExtractedTableOnPage(tbl);
                                  onClose();
                                }}
                                className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] cursor-pointer"
                              >
                                Edit Table on Page
                              </button>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <tbody>
                                {tbl.rows.map((row, rIdx) => (
                                  <tr
                                    key={rIdx}
                                    className={
                                      rIdx === 0
                                        ? 'bg-slate-800/90 font-bold text-white'
                                        : 'border-t border-slate-800/70 text-slate-300'
                                    }
                                  >
                                    {row.map((cell, cIdx) => (
                                      <td
                                        key={cIdx}
                                        className="px-2.5 py-1.5 border-e border-slate-800/70"
                                      >
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
