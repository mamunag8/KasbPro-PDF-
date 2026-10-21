import React from 'react';
import {
  CheckSquare,
  Circle,
  Eraser,
  FileEdit,
  Hand,
  Highlighter,
  MousePointer,
  PenTool,
  Redo2,
  RotateCcw,
  RotateCw,
  ScanText,
  Square,
  Stamp,
  StickyNote,
  Table,
  Trash2,
  Type,
  Underline,
  Undo2,
  FileSignature,
} from 'lucide-react';
import type { EditorTool, LanguageCode } from '../types/pdf';
import { TRANSLATIONS } from '../i18n/translations';

interface ActionToolbarProps {
  activeTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  activeColor: string;
  onChangeColor: (color: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  selectedAnnotationId: string | null;
  onDeleteSelectedAnnotation: () => void;
  onRotatePage: (delta: 90 | -90) => void;
  onOpenSignatureModal: (mode: 'signature' | 'stamp') => void;
  onInsertQuickTable: () => void;
  language: LanguageCode;
}

const PRESET_COLORS = [
  '#4f46e5', // Indigo
  '#ef4444', // Crimson Red
  '#10b981', // Emerald Green
  '#f59e0b', // Amber / Highlighter
  '#0ea5e9', // Sky Blue
  '#111827', // Ink Black
];

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  activeTool,
  onSelectTool,
  activeColor,
  onChangeColor,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedAnnotationId,
  onDeleteSelectedAnnotation,
  onRotatePage,
  onOpenSignatureModal,
  onInsertQuickTable,
  language,
}) => {
  const t = TRANSLATIONS[language];

  const toolBtn = (
    tool: EditorTool,
    label: string,
    icon: React.ReactNode,
    onClickOverride?: () => void,
    highlightBadge?: boolean
  ) => {
    const isActive = activeTool === tool;
    return (
      <button
        key={tool}
        onClick={onClickOverride || (() => onSelectTool(tool))}
        title={label}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 ${
          isActive
            ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
            : highlightBadge
            ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20'
            : 'text-slate-300 hover:text-white hover:bg-slate-800'
        }`}
      >
        {icon}
        <span className="hidden lg:inline">{label}</span>
      </button>
    );
  };

  return (
    <div className="bg-slate-900/85 border-b border-slate-800/90 px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto select-none shrink-0">
      {/* Left & Center Tool Groups */}
      <div className="flex items-center gap-1">
        {/* Navigate Group */}
        <div className="flex items-center gap-1 pe-2 border-e border-slate-800">
          {toolBtn('select', t.toolSelect, <MousePointer className="w-3.5 h-3.5" />)}
          {toolBtn('pan', t.toolPan, <Hand className="w-3.5 h-3.5" />)}
        </div>

        {/* Direct Text & Markup Group */}
        <div className="flex items-center gap-1 px-2 border-e border-slate-800">
          {toolBtn(
            'edit-text',
            t.toolEditText,
            <FileEdit className="w-3.5 h-3.5 text-indigo-400" />,
            undefined,
            true
          )}
          {toolBtn('add-text', t.toolAddText, <Type className="w-3.5 h-3.5" />)}
          {toolBtn('highlight', t.toolHighlight, <Highlighter className="w-3.5 h-3.5 text-amber-400" />)}
          {toolBtn('underline', t.toolUnderline, <Underline className="w-3.5 h-3.5" />)}
          {toolBtn('note', t.toolNote, <StickyNote className="w-3.5 h-3.5 text-yellow-400" />)}
        </div>

        {/* Tables, Sign & Stamp Group */}
        <div className="flex items-center gap-1 px-2 border-e border-slate-800">
          {toolBtn(
            'table',
            t.toolTable,
            <Table className="w-3.5 h-3.5 text-emerald-400" />,
            onInsertQuickTable
          )}
          {toolBtn(
            'signature',
            t.toolSign,
            <FileSignature className="w-3.5 h-3.5 text-sky-400" />,
            () => onOpenSignatureModal('signature')
          )}
          {toolBtn(
            'stamp',
            t.toolStamp,
            <Stamp className="w-3.5 h-3.5 text-rose-400" />,
            () => onOpenSignatureModal('stamp')
          )}
          {toolBtn('checkmark', t.toolCheck, <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />)}
        </div>

        {/* Draw, Shapes, Redact & Region OCR */}
        <div className="flex items-center gap-1 px-2">
          {toolBtn('draw', t.toolDraw, <PenTool className="w-3.5 h-3.5" />)}
          {toolBtn('rect', t.toolShape, <Square className="w-3.5 h-3.5" />)}
          {toolBtn('circle', 'Circle', <Circle className="w-3.5 h-3.5" />)}
          {toolBtn('redact', t.toolRedact, <Eraser className="w-3.5 h-3.5 text-rose-400" />)}
          {toolBtn(
            'ocr-region',
            t.toolOcr,
            <ScanText className="w-3.5 h-3.5 text-amber-400" />,
            undefined,
            true
          )}
        </div>
      </div>

      {/* Right: Color Swatches, Rotate, Undo/Redo, Delete */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 px-2 border-s border-slate-800">
          {PRESET_COLORS.map((hex) => (
            <button
              key={hex}
              onClick={() => onChangeColor(hex)}
              className={`w-4 h-4 rounded-full cursor-pointer transition-transform ${
                activeColor === hex ? 'scale-125 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
              }`}
              style={{ backgroundColor: hex }}
              title={`Color ${hex}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1 border-s border-slate-800 ps-2">
          <button
            onClick={() => onRotatePage(-90)}
            title={t.rotateLeft}
            className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onRotatePage(90)}
            title={t.rotateRight}
            className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-s border-slate-800 ps-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo"
            className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
            className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          {selectedAnnotationId && (
            <button
              onClick={onDeleteSelectedAnnotation}
              title="Delete Selected Item"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30 text-xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
