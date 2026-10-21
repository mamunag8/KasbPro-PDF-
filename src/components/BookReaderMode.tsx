import React, { useEffect, useRef, useState } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import {
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  FileText,
  ListTree,
} from 'lucide-react';
import type { LanguageCode, OutlineNode } from '../types/pdf';
import { renderPdfPageToCanvas } from '../services/pdfEngine';
import { TRANSLATIONS } from '../i18n/translations';

interface BookReaderModeProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  currentPage: number;
  pageCount: number;
  onChangePage: (page: number) => void;
  outline: OutlineNode[];
  bookmarks: number[];
  onToggleBookmark: (page: number) => void;
  pageRotations: Record<number, number>;
  language: LanguageCode;
}

export const BookReaderMode: React.FC<BookReaderModeProps> = ({
  pdfDoc,
  currentPage,
  pageCount,
  onChangePage,
  outline,
  bookmarks,
  onToggleBookmark,
  pageRotations,
  language,
}) => {
  const t = TRANSLATIONS[language];
  const [twoPageSpread, setTwoPageSpread] = useState(true);
  const [showChapterDrawer, setShowChapterDrawer] = useState(true);

  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);

  const leftPage = twoPageSpread
    ? currentPage % 2 === 0
      ? Math.max(1, currentPage - 1)
      : currentPage
    : currentPage;
  const rightPage =
    twoPageSpread && leftPage + 1 <= pageCount ? leftPage + 1 : null;

  useEffect(() => {
    if (!pdfDoc) return;
    if (leftCanvasRef.current) {
      renderPdfPageToCanvas(
        pdfDoc,
        leftPage,
        leftCanvasRef.current,
        1.05,
        pageRotations[leftPage] || 0
      ).catch(() => {});
    }
    if (rightPage && rightCanvasRef.current) {
      renderPdfPageToCanvas(
        pdfDoc,
        rightPage,
        rightCanvasRef.current,
        1.05,
        pageRotations[rightPage] || 0
      ).catch(() => {});
    }
  }, [pdfDoc, leftPage, rightPage, pageRotations]);

  const activeChapter =
    [...outline]
      .reverse()
      .find((node) => node.pageNumber <= leftPage) || outline[0];

  const progressPercent = Math.round(
    ((rightPage || leftPage) / Math.max(1, pageCount)) * 100
  );

  const stepBackward = () => {
    const step = twoPageSpread ? 2 : 1;
    onChangePage(Math.max(1, leftPage - step));
  };

  const stepForward = () => {
    const step = twoPageSpread ? 2 : 1;
    onChangePage(Math.min(pageCount, leftPage + step));
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* Book Mode Subbar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setShowChapterDrawer((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
              showChapterDrawer
                ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            <span>{t.sidebarBookContent}</span>
          </button>

          {activeChapter && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-300 truncate">
              <span className="text-slate-500">•</span>
              <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-medium truncate">{activeChapter.title}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTwoPageSpread(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              twoPageSpread
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.twoPageSpread}</span>
          </button>

          <button
            onClick={() => setTwoPageSpread(false)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              !twoPageSpread
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.singlePageSpread}</span>
          </button>
        </div>
      </div>

      {/* Main Book Spread + Optional Chapter TOC Drawer */}
      <div className="flex-1 flex overflow-hidden">
        {showChapterDrawer && (
          <div className="w-64 bg-slate-900/95 border-e border-slate-800 p-3 overflow-y-auto space-y-1.5 shrink-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-1">
              {t.sidebarBookContent} ({outline.length})
            </div>
            {outline.map((node) => {
              const isCurrent =
                node.pageNumber === leftPage || node.pageNumber === rightPage;
              return (
                <button
                  key={node.id}
                  onClick={() => onChangePage(node.pageNumber)}
                  className={`w-full text-start px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{node.title}</span>
                  <span className="text-[10px] opacity-75 shrink-0">
                    p.{node.pageNumber}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Book Canvas Stage */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          <div className="flex items-center gap-4">
            <button
              onClick={stepBackward}
              disabled={leftPage <= 1}
              className="p-3 rounded-full bg-slate-800/90 hover:bg-indigo-600 disabled:opacity-30 text-white shadow-xl transition-colors cursor-pointer"
              title="Previous Page Spread"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Book Spread Pages */}
            <div className="flex flex-col lg:flex-row items-center justify-center rounded-lg overflow-hidden shadow-2xl border border-slate-700/70 bg-stone-100">
              {/* Left Page */}
              <div className="relative bg-white book-spread-left">
                <button
                  onClick={() => onToggleBookmark(leftPage)}
                  title="Bookmark Left Page"
                  className={`absolute top-0 end-4 z-10 px-1.5 py-2 rounded-b-md shadow transition-colors cursor-pointer ${
                    bookmarks.includes(leftPage)
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-200/80 text-slate-600 hover:bg-amber-400 hover:text-white'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                </button>
                <canvas ref={leftCanvasRef} className="block max-h-[75vh] w-auto" />
                <div className="text-center py-1.5 text-[11px] font-serif text-slate-600 bg-stone-50 border-t border-stone-200">
                  Page {leftPage}
                </div>
              </div>

              {/* Right Page (in 2-Page Spread Mode) */}
              {rightPage && (
                <div className="relative bg-white book-spread-right border-s border-stone-300">
                  <button
                    onClick={() => onToggleBookmark(rightPage)}
                    title="Bookmark Right Page"
                    className={`absolute top-0 end-4 z-10 px-1.5 py-2 rounded-b-md shadow transition-colors cursor-pointer ${
                      bookmarks.includes(rightPage)
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-200/80 text-slate-600 hover:bg-amber-400 hover:text-white'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                  </button>
                  <canvas ref={rightCanvasRef} className="block max-h-[75vh] w-auto" />
                  <div className="text-center py-1.5 text-[11px] font-serif text-slate-600 bg-stone-50 border-t border-stone-200">
                    Page {rightPage}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={stepForward}
              disabled={(rightPage || leftPage) >= pageCount}
              className="p-3 rounded-full bg-slate-800/90 hover:bg-indigo-600 disabled:opacity-30 text-white shadow-xl transition-colors cursor-pointer"
              title="Next Page Spread"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Book Reading Progress Footer */}
      <div className="h-10 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between text-xs text-slate-300 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-indigo-300">
            {rightPage
              ? `Pages ${leftPage}–${rightPage} of ${pageCount}`
              : `Page ${leftPage} of ${pageCount}`}
          </span>
          {activeChapter && (
            <span className="text-slate-400 hidden sm:inline">
              • {activeChapter.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 w-48 sm:w-64">
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-emerald-300 w-10 text-end">
            {progressPercent}%
          </span>
        </div>
      </div>
    </div>
  );
};
