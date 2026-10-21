export type LanguageCode =
  | 'en'
  | 'ar'
  | 'es'
  | 'fr'
  | 'de'
  | 'zh'
  | 'hi'
  | 'ru'
  | 'pt'
  | 'ja'
  | 'tr'
  | 'fa';

export type ViewMode = 'common' | 'book' | 'reading' | 'office-preview';

export type ReadingTheme = 'day' | 'sepia' | 'night' | 'sage';

export type ReadingFont = 'serif' | 'sans' | 'mono';

export type SidebarTab = 'thumbnails' | 'toc' | 'bookmarks' | 'search';

export type EditorTool =
  | 'select'
  | 'pan'
  | 'edit-text'
  | 'add-text'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'note'
  | 'draw'
  | 'rect'
  | 'circle'
  | 'arrow'
  | 'table'
  | 'signature'
  | 'stamp'
  | 'checkmark'
  | 'redact'
  | 'ocr-region';

export interface PdfTextItem {
  id: string;
  text: string;
  x: number; // percentage 0..100 of page width
  y: number; // percentage 0..100 of page height
  width: number; // percentage 0..100
  height: number; // percentage 0..100
  fontSize: number;
  fontName?: string;
}

export interface TableCellData {
  text: string;
  isHeader?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface AnnotationItem {
  id: string;
  pageNumber: number; // 1-based
  type:
    | 'text'
    | 'replace-text'
    | 'highlight'
    | 'underline'
    | 'strikethrough'
    | 'note'
    | 'draw'
    | 'rect'
    | 'circle'
    | 'arrow'
    | 'table'
    | 'signature'
    | 'stamp'
    | 'checkmark'
    | 'redact';
  x: number; // 0..100% of page width
  y: number; // 0..100% of page height
  width: number; // 0..100% of page width
  height: number; // 0..100% of page height
  color: string;
  backgroundColor?: string;
  opacity?: number;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  text?: string;
  originalText?: string;
  noteAuthor?: string;
  createdAt: string;
  // For freehand drawing
  points?: Array<{ x: number; y: number }>;
  // For inline editable tables placed or extracted on the PDF
  tableData?: string[][];
  tableHeaderBg?: string;
  // For signature or image stamp
  imageDataUrl?: string;
  stampVariant?: 'APPROVED' | 'CONFIDENTIAL' | 'DRAFT' | 'PAID' | 'URGENT' | 'FINAL' | 'CUSTOM';
}

export interface OutlineNode {
  id: string;
  title: string;
  pageNumber: number; // 1-based
  level: number; // 0 = chapter, 1 = section, 2 = subsection
  children?: OutlineNode[];
}

export interface ExtractedTable {
  id: string;
  pageNumber: number;
  title: string;
  rows: string[][];
}

export interface PageReflowContent {
  pageNumber: number;
  headings: string[];
  paragraphs: string[];
  tables: ExtractedTable[];
  rawText: string;
}

export interface OfficeSheetPreview {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface ConvertedDocPreview {
  sourceFileName: string;
  sourceFormat: 'docx' | 'xlsx' | 'csv' | 'md' | 'html' | 'txt' | 'image';
  htmlContent?: string;
  sheets?: OfficeSheetPreview[];
  tables: ExtractedTable[];
  orientation: 'portrait' | 'landscape';
  tableTheme: 'grid' | 'striped' | 'plain';
}

export type CloudProviderId =
  | 'google-drive'
  | 'onedrive'
  | 'dropbox'
  | 'webdav'
  | 'local-folder';

export interface CloudProviderConfig {
  id: CloudProviderId;
  name: string;
  connected: boolean;
  accountEmail?: string;
  accessToken?: string;
  folderPath?: string;
  webdavUrl?: string;
  webdavUsername?: string;
  lastSyncedAt?: string;
  autoSync: boolean;
}

export interface CloudFileEntry {
  id: string;
  provider: CloudProviderId;
  name: string;
  size: number;
  updatedAt: string;
  mimeType: string;
  remotePath: string;
}

export interface SyncQueueItem {
  id: string;
  docId: string;
  docName: string;
  provider: CloudProviderId;
  action: 'upload-pdf' | 'sync-annotations' | 'sync-reading-progress';
  queuedAt: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  errorMessage?: string;
}

export interface StoredDocumentRecord {
  id: string;
  name: string;
  originalFormat: string;
  size: number;
  pageCount: number;
  currentPage: number;
  zoom: number;
  viewMode: ViewMode;
  bookmarks: number[]; // 1-based page numbers
  annotations: AnnotationItem[];
  pageRotations: Record<number, number>; // pageNumber -> 0 | 90 | 180 | 270
  updatedAt: string;
  syncStatus: 'local' | 'pending-sync' | 'synced';
  cloudProvider?: CloudProviderId;
  cloudFileId?: string;
  pdfBytes?: ArrayBuffer;
}
