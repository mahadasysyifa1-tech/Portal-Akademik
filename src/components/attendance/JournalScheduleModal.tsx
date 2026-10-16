import React, { useState } from 'react';
import { CalendarSync, Check, RefreshCw } from 'lucide-react';

export interface SchedulePreviewData {
  activeRulesCount: number;
  periodsCount: number;
  nonKbmCount: number;
  dateRangeLabel: string;
}

export interface JournalScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (errorMessage: string) => void;
  schedulePreview: SchedulePreviewData;
  onTriggerRefresh: () => void;
}

export const JournalScheduleModal: React.FC<JournalScheduleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError,
  schedulePreview,
  onTriggerRefresh,
}) => {
  const [isScheduling, setIsScheduling] = useState(false);

  if (!isOpen) return null;

  const handleExecuteScheduling = async () => {
    setIsScheduling(true);
    onError('');
    try {
      const res = await fetch('/api/attendance/generate-all-meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.details || data?.error || 'Gagal menjadwalkan pertemuan');
      }

      onClose();
      onSuccess(
        `Berhasil menjadwalkan ${data.totalUpserted} pertemuan ke database. (${data.preservedCompleted} pertemuan terisi tetap dipertahankan, ${data.holidaysSkipped} hari libur dilewati).`
      );
      onTriggerRefresh();
    } catch (err: any) {
      console.error('Error generating meetings:', err);
      onError(err?.message || 'Terjadi kesalahan saat menyimpan jadwal.');
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#024884]/10 text-[#024884] flex items-center justify-center">
              <CalendarSync className="w-5 h-5 text-[#024884]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                Jadwalkan Pertemuan
              </h3>
              <p className="text-xs text-slate-500">
                Sinkronisasi seluruh aturan KBM ke basis data
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body: Ringkasan Perubahan */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Sistem akan memetakan seluruh aturan jadwal aktif ke tabel pertemuan (
            <code className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-mono">
              attnd_meeting
            </code>
            ) untuk tahun ajaran aktif.
          </p>

          {/* Minimal Changes Summary Card */}
          <div className="space-y-2.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 text-xs">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-500">Aturan Jadwal Aktif:</span>
              <span className="font-bold text-slate-900">
                {schedulePreview.activeRulesCount} aturan
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-500">Rentang Tanggal Kalender:</span>
              <span className="font-semibold text-slate-800 text-[11px]">
                {schedulePreview.dateRangeLabel}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-500">Agenda Non-KBM / Libur Kaldik:</span>
              <span className="font-semibold text-amber-700">
                {schedulePreview.nonKbmCount} agenda (otomatis dilewati)
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-slate-700">
              <span className="text-slate-500">Presensi &amp; Log Roll-Call:</span>
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Tetap terlindungi &amp; tidak tertimpa
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-amber-50/70 p-3 rounded-xl border border-amber-200/60">
            <span className="font-semibold text-amber-800">Catatan Kalibrasi Guru:</span> Pengaturan urutan materi dan laju kurikulum di Jurnal tidak akan diubah atau terganggu.
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isScheduling}
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={isScheduling || schedulePreview.activeRulesCount === 0}
            onClick={handleExecuteScheduling}
            className="flex items-center gap-2 px-4 py-2 bg-[#024884] hover:bg-[#0359a3] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScheduling ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Menjadwalkan...</span>
              </>
            ) : (
              <>
                <CalendarSync className="w-3.5 h-3.5 text-amber-400" />
                <span>Mulai Penjadwalan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
