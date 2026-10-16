import React from 'react';
import {
  Clock,
  BookOpen,
  Users,
  DoorOpen,
  BookmarkCheck,
  Book,
  ArrowRight
} from 'lucide-react';
import { DatabaseState, ResolvedSlot, Period, DayOfWeek } from '../../types';
import { FixedBlockSubGrid, FixedBlockHeaderGrid } from '../schedule/FixedBlockSubGrid';
import {
  formatUnitDisplay,
  get_units_for_session,
  getUnitsForSubject
} from '../../utils/pacingEngine';

export interface KaldikDayMatrixProps {
  db: DatabaseState;
  selectedDayData: {
    dateStr: string;
    dayNumber: number;
    dayOfWeek: DayOfWeek;
    activePeriods: Period[];
    classSlots: ResolvedSlot[];
  };
  formattedSelectedDate: string;
  sortedClasses: DatabaseState['classes'];
  sortedSessions: DatabaseState['sessions'];
  sortedDaySlots: ResolvedSlot[];
  subjectMap: Map<string, DatabaseState['subjects'][number]>;
  teacherMap: Map<string, DatabaseState['teachers'][number]>;
  roomMap: Map<string, DatabaseState['rooms'][number]>;
  classMap: Map<string, DatabaseState['classes'][number]>;
  sessionMap: Map<string, DatabaseState['sessions'][number]>;
  bookMap: Map<string, any>;
  dayPacingMap: Map<string, any[]>;
  onNavigateToBooks?: (bookId?: string) => void;
  onNavigateToJournal?: (subjectId?: string, classId?: string, date?: string) => void;
  meetingsForDay?: any[];
  getEffectiveStatus?: (
    meetingId: string,
    serverStatus?: 'scheduled' | 'completed' | 'cancelled'
  ) => 'scheduled' | 'completed' | 'cancelled';
  isMeetingDrafted?: (meetingId: string) => boolean;
  onOpenAttendanceModal?: (slot: ResolvedSlot, meeting?: any) => void;
  onToggleSessionStatus?: (meetingId: string, currentStatus: string) => void;
}

