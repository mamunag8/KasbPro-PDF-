import React, { useEffect, useState } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Minus,
  Plus,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  ExtractedTable,
  LanguageCode,
  PageReflowContent,
  ReadingFont,
  ReadingTheme,
} from '../types/pdf';
import { extractPageReflowContent } from '../services/pdfEngine';
import {
  exportTablesToExcel,
  exportTableToCsv,
} from '../services/documentConverter';
import { TRANSLATIONS } from '../i18n/translations';

interface ComfortReadingModeProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  currentPage: number;
  pageCount: number;
  onChangePage: (page: number) => void;
  language: LanguageCode;
  docName: string;
}

export const ComfortReadingMode: React.FC<ComfortReadingModeProps> = ({
  pdfDoc,
  currentPage,
  pageCount,
  onChangePage,
  language,
  docName,
}) => {
  const t = TRANSLATIONS[language];
  const [theme, setTheme] = useState<ReadingTheme>('sepia');
  const [fontFamily, setFontFamily] = useState<ReadingFont>('serif');
  const [fontSize, setFontSize] = useState(18);
  const [content, setContent] = useState<PageReflowContent | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);

  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    extractPageReflowContent(pdfDoc, currentPage)
      .then((res) => {
        if (!cancelled) setContent(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleReadAloud = () => {
    if (!('speechSynthesis' in window) || !content) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      content.rawText || content.paragraphs.join('. ')
    );
    utterance.rate = speechRate;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const themeClass =
    theme === 'day'
      ? 'reading-theme-day'
      : theme === 'sepia'
      ? 'reading-theme-sepia'
      : theme === 'sage'
      ? 'reading-theme-sage'
      : 'reading-theme-night';

  const fontClass =
    fontFamily === 'serif'
      ? 'font-serif'
      : fontFamily === 'mono'
      ? 'font-mono'
      : 'font-sans';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Comfort Reading Control Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 select-none shrink-0">
        {/* Theme Selector */}
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400 me-1" />
          {(
            [
              { id: 'day', label: t.themeDay, bg: 'bg-white text-slate-900' },
              { id: 'sepia', label: t.themeSepia, bg: 'bg-[#f6efe0] text-[#3d3122]' },
              { id: 'sage', label: t.themeSage, bg: 'bg-[#e6f0e9] text-[#1f3528]' },
              { id: 'night', label: t.themeNight, bg: 'bg-slate-950 text-slate-100' },
            ] as const
          ).map((th) => (
            <button
              key={th.id}
              onClick={() => setTheme(th.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                th.bg
              } ${
                theme === th.id
                  ? 'ring-2 ring-indigo-500 border-indigo-500'
                  : 'border-slate-700 opacity-80 hover:opacity-100'
              }`}
            >
              {th.label}
            </button>
          ))}
        </div>

        {/* Font & Typography Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
            {(['serif', 'sans', 'mono'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFontFamily(f)}
                className={`px-2 py-1 rounded-md capitalize cursor-pointer ${
                  fontFamily === f
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-800 rounded-lg px-2 py-1 border border-slate-700 text-xs text-slate-200">
            <button
              onClick={() => setFontSize((s) => Math.max(13, s - 2))}
              className="p-0.5 hover:text-indigo-400 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-10 text-center font-mono">{fontSize}px</span>
            <button
              onClick={() => setFontSize((s) => Math.min(30, s + 2))}
              className="p-0.5 hover:text-indigo-400 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Offline Read Aloud TTS */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleReadAloud}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                isSpeaking
                  ? 'bg-rose-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>{t.stopReading}</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{t.readAloud}</span>
                </>
              )}
            </button>

            <select
              value={speechRate}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1.5 text-xs"
            >
              <option value={0.85}>0.85x</option>
              <option value={1.0}>1.0x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reflowed Reader Viewport (Maintains Tables + Clean Paragraphs) */}
      <div className={`flex-1 overflow-y-auto transition-colors ${themeClass}`}>
        <div
          className={`max-w-3xl mx-auto px-6 sm:px-12 py-10 space-y-6 ${fontClass}`}
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.75 }}
        >
          <div className="flex items-center justify-between border-b border-current/15 pb-3 text-xs font-sans opacity-75">
            <span>{docName}</span>
            <span>
              Page {currentPage} of {pageCount} • Reflow & Table-Preserving Mode
            </span>
          </div>

          {/* Paragraphs & Headings */}
          {content && content.paragraphs.length > 0 ? (
            <div className="space-y-4">
              {content.paragraphs.map((para, idx) => {
                if (para.startsWith('## ')) {
                  return (
                    <h2
                      key={idx}
                      className="font-bold tracking-tight pt-3 border-b border-current/10 pb-1"
                      style={{ fontSize: `${Math.round(fontSize * 1.28)}px` }}
                    >
                      {para.slice(3)}
                    </h2>
                  );
                }
                return (
                  <p key={idx} className="leading-relaxed">
                    {para}
                  </p>
                );
              })}
            </div>
          ) : (
            <p className="italic opacity-70">
              No embedded text found on this page. Use the "OCR & Tables" button in the top bar to recognize scanned text.
            </p>
          )}

          {/* Preserved Page Tables in Comfort Reading Mode */}
          {content && content.tables.length > 0 && (
            <div className="space-y-6 pt-4 font-sans">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider opacity-80">
                  Preserved Structured Tables on Page {currentPage} ({content.tables.length})
                </h3>
                <button
                  onClick={() => exportTablesToExcel(content.tables, docName)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{t.extractTables}</span>
                </button>
              </div>

              {content.tables.map((tbl: ExtractedTable) => (
                <div
                  key={tbl.id}
                  className="rounded-xl overflow-hidden border border-current/20 shadow-md"
                >
                  <div className="px-4 py-2 bg-indigo-900 text-white text-xs font-semibold flex items-center justify-between">
                    <span>{tbl.title}</span>
                    <button
                      onClick={() => exportTableToCsv(tbl, docName)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-700 hover:bg-indigo-600 text-[11px] cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <tbody>
                        {tbl.rows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={
                              rIdx === 0
                                ? 'bg-indigo-600/15 font-bold border-b border-current/20'
                                : 'border-b border-current/10'
                            }
                          >
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className="px-3 py-2 border-e border-current/10"
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

          {/* Bottom Page Turn Bar inside Reader */}
          <div className="pt-8 border-t border-current/15 flex items-center justify-between font-sans text-sm">
            <button
              onClick={() => onChangePage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-35 font-semibold cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Previous Page
            </button>
            <span className="font-semibold opacity-80">
              Page {currentPage} of {pageCount}
            </span>
            <button
              onClick={() => onChangePage(Math.min(pageCount, currentPage + 1))}
              disabled={currentPage >= pageCount}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-35 font-semibold cursor-pointer"
            >
              Next Page <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
