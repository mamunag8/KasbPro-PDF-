import React, { useRef, useState } from 'react';
import {
  BookOpen,
  Cloud,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Globe,
  Layers,
  Maximize2,
  Minimize2,
  PanelLeft,
  ScanText,
  Sparkles,
  Table2,
  WifiOff,
  ChevronDown,
} from 'lucide-react';
import type {
  LanguageCode,
  StoredDocumentRecord,
  ViewMode,
} from '../types/pdf';
import {
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
} from '../i18n/translations';

interface TopHeaderProps {
  currentDocName: string;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  onUploadFiles: (files: FileList) => void;
  onLoadStarterPdf: () => void;
  onLoadSampleExcel: () => void;
  onOpenOcrModal: () => void;
  onOpenDayToDayModal: () => void;
  onOpenCloudSyncModal: () => void;
  onExportFinalPdf: () => void;
  syncStatus: 'local' | 'pending-sync' | 'synced';
  vaultDocs: StoredDocumentRecord[];
  onSelectVaultDoc: (doc: StoredDocumentRecord) => void;
  hasOfficePreview: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentDocName,
  viewMode,
  onChangeViewMode,
  sidebarOpen,
  onToggleSidebar,
  isFullScreen,
  onToggleFullScreen,
  language,
  onChangeLanguage,
  onUploadFiles,
  onLoadStarterPdf,
  onLoadSampleExcel,
  onOpenOcrModal,
  onOpenDayToDayModal,
  onOpenCloudSyncModal,
  onExportFinalPdf,
  syncStatus,
  vaultDocs,
  onSelectVaultDoc,
  hasOfficePreview,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const t = TRANSLATIONS[language];

  return (
    <header className="h-14 bg-slate-900/95 border-b border-slate-800 px-3 flex items-center justify-between gap-2 select-none z-30 shrink-0">
      {/* Left: Sidebar Toggle + Brand + File Switcher */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onToggleSidebar}
          title="Toggle Navigation Sidebar"
          className={`p-2 rounded-lg border transition-colors ${
            sidebarOpen
              ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
              : 'bg-slate-800/70 border-slate-700/70 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-extrabold text-xs text-white shadow-sm shrink-0">
            PDF
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white tracking-tight">
                {t.appName}
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hidden xl:inline-block">
                {t.badgeFree}
              </span>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowFileMenu((v) => !v)}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 max-w-[200px] truncate"
              >
                <span className="truncate">{currentDocName}</span>
                <ChevronDown className="w-3 h-3 shrink-0" />
              </button>

              {showFileMenu && (
                <div
                  onMouseLeave={() => setShowFileMenu(false)}
                  className="absolute top-6 start-0 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-1"
                >
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Quick Demo & Offline Vault Files
                  </div>
                  <button
                    onClick={() => {
                      onLoadStarterPdf();
                      setShowFileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left hover:bg-indigo-600/20 text-slate-200"
                  >
                    <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="truncate">
                      <div className="font-medium">KasbPro Official Handbook.pdf</div>
                      <div className="text-[10px] text-slate-400">
                        Built-in Chapters, Financial Tables & Sign Demo
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onLoadSampleExcel();
                      setShowFileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left hover:bg-emerald-600/20 text-slate-200"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <div className="font-medium">Sample Q4 Financial Schedule.xlsx</div>
                      <div className="text-[10px] text-slate-400">
                        Test Excel Multi-Sheet Table to PDF Converter
                      </div>
                    </div>
                  </button>

                  {vaultDocs.length > 0 && (
                    <>
                      <div className="border-t border-slate-800 my-1 pt-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Recent Offline Vault ({vaultDocs.length})
                      </div>
                      <div className="max-h-44 overflow-y-auto space-y-0.5">
                        {vaultDocs.map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => {
                              onSelectVaultDoc(doc);
                              setShowFileMenu(false);
                            }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-800 text-slate-300"
                          >
                            <span className="truncate max-w-[180px]">{doc.name}</span>
                            <span className="text-[10px] text-slate-500">
                              p.{doc.currentPage}/{doc.pageCount}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Open / Convert Any File */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.tsv,.md,.txt,.html,.htm,.png,.jpg,.jpeg,.webp,.svg"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onUploadFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-100 transition-colors cursor-pointer shrink-0"
          title="Open PDF, Word (.docx), Excel (.xlsx/.csv), Markdown, or Images"
        >
          <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">{t.openFile}</span>
        </button>
      </div>

      {/* Center: Structured 4-Mode Switcher (Common • Book Mode • Reading Mode • Table/Doc Preview) */}
      <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800 gap-1 overflow-x-auto">
        <button
          onClick={() => onChangeViewMode('common')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            viewMode === 'common'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{t.commonMode}</span>
        </button>

        <button
          onClick={() => onChangeViewMode('book')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            viewMode === 'book'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>{t.bookMode}</span>
        </button>

        <button
          onClick={() => onChangeViewMode('reading')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            viewMode === 'reading'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t.readingMode}</span>
        </button>

        {hasOfficePreview && (
          <button
            onClick={() => onChangeViewMode('office-preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
              viewMode === 'office-preview'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-300 hover:bg-emerald-950/50'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>{t.officePreviewMode}</span>
          </button>
        )}
      </div>

      {/* Right: OCR Studio, Daily Actions, Cloud Sync, Language Selector, Full Screen, Export PDF */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onOpenOcrModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium transition-colors cursor-pointer"
          title={t.ocrStudio}
        >
          <ScanText className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">{t.toolOcr}</span>
        </button>

        <button
          onClick={onOpenDayToDayModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          title={t.mergeSplitTools}
        >
          <Layers className="w-3.5 h-3.5 text-violet-400" />
          <span className="hidden xl:inline">{t.dayToDayHub}</span>
        </button>

        <button
          onClick={onOpenCloudSyncModal}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
            syncStatus === 'synced'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : syncStatus === 'pending-sync'
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
          title={t.cloudSync}
        >
          {syncStatus === 'synced' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : syncStatus === 'pending-sync' ? (
            <Cloud className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-sky-400" />
          )}
          <span className="hidden lg:inline">
            {syncStatus === 'synced'
              ? t.syncedCloud
              : syncStatus === 'pending-sync'
              ? t.pendingSync
              : t.offlineReady}
          </span>
        </button>

        {/* Language Selector (12 Languages + RTL/LTR) */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu((v) => !v)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 cursor-pointer"
            title="Switch Language (LTR / RTL)"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span className="uppercase font-semibold">{language}</span>
          </button>

          {showLangMenu && (
            <div
              onMouseLeave={() => setShowLangMenu(false)}
              className="absolute top-10 end-0 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 max-h-80 overflow-y-auto"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    onChangeLanguage(lang.code);
                    setShowLangMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer ${
                    language === lang.code
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{lang.nativeName}</span>
                  <span className="text-[10px] opacity-75 uppercase">
                    {lang.dir}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* One-Click Full Screen */}
        <button
          onClick={onToggleFullScreen}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
          title={isFullScreen ? t.exitFullScreen : t.fullScreen}
        >
          {isFullScreen ? (
            <Minimize2 className="w-4 h-4 text-indigo-400" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>

        {/* Save / Export PDF */}
        <button
          onClick={onExportFinalPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.exportPdf}</span>
        </button>
      </div>
    </header>
  );
};
