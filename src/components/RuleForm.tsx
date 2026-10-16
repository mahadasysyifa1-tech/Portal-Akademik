import React, { useState, useEffect, useMemo } from 'react';
import {
  DatabaseState,
  ScheduleRule,
  DayOfWeek,
  RuleException
} from '../types';
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Save,
  Clock,
  Repeat,
  Layers,
  GraduationCap,
  Users,
  DoorOpen,
  Calendar,
  Sparkles,
  CheckCircle2,
  RotateCcw
} from 'lucide-react';
import { getNormalizedDateRangesForRule, formatDateRangesSummary } from '../utils/dateNormalizer';

export interface RuleFormProps {
  db: DatabaseState;
  editingRule?: ScheduleRule | null;
  prefill?: {
    day?: DayOfWeek;
    periodId?: string;
    sessionId?: string;
    classId?: string;
    subjectId?: string;
  };
  onSave: (rule: ScheduleRule) => void;
  onDelete?: (ruleId: string) => void;
  onClose?: () => void;
  onNewRule?: () => void;
  inline?: boolean;
  className?: string;
}

export const RuleForm: React.FC<RuleFormProps> = ({
  db,
  editingRule,
  prefill,
  onSave,
  onDelete,
  onClose,
  onNewRule,
  inline = false,
  className = ''
}) => {
  const [subjectId, setSubjectId] = useState<string>(
    editingRule?.subjectId || prefill?.subjectId || (db.subjects[0]?.id || '')
  );
  const [classId, setClassId] = useState<string>(
    editingRule?.classId || prefill?.classId || (db.classes[0]?.id || '')
  );
  const [teacherId, setTeacherId] = useState<string>(
    editingRule?.teacherId || (db.teachers[0]?.id || '')
  );
  const [roomId, setRoomId] = useState<string>(
    editingRule?.roomId || (db.rooms[0]?.id || '')
  );
  const [sessionId, setSessionId] = useState<string>(
    editingRule?.sessionId || prefill?.sessionId || (db.sessions[0]?.id || '')
  );
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(() => {
    if (editingRule?.daysOfWeek && editingRule.daysOfWeek.length > 0) {
      return editingRule.daysOfWeek;
    }
    if (editingRule?.dayOfWeek) {
      return [editingRule.dayOfWeek];
    }
    if (prefill?.day) {
      return [prefill.day];
    }
    return ['Monday'];
  });
  const [periodIds, setPeriodIds] = useState<string[]>(() => {
    if (editingRule?.periodIds && editingRule.periodIds.length > 0) {
      return editingRule.periodIds;
    }
    if (prefill?.periodId) {
      return [prefill.periodId];
    }
    return ['prd-1'];
  });
  const [repeatDetail, setRepeatDetail] = useState<'Weekly' | 'Bi-Weekly' | 'Custom'>(
    editingRule?.repeatDetail || 'Weekly'
  );
  const [active, setActive] = useState<boolean>(
    editingRule ? (editingRule.active !== undefined ? editingRule.active : true) : true
  );
  const [notes, setNotes] = useState<string>(editingRule?.notes || '');
  const [exceptions, setExceptions] = useState<RuleException[]>(
    editingRule?.exceptions || []
  );
  const [showExceptions, setShowExceptions] = useState<boolean>(
    Boolean(editingRule?.exceptions && editingRule.exceptions.length > 0)
  );
  const [saveFeedback, setSaveFeedback] = useState<boolean>(false);

  // Sync state whenever editingRule or prefill changes externally (real-time click from schedule!)
  useEffect(() => {
    if (editingRule) {
      setSubjectId(editingRule.subjectId);
      setClassId(editingRule.classId);
      setTeacherId(editingRule.teacherId);
      setRoomId(editingRule.roomId);
      setSessionId(editingRule.sessionId);
      if (editingRule.daysOfWeek && editingRule.daysOfWeek.length > 0) {
        setSelectedDays(editingRule.daysOfWeek);
      } else if (editingRule.dayOfWeek) {
        setSelectedDays([editingRule.dayOfWeek]);
      } else {
        setSelectedDays(['Monday']);
      }
      setPeriodIds(
        editingRule.periodIds && editingRule.periodIds.length > 0 ? editingRule.periodIds : ['prd-1']
      );
      setRepeatDetail(editingRule.repeatDetail || 'Weekly');
      setActive(editingRule.active !== undefined ? editingRule.active : true);
      setNotes(editingRule.notes || '');
      setExceptions(editingRule.exceptions || []);
      setShowExceptions(Boolean(editingRule.exceptions && editingRule.exceptions.length > 0));
    } else {
      const resolvedSubId = prefill?.subjectId || (db.subjects[0]?.id || '');
      const sub = db.subjects.find((s) => s.id === resolvedSubId);
      setSubjectId(resolvedSubId);
      setClassId(prefill?.classId || (db.classes[0]?.id || ''));
      setTeacherId(sub?.defaultTeacherId || (db.teachers[0]?.id || ''));
      setRoomId(sub?.defaultRoomId || (db.rooms[0]?.id || ''));
      setSessionId(prefill?.sessionId || (db.sessions[0]?.id || ''));
      setSelectedDays(prefill?.day ? [prefill.day] : ['Monday']);
      setPeriodIds(prefill?.periodId ? [prefill.periodId] : ['prd-1']);
      setRepeatDetail('Weekly');
      setActive(true);
      setNotes('');
      setExceptions([]);
      setShowExceptions(false);
    }
  }, [editingRule, prefill, db.subjects, db.classes, db.teachers, db.rooms, db.sessions]);

  // Normalized date range preview for selected presets
  const normalizedDateRanges = useMemo(() => {
    const dummyRule: ScheduleRule = {
      id: 'temp',
      subjectId: '',
      classId: '',
      teacherId: '',
      roomId: '',
      sessionId: '',
      periodIds,
      repeatDetail: 'Weekly',
      active: true
    };
    return getNormalizedDateRangesForRule(dummyRule, db.periods);
  }, [periodIds, db.periods]);

  // Auto-fill default teacher/room if new rule and subject changes
  const handleSubjectChange = (newSubjectId: string) => {
    setSubjectId(newSubjectId);
    if (!editingRule) {
      const subject = db.subjects.find((s) => s.id === newSubjectId);
      if (subject?.defaultTeacherId) setTeacherId(subject.defaultTeacherId);
      if (subject?.defaultRoomId) setRoomId(subject.defaultRoomId);
    }
  };

  const togglePeriod = (pId: string) => {
    if (periodIds.includes(pId)) {
      if (periodIds.length > 1) {
        setPeriodIds(periodIds.filter((id) => id !== pId));
      }
    } else {
      const nextPids = [...periodIds, pId];
      const periodOrder = new Map<string, number>(db.periods.map((p, idx) => [p.id, p.periodNumber ?? idx]));
      nextPids.sort((a, b) => (periodOrder.get(a) ?? 999) - (periodOrder.get(b) ?? 999));
      setPeriodIds(nextPids);
    }
  };

  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const toggleDay = (day: DayOfWeek) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const selectDayPreset = (preset: 'all' | 'mtw' | 'mwf' | 'tt') => {
    switch (preset) {
      case 'all':
        setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
        break;
      case 'mtw':
        setSelectedDays(['Monday', 'Tuesday', 'Wednesday']);
        break;
      case 'mwf':
        setSelectedDays(['Monday', 'Wednesday', 'Friday']);
        break;
      case 'tt':
        setSelectedDays(['Tuesday', 'Thursday']);
        break;
    }
  };

  // Exceptions management
  const addException = () => {
    const newExc: RuleException = {
      id: `exc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ruleId: editingRule?.id || 'temp',
      periodId: periodIds[0] || (db.periods[0]?.id || ''),
      overrideSessionId: undefined,
      overrideRoomId: undefined,
      overrideTeacherId: undefined,
      note: ''
    };
    setExceptions([...exceptions, newExc]);
    setShowExceptions(true);
  };

  const updateException = (index: number, field: keyof RuleException, val: string | undefined) => {
    const next = [...exceptions];
    next[index] = { ...next[index], [field]: val || undefined };
    setExceptions(next);
  };

  const removeException = (index: number) => {
    setExceptions(exceptions.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!subjectId || !classId || !teacherId || !roomId || !sessionId || periodIds.length === 0) {
      return;
    }

    const periodOrder = new Map<string, number>(db.periods.map((p, idx) => [p.id, p.periodNumber ?? idx]));
    const uniquePeriodIds: string[] = Array.from(new Set<string>(periodIds.filter(Boolean)));
    const sortedPeriodIds = uniquePeriodIds.sort((a, b) => (periodOrder.get(a) ?? 999) - (periodOrder.get(b) ?? 999));

    const ruleToSave: ScheduleRule = {
      id: editingRule?.id || `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      subjectId,
      classId,
      teacherId,
      roomId,
      sessionId,
      dayOfWeek: selectedDays[0] || 'Monday',
      daysOfWeek: selectedDays,
      periodIds: sortedPeriodIds,
      repeatDetail,
      active,
      exceptions,
      notes: notes.trim() || undefined,
      createdAt: editingRule?.createdAt || new Date().toISOString()
    };

    onSave(ruleToSave);

    setSaveFeedback(true);
    setTimeout(() => {
      setSaveFeedback(false);
    }, 2200);
  };

  const currentSubject = db.subjects.find((s) => s.id === subjectId);
  const currentClass = db.classes.find((c) => c.id === classId);

  return (
    <div
      className={`${
        inline
          ? 'w-full bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col'
          : 'bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden'
      } ${className}`}
    >
      {/* Form Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: currentSubject?.color || '#4f46e5' }}
            />
            <h3 className="text-sm font-bold text-slate-900 truncate">
              {editingRule ? 'Edit Aturan Jadwal' : 'Buat Aturan Jadwal'}
            </h3>
            {editingRule && (
              <span className="text-[10px] px-2 py-0.5 font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md shrink-0">
                {editingRule.id.slice(-6)}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            {editingRule
              ? `${currentSubject?.name || 'Pelajaran'} • ${currentClass?.name || 'Kelas'}`
              : 'Pilih slot di jadwal atau isi form untuk alokasi KBM.'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {inline && onNewRule && editingRule && (
            <button
              type="button"
              onClick={onNewRule}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
              title="Mulai membuat aturan baru"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Aturan Baru</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Tutup form aturan"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Save Feedback Banner */}
      {saveFeedback && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 text-xs font-semibold text-emerald-800 animate-in fade-in duration-150 shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Aturan jadwal berhasil disimpan ke database!</span>
        </div>
      )}

      {/* Scrollable Form Body */}
      <form
        onSubmit={handleSubmit}
        className={`p-5 space-y-4 overflow-y-auto ${
          inline ? 'max-h-[calc(100vh-14rem)]' : 'max-h-[75vh]'
        }`}
      >
        {/* Subject & Class Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>Mata Pelajaran</span>
            </label>
            <select
              id="form-subject-select"
              value={subjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              required
            >
              {db.subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
              <span>Kelas / Rombel</span>
            </label>
            <select
              id="form-class-select"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              required
            >
              {db.classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} (Kelas {cls.grade} • {cls.studentCount} santri)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Teacher & Room Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>Guru Pengampu</span>
            </label>
            <select
              id="form-teacher-select"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              required
            >
              {db.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.panggilan ? ` (${t.panggilan})` : ''} ({t.department})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>Ruang Kelas / Lab</span>
            </label>
            <select
              id="form-room-select"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              required
            >
              {db.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.type} • Kapasitas: {r.capacity})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Timing, Cadence & Dedicated Periods */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
          {/* Column 1: Session, Repeat, and Days */}
          <div className="space-y-3">
            {/* Primary Session */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Sesi Waktu</span>
              </label>
              <select
                id="form-session-select"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              >
                {db.sessions
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
              </select>
            </div>

            {/* Repeating Cadence */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Repeat className="w-3.5 h-3.5 text-slate-400" />
                <span>Perulangan Jadwal</span>
              </label>
              <select
                id="form-repeat-select"
                value={repeatDetail}
                onChange={(e) => setRepeatDetail(e.target.value as any)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              >
                <option value="Weekly">Mingguan (Setiap Pekan)</option>
                <option value="Bi-Weekly">Dua Pekan Sekali (Selang-seling)</option>
                <option value="Custom">Kustom / Blok Khusus</option>
              </select>
            </div>

            {/* Days Selection with Presets */}
            {repeatDetail === 'Weekly' && (
              <div className="pt-0.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-600">
                    Hari ({selectedDays.length} dipilih)
                  </span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => selectDayPreset('all')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium transition-colors cursor-pointer"
                      title="Senin s.d. Jumat"
                    >
                      Sen-Jum
                    </button>
                    <button
                      type="button"
                      onClick={() => selectDayPreset('mwf')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 font-medium transition-colors cursor-pointer"
                      title="Senin, Rabu, Jumat"
                    >
                      Sen-Rab-Jum
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {days.map((d) => {
                    const isSelected = selectedDays.includes(d);
                    const indoDays: Record<DayOfWeek, string> = {
                      Monday: 'Sen',
                      Tuesday: 'Sel',
                      Wednesday: 'Rab',
                      Thursday: 'Kam',
                      Friday: 'Jum',
                      Saturday: 'Sab',
                      Sunday: 'Ahd'
                    };
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(d)}
                        title={d}
                        className={`py-1 text-[11px] font-bold rounded-lg border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {indoDays[d] || d.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Column 2: Period Presets & Date Preview */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Periode ({periodIds.length}/{db.periods.length})</span>
              </label>
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setPeriodIds(db.periods.map((p) => p.id))}
                  className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  Semua
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => setPeriodIds([db.periods[0]?.id].filter(Boolean))}
                  className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Vertical Stacked List with Checkboxes */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-lg divide-y divide-slate-200/60 overflow-hidden shadow-2xs max-h-36 overflow-y-auto">
              {db.periods
                .slice()
                .sort((a, b) => a.periodNumber - b.periodNumber)
                .map((p) => {
                  const isSelected = periodIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors text-xs select-none ${
                        isSelected
                          ? 'bg-indigo-50/90 text-indigo-950 font-medium'
                          : 'hover:bg-white text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePeriod(p.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                      />
                      <span className="font-semibold text-slate-800 text-[11px] truncate">{p.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal ml-auto shrink-0">
                        {p.startDate} - {p.endDate}
                      </span>
                    </label>
                  );
                })}
            </div>

            {/* Live Normalized Date Range Feedback */}
            <div className="mt-2 p-2 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-xs">
              <div className="flex items-center gap-1 text-indigo-900 font-bold text-[10px] mb-0.5">
                <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>Rentang Tanggal Ternormalisasi:</span>
              </div>
              <p className="text-[11px] text-indigo-950 font-semibold leading-tight">
                {formatDateRangesSummary(normalizedDateRanges)}
              </p>
            </div>
          </div>
        </div>

        {/* Exceptions (Overrides per Period) */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1.5">
            <button
              type="button"
              onClick={() => setShowExceptions(!showExceptions)}
              className="text-xs font-bold text-slate-700 hover:text-indigo-600 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Pengecualian Khusus Periode ({exceptions.length})</span>
              <span className="text-[10px] font-normal text-slate-400">
                {showExceptions ? '(sembunyikan)' : '(tampilkan)'}
              </span>
            </button>
            <button
              type="button"
              onClick={addException}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Tambah Pengecualian</span>
            </button>
          </div>

          {showExceptions && exceptions.length > 0 && (
            <div className="space-y-2 border border-slate-200 rounded-lg p-2.5 bg-slate-50/60">
              {exceptions.map((exc, idx) => (
                <div
                  key={exc.id || idx}
                  className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 text-[11px]">
                      Pengecualian #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeException(idx)}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer"
                      title="Hapus pengecualian ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                        Berlaku di Periode
                      </label>
                      <select
                        value={exc.periodId}
                        onChange={(e) => updateException(idx, 'periodId', e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1"
                      >
                        {db.periods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                        Override Guru (Opsional)
                      </label>
                      <select
                        value={exc.overrideTeacherId || ''}
                        onChange={(e) => updateException(idx, 'overrideTeacherId', e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1"
                      >
                        <option value="">(Tetap Sesuai Aturan Utama)</option>
                        {db.teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes & Active Status */}
        <div className="space-y-2 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan Khusus (Opsional)
            </label>
            <input
              type="text"
              id="form-rule-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Gabungan kelas teori / Praktikum lab"
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <input
              id="form-active-checkbox"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
            />
            <label htmlFor="form-active-checkbox" className="text-xs font-medium text-slate-700 cursor-pointer">
              Aturan aktif di jadwal (KBM terjadwal)
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
          <div>
            {editingRule && onDelete && (
              <button
                type="button"
                id="form-delete-rule-btn"
                onClick={() => {
                  if (window.confirm('Hapus aturan jadwal ini?')) {
                    onDelete(editingRule.id);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                title="Hapus aturan jadwal ini"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Hapus</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Tutup
              </button>
            )}
            <button
              type="submit"
              id="form-save-rule-btn"
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{editingRule ? 'Perbarui Aturan' : 'Simpan Aturan'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
