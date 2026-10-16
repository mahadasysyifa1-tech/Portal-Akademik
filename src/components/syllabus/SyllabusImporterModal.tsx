import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Table as TableIcon
} from 'lucide-react';
import { DatabaseState, SyllabusUnit } from '../../types';
import { parseSyllabusCsv, getSampleSyllabusCsv } from '../../utils/syllabusImporter';
import { formatUnitDisplay } from '../../utils/pacingEngine';

interface SyllabusImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: DatabaseState;
  onImportUnits: (newUnits: SyllabusUnit[], mode: 'replace' | 'append') => void;
}

export const SyllabusImporterModal: React.FC<SyllabusImporterModalProps> = ({
  isOpen,
  onClose,
  db,
  onImportUnits
}) => {
  if (!isOpen) return null;

  const [csvText, setCsvText] = useState('');
  const [parsedUnits, setParsedUnits] = useState<SyllabusUnit[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('append');
  const [selectedBookId, setSelectedBookId] = useState<string>(db.books?.[0]?.id || '');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvText(content);
      doParse(content, selectedBookId);
    };
    reader.readAsText(file);
  };

  const doParse = (text: string, bookId: string) => {
    const result = parseSyllabusCsv(text, db.books || [], db.subjects || [], bookId);
    setParsedUnits(result.units);
    setParseErrors(result.errors);
  };

  const handleTextChange = (val: string) => {
    setCsvText(val);
    doParse(val, selectedBookId);
  };

  const handleDownloadSample = () => {
    const selectedBook = (db.books || []).find((b) => b.id === selectedBookId);
    const bookCode = selectedBook ? (selectedBook.displayCode || selectedBook.display_code || selectedBook.id) : 'BK-01';
    const sample = getSampleSyllabusCsv(bookCode);
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `template_silabus_${bookCode}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (parsedUnits.length === 0) return;
    onImportUnits(parsedUnits, importMode);
    onClose();
  };

  const bookMap = new Map<string, any>((db.books || []).map((b) => [b.id, b]));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Impor Silabus Materi (CSV SyllabusUnit)
              </h3>
              <p className="text-xs text-slate-500">
                Format: book_code, order, title, page_start, page_end, part
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Controls: Template download & Default Book */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">Buku / Kitab Acuan:</label>
              <select
                value={selectedBookId}
                onChange={(e) => {
                  setSelectedBookId(e.target.value);
                  if (csvText) doParse(csvText, e.target.value);
                }}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-medium max-w-[220px] truncate"
              >
                {(db.books || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.displayCode || b.display_code || b.id})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleDownloadSample}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Template CSV</span>
            </button>
          </div>

          {/* Upload Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-amber-400 rounded-2xl p-4 text-center cursor-pointer hover:bg-amber-50/20 transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-slate-700">
              Pilih file CSV silabus dari komputer Anda
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Atau tempelkan (paste) teks CSV pada kotak di bawah
            </p>
          </div>

          {/* Raw CSV Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Isi Data CSV Silabus:
            </label>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="book_code,order,title,page_start,page_end,part&#10;bk-arb,1,Mukaddimah & Bab 1,1,20,1"
              className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Errors notice */}
          {parseErrors.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Peringatan Pembacaan CSV:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-700">
                {parseErrors.slice(0, 4).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {parseErrors.length > 4 && (
                  <li>...dan {parseErrors.length - 4} catatan lainnya</li>
                )}
              </ul>
            </div>
          )}

          {/* Preview of Parsed Units */}
          {parsedUnits.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Pratinjau {parsedUnits.length} Bab Materi Terbaca:
                </span>
                <span className="text-[11px] text-slate-500">
                  Diurutkan berdasarkan urutan per buku
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="p-2 border-b border-slate-200">Urutan</th>
                      <th className="p-2 border-b border-slate-200">Buku / Kitab</th>
                      <th className="p-2 border-b border-slate-200">Format Tampilan Bab</th>
                      <th className="p-2 border-b border-slate-200">Halaman</th>
                      <th className="p-2 border-b border-slate-200">Bobot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedUnits.map((unit) => {
                      const pStart = typeof unit.page_start === 'number' ? unit.page_start : parseInt(String(unit.page_start), 10);
                      const pEnd = typeof unit.page_end === 'number' ? unit.page_end : parseInt(String(unit.page_end), 10);
                      const weight = (!isNaN(pStart) && !isNaN(pEnd) && pEnd >= pStart)
                        ? (pEnd - pStart + 1)
                        : 1;
                      const bookObj = unit.bookId ? bookMap.get(unit.bookId) : undefined;
                      const bookTitle = bookObj ? bookObj.title : (unit.bookCode || unit.bookId || '-');

                      return (
                        <tr key={unit.id} className="hover:bg-slate-50">
                          <td className="p-2 font-mono text-slate-500">#{unit.order}</td>
                          <td className="p-2 font-medium text-slate-700 truncate max-w-[150px]" title={bookTitle}>
                            {bookTitle}
                          </td>
                          <td className="p-2 font-medium text-slate-900">
                            {formatUnitDisplay(unit)}
                          </td>
                          <td className="p-2 font-mono text-slate-600 text-[11px]">
                            {unit.page_start ? `Hal. ${unit.page_start} - ${unit.page_end || '?'}` : '-'}
                          </td>
                          <td className="p-2 font-bold text-amber-700 font-mono">
                            {weight}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mode Selector */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Metode Penyimpanan:</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span className="text-slate-700">Gabungkan / Tambah (Merge)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span className="text-rose-700 font-medium">Ganti Semua Silabus</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {parsedUnits.length > 0
              ? `${parsedUnits.length} bab siap disimpan.`
              : 'Silakan pilih file atau tempelkan data.'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/80 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={parsedUnits.length === 0}
              className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Impor {parsedUnits.length > 0 ? `(${parsedUnits.length})` : ''}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
