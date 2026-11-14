import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Calendar,
  AlertCircle,
  Filter,
  GraduationCap,
  Users,
  Loader2,
  BookOpen,
  Check,
} from 'lucide-react';
import type { AttendanceStatus, AttendanceSummaryItem, AttendanceHistoryEntry } from '../../types';

interface AttendanceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  personType: 'student' | 'teacher';
  personId: string;
  personName: string;
  personSubtitle?: string;
  initialSummary?: AttendanceSummaryItem;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  Hadir: {
    label: 'Hadir',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  Terlambat: {
    label: 'Terlambat',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  Izin: {
    label: 'Izin',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  Sakit: {
    label: 'Sakit',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    dotClass: 'bg-purple-500',
  },
  Alpa: {
    label: 'Alpa',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
  },
};

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const AttendanceHistoryModal: React.FC<AttendanceHistoryModalProps> = ({
  isOpen,
  onClose,
  personType,
  personId,
  personName,
  personSubtitle,
  initialSummary,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [history, setHistory] = useState<AttendanceHistoryEntry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [isSubjectMenuOpen, setIsSubjectMenuOpen] = useState<boolean>(false);
  const subjectMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedSubject('all');
    setIsSubjectMenuOpen(false);
  }, [personId, isOpen]);

  useEffect(() => {
    if (!isOpen || !personId) return;

    let isMounted = true;
    setLoading(true);

    const url = `/api/attendance/person-history?personType=${personType}&personId=${encodeURIComponent(
      personId
    )}${selectedMonth !== 'all' ? `&month=${selectedMonth}` : ''}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat riwayat presensi');
        return res.json();
      })
      .then((data: AttendanceHistoryEntry[]) => {
        if (isMounted) {
          setHistory(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Fetch attendance history error:', err);
        if (isMounted) {
          setHistory([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, personType, personId, selectedMonth]);

  // Handle escape key & outside clicks for subject dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isSubjectMenuOpen) {
          setIsSubjectMenuOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubjectMenuOpen, onClose]);

  useEffect(() => {
    if (!isSubjectMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (subjectMenuRef.current && !subjectMenuRef.current.contains(e.target as Node)) {
        setIsSubjectMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSubjectMenuOpen]);

  // Extract distinct available months from history for dynamic filter
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    history.forEach((h) => {
      if (h.meetingDate && h.meetingDate.length >= 7) {
        set.add(h.meetingDate.substring(0, 7));
      }
    });

    // Also include common current year months if empty
    const current = new Date();
    const curYear = current.getFullYear();
    for (let m = 7; m <= 12; m++) {
      set.add(`${curYear - 1}-${String(m).padStart(2, '0')}`);
    }
    for (let m = 1; m <= 12; m++) {
      set.add(`${curYear}-${String(m).padStart(2, '0')}`);
    }

    return Array.from(set).sort().reverse();
  }, [history]);

  const getSubjectShortCode = (name: string, code?: string) => {
    const cleanCode = code?.trim();
    if (cleanCode) return cleanCode.toUpperCase().slice(0, 4);
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase() || 'MP';
  };

  // Distinct subjects found in loaded attendance history
  const availableSubjects = useMemo(() => {
    const map = new Map<string, { color?: string; code: string }>();
    history.forEach((h) => {
      if (h.subjectName) {
        const existing = map.get(h.subjectName);
        if (!existing) {
          map.set(h.subjectName, {
            color: h.subjectColor,
            code: getSubjectShortCode(h.subjectName, h.subjectCode),
          });
        } else if (!existing.color && h.subjectColor) {
          existing.color = h.subjectColor;
        }
      }
    });
    if (selectedSubject !== 'all' && !map.has(selectedSubject)) {
      map.set(selectedSubject, {
        color: undefined,
        code: getSubjectShortCode(selectedSubject),
      });
    }
    return Array.from(map.entries())
      .map(([name, info]) => ({ name, color: info.color, code: info.code }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [history, selectedSubject]);

  const selectedSubjectMeta = useMemo(
    () => availableSubjects.find((s) => s.name === selectedSubject),
    [availableSubjects, selectedSubject]
  );

  const subjectFilteredHistory = useMemo(() => {
    if (selectedSubject === 'all') return history;
    return history.filter((h) => h.subjectName === selectedSubject);
  }, [history, selectedSubject]);

  // Filter history by status filter inside modal (on top of subject & month filters)
  const filteredHistory = useMemo(() => {
    return subjectFilteredHistory.filter((h) => {
      if (statusFilter !== 'all' && h.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [subjectFilteredHistory, statusFilter]);

  // Recalculate stats for current subject-filtered list
  const currentStats = useMemo(() => {
    const total = subjectFilteredHistory.length;
    const hadir = subjectFilteredHistory.filter((h) => h.status === 'Hadir').length;
    const terlambat = subjectFilteredHistory.filter((h) => h.status === 'Terlambat').length;
    const izin = subjectFilteredHistory.filter((h) => h.status === 'Izin').length;
    const sakit = subjectFilteredHistory.filter((h) => h.status === 'Sakit').length;
    const alpa = subjectFilteredHistory.filter((h) => h.status === 'Alpa').length;
    const present = hadir + terlambat;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, hadir, terlambat, izin, sakit, alpa, present, rate };
  }, [subjectFilteredHistory]);

  const displayStats =
    selectedMonth === 'all' && selectedSubject === 'all' && initialSummary
      ? {
          total: initialSummary.total,
          hadir: initialSummary.hadir,
          terlambat: initialSummary.terlambat,
          izin: initialSummary.izin,
          sakit: initialSummary.sakit,
          alpa: initialSummary.alpa,
          present: initialSummary.hadir + initialSummary.terlambat,
          rate: initialSummary.rate,
        }
      : currentStats;

  if (!isOpen) return null;

  const rateColor =
    displayStats.rate >= 85
      ? 'text-emerald-600'
      : displayStats.rate >= 70
      ? 'text-amber-600'
      : displayStats.total === 0
      ? 'text-slate-400'
      : 'text-rose-600';

  const barColor =
    displayStats.rate >= 85
      ? 'bg-emerald-500'
      : displayStats.rate >= 70
      ? 'bg-amber-500'
      : 'bg-rose-500';

  const statCells = [
    { key: 'total', label: 'Total Sesi', short: 'Total', value: displayStats.total, color: 'text-slate-800' },
    { key: 'hadir', label: 'Hadir', short: 'Hadir', value: displayStats.hadir, color: 'text-emerald-600' },
    { key: 'terlambat', label: 'Terlambat', short: 'Telat', value: displayStats.terlambat, color: 'text-amber-600' },
    { key: 'izin', label: 'Izin', short: 'Izin', value: displayStats.izin, color: 'text-blue-600' },
    { key: 'sakit', label: 'Sakit', short: 'Sakit', value: displayStats.sakit, color: 'text-purple-600' },
    { key: 'alpa', label: 'Alpa', short: 'Alpa', value: displayStats.alpa, color: 'text-rose-600' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] z-10">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              {personType === 'student' ? (
                <GraduationCap className="w-4.5 h-4.5" />
              ) : (
                <Users className="w-4.5 h-4.5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-base font-bold text-slate-900 truncate">{personName}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200/80 text-slate-700 shrink-0">
                  {personType === 'student' ? 'Santri' : 'Pengajar'}
                </span>
              </div>
              {personSubtitle && (
                <p className="text-xs text-slate-500 truncate font-mono">{personSubtitle}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Presence Summary: square subject tile + big rate + bar + count */}
        <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-100">
          <div className="flex items-center gap-3">
            {/* Clickable Square Subject Block */}
            <div ref={subjectMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsSubjectMenuOpen((prev) => !prev)}
                style={
                  selectedSubject !== 'all'
                    ? { backgroundColor: selectedSubjectMeta?.color || '#4F46E5' }
                    : undefined
                }
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex flex-col items-center justify-center px-1 transition-all cursor-pointer select-none ${
                  selectedSubject !== 'all'
                    ? 'border border-black/15 shadow-xs text-white hover:brightness-95'
                    : 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200/80'
                }`}
                title={
                  selectedSubject === 'all'
                    ? 'Semua Mata Pelajaran — klik untuk memfilter per mapel'
                    : `${selectedSubject} — klik untuk mengganti mata pelajaran`
                }
              >
                {selectedSubject === 'all' ? (
                  <>
                    <BookOpen className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-slate-600 shrink-0" />
                    <span className="text-[9px] font-semibold text-slate-600 leading-tight mt-0.5 truncate max-w-[44px] sm:max-w-[50px]">
                      Semua
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm sm:text-base font-black leading-none tracking-tight text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]">
                      {selectedSubjectMeta?.code || getSubjectShortCode(selectedSubject)}
                    </span>
                    <span className="text-[8px] sm:text-[9px] font-medium text-white/95 leading-tight mt-0.5 truncate max-w-[44px] sm:max-w-[52px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">
                      {selectedSubject}
                    </span>
                  </>
                )}
              </button>

              {isSubjectMenuOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-30 min-w-[200px] max-w-[270px] max-h-60 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubject('all');
                      setIsSubjectMenuOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      selectedSubject === 'all'
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <BookOpen className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">Semua Mapel</span>
                    </span>
                    {selectedSubject === 'all' && <Check className="w-3.5 h-3.5 shrink-0 text-indigo-600" />}
                  </button>

                  {availableSubjects.length > 0 && <div className="my-1 border-t border-slate-100" />}

                  {availableSubjects.map((subj) => {
                    const isSelected = selectedSubject === subj.name;
                    return (
                      <button
                        key={subj.name}
                        type="button"
                        onClick={() => {
                          setSelectedSubject(subj.name);
                          setIsSubjectMenuOpen(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-700 font-bold'
                            : 'text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: subj.color || '#64748B' }}
                          />
                          <span className="font-mono text-[10px] font-bold text-slate-400 shrink-0">
                            {subj.code}
                          </span>
                          <span className="truncate">{subj.name}</span>
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-indigo-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={`text-4xl sm:text-5xl font-black leading-none tabular-nums shrink-0 ${rateColor}`}>
              {displayStats.rate}%
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex w-full h-2 rounded-full overflow-hidden bg-slate-100">
                <div
                  className={`h-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${Math.min(100, displayStats.rate)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-tight">
                <span className="font-bold text-slate-800">{displayStats.present}</span> hadir dari total{' '}
                <span className="font-bold text-slate-800">{displayStats.total}</span> sesi
              </p>
            </div>
          </div>
        </div>

        {/* Stat Row: numbers only */}
        <div className="grid grid-cols-6 px-2 sm:px-6 py-2 bg-white border-b border-slate-100 divide-x divide-slate-100">
          {statCells.map((c) => (
            <div key={c.key} className="text-center min-w-0 px-0.5">
              <div className={`text-base sm:text-lg font-black leading-none tabular-nums ${c.color}`}>
                {c.value}
              </div>
              <div className="mt-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide text-slate-400 truncate">
                <span className="sm:hidden">{c.short}</span>
                <span className="hidden sm:inline">{c.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Filters: one row */}
        <div className="px-4 sm:px-6 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer truncate"
            >
              <option value="all">Semua Bulan</option>
              {availableMonths.map((mStr) => {
                const [y, m] = mStr.split('-');
                const monthName = MONTH_NAMES[parseInt(m, 10) - 1] || mStr;
                return (
                  <option key={mStr} value={mStr}>
                    {monthName} {y}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="relative shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="Hadir">Hadir</option>
              <option value="Terlambat">Terlambat</option>
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
              <option value="Alpa">Alpa</option>
            </select>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 min-h-[220px]">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
              <p className="text-xs font-medium">Memuat riwayat sesi presensi...</p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">
                Tidak ada riwayat presensi yang ditemukan
              </p>
              <p className="text-[11px] text-slate-400">
                Belum ada data presensi pada rentang waktu atau status yang dipilih.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-2xs">
              {filteredHistory.map((item, idx) => {
                const conf = STATUS_CONFIG[item.status] || {
                  label: item.status || 'Hadir',
                  badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  dotClass: 'bg-slate-400',
                };

                // Format Indonesian Date
                let formattedDate = item.meetingDate;
                try {
                  const d = new Date(item.meetingDate + 'T00:00:00');
                  formattedDate = d.toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  });
                } catch {
                  // Keep raw
                }

                return (
                  <div
                    key={`${item.meetingId}-${idx}`}
                    className="p-3.5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{formattedDate}</span>
                        {item.sessionName && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            • {item.sessionName}{' '}
                            {item.startTime && item.endTime
                              ? `(${item.startTime} - ${item.endTime})`
                              : ''}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                        {/* Subject */}
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                          {item.subjectColor && (
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ backgroundColor: item.subjectColor }}
                            />
                          )}
                          {item.subjectName}
                        </span>

                        <span className="text-slate-300">/</span>

                        {/* Class */}
                        <span className="font-medium text-slate-700">{item.className}</span>

                        {/* Teacher if viewing student */}
                        {personType === 'student' && item.teacherName && (
                          <>
                            <span className="text-slate-300">/</span>
                            <span className="text-[11px] text-slate-500">
                              Guru: {item.teacherName}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Notes / Reason if any */}
                      {item.note && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200/60 mt-1 max-w-md">
                          <span className="font-semibold text-slate-700">Keterangan:</span>{' '}
                          {item.note}
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${conf.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${conf.dotClass}`} />
                        {conf.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="hidden sm:inline">Tekan Esc untuk menutup</span>
          <span className="text-[11px] text-slate-400">{filteredHistory.length} sesi ditampilkan</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};