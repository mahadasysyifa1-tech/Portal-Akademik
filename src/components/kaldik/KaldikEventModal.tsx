import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  Repeat,
  Layers,
  Sparkles,
  AlertTriangle,
  Trash2,
  CalendarDays,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Calendar
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
  { name: 'Emerald (Kegiatan)', hex: '#10B981' },
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
  Sunday: 'Ahd'
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
  const [eventType, setEventType] = useState<KaldikEventType>('general');
  const [isKbm, setIsKbm] = useState(false);
  const [color, setColor] = useState('#6366F1');
  const [description, setDescription] = useState('');
  const [periodId, setPeriodId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatDetail, setRepeatDetail] = useState<'Weekly' | 'Bi-Weekly' | 'Custom'>('Weekly');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(['Monday']);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (initialEvent) {
      const isEvtKbm = Boolean(initialEvent.isKbm ?? (initialEvent.type === 'kbm'));
      const evtType = initialEvent.type || (isEvtKbm ? 'kbm' : 'general');
      setTitle(initialEvent.title || '');
      setEventType(evtType);
      setIsKbm(isEvtKbm);
      setColor(initialEvent.color || (isEvtKbm ? '#F59E0B' : '#6366F1'));
      setDescription(initialEvent.description || '');
      setIsAllDay(initialEvent.isAllDay !== undefined ? initialEvent.isAllDay : true);
      setStartTime(initialEvent.startTime || '08:00');
      setEndTime(initialEvent.endTime || '10:00');
      setIsRecurring(Boolean(initialEvent.isRecurring));
      setSelectedDays(
        Array.isArray(initialEvent.daysOfWeek) && initialEvent.daysOfWeek.length > 0
          ? initialEvent.daysOfWeek
          : ['Monday']
      );
      setRepeatDetail(initialEvent.repeatDetail || 'Weekly');
      setPeriodId(initialEvent.periodId || (periods[0]?.id || ''));

      let eventStart = initialEvent.startDate || defaultDate || new Date().toISOString().slice(0, 10);
      let eventEnd = initialEvent.endDate || initialEvent.startDate || defaultDate || new Date().toISOString().slice(0, 10);
      let warningMsg: string | null = null;

      if (isEvtKbm && initialEvent.periodId) {
        const livePeriod = periods.find((p) => p.id === initialEvent.periodId);
        if (livePeriod) {
          eventStart = livePeriod.startDate;
          eventEnd = livePeriod.endDate;
        } else {
          warningMsg = 'Peringatan: Periode rujukan untuk KBM ini tidak ditemukan dalam daftar periode aktif.';
        }
      }

      setStartDate(eventStart);
      setEndDate(eventEnd);
      setValidationWarning(warningMsg);
    } else {
      const todayStr = defaultDate || new Date().toISOString().slice(0, 10);
      setTitle('');
      setEventType('general');
      setIsKbm(true); // Default general event: KBM tetap berlangsung
      setColor('#6366F1');
      setDescription('');
      setPeriodId(periods[0]?.id || '');
      setStartDate(todayStr);
      setEndDate(todayStr);
      setIsAllDay(true);
      setStartTime('08:00');
      setEndTime('10:00');
      setIsRecurring(false);
      setRepeatDetail('Weekly');
      setSelectedDays(['Monday']);
      setValidationWarning(null);
    }
  }, [isOpen, initialEvent, defaultDate, periods]);

  if (!isOpen) return null;

  // Handle Type Change
  const handleTypeChange = (newType: KaldikEventType) => {
    setEventType(newType);
    setValidationWarning(null);

    if (newType === 'kbm') {
      setIsKbm(true); // Automatic KBM active
      setColor('#F59E0B');
      setIsAllDay(true);
      // Auto-populate from selected period if available
      const activePeriod = periods.find((p) => p.id === periodId) || periods[0];
      if (activePeriod) {
        setPeriodId(activePeriod.id);
        setStartDate(activePeriod.startDate);
        setEndDate(activePeriod.endDate);
        if (!title || title === 'Event Baru') {
          setTitle(`KBM ${activePeriod.name}`);
        }
      }
    } else if (newType === 'holiday') {
      setIsKbm(false); // Default: KBM dibatalkan
      setColor('#EF4444');
    } else if (newType === 'exam') {
      setIsKbm(false); // Default: KBM dibatalkan (fokus ujian)
      setColor('#8B5CF6');
    } else if (newType === 'activity') {
      setIsKbm(true); // Default: KBM tetap berlangsung
      setColor('#10B981');
    } else {
      setIsKbm(true); // General: KBM tetap berlangsung
      setColor('#6366F1');
    }
  };

  // Period Preset Selection: fills startDate & endDate
  const handlePeriodPresetSelect = (pId: string) => {
    setPeriodId(pId);
    const p = periods.find((item) => item.id === pId);
    if (p) {
      setStartDate(p.startDate);
      setEndDate(p.endDate);
      if (eventType === 'kbm' && (!title || title.startsWith('KBM'))) {
        setTitle(`KBM ${p.name}`);
      }
      setValidationWarning(null);
    }
  };

  // Toggle Day Selection
  const handleToggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  // Day Presets (adopted from RuleForm)
  const selectDayPreset = (preset: 'all' | 'mwf' | 'mon-sat') => {
    if (preset === 'all') {
      setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    } else if (preset === 'mwf') {
      setSelectedDays(['Monday', 'Wednesday', 'Friday']);
    } else if (preset === 'mon-sat') {
      setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalStart = startDate;
    let finalEnd = endDate;

    // Strict validation for KBM
    if (eventType === 'kbm' || isKbm) {
      const validation = validateAndFitKbmPeriodDates(startDate, endDate, periodId, periods);
      finalStart = validation.validStartDate;
      finalEnd = validation.validEndDate;
      if (validation.matchedPeriod) {
        setPeriodId(validation.matchedPeriod.id);
      }
    }

    const payload: KaldikEvent = {
      id: initialEvent?.id || `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim() || (eventType === 'kbm' ? 'KBM' : 'Event Baru'),
      isKbm,
      type: eventType,
      isAllDay,
      startDate: finalStart,
      endDate: finalEnd,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
      isRecurring,
      daysOfWeek: isRecurring ? selectedDays : undefined,
      repeatDetail: isRecurring ? repeatDetail : undefined,
      periodId: periodId || undefined,
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
              {eventType === 'kbm' || isKbm ? (
                <GraduationCap className="w-4 h-4" />
              ) : (
                <CalendarDays className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {initialEvent ? 'Edit Acara Kalender Akademik' : 'Tambah Acara Kaldik Baru'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Jadwal KBM, libur resmi, ujian, atau agenda ma’had
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Validation Warning Alert */}
          {validationWarning && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-start gap-2 text-xs text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="flex-1 text-[11px] leading-relaxed">{validationWarning}</p>
            </div>
          )}

          {/* 1. Title Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <span>Nama / Judul Acara</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                eventType === 'kbm'
                  ? 'Misal: KBM Semester Ganjil 2026/2027'
                  : 'Misal: Libur Idul Fitri / Ujian Tengah Semester / Rihlah Santri'
              }
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          {/* 2. Tipe / Kategori Acara Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kategori / Tipe Acara
            </label>
            <select
              value={eventType}
              onChange={(e) => handleTypeChange(e.target.value as KaldikEventType)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            >
              <option value="kbm">📚 KBM (Kegiatan Belajar Mengajar)</option>
              <option value="holiday">🏖️ Libur / Cuti Akademik</option>
              <option value="exam">📝 Ujian / Asesmen / Evaluasi</option>
              <option value="activity">⭐ Agenda / Kegiatan Khusus Ma'had</option>
              <option value="general">📅 Umum / Lainnya</option>
            </select>
          </div>

          {/* 3. Warna Penanda & Deskripsi / Catatan (placed immediately below Tipe picker) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Warna Penanda
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

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Deskripsi / Catatan (Opsional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Catatan tambahan acara..."
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          {/* 4. KBM Status: "KBM tetap berlangsung / KBM dibatalkan" */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Pengaruh Terhadap Jadwal KBM</span>
              </span>
              <span className="text-[10px] text-slate-500">
                {eventType === 'kbm' ? 'Otomatis untuk tipe KBM' : 'Atur pembatalan KBM'}
              </span>
            </div>

            <div className="pt-1.5">
              {eventType === 'kbm' ? (
                <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>KBM Tetap Berlangsung (Wajib Aktif untuk Tipe KBM)</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsKbm(true)}
                    className={`p-2.5 rounded-lg border text-xs text-left font-medium transition-all cursor-pointer flex items-center gap-2 ${
                      isKbm
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 ring-1 ring-emerald-400 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className={`w-4 h-4 shrink-0 ${isKbm ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="leading-tight">KBM Tetap Berlangsung</div>
                      <div className="text-[10px] font-normal text-slate-500 mt-0.5">Jadwal kelas berjalan normal</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsKbm(false)}
                    className={`p-2.5 rounded-lg border text-xs text-left font-medium transition-all cursor-pointer flex items-center gap-2 ${
                      !isKbm
                        ? 'bg-rose-50 border-rose-300 text-rose-900 ring-1 ring-rose-400 font-bold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <XCircle className={`w-4 h-4 shrink-0 ${!isKbm ? 'text-rose-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="leading-tight">KBM Dibatalkan</div>
                      <div className="text-[10px] font-normal text-slate-500 mt-0.5">Hari ditandai non-KBM (libur)</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 5. Keterikatan Periode Akademik & Rentang Tanggal */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-white">
            {/* Suggested Academic Period Preset Dropdown */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Preset Periode Akademik</span>
                  {eventType === 'kbm' && <span className="text-rose-500">*</span>}
                </label>
                <span className="text-[10px] text-slate-400">
                  {eventType === 'kbm' ? 'Wajib untuk rujukan KBM' : 'Opsional sebagai pengisi tanggal'}
                </span>
              </div>

              <select
                value={periodId}
                onChange={(e) => handlePeriodPresetSelect(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                required={eventType === 'kbm'}
              >
                <option value="">-- Pilih Periode Akademik --</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.startDate} s.d. {p.endDate})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Tanggal Mulai</span>
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate < e.target.value) setEndDate(e.target.value);
                  }}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>Tanggal Selesai</span>
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-mono"
                />
              </div>
            </div>

            {/* All Day Toggle & Time Inputs */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span>Sepanjang Hari (All Day)</span>
              </label>

              {!isAllDay && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Jam Mulai</span>
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono"
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
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 6. Perulangan & Hari Aktif (adopting RuleForm pattern) */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <Repeat className="w-3.5 h-3.5 text-indigo-500" />
                <span>Acara Berulang (Recurring Event)</span>
              </label>
              <span className="text-[10px] text-slate-400">
                {isRecurring ? 'Pola jadwal berulang aktif' : 'Acara satu kali / rentang tunggal'}
              </span>
            </div>

            {isRecurring && (
              <div className="space-y-3 pt-2 border-t border-slate-200/80">
                {/* Cadence */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Frekuensi Perulangan
                  </label>
                  <select
                    value={repeatDetail}
                    onChange={(e) => setRepeatDetail(e.target.value as any)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Weekly">Mingguan (Setiap Pekan)</option>
                    <option value="Bi-Weekly">Dua Pekan Sekali (Selang-seling)</option>
                    <option value="Custom">Kustom / Blok Khusus</option>
                  </select>
                </div>

                {/* Days of Week buttons with presets */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-600">
                      Hari Aktif ({selectedDays.length} dipilih)
                    </span>
                    <div className="flex items-center gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => selectDayPreset('all')}
                        className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium transition-colors border border-slate-200 cursor-pointer"
                        title="Senin s.d. Jumat"
                      >
                        Sen-Jum
                      </button>
                      <button
                        type="button"
                        onClick={() => selectDayPreset('mwf')}
                        className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium transition-colors border border-slate-200 cursor-pointer"
                        title="Senin, Rabu, Jumat"
                      >
                        Sen-Rab-Jum
                      </button>
                      <button
                        type="button"
                        onClick={() => selectDayPreset('mon-sat')}
                        className="px-1.5 py-0.5 rounded bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium transition-colors border border-slate-200 cursor-pointer"
                        title="Senin s.d. Sabtu"
                      >
                        Sen-Sab
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {ALL_DAYS.map((d) => {
                      const isSelected = selectedDays.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleToggleDay(d)}
                          className={`py-1.5 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {DAY_LABELS[d] || d.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            {initialEvent && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Hapus acara "${title || 'ini'}" dari kalender?`)) {
                    onDelete(initialEvent.id);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Acara</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                {initialEvent ? 'Simpan Perubahan' : 'Tambah Acara'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
