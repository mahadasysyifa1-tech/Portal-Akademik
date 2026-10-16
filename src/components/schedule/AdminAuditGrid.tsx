import React, { useMemo, useState } from 'react';
import { DatabaseState, DayOfWeek, ScheduleRule } from '../../types';
import { FixedBlockSubGrid, FixedBlockHeaderGrid } from './FixedBlockSubGrid';
import { ClassIcon } from '../ClassIcon';
import { computeResolvedSlots } from '../../utils/scheduleEngine';
import { doesIntersectRange } from '../../utils/dateNormalizer';
import { Clock, AlertCircle, Grid3X3, Table, Layers, ChevronRight, GraduationCap } from 'lucide-react';

interface AdminAuditGridProps {
  db: DatabaseState;
  selectedPeriodId: string;
  onEntryClick?: (data: any) => void;
  onEditRule?: (rule: ScheduleRule) => void;
}

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_LABELS: Record<DayOfWeek, string> = {
  Monday: 'Senin',
  Tuesday: 'Selasa',
  Wednesday: 'Rabu',
  Thursday: 'Kamis',
  Friday: 'Jumat',
  Saturday: 'Sabtu',
  Sunday: 'Ahad'
};

function getSessionAbbr(name: string): string {
  if (!name) return 'S';
  const clean = name.trim();
  const numMatch = clean.match(/^(?:Session|Sesi|Jam|Period)?\s*(\d+)/i) || clean.match(/(\d+)/);
  if (numMatch) {
    const firstChar = clean[0].toUpperCase();
    return `${firstChar}${numMatch[1]}`;
  }
  return clean.slice(0, 3).toUpperCase();
}

