import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Repeat,
  Layers,
  Sparkles,
  AlertTriangle,
  Trash2,
  Check,
  CalendarDays,
  GraduationCap
} from 'lucide-react';
import { KaldikEvent, KaldikEventType, Period, DayOfWeek } from '../../types';
import { validateAndFitKbmPeriodDates } from '../../utils/kaldikValidation';

interface KaldikEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: KaldikEvent) => void;
  onDelete?: (id: string) => void;
  initialEvent?: KaldikEvent | null;
  defaultDate?: string;
  periods: Period[];
}

const COLOR_PRESETS = [
  { name: 'Amber (KBM)', hex: '#F59E0B' },
  { name: 'Rose (Libur)', hex: '#EF4444' },
  { name: 'Purple (Ujian)', hex: '#8B5CF6' },
  { name: 'Emerald (Sunnah/Kegiatan)', hex: '#10B981' },
  { name: 'Sky (Akademik)', hex: '#0284C7' },
  { name: 'Indigo (Umum)', hex: '#6366F1' },
  { name: 'Orange (Ekstrakurikuler)', hex: '#EA580C' }
];

const ALL_DAYS: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  Monday: 'Sen',
  Tuesday: 'Sel',
  Wednesday: 'Rab',
  Thursday: 'Kam',
  Friday: 'Jum',
  Saturday: 'Sab',
  Sunday: 'Ahad'
};

