import React, { useState } from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  FileOutput,
  LayoutGrid,
  Plus,
  Table2,
} from 'lucide-react';
import type { ConvertedDocPreview, LanguageCode } from '../types/pdf';
import { TRANSLATIONS } from '../i18n/translations';
import { exportTablesToExcel } from '../services/documentConverter';

interface OfficePreviewViewportProps {
  preview: ConvertedDocPreview;
  onUpdatePreview: (updated: ConvertedDocPreview) => void;
  onConvertAndOpenInPdfEditor: () => void;
  isConverting: boolean;
  language: LanguageCode;
}

export const OfficePreviewViewport: React.FC<OfficePreviewViewportProps> = ({
  preview,
  onUpdatePreview,
  onConvertAndOpenInPdfEditor,
  isConverting,
  language,
}) => {
  const t = TRANSLATIONS[language];
  const [activeTableIndex, setActiveTableIndex] = useState(0);

  const currentTable = preview.tables[activeTableIndex] || preview.tables[0];

  const handleCellChange = (rowIdx: number, colIdx: number, value: string) => {
    const updatedTables = preview.tables.map((tbl, idx) => {
      if (idx !== activeTableIndex) return tbl;
      const newRows = tbl.rows.map((r) => [...r]);
      newRows[rowIdx][colIdx] = value;
      return { ...tbl, rows: newRows };
    });
    onUpdatePreview({ ...preview, tables: updatedTables });
  };

  const handleAddRow = () => {
    if (!currentTable) return;
    const cols = currentTable.rows[0]?.length || 4;
    const updatedTables = preview.tables.map((tbl, idx) => {
      if (idx !== activeTableIndex) return tbl;
      return {
        ...tbl,
        rows: [...tbl.rows, new Array(cols).fill('New Value')],
      };
    });
    onUpdatePreview({ ...preview, tables: updatedTables });
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
      {/* Conversion Configuration Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <Table2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-white">
                {preview.sourceFileName}
              </h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                {preview.sourceFormat.toUpperCase()} Viewer & Table Converter
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t.preserveTablesNote}</span>
            </p>
          </div>
        </div>

        {/* Orientation, Theme & One-Click Convert to PDF */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
            <button
              onClick={() =>
                onUpdatePreview({ ...preview, orientation: 'portrait' })
              }
              className={`px-2.5 py-1 rounded-md cursor-pointer ${
                preview.orientation === 'portrait'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-300'
              }`}
            >
              Portrait
            </button>
            <button
              onClick={() =>
                onUpdatePreview({ ...preview, orientation: 'landscape' })
              }
              className={`px-2.5 py-1 rounded-md cursor-pointer ${
                preview.orientation === 'landscape'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-300'
              }`}
            >
              Landscape (Wide Tables)
            </button>
          </div>

          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
            {(['grid', 'striped', 'plain'] as const).map((themeOpt) => (
              <button
                key={themeOpt}
                onClick={() =>
                  onUpdatePreview({ ...preview, tableTheme: themeOpt })
                }
                className={`px-2.5 py-1 rounded-md capitalize cursor-pointer ${
                  preview.tableTheme === themeOpt
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-300'
                }`}
              >
                {themeOpt}
              </button>
            ))}
          </div>

          {preview.tables.length > 0 && (
            <button
              onClick={() =>
                exportTablesToExcel(preview.tables, preview.sourceFileName)
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export .XLSX</span>
            </button>
          )}

          <button
            onClick={onConvertAndOpenInPdfEditor}
            disabled={isConverting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all cursor-pointer"
          >
            <FileOutput className="w-4 h-4" />
            <span>
              {isConverting
                ? 'Converting Tables to Vector PDF...'
                : `${t.convertOffice} & Edit`}
            </span>
          </button>
        </div>
      </div>

      {/* Sheet / Table Tabs + Editable Grid & Document View */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-6xl mx-auto w-full">
        {preview.tables.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {preview.tables.map((tbl, idx) => (
                  <button
                    key={tbl.id}
                    onClick={() => setActiveTableIndex(idx)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                      activeTableIndex === idx
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>{tbl.title}</span>
                    <span className="text-[10px] opacity-75">
                      ({tbl.rows.length} rows)
                    </span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleAddRow}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Add Table Row</span>
              </button>
            </div>

            {/* Interactive Editable Spreadsheet / Table Grid */}
            {currentTable && (
              <div className="rounded-xl border border-slate-700 overflow-hidden shadow-2xl bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      {currentTable.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={
                            rIdx === 0
                              ? 'bg-indigo-950/90 text-indigo-100 font-bold'
                              : rIdx % 2 === 0
                              ? 'bg-slate-900'
                              : 'bg-slate-900/50'
                          }
                        >
                          <td className="w-10 text-center py-2 px-2 border border-slate-800 text-[10px] font-mono text-slate-500 select-none">
                            {rIdx === 0 ? '#' : rIdx}
                          </td>
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="border border-slate-800 p-0 min-w-[120px]"
                            >
                              <input
                                type="text"
                                value={cell}
                                onChange={(e) =>
                                  handleCellChange(rIdx, cIdx, e.target.value)
                                }
                                className={`w-full px-3 py-2 bg-transparent focus:outline-none focus:bg-indigo-950/40 ${
                                  rIdx === 0
                                    ? 'font-bold text-white'
                                    : 'text-slate-200'
                                }`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rich Document Body Preview (for DOCX, HTML, Markdown, Images) */}
        {preview.htmlContent && (
          <div className="bg-white text-slate-900 rounded-xl p-8 shadow-xl prose max-w-none">
            <div
              dangerouslySetInnerHTML={{ __html: preview.htmlContent }}
              className="space-y-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:p-2"
            />
          </div>
        )}
      </div>
    </div>
  );
};
