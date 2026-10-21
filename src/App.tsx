import React, { useCallback, useEffect, useState } from 'react';
import type * as pdfjsLib from 'pdfjs-dist';
import type {
  AnnotationItem,
  ConvertedDocPreview,
  EditorTool,
  ExtractedTable,
  LanguageCode,
  OutlineNode,
  SidebarTab,
  StoredDocumentRecord,
  ViewMode,
} from './types/pdf';
import { SUPPORTED_LANGUAGES } from './i18n/translations';
import {
  createStarterHandbookPdf,
  deletePageFromPdf,
  exportAnnotatedPdf,
  extractBookOutline,
  insertBlankPageInPdf,
  loadPdfDocument,
} from './services/pdfEngine';
import {
  convertPreviewToPdfBytes,
  createSampleOfficeWorkbookPreview,
  detectFileFormat,
  parseOfficeOrTextFile,
} from './services/documentConverter';
import {
  listVaultDocuments,
  saveDocumentToVault,
} from './services/storageService';
import { TopHeader } from './components/TopHeader';
import { ActionToolbar } from './components/ActionToolbar';
import { LeftSidebar } from './components/LeftSidebar';
import { CommonPdfViewport } from './components/CommonPdfViewport';
import { BookReaderMode } from './components/BookReaderMode';
import { ComfortReadingMode } from './components/ComfortReadingMode';
import { OfficePreviewViewport } from './components/OfficePreviewViewport';
import { SignatureStampModal } from './components/SignatureStampModal';
import { OcrAndTableModal } from './components/OcrAndTableModal';
import { DayToDayToolsModal } from './components/DayToDayToolsModal';
import { CloudSyncModal } from './components/CloudSyncModal';

