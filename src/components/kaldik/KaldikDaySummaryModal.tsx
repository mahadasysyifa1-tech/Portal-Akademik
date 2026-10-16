import React from 'react';
import {
  X,
  Calendar,
  Clock,
  BookOpen,
  Users,
  DoorOpen,
  GraduationCap,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  BookmarkCheck,
  ArrowRight
} from 'lucide-react';
import {
  DatabaseState,
  KaldikEvent,
  ResolvedSlot,
  DayOfWeek,
  Subject,
  ClassEntity,
  Teacher,
  Room,
  Session
} from '../../types';
import { computePacingProjection, formatUnitDisplay, get_units_for_session, getUnitsForSubject } from '../../utils/pacingEngine';

interface KaldikDaySummaryModalProps {
  isOpen: boolean;
  dateStr: string; // 'YYYY-MM-DD'
  events: KaldikEvent[];
  slots: ResolvedSlot[];
  db: DatabaseState;
  onClose: () => void;
  onAddEvent: (dateStr: string) => void;
  onEditEvent: (event: KaldikEvent) => void;
  onDeleteEvent: (id: string) => void;
}

const INDONESIAN_DAYS = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const KaldikDaySummaryModal: React.FC<KaldikDaySummaryModalProps> = ({
  isOpen,
  dateStr,
  events,
  slots,
  db,
  onClose,
  onAddEvent,
  onEditEvent,
  onDeleteEvent
}) => {
  if (!isOpen || !dateStr) return null;

  const dateObj = new Date(dateStr + 'T00:00:00');
  const dayName = INDONESIAN_DAYS[dateObj.getDay()];
  const dayNum = dateObj.getDate();
  const monthName = INDONESIAN_MONTHS[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  const formattedDate = `${dayName}, ${dayNum} ${monthName} ${year}`;

  // Find if date falls into any academic period
  const activePeriods = db.periods.filter(
    (p) => dateStr >= p.startDate && dateStr <= p.endDate
  );

  // Maps for fast lookup
  const subjectMap = new Map<string, Subject>(db.subjects.map((s) => [s.id, s]));
  const classMap = new Map<string, ClassEntity>(db.classes.map((c) => [c.id, c]));
  const teacherMap = new Map<string, Teacher>(db.teachers.map((t) => [t.id, t]));
  const roomMap = new Map<string, Room>(db.rooms.map((r) => [r.id, r]));
  const sessionMap = new Map<string, Session>(db.sessions.map((s) => [s.id, s]));

  // Sort slots by session order
  const sortedSlots = [...slots].sort((a, b) => {
    const sesA = sessionMap.get(a.sessionId)?.order ?? 999;
    const sesB = sessionMap.get(b.sessionId)?.order ?? 999;
    return sesA - sesB;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex flex-col items-center justify-center text-indigo-700">
              <span className="text-[10px] font-bold uppercase">{dayName.slice(0, 3)}</span>
              <span className="text-base font-black leading-none">{dayNum}</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Ringkasan Tanggal: {formattedDate}</span>
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                {activePeriods.length > 0 ? (
                  activePeriods.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>{p.name}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400">Di luar periode KBM resmi</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAddEvent(dateStr)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Event</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Events & Agenda */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-indigo-600" />
                <span>Agenda &amp; Event Kaldik ({events.length})</span>
              </h4>
            </div>

            {events.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                <p className="text-xs text-slate-500 font-medium">
                  Tidak ada agenda atau event khusus pada tanggal ini.
                </p>
                <button
                  type="button"
                  onClick={() => onAddEvent(dateStr)}
                  className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                >
                  + Tambahkan Event Baru
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((evt) => {
                  const isKbmMissingPeriod = Boolean(
                    evt.isKbm && (!evt.periodId || !db.periods.some((p) => p.id === evt.periodId))
                  );

                  return (
                    <div
                      key={evt.id}
                      className={`p-3 rounded-xl border bg-white shadow-2xs flex items-start justify-between gap-3 transition-colors hover:border-slate-300 ${
                        isKbmMissingPeriod ? 'border-dashed border-amber-400 bg-amber-50/40' : ''
                      }`}
                      style={{ borderLeftWidth: '4px', borderLeftColor: evt.color || '#6366F1' }}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">{evt.title}</span>
                          {evt.isKbm && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                              KBM Resmi
                            </span>
                          )}
                          {isKbmMissingPeriod && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-dashed border-amber-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-700" />
                              Periode Rujukan Hilang
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 capitalize">
                            {evt.type}
                          </span>
                        </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{evt.isAllDay ? 'Sepanjang Hari' : `${evt.startTime} - ${evt.endTime}`}</span>
                        </span>
                        {evt.isRecurring && (
                          <span className="text-indigo-600 font-medium">
                            • Berulang ({evt.repeatDetail || 'Weekly'})
                          </span>
                        )}
                      </div>

                      {evt.description && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg mt-1 border border-slate-100">
                          {evt.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onEditEvent(evt)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Edit Event"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteEvent(evt.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>

          {/* Section 2: Scheduled Class Sessions on this Day */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>Jadwal Pelajaran Kelas ({sortedSlots.length} Sesi Aktif)</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                Sesuai aturan jadwal mingguan hari {dayName}
              </span>
            </div>

            {sortedSlots.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                <p className="text-xs text-slate-500 font-medium">
                  {activePeriods.length === 0
                    ? `Tanggal ini berada di luar rentang periode KBM aktif, sehingga tidak ada sesi kelas terjadwal.`
                    : `Tidak ada sesi pelajaran kelas yang dijadwalkan pada hari ${dayName}.`}
                </p>
              </div>
            ) : (
              <div className="bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200/70">
                {sortedSlots.map((slot, idx) => {
                  const subject = subjectMap.get(slot.subjectId);
                  const cls = classMap.get(slot.classId);
                  const teacher = teacherMap.get(slot.teacherId);
                  const room = roomMap.get(slot.roomId);
                  const session = sessionMap.get(slot.sessionId);

                  const projection = computePacingProjection(db, slot.subjectId, slot.classId);
                  const matchedSession = projection.find(
                    (p) =>
                      p.session.date === dateStr &&
                      (p.session.sessionId === slot.sessionId || p.session.ruleId === slot.ruleId)
                  );
                  const scheduledUnits = matchedSession
                    ? matchedSession.units
                    : get_units_for_session(db, slot.subjectId, slot.classId, `${dateStr}_${slot.sessionId}_${slot.ruleId}`);
                  const meetingIndex = matchedSession?.session.meetingIndex;
                  const hasSyllabusForSubject = getUnitsForSubject(db, slot.subjectId).length > 0;

                  // First material & last material calculation
                  const firstUnit = scheduledUnits[0];
                  const lastUnit = scheduledUnits[scheduledUnits.length - 1];

                  const firstPage = firstUnit?.page_start ?? firstUnit?.page_end;
                  const lastPage = lastUnit?.page_end ?? lastUnit?.page_start;

                  const pageRangeLabel =
                    firstPage !== undefined && lastPage !== undefined
                      ? firstPage !== lastPage
                        ? `hal. ${firstPage}-${lastPage}:`
                        : `hal. ${firstPage}:`
                      : firstPage !== undefined
                      ? `hal. ${firstPage}:`
                      : lastPage !== undefined
                      ? `hal. ${lastPage}:`
                      : '';

                  return (
                    <div
                      key={`${slot.ruleId}-${slot.sessionId}-${idx}`}
                      className="p-3 bg-white hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        <div className="w-16 shrink-0">
                          <span className="text-[10px] font-bold text-indigo-700 block">
                            {session?.name || `Sesi ${idx + 1}`}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {session?.startTime} - {session?.endTime}
                          </span>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: subject?.color || '#3B82F6' }}
                            />
                            <span className="font-bold text-slate-900 truncate">
                              {subject?.name || 'Mata Pelajaran'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {cls?.name || 'Kelas'}
                            </span>
                            {meetingIndex !== undefined && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 shrink-0">
                                Pertemuan #{meetingIndex}
                              </span>
                            )}
                            <span className="text-slate-300 hidden sm:inline">•</span>
                            <span className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                              <Users className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{teacher?.panggilan || teacher?.name || 'Guru'}</span>
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                              <DoorOpen className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{room?.name || 'Ruang'}</span>
                            </span>
                          </div>

                          {/* 1-line syllabus: bookmarkcheck icon | {hal. ${first page of first material}-${last page of last material}:} | badge: first material | dash | badge: last material */}
                          <div className="flex items-center gap-1.5 text-[11px] min-w-0 flex-wrap">
                            <BookmarkCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            {scheduledUnits.length > 0 ? (
                              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                {pageRangeLabel && (
                                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-amber-900 shrink-0">
                                    {firstUnit?.isPartialStart && (
                                      <ArrowRight
                                        className="w-3 h-3 text-amber-600 shrink-0"
                                        title={`Lanjutan dari sesi sebelumnya (mulai hal. ${firstUnit.page_start} dari ${firstUnit.raw_page_start}–${firstUnit.raw_page_end})`}
                                      />
                                    )}
                                    <span>{pageRangeLabel}</span>
                                    {lastUnit?.isPartialEnd && (
                                      <ArrowRight
                                        className="w-3 h-3 text-amber-600 shrink-0"
                                        title={`Bersambung ke sesi berikutnya (sampai hal. ${lastUnit?.page_end} dari ${lastUnit?.raw_page_start}–${lastUnit?.raw_page_end})`}
                                      />
                                    )}
                                  </span>
                                )}
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-950 border border-amber-200/80 truncate max-w-[200px] sm:max-w-[260px]"
                                  title={formatUnitDisplay(firstUnit)}
                                >
                                  {formatUnitDisplay(firstUnit)}
                                </span>
                                {scheduledUnits.length > 1 && (
                                  <>
                                    <span className="text-slate-400 shrink-0 font-bold">-</span>
                                    <span
                                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-950 border border-amber-200/80 truncate max-w-[200px] sm:max-w-[260px]"
                                      title={formatUnitDisplay(lastUnit)}
                                    >
                                      {formatUnitDisplay(lastUnit)}
                                    </span>
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px] truncate">
                                {hasSyllabusForSubject
                                  ? 'Sesi Praktikum / Pembahasan Mandiri'
                                  : 'Belum ada data silabus'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {slot.hasException && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0 self-start sm:self-center">
                          Pengecualian Periode
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
