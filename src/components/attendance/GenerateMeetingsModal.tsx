import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  Calendar,
  CalendarDays,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Info,
  CalendarRange,
  Layers,
  Clock,
  ArrowRight
} from 'lucide-react';
import type { DatabaseState, GenerateMeetingsResult, Period } from '../../types';

interface GenerateMeetingsModalProps {
  db: DatabaseState;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: GenerateMeetingsResult) => void;
}

export const GenerateMeetingsModal: React.FC<GenerateMeetingsModalProps> = ({
  db,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen) return null;

  // Active periods list
  const periods = useMemo(() => db.periods || [], [db.periods]);
  const kaldikEvents = useMemo(() => db.kaldikEvents || [], [db.kaldikEvents]);
  const rules = useMemo(() => (db.rules || []).filter((r) => r.active !== false), [db.rules]);

  // Default date boundaries from periods or current month
  const defaultPeriodRange = useMemo(() => {
    if (periods.length > 0) {
      const sortedStarts = periods.map((p) => p.startDate).filter(Boolean).sort();
      const sortedEnds = periods.map((p) => p.endDate).filter(Boolean).sort();
      return {
        start: sortedStarts[0] || '2026-09-01',
        end: sortedEnds[sortedEnds.length - 1] || '2026-12-31',
      };
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    return {
      start: `${y}-${m}-01`,
      end: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [periods]);

  // Mode: 'academic-period' | 'custom-range'
  const [scopeMode, setScopeMode] = useState<'academic-period' | 'custom-range'>('academic-period');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>(defaultPeriodRange.start);
  const [customEndDate, setCustomEndDate] = useState<string>(defaultPeriodRange.end);

  // Settings
  const [skipHolidays, setSkipHolidays] = useState<boolean>(true);
  const [overwriteScheduled, setOverwriteScheduled] = useState<boolean>(true);

  // Loading & Result states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultData, setResultData] = useState<GenerateMeetingsResult | null>(null);

  // Compute effective date range
  const effectiveRange = useMemo(() => {
    if (scopeMode === 'custom-range') {
      return {
        start: customStartDate,
        end: customEndDate,
      };
    }
    if (selectedPeriodId === 'all') {
      return defaultPeriodRange;
    }
    const found = periods.find((p) => p.id === selectedPeriodId);
    if (found) {
      return { start: found.startDate, end: found.endDate };
    }
    return defaultPeriodRange;
  }, [scopeMode, selectedPeriodId, customStartDate, customEndDate, periods, defaultPeriodRange]);

  // Find holidays and breaks in range
  const detectedHolidays = useMemo(() => {
    if (!effectiveRange.start || !effectiveRange.end) return [];
    return kaldikEvents.filter((e) => {
      if (!e.startDate || !e.endDate) return false;
      const overlaps = e.startDate <= effectiveRange.end && effectiveRange.start <= e.endDate;
      if (!overlaps) return false;
      return e.type === 'holiday' || (e.isKbm === false && /libur|holiday|cuti|santri|break/i.test(e.title || ''));
    });
  }, [kaldikEvents, effectiveRange]);

  // Days count estimation
  const totalCalendarDays = useMemo(() => {
    try {
      const s = new Date(effectiveRange.start + 'T00:00:00Z');
      const e = new Date(effectiveRange.end + 'T00:00:00Z');
      const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return diff > 0 ? diff : 0;
    } catch {
      return 0;
    }
  }, [effectiveRange]);

  const handleGenerate = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setResultData(null);

    try {
      const payload = {
        startDate: effectiveRange.start,
        endDate: effectiveRange.end,
        periodId: scopeMode === 'academic-period' ? selectedPeriodId : undefined,
        skipHolidays,
        overwriteScheduled,
      };

      const res = await fetch('/api/attendance/generate-meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.details || `Server returned ${res.status}`);
      }

      const data: GenerateMeetingsResult = await res.json();
      setResultData(data);
      onSuccess(data);
    } catch (err: any) {
      console.error('Error generating meetings:', err);
      setErrorMessage(err.message || 'Gagal membuat sesi pertemuan. Silakan periksa koneksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Generate Sesi Pertemuan
                <span className="text-[10px] uppercase font-extrabold tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  Admin
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Otomatisasi jadwal pertemuan presensi berdasarkan Kaldik & Aturan KBM
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Result view if finished */}
          {resultData ? (
            <div className="space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-950">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-900 text-base">Generate Pertemuan Berhasil!</h3>
                    <p className="text-xs text-emerald-700 mt-0.5">{resultData.message}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-emerald-200/70">
                  <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-100 text-center">
                    <div className="text-[11px] font-medium text-emerald-700">Hari Diproses</div>
                    <div className="text-lg font-extrabold text-slate-900">{resultData.totalDaysProcessed}</div>
                  </div>
                  <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-100 text-center">
                    <div className="text-[11px] font-medium text-emerald-700">Sesi Dibuat</div>
                    <div className="text-lg font-extrabold text-emerald-600">+{resultData.totalCreated}</div>
                  </div>
                  <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-100 text-center">
                    <div className="text-[11px] font-medium text-emerald-700">Diperbarui</div>
                    <div className="text-lg font-extrabold text-blue-600">{resultData.totalUpdated}</div>
                  </div>
                  <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-100 text-center">
                    <div className="text-[11px] font-medium text-emerald-700">Libur Dilewati</div>
                    <div className="text-lg font-extrabold text-amber-600">{resultData.totalSkippedHolidays}</div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-emerald-800 flex items-center gap-1.5 bg-emerald-100/50 p-2 rounded-lg">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Sebanyak <strong>{resultData.totalPreserved} sesi presensi selesai</strong> tetap terlindungi utuh tanpa perubahan log presensi santri.
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  Selesai &amp; Buka Kalender
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Error banner if any */}
              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold">Gagal memproses:</span> {errorMessage}
                  </div>
                </div>
              )}

              {/* Scope Selection Tabs */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Cakupan Rentang Tanggal
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setScopeMode('academic-period')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      scopeMode === 'academic-period'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CalendarRange className="w-3.5 h-3.5 text-amber-500" />
                    <span>Periode Kaldik</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScopeMode('custom-range')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      scopeMode === 'custom-range'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Rentang Kustom</span>
                  </button>
                </div>
              </div>

              {/* Scope controls */}
              {scopeMode === 'academic-period' ? (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    Pilih Periode Akademik:
                  </label>
                  <select
                    value={selectedPeriodId}
                    onChange={(e) => setSelectedPeriodId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    <option value="all">
                      🌟 Seluruh Periode Kaldik Aktif ({defaultPeriodRange.start} s/d {defaultPeriodRange.end})
                    </option>
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.startDate} s/d {p.endDate})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Tanggal Mulai:
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Tanggal Akhir:
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Range Preview Badge */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>
                    Rentang: <strong>{effectiveRange.start}</strong> s/d <strong>{effectiveRange.end}</strong>
                  </span>
                </div>
                <div className="font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-lg">
                  {totalCalendarDays} hari kalender
                </div>
              </div>

              {/* Kaldik Holidays Detection Banner */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200/70 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                    <CalendarDays className="w-4 h-4 text-amber-600" />
                    <span>Deteksi Hari Libur &amp; Non-KBM Kaldik</span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-md">
                    {detectedHolidays.length} event terdeteksi
                  </span>
                </div>

                {detectedHolidays.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {detectedHolidays.map((h) => (
                      <span
                        key={h.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-slate-700 text-[11px]"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <strong className="font-semibold">{h.title}</strong>
                        <span className="text-slate-400 text-[10px]">({h.startDate})</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Tidak ada hari libur resmi atau kegiatan jeda yang terdaftar di rentang tanggal ini.
                  </p>
                )}
              </div>

              {/* Configuration Toggles */}
              <div className="space-y-3 pt-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Pengaturan Integrasi
                </label>

                {/* Toggle 1: Skip Holidays */}
                <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 hover:bg-slate-50/80 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipHolidays}
                    onChange={(e) => setSkipHolidays(e.target.checked)}
                    className="mt-0.5 rounded-md text-amber-600 focus:ring-amber-500 h-4 w-4 border-slate-300"
                  />
                  <div>
                    <div className="font-semibold text-slate-800 text-xs">
                      Lewati hari libur &amp; cuti bersama Kalender Akademik (Kaldik)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Tanggal yang ditandai sebagai libur resmi akan secara otomatis dilewati dan tidak dibuatkan sesi pertemuan.
                    </div>
                  </div>
                </label>

                {/* Toggle 2: Overwrite Scheduled & Preserve Completed */}
                <label className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 hover:bg-slate-50/80 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwriteScheduled}
                    onChange={(e) => setOverwriteScheduled(e.target.checked)}
                    className="mt-0.5 rounded-md text-amber-600 focus:ring-amber-500 h-4 w-4 border-slate-300"
                  />
                  <div>
                    <div className="font-semibold text-slate-800 text-xs">
                      Perbarui jadwal sesi yang belum dimulai (presensi selesai tetap aman)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Sesi berstatus &lsquo;scheduled&rsquo; diselaraskan dengan aturan pelajaran, guru, dan ruangan terbaru. Semua sesi yang telah diisi presensi santri akan tetap aman terjaga.
                    </div>
                  </div>
                </label>
              </div>

              {/* Stats note */}
              <div className="flex items-center gap-2 p-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-[11px] text-indigo-900">
                <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>
                  Sistem mendeteksi <strong>{rules.length} aturan jadwal KBM aktif</strong>. Sesi pertemuan akan dibuatkan otomatis untuk tiap kelas dan sesi pelajaran terkait.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer (when not finished yet) */}
        {!resultData && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses Generate Pertemuan...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Mulai Generate Jadwal</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