export const KaldikDayMatrix: React.FC<KaldikDayMatrixProps> = ({
  db,
  selectedDayData,
  formattedSelectedDate,
  sortedClasses,
  sortedSessions,
  sortedDaySlots,
  subjectMap,
  teacherMap,
  roomMap,
  classMap,
  sessionMap,
  bookMap,
  dayPacingMap,
  onNavigateToBooks,
  onNavigateToJournal,
  meetingsForDay = [],
  getEffectiveStatus,
  isMeetingDrafted,
  onOpenAttendanceModal,
  onToggleSessionStatus
}) => {
  return (
    <div className="space-y-6">
      {/* 1. Matriks Sesi Waktu (Table for the Relevant Day) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Matriks Sesi Waktu ({selectedDayData.dayOfWeek})</span>
          </h4>
          <span className="text-[11px] text-slate-400 font-medium">
            {sortedClasses.length} kelas terdaftar • {selectedDayData.classSlots.length} sesi terisi
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                  <th className="w-36 sm:w-44 px-3.5 py-2.5 border-r border-slate-200 align-middle">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Sesi Waktu</span>
                    </div>
                  </th>
                  <th className="p-2 text-slate-800 align-top">
                    <div className="px-1.5 py-1 text-xs font-bold text-slate-800">
                      Matriks Kelas per Sesi ({formattedSelectedDate})
                    </div>
                    <FixedBlockHeaderGrid classes={sortedClasses} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {sortedSessions.map((session, sIdx) => {
                  return (
                    <tr
                      key={session.id}
                      className={`hover:bg-slate-50/40 transition-colors ${
                        sIdx === sortedSessions.length - 1 ? '' : ''
                      }`}
                    >
                      {/* Left Column: Sesi Waktu */}
                      <td className="px-3.5 py-3 bg-slate-50/70 border-r border-slate-200 align-top">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-800">{session.name}</span>
                          <span className="text-[10px] text-amber-700 font-mono font-bold">
                            #{session.order}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {session.startTime} – {session.endTime}
                        </div>
                      </td>

                      {/* Right Column: Matriks Kelas via FixedBlockSubGrid */}
                      <td className="p-2 align-middle">
                        <FixedBlockSubGrid
                          count={sortedClasses.length}
                          interactive={true}
                          onBlockClick={(_idx, block) => {
                            if (block.isFilled && block.slot) {
                              const meeting = meetingsForDay.find(
                                (m) => m.classId === block.slot.classId && m.sessionId === block.slot.sessionId
                              );
                              onOpenAttendanceModal?.(block.slot, meeting);
                            }
                          }}
                          getStateFn={(classIndex) => {
                            const cls = sortedClasses[classIndex];
                            const slot = selectedDayData.classSlots.find(
                              (s) => s.sessionId === session.id && s.classId === cls.id
                            );

                            if (slot) {
                              const sub = slot.subjectId ? subjectMap.get(slot.subjectId) : undefined;
                              const tch = slot.teacherId ? teacherMap.get(slot.teacherId) : undefined;
                              const rm = slot.roomId ? roomMap.get(slot.roomId) : undefined;

                              const meeting = meetingsForDay.find(
                                (m) => m.classId === cls.id && m.sessionId === session.id
                              );
                              const meetingId = meeting?.id || `mtg-${selectedDayData.dateStr}-${cls.id}-${session.id}`;
                              const effectiveStatus = getEffectiveStatus
                                ? getEffectiveStatus(meetingId, meeting?.status || 'scheduled')
                                : (meeting?.status || 'scheduled');
                              const isDraft = isMeetingDrafted ? isMeetingDrafted(meetingId) : false;

                              const statusDesc = effectiveStatus === 'completed'
                                ? 'Presensi Selesai'
                                : effectiveStatus === 'cancelled'
                                ? 'Sesi Dibatalkan'
                                : 'Belum Dicatat';

                              return {
                                id: `${slot.ruleId}_${cls.id}`,
                                label: cls.name,
                                isFilled: true,
                                occupied: true,
                                color: sub?.color || '#4F46E5',
                                teacherColor: tch?.color || (tch ? '#0284C7' : undefined),
                                tooltip: `${cls.name}: ${sub?.name || 'Pelajaran'} (${tch?.panggilan || tch?.name || 'Pengampu'}) - ${rm?.name || 'Ruang'} • [${statusDesc}]${isDraft ? ' (Draft)' : ''} (Klik untuk presensi)`,
                                subjectName: sub?.name,
                                subjectCode: sub?.code,
                                teacherName: tch?.panggilan || tch?.name,
                                roomName: rm?.name,
                                hasException: slot.hasException,
                                ruleId: slot.ruleId,
                                slot,
                                attendanceStatus: effectiveStatus,
                                isDraft
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. Jadwal Pelajaran Kelas Aktif */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-amber-600" />
            <span>Jadwal Pelajaran Kelas Aktif ({sortedDaySlots.length} Sesi Aktif)</span>
          </h4>
          <span className="text-[11px] text-slate-400 font-medium">
            Rincian daftar pelajaran hari {selectedDayData.dayOfWeek}
          </span>
        </div>

        {sortedDaySlots.length === 0 ? (
          <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
            <p className="text-xs text-slate-500 font-medium">
              {selectedDayData.activePeriods.length === 0
                ? `Tanggal ini berada di luar rentang periode KBM aktif, sehingga tidak ada sesi kelas terjadwal.`
                : `Tidak ada sesi pelajaran kelas yang dijadwalkan pada hari ini.`}
            </p>
          </div>
        ) : (
          <div className="bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200/70">
            {sortedDaySlots.map((slot, idx) => {
              const subject = subjectMap.get(slot.subjectId);
              const cls = classMap.get(slot.classId);
              const teacher = teacherMap.get(slot.teacherId);
              const room = roomMap.get(slot.roomId);
              const session = sessionMap.get(slot.sessionId);

              const projection = dayPacingMap.get(`${slot.subjectId}_${slot.classId}`) || [];
              const matchedSession = projection.find(
                (p) =>
                  p.session.date === selectedDayData.dateStr &&
                  (p.session.sessionId === slot.sessionId || p.session.ruleId === slot.ruleId)
              );
              const scheduledUnits = matchedSession
                ? matchedSession.units
                : get_units_for_session(db, slot.subjectId, slot.classId, `${selectedDayData.dateStr}_${slot.sessionId}_${slot.ruleId}`);
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
                  className="p-3 bg-white hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    {/* Time & Session */}
                    <div className="w-20 shrink-0">
                      <span className="text-[10px] font-bold text-amber-800 block">
                        {session?.name || `Sesi ${idx + 1}`}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {session?.startTime} - {session?.endTime}
                      </span>
                    </div>

                    {/* Content: Meta on line 1, Simplified 1-line syllabus on line 2 */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: subject?.color || '#F59E0B' }}
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

                      {/* 1-line syllabus */}
                      <div className="flex items-center gap-1.5 text-[11px] min-w-0 flex-wrap">
                        <BookmarkCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        {scheduledUnits.length > 0 ? (
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            {/* Book & Vol/Ch Badges */}
                            {(() => {
                              const bId = firstUnit?.bookId || subject?.default_book || subject?.defaultBookId || subject?.primary_book_code;
                              const book = bId ? bookMap.get(bId) : null;
                              if (!book) return null;
                              const chapters = book.chapters || [];
                              const matchedChapter = chapters.find(
                                (ch) => (firstUnit?.chapterBookId && ch.id === firstUnit.chapterBookId) ||
                                        (firstUnit?.part && ch.chapterNumber === firstUnit.part)
                              );
                              let volChText = '';
                              if (matchedChapter) {
                                const chPages = matchedChapter.pageEnd || 0;
                                const chTitle = matchedChapter.title || `Jilid ${matchedChapter.chapterNumber}`;
                                volChText = chPages > 0 ? `${chTitle}: ${chPages} hal` : chTitle;
                              } else {
                                const totalJilid = chapters.length > 0 ? chapters.length : (book.totalChapters || 0);
                                const cumulativePages = chapters.length > 0
                                  ? chapters.reduce((sum, ch) => sum + (Number(ch.pageEnd) || 0), 0)
                                  : (book.totalPages || 0);
                                volChText = totalJilid > 0
                                  ? `${totalJilid} Jilid: ${cumulativePages.toLocaleString('id-ID')} hal`
                                  : `${cumulativePages.toLocaleString('id-ID')} hal`;
                              }

                              return (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNavigateToBooks?.(book.id);
                                    }}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer shrink-0 shadow-2xs"
                                    title={`Kitab: ${book.title}${book.altTitle ? ` (${book.altTitle})` : ''} • Klik untuk melihat info kitab`}
                                  >
                                    <Book className="w-3 h-3 text-indigo-600 shrink-0" />
                                    <span className="truncate max-w-[120px] sm:max-w-[150px]">
                                      {book.displayCode || book.altTitle || book.title}
                                    </span>
                                  </button>
                                  {volChText && (
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0 shadow-2xs"
                                      title="Volume/Bab & Jumlah Halaman"
                                    >
                                      {volChText}
                                    </span>
                                  )}
                                </>
                              );
                            })()}

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
                              className={`px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-950 border border-amber-200/80 truncate max-w-[200px] sm:max-w-[260px] ${
                                onNavigateToJournal ? 'cursor-pointer hover:bg-amber-100 hover:border-amber-300' : ''
                              }`}
                              title={`${formatUnitDisplay(firstUnit)}${onNavigateToJournal ? ' (Klik untuk buka Jurnal)' : ''}`}
                              onClick={() => {
                                if (onNavigateToJournal) {
                                  onNavigateToJournal(slot.subjectId, slot.classId, selectedDayData.dateStr);
                                }
                              }}
                            >
                              {formatUnitDisplay(firstUnit)}
                            </span>
                            {scheduledUnits.length > 1 && (
                              <>
                                <span className="text-slate-400 shrink-0 font-bold">-</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-950 border border-amber-200/80 truncate max-w-[200px] sm:max-w-[260px] ${
                                    onNavigateToJournal ? 'cursor-pointer hover:bg-amber-100 hover:border-amber-300' : ''
                                  }`}
                                  title={`${formatUnitDisplay(lastUnit)}${onNavigateToJournal ? ' (Klik untuk buka Jurnal)' : ''}`}
                                  onClick={() => {
                                    if (onNavigateToJournal) {
                                      onNavigateToJournal(slot.subjectId, slot.classId, selectedDayData.dateStr);
                                    }
                                  }}
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

                  {/* Badges & Attendance Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                    {slot.hasException && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        Pengecualian Periode
                      </span>
                    )}

                    {(() => {
                      const meeting = meetingsForDay.find(
                        (m) => m.classId === slot.classId && m.sessionId === slot.sessionId
                      );
                      const meetingId = meeting?.id || `mtg-${selectedDayData.dateStr}-${slot.classId}-${slot.sessionId}`;
                      const effectiveStatus = getEffectiveStatus
                        ? getEffectiveStatus(meetingId, meeting?.status || 'scheduled')
                        : (meeting?.status || 'scheduled');
                      const isDraft = isMeetingDrafted ? isMeetingDrafted(meetingId) : false;

                      return (
                        <div className="flex items-center gap-1.5">
                          {effectiveStatus === 'completed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                              ✓ Selesai{isDraft ? ' (Draft)' : ''}
                            </span>
                          ) : effectiveStatus === 'cancelled' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 line-through">
                              Dibatalkan{isDraft ? ' (Draft)' : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              Belum Absen{isDraft ? ' (Draft)' : ''}
                            </span>
                          )}

                          {onOpenAttendanceModal && (
                            <button
                              type="button"
                              onClick={() => onOpenAttendanceModal(slot, meeting)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
                              title="Buka absensi santri"
                            >
                              {effectiveStatus === 'completed' ? 'Presensi' : 'Isi Absen'}
                            </button>
                          )}

                          {onToggleSessionStatus && (
                            <button
                              type="button"
                              onClick={() => onToggleSessionStatus(meetingId, effectiveStatus)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer ${
                                effectiveStatus === 'cancelled'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
                              }`}
                              title={effectiveStatus === 'cancelled' ? 'Aktifkan kembali sesi ini' : 'Batalkan sesi pada tanggal ini'}
                            >
                              {effectiveStatus === 'cancelled' ? 'Pulihkan' : 'Batal'}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
