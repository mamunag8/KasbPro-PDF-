import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Check,
  Download,
  Eraser,
  FileSignature,
  FolderDown,
  FolderUp,
  ImagePlus,
  Save,
  Stamp,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import {
  deleteSavedSignature,
  exportSavedSignsAndSealsPack,
  importSavedSignsAndSealsPack,
  listSavedSignatures,
  saveSignatureToVault,
  type SavedSignOrSealRecord,
} from '../services/storageService';

interface SignatureStampModalProps {
  initialTab: 'signature' | 'stamp';
  onClose: () => void;
  onPlaceSignature: (dataUrl: string, textFallback?: string, color?: string) => void;
  onPlaceStamp: (label: string, color: string) => void;
}

const STAMP_PRESETS = [
  { label: 'APPROVED', color: '#10b981' },
  { label: 'PAID', color: '#059669' },
  { label: 'CONFIDENTIAL', color: '#ef4444' },
  { label: 'DRAFT', color: '#f59e0b' },
  { label: 'URGENT', color: '#dc2626' },
  { label: 'FINAL & VERIFIED', color: '#4f46e5' },
];

export const SignatureStampModal: React.FC<SignatureStampModalProps> = ({
  initialTab,
  onClose,
  onPlaceSignature,
  onPlaceStamp,
}) => {
  const [tab, setTab] = useState<'draw' | 'import' | 'seal' | 'type' | 'stamp'>(
    initialTab === 'stamp' ? 'seal' : 'draw'
  );
  const [inkColor, setInkColor] = useState('#1e3a8a');
  const [typedName, setTypedName] = useState('Authorized Signatory');
  const [customStampText, setCustomStampText] = useState(
    `APPROVED • ${new Date().toLocaleDateString()}`
  );

  // Official Company Seal Builder State
  const [sealCompany, setSealCompany] = useState('KASB LLC • OFFICIAL SEAL');
  const [sealCenterText, setSealCenterText] = useState('APPROVED & VERIFIED');
  const [sealSubText, setSealSubText] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [sealColor, setSealColor] = useState('#1e3a8a');

  // Imported Image Sign / Seal State
  const [importedDataUrl, setImportedDataUrl] = useState<string | null>(null);
  const [importedLabel, setImportedLabel] = useState('Imported Sign / Seal');
  const [removeWhiteBg, setRemoveWhiteBg] = useState(true);
  const [rawImportFile, setRawImportFile] = useState<File | null>(null);

  const [savedItems, setSavedItems] = useState<SavedSignOrSealRecord[]>([]);
  const padRef = useRef<HTMLCanvasElement>(null);
  const sealCanvasRef = useRef<HTMLCanvasElement>(null);
  const packInputRef = useRef<HTMLInputElement>(null);
  const [drawing, setDrawing] = useState(false);

  const refreshSaved = async () => {
    setSavedItems(await listSavedSignatures());
  };

  useEffect(() => {
    refreshSaved();
  }, []);

  // Render Circular Official Seal Preview whenever seal settings change
  useEffect(() => {
    if (tab !== 'seal' || !sealCanvasRef.current) return;
    const canvas = sealCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    ctx.strokeStyle = sealColor;
    ctx.fillStyle = sealColor;

    // Outer double ring
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 88, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, 80, 0, Math.PI * 2);
    ctx.stroke();

    // Inner circle
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 52, 0, Math.PI * 2);
    ctx.stroke();

    // Top & bottom curved/centered text
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sealCompany.slice(0, 28).toUpperCase(), cx, cy - 58);
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`★ ${sealSubText} ★`, cx, cy + 68);

    // Center Banner
    ctx.fillStyle = sealColor;
    ctx.font = 'extrabold 13px sans-serif';
    ctx.fillText(sealCenterText.slice(0, 22).toUpperCase(), cx, cy + 4);
  }, [tab, sealCompany, sealCenterText, sealSubText, sealColor]);

  // Process Imported Image with optional White Background Removal (Transparency)
  useEffect(() => {
    if (!rawImportFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 500;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.floor(img.width * scale));
        canvas.height = Math.max(1, Math.floor(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (removeWhiteBg) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            // Make near-white pixels transparent so seal/signature blends cleanly on PDF
            if (r > 225 && g > 225 && b > 225) {
              d[i + 3] = 0;
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }
        setImportedDataUrl(canvas.toDataURL('image/png'));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(rawImportFile);
  }, [rawImportFile, removeWhiteBg]);

  const clearPad = () => {
    const canvas = padRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handlePadDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = padRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setDrawing(true);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handlePadMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing || !padRef.current) return;
    const rect = padRef.current.getBoundingClientRect();
    const ctx = padRef.current.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const handlePadUp = () => setDrawing(false);

  const handleSaveAndPlaceDrawnSignature = async (placeImmediately: boolean) => {
    if (!padRef.current) return;
    const dataUrl = padRef.current.toDataURL('image/png');
    const newSig: SavedSignOrSealRecord = {
      id: `sig-${Date.now()}`,
      label: `Signature ${savedItems.length + 1}`,
      category: 'signature',
      dataUrl,
      createdAt: new Date().toISOString(),
    };
    await saveSignatureToVault(newSig);
    await refreshSaved();
    if (placeImmediately) {
      onPlaceSignature(dataUrl, undefined, inkColor);
      onClose();
    }
  };

  const handleSaveAndPlaceSeal = async (placeImmediately: boolean) => {
    if (!sealCanvasRef.current) return;
    const dataUrl = sealCanvasRef.current.toDataURL('image/png');
    const newSeal: SavedSignOrSealRecord = {
      id: `seal-${Date.now()}`,
      label: sealCompany,
      category: 'seal',
      dataUrl,
      createdAt: new Date().toISOString(),
    };
    await saveSignatureToVault(newSeal);
    await refreshSaved();
    if (placeImmediately) {
      onPlaceSignature(dataUrl, sealCompany, sealColor);
      onClose();
    }
  };

  const handleSaveAndPlaceImported = async (placeImmediately: boolean) => {
    if (!importedDataUrl) return;
    const rec: SavedSignOrSealRecord = {
      id: `imp-${Date.now()}`,
      label: importedLabel || 'Imported Sign / Seal',
      category: 'seal',
      dataUrl: importedDataUrl,
      createdAt: new Date().toISOString(),
    };
    await saveSignatureToVault(rec);
    await refreshSaved();
    if (placeImmediately) {
      onPlaceSignature(importedDataUrl, importedLabel, inkColor);
      onClose();
    }
  };

  const handlePlaceTypedSignature = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 110;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = inkColor;
      ctx.font = 'italic bold 40px Georgia, serif';
      ctx.fillText(typedName || 'Signed', 20, 68);
    }
    const dataUrl = canvas.toDataURL('image/png');
    await saveSignatureToVault({
      id: `typed-${Date.now()}`,
      label: typedName,
      category: 'signature',
      dataUrl,
      createdAt: new Date().toISOString(),
    });
    onPlaceSignature(dataUrl, typedName, inkColor);
    onClose();
  };

  const downloadDataUrlPng = (dataUrl: string, name: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="font-bold text-white text-base">
                Signature, Official Seal & Stamp Vault (100% Local & Offline)
              </h3>
              <p className="text-[11px] text-slate-400">
                Draw, import images, build circular company seals, and save locally for 1-click reuse
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

        {/* 5 Mode Tabs */}
        <div className="grid grid-cols-5 gap-1 p-2 bg-slate-950 border-b border-slate-800 text-xs font-semibold shrink-0">
          <button
            onClick={() => setTab('draw')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer ${
              tab === 'draw'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileSignature className="w-3.5 h-3.5" /> Draw Sign
          </button>
          <button
            onClick={() => setTab('import')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer ${
              tab === 'import'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImagePlus className="w-3.5 h-3.5" /> Import Sign/Seal
          </button>
          <button
            onClick={() => setTab('seal')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer ${
              tab === 'seal'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" /> Official Seal
          </button>
          <button
            onClick={() => setTab('type')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer ${
              tab === 'type'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Type className="w-3.5 h-3.5" /> Type Sign
          </button>
          <button
            onClick={() => setTab('stamp')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer ${
              tab === 'stamp'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Stamp className="w-3.5 h-3.5" /> Quick Stamps
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === 'draw' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>Ink Color:</span>
                  {['#1e3a8a', '#0f172a', '#dc2626', '#047857', '#6d28d9'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setInkColor(c)}
                      className={`w-5 h-5 rounded-full cursor-pointer ${
                        inkColor === c ? 'ring-2 ring-white scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button
                  onClick={clearPad}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" /> Clear Pad
                </button>
              </div>

              <div className="bg-white rounded-xl border-2 border-dashed border-slate-400 overflow-hidden">
                <canvas
                  ref={padRef}
                  width={540}
                  height={150}
                  onMouseDown={handlePadDown}
                  onMouseMove={handlePadMove}
                  onMouseUp={handlePadUp}
                  onMouseLeave={handlePadUp}
                  className="w-full h-36 cursor-crosshair block"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveAndPlaceDrawnSignature(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-emerald-400" /> Save Locally to Vault
                </button>
                <button
                  onClick={() => handleSaveAndPlaceDrawnSignature(true)}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Save & Place Signature on Page
                </button>
              </div>
            </div>
          )}

          {tab === 'import' && (
            <div className="space-y-4 text-xs">
              <label className="block border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-5 text-center cursor-pointer bg-slate-950/60">
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setRawImportFile(file);
                      setImportedLabel(file.name.replace(/\.[^.]+$/, ''));
                    }
                  }}
                />
                <ImagePlus className="w-7 h-7 text-indigo-400 mx-auto mb-1.5" />
                <div className="font-bold text-slate-200">
                  Click to Import Signature, Company Seal, or Stamp Image (.PNG / .JPG / .WEBP)
                </div>
                <div className="text-slate-400 mt-0.5">
                  Automatically removes white paper background for clean transparent placement
                </div>
              </label>

              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  value={importedLabel}
                  onChange={(e) => setImportedLabel(e.target.value)}
                  placeholder="Label for saved sign/seal..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeWhiteBg}
                    onChange={(e) => setRemoveWhiteBg(e.target.checked)}
                    className="rounded accent-indigo-500"
                  />
                  <span>Auto-Remove White Background</span>
                </label>
              </div>

              {importedDataUrl && (
                <div className="bg-white/95 rounded-xl p-4 flex flex-col items-center border border-slate-300">
                  <img
                    src={importedDataUrl}
                    alt="Imported Sign or Seal"
                    className="max-h-28 object-contain"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  disabled={!importedDataUrl}
                  onClick={() => handleSaveAndPlaceImported(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4 text-emerald-400" /> Save Locally
                </button>
                <button
                  disabled={!importedDataUrl}
                  onClick={() => handleSaveAndPlaceImported(true)}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Save & Place on PDF Page
                </button>
              </div>
            </div>
          )}

          {tab === 'seal' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center text-xs">
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Top Ring Organization / Name:
                  </label>
                  <input
                    type="text"
                    value={sealCompany}
                    onChange={(e) => setSealCompany(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Center Seal Status / Title:
                  </label>
                  <input
                    type="text"
                    value={sealCenterText}
                    onChange={(e) => setSealCenterText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    Bottom Date / Reg No:
                  </label>
                  <input
                    type="text"
                    value={sealSubText}
                    onChange={(e) => setSealSubText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-slate-400">Seal Ink:</span>
                  {['#1e3a8a', '#dc2626', '#047857', '#6d28d9', '#0f172a'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setSealColor(c)}
                      className={`w-5 h-5 rounded-full cursor-pointer ${
                        sealColor === c ? 'ring-2 ring-white scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="bg-white rounded-xl p-3 border border-slate-300 shadow-inner">
                  <canvas ref={sealCanvasRef} width={200} height={200} />
                </div>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => handleSaveAndPlaceSeal(false)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-emerald-400" /> Save Seal
                  </button>
                  <button
                    onClick={() => handleSaveAndPlaceSeal(true)}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> Place Seal on Page
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'type' && (
            <div className="space-y-4">
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Enter your full name..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <div className="bg-white rounded-xl p-5 text-center border border-slate-300">
                <span
                  style={{ color: inkColor }}
                  className="font-serif italic font-bold text-3xl select-none"
                >
                  {typedName || 'Authorized Signatory'}
                </span>
              </div>
              <button
                onClick={handlePlaceTypedSignature}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" /> Save & Place Typed Signature
              </button>
            </div>
          )}

          {tab === 'stamp' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {STAMP_PRESETS.map((st) => (
                  <button
                    key={st.label}
                    onClick={() => {
                      onPlaceStamp(st.label, st.color);
                      onClose();
                    }}
                    style={{ borderColor: st.color, color: st.color }}
                    className="border-2 rounded-xl py-2.5 px-3 font-extrabold text-xs tracking-widest uppercase bg-slate-950 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    {st.label}
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="text-xs text-slate-400 block">
                  Custom Official Stamp Text:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customStampText}
                    onChange={(e) => setCustomStampText(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <button
                    onClick={() => {
                      onPlaceStamp(customStampText, '#4f46e5');
                      onClose();
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Place Stamp
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Local Saved Signatures & Seals Vault (Always Visible at Bottom for 1-Click Reuse & Local Import/Export) */}
          <div className="pt-3 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Saved Local Signatures & Seals Vault ({savedItems.length})
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  ref={packInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      await importSavedSignsAndSealsPack(f);
                      await refreshSaved();
                    }
                  }}
                />
                <button
                  onClick={() => packInputRef.current?.click()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
                  title="Import Saved Sign/Seal JSON Pack"
                >
                  <FolderUp className="w-3 h-3 text-indigo-400" /> Import Pack
                </button>
                {savedItems.length > 0 && (
                  <button
                    onClick={exportSavedSignsAndSealsPack}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
                    title="Export All Saved Signs & Seals Locally"
                  >
                    <FolderDown className="w-3 h-3 text-emerald-400" /> Export Pack
                  </button>
                )}
              </div>
            </div>

            {savedItems.length === 0 ? (
              <p className="text-xs text-slate-500">
                Draw a signature, import an image seal, or build an official circular seal above and click "Save Locally" for instant 1-click reuse.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto">
                {savedItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl p-2 border border-slate-300 flex flex-col justify-between gap-1.5 shadow-xs"
                  >
                    <div
                      onClick={() => {
                        onPlaceSignature(item.dataUrl, item.label);
                        onClose();
                      }}
                      title="Click to place on PDF page"
                      className="h-14 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                    >
                      <img
                        src={item.dataUrl}
                        alt={item.label}
                        className="max-h-14 max-w-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-1 text-[10px] text-slate-700">
                      <span className="truncate font-semibold max-w-[90px]">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            downloadDataUrlPng(item.dataUrl, item.label)
                          }
                          title="Save as Local PNG File"
                          className="p-0.5 text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          onClick={async () => {
                            await deleteSavedSignature(item.id);
                            await refreshSaved();
                          }}
                          title="Delete from Vault"
                          className="p-0.5 text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