export const AdminAuditGrid: React.FC<AdminAuditGridProps> = ({
  db,
  selectedPeriodId,
  onEntryClick,
  onEditRule
}) => {
  const [subView, setSubView] = useState<'matrix' | 'table'>('matrix');

  // Sorted sessions
  const sortedSessions = useMemo(() => {
    return [...db.sessions].sort((a, b) => a.order - b.order);
  }, [db.sessions]);

  // Stably sorted classes
  const sortedClasses = useMemo(() => {
    return [...db.classes].sort((a, b) => (a.grade || 0) - (b.grade || 0) || a.name.localeCompare(b.name));
  }, [db.classes]);

  const isUltraDense = sortedClasses.length > 10;

  // Lookup maps
  const subjectMap = useMemo(() => new Map(db.subjects.map((s) => [s.id, s])), [db.subjects]);
  const teacherMap = useMemo(() => new Map(db.teachers.map((t) => [t.id, t])), [db.teachers]);
  const roomMap = useMemo(() => new Map(db.rooms.map((r) => [r.id, r])), [db.rooms]);
  const ruleMap = useMemo(() => new Map(db.rules.map((r) => [r.id, r])), [db.rules]);

  // Resolved slots
  const allResolvedSlots = useMemo(() => {
    return computeResolvedSlots(db.rules, db.periods);
  }, [db.rules, db.periods]);

  // Filter slots by selected period
  const activeSlots = useMemo(() => {
    if (selectedPeriodId && selectedPeriodId !== 'all') {
      const targetP = db.periods.find((p) => p.id === selectedPeriodId);
      if (targetP && targetP.startDate && targetP.endDate) {
        return allResolvedSlots.filter((s) =>
          doesIntersectRange(s.dateRanges || [], targetP.startDate, targetP.endDate)
        );
      }
      return allResolvedSlots.filter((s) => s.periodId === selectedPeriodId);
    }
    return allResolvedSlots;
  }, [allResolvedSlots, selectedPeriodId, db.periods]);

  // Pre-index slots by `${day}_${sessionId}_${classId}`
  const slotIndex = useMemo(() => {
    const map = new Map<string, typeof activeSlots[0]>();
    activeSlots.forEach((slot) => {
      const key = `${slot.day}_${slot.sessionId}_${slot.classId}`;
      map.set(key, slot);
    });
    return map;
  }, [activeSlots]);

  // Active sessions in matrix view: hide session rows that don't contain any active subject across the week
  const visibleSessions = useMemo(() => {
    return sortedSessions.filter((session) => {
      // Check if at least one day and at least one class has an active subject in this session
      return DAYS.some((day) =>
        sortedClasses.some((cls) => {
          const slot = slotIndex.get(`${day}_${session.id}_${cls.id}`);
          return Boolean(slot && slot.subjectId);
        })
      );
    });
  }, [sortedSessions, sortedClasses, slotIndex]);

  const activeSessions = useMemo(() => {
    return visibleSessions.length > 0 ? visibleSessions : sortedSessions;
  }, [visibleSessions, sortedSessions]);

  // Legend subjects
  const legendSubjects = useMemo(() => {
    return db.subjects.map((s) => ({
      id: s.id,
      label: s.name || s.code,
      color: s.color || '#4F46E5'
    }));
  }, [db.subjects]);

  // Legend teachers (for chip border indicators)
  const legendTeachers = useMemo(() => {
    return db.teachers.map((t) => ({
      id: t.id,
      label: t.panggilan || t.name,
      color: t.color || '#0284C7'
    }));
  }, [db.teachers]);

  return (
    <div className="space-y-4">
      {/* Subview Toggle and Stats */}
      <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setSubView('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subView === 'matrix'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Per Sesi</span>
            </button>
            <button
              type="button"
              onClick={() => setSubView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subView === 'table'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Per Kelas</span>
            </button>
          </div>

          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Menampilkan <strong className="text-slate-800">{sortedClasses.length} kelas</strong> &amp;{' '}
            <strong className="text-slate-800">
              {subView === 'matrix'
                ? `${visibleSessions.length} sesi aktif`
                : `${sortedSessions.length} sesi waktu`}
            </strong>
          </span>
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          Klik pada chip kelas untuk melihat rincian jadwal
        </div>
      </div>

      {/* Density notice if many classes */}
      {sortedClasses.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center text-xs text-amber-800">
          Belum ada data kelas yang terdaftar. Tambahkan kelas melalui menu Basis Data.
        </div>
      )}

      {/* VIEW 1: Matrix View (Rows = Sessions, Cols = Days) */}
      {subView === 'matrix' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-36 sm:w-44 px-3 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider border-r border-slate-200 sticky left-0 bg-slate-50 z-10 align-top">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Sesi Waktu</span>
                    </div>
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      className="px-2 py-2.5 text-xs font-bold text-slate-800 text-center border-r border-slate-200 last:border-r-0 min-w-[180px] align-top"
                    >
                      <div className="font-bold text-slate-800 mb-1.5">
                        {DAY_LABELS[day] || day}
                      </div>
                      {!isUltraDense && sortedClasses.length > 0 && (
                        <FixedBlockHeaderGrid classes={sortedClasses} />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleSessions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={DAYS.length + 1}
                      className="py-12 text-center text-xs text-slate-500"
                    >
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <AlertCircle className="w-5 h-5 text-slate-400" />
                        <span>Tidak ada sesi pelajaran aktif pada periode ini.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleSessions.map((session, sIdx) => (
                    <tr
                      key={session.id}
                      className={`hover:bg-slate-50/40 transition-colors ${
                        sIdx === visibleSessions.length - 1 ? 'border-b border-slate-200' : ''
                      }`}
                    >
                    {/* Session Header */}
                    <td className="px-3 py-3 bg-slate-50/80 border-r border-slate-200 text-xs sticky left-0 z-10">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{session.name}</span>
                        <span className="text-[10px] text-amber-700 font-mono font-bold">
                          #{session.order}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {session.startTime} – {session.endTime}
                      </div>
                    </td>

                    {/* Days: Fixed subgrid for all classes in this slot */}
                    {DAYS.map((day) => {
                      return (
                        <td
                          key={day}
                          className="p-1.5 align-middle border-r border-slate-200 last:border-r-0"
                        >
                          <FixedBlockSubGrid
                            count={sortedClasses.length}
                            interactive={true}
                            onBlockClick={(classIndex, block) => {
                              if (block.isFilled && block.slot) {
                                const cls = sortedClasses[classIndex];
                                const sub = block.slot.subjectId ? subjectMap.get(block.slot.subjectId) : undefined;
                                const tch = block.slot.teacherId ? teacherMap.get(block.slot.teacherId) : undefined;
                                const rm = block.slot.roomId ? roomMap.get(block.slot.roomId) : undefined;
                                if (onEntryClick) {
                                  onEntryClick({
                                    slot: block.slot,
                                    subject: sub,
                                    teacher: tch,
                                    room: rm,
                                    classEntity: cls,
                                    day,
                                    sessionName: session.name,
                                    sessionTime: `${session.startTime} - ${session.endTime}`
                                  });
                                } else if (onEditRule && block.ruleId) {
                                  const rule = ruleMap.get(block.ruleId);
                                  if (rule) onEditRule(rule);
                                }
                              }
                            }}
                            getStateFn={(classIndex) => {
                              const cls = sortedClasses[classIndex];
                              const key = `${day}_${session.id}_${cls.id}`;
                              const slot = slotIndex.get(key);

                              if (slot) {
                                const sub = slot.subjectId ? subjectMap.get(slot.subjectId) : undefined;
                                const tch = slot.teacherId ? teacherMap.get(slot.teacherId) : undefined;
                                const rm = slot.roomId ? roomMap.get(slot.roomId) : undefined;

                                return {
                                  id: `${slot.ruleId}_${cls.id}`,
                                  label: cls.name,
                                  isFilled: true,
                                  occupied: true,
                                  color: sub?.color || '#4F46E5',
                                  teacherColor: tch?.color || (tch ? '#0284C7' : undefined),
                                  tooltip: `${cls.name}: ${sub?.name || 'Pelajaran'} (${tch?.panggilan || tch?.name || 'Pengampu'}) - ${rm?.name || 'Ruang'}`,
                                  subjectName: sub?.name,
                                  subjectCode: sub?.code,
                                  teacherName: tch?.panggilan || tch?.name,
                                  roomName: rm?.name,
                                  hasException: slot.hasException,
                                  ruleId: slot.ruleId,
                                  slot
                                };
                              }

                              return {
                                id: `free_${session.id}_${cls.id}`,
                                label: cls.name,
                                isFilled: false,
                                occupied: false,
                                tooltip: `${cls.name}: Kosong (Tidak ada jadwal)`
                              };
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: Table View (Rows = Classes, Cols = Days & Sessions) */}
      {subView === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-48 px-3 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200 sticky left-0 bg-slate-50 z-10 align-middle">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-indigo-600" />
                        <span>Kelas</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-semibold px-1.5 py-0.5 rounded bg-slate-200/70 font-mono" title="Urutan Sesi Vertikal">
                        Sesi ↓
                      </span>
                    </div>
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      className="px-3 py-3 text-xs font-bold text-slate-800 text-center border-r border-slate-200 last:border-r-0 min-w-[150px]"
                    >
                      {DAY_LABELS[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedClasses.map((cls) => (
                  <tr key={cls.id} className="hover:bg-slate-50/40 transition-colors">
                    {/* Leftmost column: Class label + Vertical Session Legend */}
                    <td className="p-2 bg-slate-50/90 border-r border-slate-200 sticky left-0 z-10 align-top">
                      <div className="flex items-start justify-between gap-2">
                        {/* Class Info */}
                        <div className="flex items-start gap-1.5 min-w-[65px] pt-1">
                          <ClassIcon name={cls.icon} className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate" title={cls.name}>{cls.name}</div>
                            <div className="text-[10px] text-slate-500 font-medium whitespace-nowrap">Tingkat {cls.grade}</div>
                          </div>
                        </div>

                        {/* Vertical Session Legend for this class row */}
                        <div className="flex flex-col gap-1 shrink-0 pl-1.5 border-l border-slate-200">
                          {activeSessions.map((session) => (
                            <div
                              key={session.id}
                              title={`${session.name} (${session.startTime} - ${session.endTime})`}
                              className="h-[42px] w-7 rounded-md bg-white border border-slate-200 shadow-2xs flex flex-col items-center justify-center text-slate-700 font-mono text-[10px] font-bold cursor-help hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                            >
                              <span>{getSessionAbbr(session.name)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* Day Columns with session chips aligned to the vertical legend */}
                    {DAYS.map((day) => {
                      return (
                        <td key={day} className="p-2 border-r border-slate-200 last:border-r-0 align-top">
                          <div className="flex flex-col gap-1">
                            {activeSessions.map((session) => {
                              const key = `${day}_${session.id}_${cls.id}`;
                              const slot = slotIndex.get(key);
                              if (!slot || !slot.subjectId) {
                                return (
                                  <div
                                    key={session.id}
                                    className="h-[42px] rounded-lg border border-dashed border-slate-200/80 bg-slate-50/40 flex items-center justify-center text-slate-300 text-[11px] font-mono select-none"
                                    title={`Tidak ada jadwal (${session.name})`}
                                  >
                                    —
                                  </div>
                                );
                              }

                              const sub = slot.subjectId ? subjectMap.get(slot.subjectId) : undefined;
                              const tch = slot.teacherId ? teacherMap.get(slot.teacherId) : undefined;
                              const rm = slot.roomId ? roomMap.get(slot.roomId) : undefined;

                              return (
                                <button
                                  key={session.id}
                                  type="button"
                                  onClick={() => {
                                    if (onEntryClick) {
                                      onEntryClick({
                                        slot,
                                        subject: sub,
                                        teacher: tch,
                                        room: rm,
                                        classEntity: cls,
                                        day,
                                        sessionName: session.name,
                                        sessionTime: `${session.startTime} - ${session.endTime}`
                                      });
                                    } else if (onEditRule && slot.ruleId) {
                                      const rule = ruleMap.get(slot.ruleId);
                                      if (rule) onEditRule(rule);
                                    }
                                  }}
                                  className="h-[42px] w-full text-left px-2 py-1 rounded-lg border text-white shadow-2xs transition-all hover:scale-[1.01] hover:brightness-105 flex flex-col justify-center"
                                  style={{
                                    backgroundColor: sub?.color || '#4F46E5',
                                    borderColor: sub?.color || '#4F46E5'
                                  }}
                                  title={`${sub?.name || 'Pelajaran'} • ${tch?.name || 'Guru'} • ${rm?.name || 'Ruang'} • ${session.name} (${session.startTime} - ${session.endTime})`}
                                >
                                  {/* Line 1: Subject Name & Code */}
                                  <div className="flex items-center justify-between gap-1 text-[11px] font-bold leading-tight">
                                    <span className="truncate">{sub?.name || sub?.code || 'Pelajaran'}</span>
                                    {sub?.code && sub?.name && (
                                      <span className="bg-white/20 px-1 py-0.2 rounded text-[9px] font-medium shrink-0">
                                        {sub.code}
                                      </span>
                                    )}
                                  </div>
                                  {/* Line 2: Teacher & Room */}
                                  <div className="text-[10px] opacity-90 truncate leading-tight mt-0.5 flex items-center justify-between">
                                    <span className="truncate mr-1">{tch?.panggilan || tch?.name || 'Guru'}</span>
                                    <span className="shrink-0 text-[9px] opacity-80">{rm?.name || 'Ruang'}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Persistent Horizontal Legend Strip at the Bottom */}
      <div className="bg-white px-4 py-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Keterangan Matriks Semua Kelas
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
            {isUltraDense && (
              <span className="inline-flex items-center gap-1 text-indigo-700 font-semibold">
                <span className="w-1 h-3 rounded-xs bg-indigo-600 inline-block" />
                Strip = Kelas (20/baris)
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-700 inline-block" />
              Pelajaran
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs border-2 border-slate-700 bg-white inline-block" />
              Guru/Pengampu
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs border border-dashed border-slate-400 bg-white inline-block" />
              Kosong
            </span>
          </div>
        </div>

        {/* Legend Row: Classes (Moves to the bottom with the others when in Ultra Dense mode) */}
        {isUltraDense && sortedClasses.length > 0 && (
          <div className="border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                <span>Legenda Urutan Strip Kelas (Kolom 1 – {sortedClasses.length}, Kiri ke Kanan)</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono font-medium">
                {sortedClasses.length} kelas • 20 strip per baris
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
              {sortedClasses.map((cls, idx) => (
                <div
                  key={cls.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs shadow-2xs"
                  title={`${cls.name}${cls.grade ? ` (Tingkat ${cls.grade})` : ''}`}
                >
                  <span className="w-4 h-4 rounded-xs bg-indigo-100 text-indigo-700 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <ClassIcon name={cls.icon} className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="font-semibold text-slate-800 text-[11px] truncate">
                    {cls.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend Row 1: Subjects */}
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Warna Pelajaran (Latar Belakang Chip)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Free slot */}
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-white border border-dashed border-slate-300">
              <span className="w-2.5 h-2.5 rounded-xs border border-dashed border-slate-400 bg-white shrink-0" />
              <span className="text-slate-600 text-[11px] font-semibold">Kosong</span>
            </div>

            {legendSubjects.map((s) => (
              <div
                key={s.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-slate-50 border border-slate-200"
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0 shadow-2xs"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-slate-700 text-[11px] font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Legend Row 2: Teachers */}
        {legendTeachers.length > 0 && (
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Warna Guru / Pengampu (Garis Tepi / Border Chip)
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {legendTeachers.map((t) => (
                <div
                  key={t.id}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-slate-50 border border-slate-200"
                >
                  <span
                    className="w-3 h-3 rounded-xs border-2 bg-white shrink-0 shadow-2xs"
                    style={{ borderColor: t.color }}
                  />
                  <span className="text-slate-700 text-[11px] font-medium">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

