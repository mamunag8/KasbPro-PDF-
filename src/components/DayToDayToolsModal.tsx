import React, { useState } from 'react';
import {
  FilePlus,
  Layers,
  Scissors,
  ShieldCheck,
  Stamp,
  Trash2,
  X,
} from 'lucide-react';
import {
  convertPreviewToPdfBytes,
  detectFileFormat,
  parseOfficeOrTextFile,
} from '../services/documentConverter';
import {
  applyWatermarkAndPageNumbers,
  extractPdfPageRange,
  mergePdfBuffers,
} from '../services/pdfEngine';

interface DayToDayToolsModalProps {
  currentPdfBytes: ArrayBuffer | null;
  pageCount: number;
  onApplyModifiedPdfBytes: (bytes: Uint8Array, newDocName?: string) => void;
  onClose: () => void;
}

export const DayToDayToolsModal: React.FC<DayToDayToolsModalProps> = ({
  currentPdfBytes,
  pageCount,
  onApplyModifiedPdfBytes,
  onClose,
}) => {
  const [tab, setTab] = useState<'merge' | 'split' | 'watermark'>('merge');
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [includeCurrentDoc, setIncludeCurrentDoc] = useState(true);
  const [rangeText, setRangeText] = useState(`1-${Math.min(2, pageCount)}`);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL • KASBPRO');
  const [headerText, setHeaderText] = useState('Official Document');
  const [addPageNums, setAddPageNums] = useState(true);
  const [busy, setBusy] = useState(false);

  const handleRunMerge = async () => {
    setBusy(true);
    try {
      const buffers: ArrayBuffer[] = [];
      if (includeCurrentDoc && currentPdfBytes) {
        buffers.push(currentPdfBytes.slice(0));
      }
      for (const f of mergeFiles) {
        const fmt = detectFileFormat(f.name);
        if (fmt === 'pdf') {
          buffers.push(await f.arrayBuffer());
        } else {
          const preview = await parseOfficeOrTextFile(f);
          const pdfBytes = await convertPreviewToPdfBytes(preview);
          buffers.push(pdfBytes.buffer.slice(0) as ArrayBuffer);
        }
      }
      if (buffers.length > 0) {
        const merged = await mergePdfBuffers(buffers);
        onApplyModifiedPdfBytes(merged, 'Merged_KasbPro_Document.pdf');
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRunSplit = async () => {
    if (!currentPdfBytes) return;
    setBusy(true);
    try {
      const extracted = await extractPdfPageRange(currentPdfBytes, rangeText);
      onApplyModifiedPdfBytes(
        extracted,
        `Extracted_Pages_${rangeText.replace(/[^0-9-]/g, '_')}.pdf`
      );
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRunWatermark = async () => {
    if (!currentPdfBytes) return;
    setBusy(true);
    try {
      const updated = await applyWatermarkAndPageNumbers(currentPdfBytes, {
        watermarkText,
        headerText,
        addPageNumbers: addPageNums,
      });
      onApplyModifiedPdfBytes(updated);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-violet-400" />
            <h3 className="font-bold text-white text-base">
              Actionable Day-to-Day PDF Suite (100% Offline)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Task Tabs */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-slate-950 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setTab('merge')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'merge'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FilePlus className="w-3.5 h-3.5" /> Merge PDF / Office
          </button>
          <button
            onClick={() => setTab('split')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'split'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" /> Split / Extract Pages
          </button>
          <button
            onClick={() => setTab('watermark')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'watermark'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Stamp className="w-3.5 h-3.5" /> Watermark & Page #
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {tab === 'merge' && (
            <div className="space-y-4">
              <p className="text-slate-300 leading-relaxed">
                Combine multiple PDFs, Word (`.docx`), Excel (`.xlsx`/`.csv`), or
                Images into one unified PDF. All spreadsheet and document tables
                are automatically preserved.
              </p>

              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCurrentDoc}
                  onChange={(e) => setIncludeCurrentDoc(e.target.checked)}
                  className="rounded accent-indigo-500"
                />
                <span>Start with currently open PDF document</span>
              </label>

              <label className="block border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-5 text-center cursor-pointer bg-slate-950/60">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.xlsx,.xls,.csv,.md,.txt,.png,.jpg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      setMergeFiles((prev) => [
                        ...prev,
                        ...Array.from(e.target.files!),
                      ]);
                    }
                  }}
                />
                <div className="font-semibold text-indigo-400 mb-1">
                  + Add PDF, Word, Excel, or Image Files to Combine
                </div>
                <div className="text-slate-500">
                  Processed 100% locally on your device
                </div>
              </label>

              {mergeFiles.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {mergeFiles.map((f, idx) => (
                    <div
                      key={`${f.name}-${idx}`}
                      className="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 text-slate-200"
                    >
                      <span className="truncate">{f.name}</span>
                      <button
                        onClick={() =>
                          setMergeFiles((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="text-rose-400 hover:text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleRunMerge}
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
              >
                {busy
                  ? 'Combining & Preserving Tables...'
                  : 'Merge & Open Unified PDF'}
              </button>
            </div>
          )}

          {tab === 'split' && (
            <div className="space-y-4">
              <p className="text-slate-300">
                Extract specific pages or ranges from the current {pageCount}-page
                document (for example: <code className="text-indigo-300">1-2, 3</code>).
              </p>

              <div>
                <label className="block text-slate-400 mb-1.5">
                  Page Range to Extract:
                </label>
                <input
                  type="text"
                  value={rangeText}
                  onChange={(e) => setRangeText(e.target.value)}
                  placeholder="e.g. 1-2, 4"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono"
                />
              </div>

              <button
                onClick={handleRunSplit}
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
              >
                {busy ? 'Extracting Pages...' : 'Extract Selected Pages'}
              </button>
            </div>
          )}

          {tab === 'watermark' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1">
                  Diagonal Watermark Text (leave blank for none):
                </label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">
                  Top Header Text:
                </label>
                <input
                  type="text"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white"
                />
              </div>

              <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addPageNums}
                  onChange={(e) => setAddPageNums(e.target.checked)}
                  className="rounded accent-indigo-500"
                />
                <span>Add "Page X of {pageCount}" Footer Numbering</span>
              </label>

              <button
                onClick={handleRunWatermark}
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {busy
                    ? 'Applying to All Pages...'
                    : 'Apply Watermark & Page Numbers'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