export function App() {
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [viewMode, setViewMode] = useState<ViewMode>('common');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('thumbnails');
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // Document State
  const [docId, setDocId] = useState<string>('starter-handbook');
  const [docName, setDocName] = useState<string>('KasbPro Official Handbook.pdf');
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1);
  const [outline, setOutline] = useState<OutlineNode[]>([]);
  const [bookmarks, setBookmarks] = useState<number[]>([1]);
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  const [syncStatus, setSyncStatus] = useState<'local' | 'pending-sync' | 'synced'>('local');

  // Annotations + Undo/Redo History
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [undoStack, setUndoStack] = useState<AnnotationItem[][]>([]);
  const [redoStack, setRedoStack] = useState<AnnotationItem[][]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // Editor Tool State
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [activeColor, setActiveColor] = useState<string>('#4f46e5');

  // Multi-Format Office / Table Preview State
  const [officePreview, setOfficePreview] = useState<ConvertedDocPreview | null>(null);
  const [isConvertingOffice, setIsConvertingOffice] = useState(false);

  // Modals State
  const [sigStampModalMode, setSigStampModalMode] = useState<'signature' | 'stamp' | null>(null);
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrInitialRegion, setOcrInitialRegion] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [dayToDayModalOpen, setDayToDayModalOpen] = useState(false);
  const [cloudSyncModalOpen, setCloudSyncModalOpen] = useState(false);

  // Vault Recent Documents
  const [vaultDocs, setVaultDocs] = useState<StoredDocumentRecord[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Update HTML dir="rtl" / "ltr" & lang attribute when language changes
  useEffect(() => {
    const langMeta =
      SUPPORTED_LANGUAGES.find((l) => l.code === language) ||
      SUPPORTED_LANGUAGES[0];
    document.documentElement.dir = langMeta.dir;
    document.documentElement.lang = langMeta.code;
  }, [language]);

  const loadPdfBufferIntoWorkspace = useCallback(
    async (
      buffer: ArrayBuffer,
      name: string,
      id = `doc-${Date.now()}`,
      existingAnns: AnnotationItem[] = [],
      existingBookmarks: number[] = [1],
      existingRotations: Record<number, number> = {},
      initialPage = 1
    ) => {
      const proxy = await loadPdfDocument(buffer);
      const toc = await extractBookOutline(proxy);

      setDocId(id);
      setDocName(name);
      setPdfBytes(buffer);
      setPdfDoc(proxy);
      setPageCount(proxy.numPages);
      setCurrentPage(Math.min(initialPage, proxy.numPages));
      setOutline(toc);
      setAnnotations(existingAnns);
      setUndoStack([]);
      setRedoStack([]);
      setBookmarks(existingBookmarks);
      setPageRotations(existingRotations);
      setSelectedAnnotationId(null);

      const record: StoredDocumentRecord = {
        id,
        name,
        originalFormat: 'pdf',
        size: buffer.byteLength,
        pageCount: proxy.numPages,
        currentPage: initialPage,
        zoom: 1,
        viewMode: 'common',
        bookmarks: existingBookmarks,
        annotations: existingAnns,
        pageRotations: existingRotations,
        updatedAt: new Date().toISOString(),
        syncStatus: 'local',
        pdfBytes: buffer,
      };
      await saveDocumentToVault(record);
      setVaultDocs(await listVaultDocuments());
    },
    []
  );

  // Initialize with built-in Starter Handbook PDF on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const existing = await listVaultDocuments();
      if (mounted) setVaultDocs(existing);
      const starterBytes = await createStarterHandbookPdf();
      if (!mounted) return;
      await loadPdfBufferIntoWorkspace(
        starterBytes.buffer.slice(0) as ArrayBuffer,
        'KasbPro Official Handbook.pdf',
        'starter-handbook'
      );
    })();
    return () => {
      mounted = false;
    };
  }, [loadPdfBufferIntoWorkspace]);

  // Persist changes to Offline Vault whenever annotations, bookmarks, or currentPage change
  useEffect(() => {
    if (!pdfBytes || !pdfDoc) return;
    const record: StoredDocumentRecord = {
      id: docId,
      name: docName,
      originalFormat: 'pdf',
      size: pdfBytes.byteLength,
      pageCount,
      currentPage,
      zoom,
      viewMode,
      bookmarks,
      annotations,
      pageRotations,
      updatedAt: new Date().toISOString(),
      syncStatus,
      pdfBytes,
    };
    saveDocumentToVault(record).catch(() => {});
  }, [
    docId,
    docName,
    pdfBytes,
    pdfDoc,
    pageCount,
    currentPage,
    zoom,
    viewMode,
    bookmarks,
    annotations,
    pageRotations,
    syncStatus,
  ]);

  // Annotation Mutation Helpers with Undo/Redo
  const pushUndoSnapshot = (nextAnnotations: AnnotationItem[]) => {
    setUndoStack((prev) => [...prev.slice(-25), annotations]);
    setRedoStack([]);
    setAnnotations(nextAnnotations);
    if (syncStatus === 'synced') setSyncStatus('pending-sync');
  };

  const handleAddAnnotation = (ann: AnnotationItem) => {
    pushUndoSnapshot([...annotations, ann]);
  };

  const handleUpdateAnnotation = (id: string, patch: Partial<AnnotationItem>) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
    );
  };

  const handleDeleteAnnotation = (id: string) => {
    pushUndoSnapshot(annotations.filter((a) => a.id !== id));
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, annotations]);
    setUndoStack((u) => u.slice(0, -1));
    setAnnotations(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, annotations]);
    setRedoStack((r) => r.slice(0, -1));
    setAnnotations(next);
  };

  // File Upload & Multi-Format Conversion Handler
  const handleUploadFiles = async (files: FileList) => {
    const file = files[0];
    if (!file) return;

    const fmt = detectFileFormat(file.name);
    if (fmt === 'pdf') {
      const buf = await file.arrayBuffer();
      await loadPdfBufferIntoWorkspace(buf, file.name);
      setViewMode('common');
      showToast(`Opened PDF "${file.name}"`);
      return;
    }

    // Parse Word (.docx), Excel (.xlsx/.csv), Markdown, HTML, Text, or Image
    const preview = await parseOfficeOrTextFile(file);
    setOfficePreview(preview);
    setViewMode('office-preview');
    showToast(
      `Loaded "${file.name}" (${preview.tables.length} tables detected). Review or click Convert to PDF!`
    );
  };

  const handleConvertOfficePreviewToPdf = async () => {
    if (!officePreview) return;
    setIsConvertingOffice(true);
    try {
      const convertedBytes = await convertPreviewToPdfBytes(officePreview);
      const pdfFileName = `${officePreview.sourceFileName.replace(
        /\.[^.]+$/,
        ''
      )}_Converted.pdf`;
      await loadPdfBufferIntoWorkspace(
        convertedBytes.buffer.slice(0) as ArrayBuffer,
        pdfFileName
      );
      setViewMode('common');
      showToast(
        `Converted "${officePreview.sourceFileName}" to PDF with full table preservation!`
      );
    } finally {
      setIsConvertingOffice(false);
    }
  };

  const handleLoadStarterPdf = async () => {
    const bytes = await createStarterHandbookPdf();
    await loadPdfBufferIntoWorkspace(
      bytes.buffer.slice(0) as ArrayBuffer,
      'KasbPro Official Handbook.pdf',
      'starter-handbook'
    );
    setViewMode('common');
    showToast('Loaded KasbPro Official Handbook.pdf');
  };

  const handleLoadSampleExcel = () => {
    const sample = createSampleOfficeWorkbookPreview();
    setOfficePreview(sample);
    setViewMode('office-preview');
    showToast(
      'Loaded Sample Multi-Sheet Excel Workbook. Inspect tables or click Convert to PDF!'
    );
  };

  const handleToggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullScreen(false);
    }
  };

  const handleInsertQuickTableOnPage = () => {
    const id = `table-${Date.now()}`;
    handleAddAnnotation({
      id,
      pageNumber: currentPage,
      type: 'table',
      x: 12,
      y: 26,
      width: 68,
      height: 16,
      color: '#1e3a8a',
      tableData: [
        ['Item / Task', 'Owner', 'Due Date', 'Status'],
        ['Contract Review', 'Legal Team', '2026-10-25', 'Approved'],
        ['Budget Sign-Off', 'Finance Ops', '2026-10-28', 'In Progress'],
      ],
      createdAt: new Date().toISOString(),
    });
    setSelectedAnnotationId(id);
    setViewMode('common');
    showToast('Inserted interactive editable table on page!');
  };

  const handleExportFinalPdf = async () => {
    if (!pdfBytes) return;
    const finalBytes = await exportAnnotatedPdf(
      pdfBytes,
      annotations,
      pageRotations
    );
    const blob = new Blob([finalBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = docName.endsWith('.pdf') ? docName : `${docName}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported "${docName}" with all edits, tables & signatures!`);
  };

  const currentStoredRecord: StoredDocumentRecord = {
    id: docId,
    name: docName,
    originalFormat: 'pdf',
    size: pdfBytes?.byteLength || 0,
    pageCount,
    currentPage,
    zoom,
    viewMode,
    bookmarks,
    annotations,
    pageRotations,
    updatedAt: new Date().toISOString(),
    syncStatus,
    pdfBytes: pdfBytes || undefined,
  };

  const currentOcrLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === language)?.ocrLang || 'eng';

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleUploadFiles(e.dataTransfer.files);
        }
      }}
      className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden"
    >
      {/* Top Command Header */}
      <TopHeader
        currentDocName={docName}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        isFullScreen={isFullScreen}
        onToggleFullScreen={handleToggleFullScreen}
        language={language}
        onChangeLanguage={setLanguage}
        onUploadFiles={handleUploadFiles}
        onLoadStarterPdf={handleLoadStarterPdf}
        onLoadSampleExcel={handleLoadSampleExcel}
        onOpenOcrModal={() => {
          setOcrInitialRegion(null);
          setOcrModalOpen(true);
        }}
        onOpenDayToDayModal={() => setDayToDayModalOpen(true)}
        onOpenCloudSyncModal={() => setCloudSyncModalOpen(true)}
        onExportFinalPdf={handleExportFinalPdf}
        syncStatus={syncStatus}
        vaultDocs={vaultDocs}
        onSelectVaultDoc={(doc) => {
          if (doc.pdfBytes) {
            loadPdfBufferIntoWorkspace(
              doc.pdfBytes,
              doc.name,
              doc.id,
              doc.annotations,
              doc.bookmarks,
              doc.pageRotations,
              doc.currentPage
            );
          }
        }}
        hasOfficePreview={Boolean(officePreview)}
      />

      {/* Actionable Day-to-Day Editing Ribbon (Visible in Common Mode) */}
      {viewMode === 'common' && (
        <ActionToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          activeColor={activeColor}
          onChangeColor={setActiveColor}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onUndo={handleUndo}
          onRedo={handleRedo}
          selectedAnnotationId={selectedAnnotationId}
          onDeleteSelectedAnnotation={() => {
            if (selectedAnnotationId) {
              handleDeleteAnnotation(selectedAnnotationId);
            }
          }}
          onRotatePage={(delta) => {
            setPageRotations((prev) => ({
              ...prev,
              [currentPage]: ((prev[currentPage] || 0) + delta + 360) % 360,
            }));
          }}
          onOpenSignatureModal={(mode) => setSigStampModalMode(mode)}
          onInsertQuickTable={handleInsertQuickTableOnPage}
          language={language}
        />
      )}

      {/* Main Workspace Container (Sidebar + Active Mode Viewport) */}
      <div className="flex-1 flex overflow-hidden relative">
        {sidebarOpen && viewMode !== 'office-preview' && (
          <LeftSidebar
            pdfDoc={pdfDoc}
            pageCount={pageCount}
            currentPage={currentPage}
            onSelectPage={setCurrentPage}
            activeTab={sidebarTab}
            onChangeTab={setSidebarTab}
            outline={outline}
            bookmarks={bookmarks}
            onToggleBookmark={(p) =>
              setBookmarks((prev) =>
                prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
              )
            }
            annotations={annotations}
            pageRotations={pageRotations}
            onRotateSpecificPage={(p) =>
              setPageRotations((prev) => ({
                ...prev,
                [p]: ((prev[p] || 0) + 90) % 360,
              }))
            }
            onInsertBlankAfter={async (p) => {
              if (!pdfBytes) return;
              const updated = await insertBlankPageInPdf(pdfBytes, p);
              await loadPdfBufferIntoWorkspace(
                updated.buffer.slice(0) as ArrayBuffer,
                docName,
                docId,
                annotations,
                bookmarks,
                pageRotations,
                p + 1
              );
              showToast(`Inserted blank page after Page ${p}`);
            }}
            onDeletePage={async (p) => {
              if (!pdfBytes || pageCount <= 1) return;
              const updated = await deletePageFromPdf(pdfBytes, p);
              await loadPdfBufferIntoWorkspace(
                updated.buffer.slice(0) as ArrayBuffer,
                docName,
                docId,
                annotations.filter((a) => a.pageNumber !== p),
                bookmarks,
                pageRotations,
                Math.max(1, p - 1)
              );
              showToast(`Removed Page ${p}`);
            }}
            language={language}
          />
        )}

        {/* Active Viewport */}
        {viewMode === 'common' && (
          <CommonPdfViewport
            pdfDoc={pdfDoc}
            currentPage={currentPage}
            pageCount={pageCount}
            onChangePage={setCurrentPage}
            zoom={zoom}
            onChangeZoom={setZoom}
            rotation={pageRotations[currentPage] || 0}
            activeTool={activeTool}
            activeColor={activeColor}
            annotations={annotations}
            selectedAnnotationId={selectedAnnotationId}
            onSelectAnnotation={setSelectedAnnotationId}
            onAddAnnotation={handleAddAnnotation}
            onUpdateAnnotation={handleUpdateAnnotation}
            onDeleteAnnotation={handleDeleteAnnotation}
            onRegionOcrSelected={(region) => {
              setOcrInitialRegion(region);
              setOcrModalOpen(true);
            }}
            isBookmarked={bookmarks.includes(currentPage)}
            onToggleBookmark={() =>
              setBookmarks((prev) =>
                prev.includes(currentPage)
                  ? prev.filter((x) => x !== currentPage)
                  : [...prev, currentPage]
              )
            }
            language={language}
          />
        )}

        {viewMode === 'book' && (
          <BookReaderMode
            pdfDoc={pdfDoc}
            currentPage={currentPage}
            pageCount={pageCount}
            onChangePage={setCurrentPage}
            outline={outline}
            bookmarks={bookmarks}
            onToggleBookmark={(p) =>
              setBookmarks((prev) =>
                prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
              )
            }
            pageRotations={pageRotations}
            language={language}
          />
        )}

        {viewMode === 'reading' && (
          <ComfortReadingMode
            pdfDoc={pdfDoc}
            currentPage={currentPage}
            pageCount={pageCount}
            onChangePage={setCurrentPage}
            language={language}
            docName={docName}
          />
        )}

        {viewMode === 'office-preview' && officePreview && (
          <OfficePreviewViewport
            preview={officePreview}
            onUpdatePreview={setOfficePreview}
            onConvertAndOpenInPdfEditor={handleConvertOfficePreviewToPdf}
            isConverting={isConvertingOffice}
            language={language}
          />
        )}
      </div>

      {/* Signature & Official Stamp Studio Modal */}
      {sigStampModalMode && (
        <SignatureStampModal
          initialTab={sigStampModalMode}
          onClose={() => setSigStampModalMode(null)}
          onPlaceSignature={(dataUrl, textFallback, color) => {
            const id = `sig-${Date.now()}`;
            handleAddAnnotation({
              id,
              pageNumber: currentPage,
              type: 'signature',
              x: 14,
              y: 62,
              width: 26,
              height: 8,
              color: color || '#1e3a8a',
              imageDataUrl: dataUrl,
              text: textFallback,
              createdAt: new Date().toISOString(),
            });
            setSelectedAnnotationId(id);
            showToast('Placed signature on page (drag to position)');
          }}
          onPlaceStamp={(label, color) => {
            const id = `stamp-${Date.now()}`;
            handleAddAnnotation({
              id,
              pageNumber: currentPage,
              type: 'stamp',
              x: 56,
              y: 62,
              width: 26,
              height: 6,
              color,
              text: label,
              createdAt: new Date().toISOString(),
            });
            setSelectedAnnotationId(id);
            showToast(`Placed "${label}" stamp on page`);
          }}
        />
      )}

      {/* Offline OCR & Table Extraction Studio Modal */}
      {ocrModalOpen && (
        <OcrAndTableModal
          pdfDoc={pdfDoc}
          currentPage={currentPage}
          initialRegion={ocrInitialRegion}
          defaultOcrLang={currentOcrLang}
          docName={docName}
          onClose={() => setOcrModalOpen(false)}
          onInsertRecognizedTextOnPage={(text) => {
            const id = `ocr-txt-${Date.now()}`;
            handleAddAnnotation({
              id,
              pageNumber: currentPage,
              type: 'text',
              x: 10,
              y: 15,
              width: 70,
              height: 8,
              color: '#0f172a',
              backgroundColor: '#ffffff',
              fontSize: 12,
              text,
              createdAt: new Date().toISOString(),
            });
            setSelectedAnnotationId(id);
            showToast('Inserted OCR text onto page!');
          }}
          onInsertExtractedTableOnPage={(tbl: ExtractedTable) => {
            const id = `ocr-tbl-${Date.now()}`;
            handleAddAnnotation({
              id,
              pageNumber: currentPage,
              type: 'table',
              x: 8,
              y: 20,
              width: 82,
              height: Math.min(45, tbl.rows.length * 4.5),
              color: '#1e3a8a',
              tableData: tbl.rows,
              createdAt: new Date().toISOString(),
            });
            setSelectedAnnotationId(id);
            setViewMode('common');
            showToast('Placed extracted table as an editable grid on the page!');
          }}
        />
      )}

      {/* Day-to-Day Merge, Split & Watermark Modal */}
      {dayToDayModalOpen && (
        <DayToDayToolsModal
          currentPdfBytes={pdfBytes}
          pageCount={pageCount}
          onApplyModifiedPdfBytes={async (bytes, newName) => {
            await loadPdfBufferIntoWorkspace(
              bytes.buffer.slice(0) as ArrayBuffer,
              newName || docName
            );
            showToast('Applied PDF document changes offline!');
          }}
          onClose={() => setDayToDayModalOpen(false)}
        />
      )}

      {/* Cloud Storage & Offline Vault Sync Modal */}
      {cloudSyncModalOpen && (
        <CloudSyncModal
          currentDoc={currentStoredRecord}
          getExportedPdfBytes={async () => {
            if (!pdfBytes) return new Uint8Array();
            return await exportAnnotatedPdf(
              pdfBytes,
              annotations,
              pageRotations
            );
          }}
          onSyncCompleted={(status, _provider, message) => {
            setSyncStatus(status);
            showToast(message);
          }}
          onClose={() => setCloudSyncModalOpen(false)}
        />
      )}

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-16 end-5 bg-indigo-950/95 border border-indigo-500/50 text-indigo-100 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-medium z-50 animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default App;
