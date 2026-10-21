import React, { useEffect, useRef, useState } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import {
  Bookmark,
  BookOpen,
  Download,
  FilePlus2,
  Grid,
  RotateCw,
  Search,
  Star,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import type {
  AnnotationItem,
  LanguageCode,
  OutlineNode,
  SidebarTab,
} from '../types/pdf';
import { TRANSLATIONS } from '../i18n/translations';
import {
  extractPageTextItems,
  renderPdfPageToCanvas,
} from '../services/pdfEngine';

interface LeftSidebarProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  pageCount: number;
  currentPage: number;
  onSelectPage: (pageNumber: number) => void;
  activeTab: SidebarTab;
  onChangeTab: (tab: SidebarTab) => void;
  outline: OutlineNode[];
  bookmarks: number[];
  onToggleBookmark: (pageNumber: number) => void;
  annotations: AnnotationItem[];
  pageRotations: Record<number, number>;
  onRotateSpecificPage: (pageNumber: number) => void;
  onInsertBlankAfter: (pageNumber: number) => void;
  onDeletePage: (pageNumber: number) => void;
  language: LanguageCode;
}

const PageThumbnailCard: React.FC<{
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  isCurrent: boolean;
  isBookmarked: boolean;
  rotation: number;
  annotationCount: number;
  onSelect: () => void;
  onToggleBookmark: () => void;
  onRotate: () => void;
  onInsertAfter: () => void;
  onDelete: () => void;
  canDelete: boolean;
}> = ({
  pdfDoc,
  pageNumber,
  isCurrent,
  isBookmarked,
  rotation,
  annotationCount,
  onSelect,
  onToggleBookmark,
  onRotate,
  onInsertAfter,
  onDelete,
  canDelete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    if (canvasRef.current && pdfDoc) {
      renderPdfPageToCanvas(
        pdfDoc,
        pageNumber,
        canvasRef.current,
        0.24,
        rotation
      ).catch(() => {});
    }
    return () => {
      active = false;
      void active;
    };
  }, [pdfDoc, pageNumber, rotation]);

  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-xl p-2 border transition-all cursor-pointer ${
        isCurrent
          ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500/50'
          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span
          className={`text-xs font-semibold ${
            isCurrent ? 'text-indigo-300' : 'text-slate-400'
          }`}
        >
          Page {pageNumber}
        </span>

        <div className="flex items-center gap-1">
          {annotationCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
              {annotationCount}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark();
            }}
            className="p-1 rounded hover:bg-slate-700/70"
            title="Bookmark Page"
          >
            <Star
              className={`w-3.5 h-3.5 ${
                isBookmarked
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-500 group-hover:text-slate-300'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex justify-center bg-slate-950/60 rounded-lg p-1.5 overflow-hidden">
        <canvas ref={canvasRef} className="rounded shadow-sm max-w-full h-auto" />
      </div>

      {/* Quick Page Actions on Hover */}
      <div className="mt-1.5 flex items-center justify-center gap-1 opacity-85 group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRotate();
          }}
          title="Rotate Page 90°"
          className="p-1 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[10px]"
        >
          <RotateCw className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onInsertAfter();
          }}
          title="Insert Blank Page After"
          className="p-1 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[10px]"
        >
          <FilePlus2 className="w-3 h-3" />
        </button>
        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete Page"
            className="p-1 rounded bg-slate-800/90 hover:bg-rose-900/60 text-rose-400 text-[10px]"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  pdfDoc,
  pageCount,
  currentPage,
  onSelectPage,
  activeTab,
  onChangeTab,
  outline,
  bookmarks,
  onToggleBookmark,
  annotations,
  pageRotations,
  onRotateSpecificPage,
  onInsertBlankAfter,
  onDeletePage,
  language,
}) => {
  const t = TRANSLATIONS[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ pageNumber: number; snippet: string }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  const runFullTextSearch = async (q: string) => {
    setSearchQuery(q);
    if (!pdfDoc || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const matches: Array<{ pageNumber: number; snippet: string }> = [];
    const lowerQ = q.toLowerCase();

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const items = await extractPageTextItems(pdfDoc, p);
      const joined = items.map((i) => i.text).join(' ');
      const idx = joined.toLowerCase().indexOf(lowerQ);
      if (idx !== -1) {
        const start = Math.max(0, idx - 32);
        const end = Math.min(joined.length, idx + q.length + 48);
        matches.push({
          pageNumber: p,
          snippet: `${start > 0 ? '...' : ''}${joined.slice(start, end)}${
            end < joined.length ? '...' : ''
          }`,
        });
      }
    }
    setSearchResults(matches);
    setIsSearching(false);
  };

  const exportNotesMarkdown = () => {
    const lines = [
      `# Notes & Bookmarks Summary`,
      `Generated by KasbPro PDF Editor (${new Date().toLocaleDateString()})`,
      '',
      `## Bookmarked Pages`,
      ...(bookmarks.length > 0
        ? bookmarks.map((p) => `- Page ${p}`)
        : ['- No bookmarked pages yet']),
      '',
      `## Annotations & Edits (${annotations.length})`,
      ...annotations.map(
        (a) =>
          `- **Page ${a.pageNumber}** [${a.type.toUpperCase()}]: ${
            a.text || (a.tableData ? 'Structured Table' : 'Visual Markup')
          }`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'KasbPro_Bookmarks_and_Notes.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-72 bg-slate-900/95 border-e border-slate-800 flex flex-col shrink-0 select-none z-20">
      {/* 4 Structured Sidebar Tabs */}
      <div className="grid grid-cols-4 gap-1 p-2 border-b border-slate-800 bg-slate-950/60">
        <button
          onClick={() => onChangeTab('thumbnails')}
          title={t.sidebarPages}
          className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
            activeTab === 'thumbnails'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span className="truncate max-w-full">{t.sidebarPages}</span>
        </button>

        <button
          onClick={() => onChangeTab('toc')}
          title={t.sidebarBookContent}
          className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
            activeTab === 'toc'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="truncate max-w-full">{t.sidebarBookContent}</span>
        </button>

        <button
          onClick={() => onChangeTab('bookmarks')}
          title={t.sidebarBookmarks}
          className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
            activeTab === 'bookmarks'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span className="truncate max-w-full">{t.sidebarBookmarks}</span>
        </button>

        <button
          onClick={() => onChangeTab('search')}
          title={t.sidebarSearch}
          className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
            activeTab === 'search'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="truncate max-w-full">{t.sidebarSearch}</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {activeTab === 'thumbnails' && pdfDoc && (
          <div className="space-y-2.5">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((pNum) => (
              <PageThumbnailCard
                key={pNum}
                pdfDoc={pdfDoc}
                pageNumber={pNum}
                isCurrent={currentPage === pNum}
                isBookmarked={bookmarks.includes(pNum)}
                rotation={pageRotations[pNum] || 0}
                annotationCount={
                  annotations.filter((a) => a.pageNumber === pNum).length
                }
                onSelect={() => onSelectPage(pNum)}
                onToggleBookmark={() => onToggleBookmark(pNum)}
                onRotate={() => onRotateSpecificPage(pNum)}
                onInsertAfter={() => onInsertBlankAfter(pNum)}
                onDelete={() => onDeletePage(pNum)}
                canDelete={pageCount > 1}
              />
            ))}
          </div>
        )}

        {activeTab === 'toc' && (
          <div className="space-y-1">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>{t.sidebarBookContent}</span>
              <span className="text-[10px] text-indigo-400">
                {outline.length} items
              </span>
            </div>
            {outline.map((node) => {
              const isActive = currentPage === node.pageNumber;
              return (
                <button
                  key={node.id}
                  onClick={() => onSelectPage(node.pageNumber)}
                  style={{ paddingInlineStart: `${node.level * 12 + 10}px` }}
                  className={`w-full flex items-center justify-between py-2 pe-2.5 rounded-lg text-xs text-start transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30'
                      : 'text-slate-300 hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ChevronRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">{node.title}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0 ms-2">
                    p.{node.pageNumber}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'bookmarks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-1">
              <button
                onClick={() => onToggleBookmark(currentPage)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border cursor-pointer ${
                  bookmarks.includes(currentPage)
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <Star
                  className={`w-3.5 h-3.5 ${
                    bookmarks.includes(currentPage) ? 'fill-amber-400 text-amber-400' : ''
                  }`}
                />
                <span>
                  {bookmarks.includes(currentPage)
                    ? `${t.bookmarked} (p.${currentPage})`
                    : `${t.bookmarkPage} (p.${currentPage})`}
                </span>
              </button>

              <button
                onClick={exportNotesMarkdown}
                title="Export Notes & Bookmarks to Markdown"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                Bookmarked Pages ({bookmarks.length})
              </div>
              {bookmarks.length === 0 ? (
                <p className="text-xs text-slate-500 px-1">
                  Star any page to save quick reading bookmarks.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {bookmarks.map((p) => (
                    <button
                      key={p}
                      onClick={() => onSelectPage(p)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/25 cursor-pointer"
                    >
                      Page {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                Edits, Notes & Tables ({annotations.length})
              </div>
              {annotations.length === 0 ? (
                <p className="text-xs text-slate-500 px-1">
                  Annotations, text edits, signatures, and tables you add will appear here.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {annotations.map((ann) => (
                    <button
                      key={ann.id}
                      onClick={() => onSelectPage(ann.pageNumber)}
                      className="w-full text-start p-2 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 text-xs cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-[10px] text-indigo-400 font-semibold mb-0.5">
                        <span className="uppercase">{ann.type}</span>
                        <span>Page {ann.pageNumber}</span>
                      </div>
                      <div className="text-slate-200 truncate">
                        {ann.text ||
                          (ann.tableData
                            ? `Editable Table (${ann.tableData.length} rows)`
                            : ann.stampVariant || 'Visual Markup')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'search' && (
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 start-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => runFullTextSearch(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg ps-8 pe-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {isSearching && (
              <div className="text-xs text-slate-400 px-1">Searching pages...</div>
            )}

            {!isSearching && searchQuery.trim().length >= 2 && (
              <div className="text-[11px] text-slate-400 px-1">
                Found {searchResults.length} matching pages
              </div>
            )}

            <div className="space-y-1.5">
              {searchResults.map((res, idx) => (
                <button
                  key={`${res.pageNumber}-${idx}`}
                  onClick={() => onSelectPage(res.pageNumber)}
                  className="w-full text-start p-2.5 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 text-xs cursor-pointer"
                >
                  <div className="text-[10px] font-semibold text-indigo-400 mb-1">
                    Page {res.pageNumber}
                  </div>
                  <div className="text-slate-300 leading-relaxed line-clamp-3">
                    {res.snippet}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