export const KaldikEventModal: React.FC<KaldikEventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialEvent,
  defaultDate,
  periods
}) => {
  const [title, setTitle] = useState('');
  const [isKbm, setIsKbm] = useState(false);
  const [eventType, setEventType] = useState<KaldikEventType>('general');
  const [isAllDay, setIsAllDay] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(['Monday']);
  const [repeatDetail, setRepeatDetail] = useState<'Weekly' | 'Bi-Weekly' | 'Custom'>('Weekly');
  const [periodId, setPeriodId] = useState<string>('');
  const [color, setColor] = useState('#6366F1');
  const [description, setDescription] = useState('');
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) return;

    if (initialEvent) {
      const isEvtKbm = Boolean(initialEvent.isKbm || initialEvent.type === 'kbm');
      setTitle(initialEvent.title || '');
      setIsKbm(isEvtKbm);
      setEventType(initialEvent.type || (isEvtKbm ? 'kbm' : 'general'));
      setIsAllDay(initialEvent.isAllDay !== undefined ? initialEvent.isAllDay : true);

      // Fix 2: KBM events must resolve dates live from periods instead of stored snapshot
      let eventStart = initialEvent.startDate || defaultDate || new Date().toISOString().slice(0, 10);
      let eventEnd = initialEvent.endDate || initialEvent.startDate || defaultDate || new Date().toISOString().slice(0, 10);
      let warningMsg: string | null = null;

      if (isEvtKbm) {
        const livePeriod = initialEvent.periodId
          ? periods.find((p) => p.id === initialEvent.periodId)
          : undefined;

        if (livePeriod) {
          eventStart = livePeriod.startDate;
          eventEnd = livePeriod.endDate;
        } else {
          warningMsg = 'Peringatan: Periode rujukan untuk KBM ini tidak ditemukan atau telah dihapus.';
        }
      }

      setStartDate(eventStart);
      setEndDate(eventEnd);
      setStartTime(initialEvent.startTime || '08:00');
      setEndTime(initialEvent.endTime || '10:00');
      setIsRecurring(Boolean(initialEvent.isRecurring));
      setSelectedDays(initialEvent.daysOfWeek || ['Monday']);
      setRepeatDetail(initialEvent.repeatDetail || 'Weekly');
      setPeriodId(initialEvent.periodId || '');
      setColor(initialEvent.color || (isEvtKbm ? '#F59E0B' : '#6366F1'));
      setDescription(initialEvent.description || '');
      setValidationWarning(warningMsg);
    } else {
      const todayStr = defaultDate || new Date().toISOString().slice(0, 10);
      setTitle('');
      setIsKbm(false);
      setEventType('general');
      setIsAllDay(true);
      setStartDate(todayStr);
      setEndDate(todayStr);
      setStartTime('08:00');
      setEndTime('10:00');
      setIsRecurring(false);
      setSelectedDays(['Monday']);
      setRepeatDetail('Weekly');
      setPeriodId(periods[0]?.id || '');
      setColor('#6366F1');
      setDescription('');
      setValidationWarning(null);
    }
  }, [isOpen, initialEvent, defaultDate, periods]);

  if (!isOpen) return null;

  // Handler for activating KBM mode
  const handleToggleKbm = (enableKbm: boolean) => {
    setIsKbm(enableKbm);
    if (enableKbm) {
      setEventType('kbm');
      setColor('#F59E0B');
      setIsAllDay(true);
      // If title is blank or generic, set to KBM
      if (!title || title === 'Event Baru') {
        const targetPeriod = periods.find((p) => p.id === periodId) || periods[0];
        setTitle(targetPeriod ? `KBM ${targetPeriod.name}` : 'KBM');
      }

      // Auto fill period dates
      const activePeriod = periods.find((p) => p.id === periodId) || periods[0];
      if (activePeriod) {
        setPeriodId(activePeriod.id);
        setStartDate(activePeriod.startDate);
        setEndDate(activePeriod.endDate);
      }
      setValidationWarning(null);
    } else {
      if (eventType === 'kbm') setEventType('general');
      if (color === '#F59E0B') setColor('#6366F1');
      setValidationWarning(null);
    }
  };

  // Handler for period change in KBM mode
  const handleSelectPeriod = (pId: string) => {
    setPeriodId(pId);
    const selected = periods.find((p) => p.id === pId);
    if (selected) {
      // Auto-fill dates from chosen period just like class rule form
      setStartDate(selected.startDate);
      setEndDate(selected.endDate);
      if (isKbm && (!title || title.startsWith('KBM'))) {
        setTitle(`KBM ${selected.name}`);
      }
      setValidationWarning(null);
    }
  };

  // Validate manual date inputs for KBM
  const handleDateChange = (type: 'start' | 'end', val: string) => {
    if (type === 'start') {
      setStartDate(val);
      if (endDate < val) setEndDate(val);
    } else {
      setEndDate(val);
    }

    // If KBM mode, enforce period bounds validation
    if (isKbm) {
      const newStart = type === 'start' ? val : startDate;
      const newEnd = type === 'end' ? val : endDate;
      const result = validateAndFitKbmPeriodDates(newStart, newEnd, periodId, periods);
      if (result.wasAdjusted) {
        setValidationWarning(result.message || 'Tanggal KBM harus berada dalam periode resmi');
      } else {
        setValidationWarning(null);
      }
    }
  };

  // Clamp on blur if in KBM mode
  const handleDateBlur = () => {
    if (isKbm) {
      const result = validateAndFitKbmPeriodDates(startDate, endDate, periodId, periods);
      if (result.wasAdjusted) {
        setStartDate(result.validStartDate);
        setEndDate(result.validEndDate);
        if (result.matchedPeriod && result.matchedPeriod.id !== periodId) {
          setPeriodId(result.matchedPeriod.id);
        }
        setValidationWarning(result.message || null);
      }
    }
  };

  const handleToggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalStart = startDate;
    let finalEnd = endDate;

    // Strict validation for KBM
    if (isKbm) {
      const validation = validateAndFitKbmPeriodDates(startDate, endDate, periodId, periods);
      finalStart = validation.validStartDate;
      finalEnd = validation.validEndDate;
      if (validation.matchedPeriod) {
        setPeriodId(validation.matchedPeriod.id);
      }
    }

    const payload: KaldikEvent = {
      id: initialEvent?.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim() || (isKbm ? 'KBM' : 'Event Baru'),
      isKbm,
      type: isKbm ? 'kbm' : eventType,
      isAllDay,
      startDate: finalStart,
      endDate: finalEnd,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
      isRecurring,
      daysOfWeek: isRecurring ? selectedDays : undefined,
      repeatDetail: isRecurring ? repeatDetail : undefined,
      periodId: isKbm || periodId ? periodId : undefined,
      color,
      description: description.trim() || undefined,
      createdAt: initialEvent?.createdAt || new Date().toISOString()
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-2xs"
              style={{ backgroundColor: color }}
            >
              {isKbm ? <GraduationCap className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {initialEvent ? 'Edit Event Kaldik' : 'Tambah Event Baru'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Kalender Pendidikan: Jadwal KBM, libur resmi, ujian, atau agenda ma’had
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Event Title with Special "KBM" Quick Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span>Nama / Judul Event</span>
                <span className="text-rose-500">*</span>
              </label>

              {/* Special KBM quick toggle button */}
              <button
                type="button"
                onClick={() => handleToggleKbm(!isKbm)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  isKbm
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 ring-2 ring-amber-400/30'
                    : 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border border-slate-200'
                }`}
              >
                <Sparkles className={`w-3 h-3 ${isKbm ? 'text-amber-600 fill-amber-500' : 'text-slate-400'}`} />
                <span>{isKbm ? '✓ Ditandai sebagai KBM' : '+ Jadikan KBM'}</span>
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isKbm ? 'Misal: KBM Periode 1 (Cycle 1)' : 'Misal: Libur Idul Fitri / Ujian Akhir / Halal Bihalal'}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          {/* KBM Period Integration Box - Appears when isKbm is active */}
          {isKbm && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                  <Layers className="w-3.5 h-3.5 text-amber-700" />
                  <span>Pilih Periode Database KBM</span>
                </div>
                <span className="text-[10px] font-semibold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-full">
                  Terkait Basis Data Periode
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {periods.map((p) => {
                  const isSelected = periodId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPeriod(p.id)}
                      className={`text-left p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-100/90 border-amber-400 ring-1 ring-amber-400 text-amber-950 font-bold'
                          : 'bg-white border-amber-200/80 hover:bg-amber-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="truncate">{p.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-800 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {p.startDate} s.d. {p.endDate}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Quick Fill Button */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-amber-900">
                  Rentang tanggal KBM wajib berada dalam batas periode di atas.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const activeP = periods.find((p) => p.id === periodId) || periods[0];
                    if (activeP) {
                      setStartDate(activeP.startDate);
                      setEndDate(activeP.endDate);
                      setValidationWarning(null);
                    }
                  }}
                  className="text-[11px] font-bold text-amber-900 hover:text-amber-950 underline cursor-pointer"
                >
                  Isi Otomatis dari Periode
                </button>
              </div>

              {/* Flagged warning if periodId missing or doesn't match any period */}
              {(!periodId || !periods.some((p) => p.id === periodId)) && (
                <div className="bg-amber-100/90 border-2 border-dashed border-amber-500 rounded-lg p-2.5 flex items-start gap-2 text-xs text-amber-950">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-bold block">Peringatan: Periode Rujukan Tidak Ditemukan</span>
                    <span>Periode rujukan untuk event KBM ini (ID: {periodId || 'kosong'}) tidak ditemukan dalam daftar periode aktif. Silakan pilih salah satu periode aktif di atas untuk menyinkronkan rentang tanggal live.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation Warning Alert */}
          {validationWarning && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-start gap-2 text-xs text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="flex-1 text-[11px] leading-relaxed">{validationWarning}</p>
            </div>
          )}

          {/* Category & Color row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kategori Event
              </label>
              <select
                value={isKbm ? 'kbm' : eventType}
                onChange={(e) => {
                  const val = e.target.value as KaldikEventType;
                  setEventType(val);
                  if (val === 'kbm') {
                    handleToggleKbm(true);
                  } else {
                    setIsKbm(false);
                    if (val === 'holiday') setColor('#EF4444');
                    else if (val === 'exam') setColor('#8B5CF6');
                    else if (val === 'activity') setColor('#10B981');
                    else setColor('#6366F1');
                  }
                }}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              >
                <option value="kbm">📚 KBM (Kegiatan Belajar Mengajar)</option>
                <option value="holiday">🏖️ Libur / Cuti Akademik</option>
                <option value="exam">📝 Ujian / Asesmen / Evaluasi</option>
                <option value="activity">⭐ Agenda / Kegiatan Khusus Ma'had</option>
                <option value="general">📅 Umum / Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Warna Label
              </label>
              <div className="flex items-center gap-1.5 pt-0.5">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    title={p.name}
                    onClick={() => setColor(p.hex)}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      color === p.hex ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: p.hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* All Day Toggle & Timing */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span>Sepanjang Hari (All Day)</span>
              </label>
              <span className="text-[10px] text-slate-400">
                {isAllDay ? 'Berlaku 1 hari penuh' : 'Spesifik jam tertentu'}
              </span>
            </div>

            {/* Time inputs if not all day */}
            {!isAllDay && (
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200/60">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Jam Mulai</span>
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Jam Selesai</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Date Range Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Tanggal Mulai</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => handleDateChange('start', e.target.value)}
                onBlur={handleDateBlur}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Tanggal Selesai</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => handleDateChange('end', e.target.value)}
                onBlur={handleDateBlur}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Recurring Events Toggle (unrelated to classrule) */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5 text-slate-500" />
                  <span>Event Berulang (Recurring)</span>
                </span>
              </label>
              <span className="text-[10px] text-slate-400">
                {isRecurring ? 'Berulang pada hari tertentu' : 'Sekali kejadian'}
              </span>
            </div>

            {/* Recurring Settings */}
            {isRecurring && (
              <div className="space-y-2.5 pt-2 border-t border-slate-200/60">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600">Pilih Hari Berulang:</span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSelectedDays(['Monday', 'Thursday'])}
                      className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 cursor-pointer"
                    >
                      Senin &amp; Kamis
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}
                      className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 cursor-pointer"
                    >
                      Senin - Jumat
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {ALL_DAYS.map((day) => {
                    const isSelected = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleToggleDay(day)}
                        className={`py-1.5 text-center text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {DAY_LABELS[day]}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Pola Perulangan:
                  </label>
                  <select
                    value={repeatDetail}
                    onChange={(e) => setRepeatDetail(e.target.value as any)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800"
                  >
                    <option value="Weekly">Setiap Pekan (Weekly)</option>
                    <option value="Bi-Weekly">Dua Pekan Sekali (Bi-Weekly)</option>
                    <option value="Custom">Kustom / Rentang Tertentu</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan / Keterangan Tambahan (Opsional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tambahkan detail lokasi, panitia, ketentuan seragam santri, dll..."
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
            <div>
              {initialEvent && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Hapus event "${initialEvent.title}" dari Kaldik?`)) {
                      onDelete(initialEvent.id);
                      onClose();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{initialEvent ? 'Simpan Perubahan' : 'Tambah Event'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
