import React, { useMemo } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  CalendarDays,
  Clock,
  MapPin,
  User,
  Book,
  ArrowRight,
  FileText,
  Ban,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  Check
} from 'lucide-react';
import type {
  Subject,
  ClassEntity,
  Teacher,
  Room,
  SyllabusScope,
  ScheduledSessionOccurrence
} from '../../types';
import { formatUnitDisplay } from '../../utils/pacingEngine';

export interface SyllabusTimelineProps {
  currentSubject?: Subject;
  currentClass?: ClassEntity;
  applicableClasses: ClassEntity[];
  pacingData: {
    projection: Array<{
      session: ScheduledSessionOccurrence;
      units: any[];
      isCheckpoint?: boolean;
      isAdjusted?: boolean;
    }>;
    scopedUnits: any[];
    totalPages: number;
    pagesPerSession: string;
  } | null;
  existingScope: SyllabusScope | null;
  isAdmin: boolean;
  onNavigateToSyllabusScope?: (subjectId?: string, classId?: string) => void;
  onNavigateToRuleManager?: () => void;
  onNavigateToBooks?: (bookId?: string) => void;
  onOpenAdminLogin: () => void;
  onBackToClasses: () => void;
  onBackToSubjects: () => void;
  todayStr: string;
  activeHighlightDate: string | null;
  currentSessionItem: any;
  teacherMap: Map<string, Teacher>;
  roomMap: Map<string, Room>;
  bookMap: Map<string, any>;
  todayRowRef: React.MutableRefObject<HTMLDivElement | null>;
  currentSessionRef: React.MutableRefObject<HTMLDivElement | null>;
  displayNumber: (slotIdx: number) => number;
}

export const SyllabusTimeline: React.FC<SyllabusTimelineProps> = ({
  currentSubject,
  currentClass,
  applicableClasses,
  pacingData,
  existingScope,
  isAdmin,
  onNavigateToSyllabusScope,
  onNavigateToRuleManager,
  onNavigateToBooks,
  onOpenAdminLogin,
  onBackToClasses,
  onBackToSubjects,
  todayStr,
  activeHighlightDate,
  currentSessionItem,
  teacherMap,
  roomMap,
  bookMap,
  todayRowRef,
  currentSessionRef,
  displayNumber,
}) => {
  const activeCount = pacingData?.projection.filter((p) => !p.session.isCancelled).length || 0;
  const cancelledCount = pacingData?.projection.filter((p) => p.session.isCancelled).length || 0;

  // Calculate Pacing Progress (Behind vs Ahead vs On Track) based on page difference
  const pacingStatus = useMemo(() => {
    if (!pacingData?.projection || pacingData.projection.length === 0) return null;

    // Find latest meeting that has actual progress recorded
    const recordedSessions = pacingData.projection.filter(
      (p) => !p.session.isCancelled && typeof p.session.actual_page === 'number' && p.session.actual_page > 0
    );
    if (recordedSessions.length === 0) return null;

    const latest = recordedSessions[recordedSessions.length - 1];
    const actualPage = latest.session.actual_page!;
    const actualMateriId = latest.session.actual_materi_id;
    const scopedUnits = pacingData.scopedUnits || [];

    // Helper to calculate cumulative pages across scoped units (handles cut materials, multiple books, and page offsets)
    const getCumulativePage = (unitId: string | undefined, pageNum: number): number => {
      if (scopedUnits.length === 0) return pageNum;

      let uIdx = unitId ? scopedUnits.findIndex((u) => u.id === unitId) : -1;
      if (uIdx === -1) {
        uIdx = scopedUnits.findIndex((u) => {
          const s = typeof u.page_start === 'number' ? u.page_start : parseInt(String(u.page_start), 10);
          const e = typeof u.page_end === 'number' ? u.page_end : parseInt(String(u.page_end), 10);
          return !isNaN(s) && !isNaN(e) && pageNum >= Math.min(s, e) && pageNum <= Math.max(s, e);
        });
      }
      if (uIdx === -1) uIdx = 0;

      let cum = 0;
      for (let i = 0; i < uIdx; i++) {
        const s = typeof scopedUnits[i].page_start === 'number' ? scopedUnits[i].page_start : parseInt(String(scopedUnits[i].page_start), 10);
        const e = typeof scopedUnits[i].page_end === 'number' ? scopedUnits[i].page_end : parseInt(String(scopedUnits[i].page_end), 10);
        const span = !isNaN(s) && !isNaN(e) && e >= s ? e - s + 1 : 1;
        cum += span;
      }

      const currentUnit = scopedUnits[uIdx];
      const uStart = typeof currentUnit?.page_start === 'number' ? currentUnit.page_start : parseInt(String(currentUnit?.page_start || 1), 10);
      cum += Math.max(0, pageNum - uStart + 1);
      return cum;
    };

    const targetUnit = latest.units[latest.units.length - 1] || scopedUnits[0];
    const targetPage = targetUnit?.page_end ?? targetUnit?.page_start ?? 0;
    const targetUnitId = targetUnit?.id;

    const actualCum = getCumulativePage(actualMateriId, actualPage);
    const targetCum = getCumulativePage(targetUnitId, targetPage);
    const diff = actualCum - targetCum;

    return {
      meetingIndex: latest.session.meetingIndex,
      diff,
      actualPage,
      targetPage
    };
  }, [pacingData]);

  const latestMeetingWithNotes = pacingData?.projection
    ?.slice()
    ?.reverse()
    ?.find((p) => p.session.meetingNotes && p.session.meetingNotes.trim().length > 0);
  const latestNotes = latestMeetingWithNotes?.session.meetingNotes || existingScope?.notes;

  return (
    <div className="space-y-4">
      {/* Breadcrumb & Header Card */}
      <div className="sticky top-30 z-20 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5 mb-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (applicableClasses.length > 1) {
                  onBackToClasses();
                } else {
                  onBackToSubjects();
                }
              }}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span
                onClick={onBackToSubjects}
                className="hover:underline cursor-pointer"
              >
                Pelajaran
              </span>
              <span>/</span>
              <span
                onClick={() => {
                  if (applicableClasses.length > 1) {
                    onBackToClasses();
                  } else {
                    onBackToSubjects();
                  }
                }}
                className="text-slate-900 font-bold hover:underline cursor-pointer"
                title={applicableClasses.length > 1 ? 'Kembali ke pilihan kelas' : undefined}
              >
                {currentSubject?.name}
              </span>
              <span>/</span>
              <span className="text-amber-700 font-bold">{currentClass?.name}</span>
            </div>
          </div>

          {/* Action Button: Kalibrasi Laju (Retained for admin, deprecated all other action buttons) */}
          {isAdmin && onNavigateToSyllabusScope && (
            <button
              type="button"
              onClick={() =>
                onNavigateToSyllabusScope(
                  currentSubject?.id || undefined,
                  currentClass?.id || undefined
                )
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-all cursor-pointer shadow-2xs"
              title="Buka pengaturan silabus dan kalibrasi laju materi di Syllabus Scope Modal"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {existingScope?.adjustment
                  ? `Kalibrasi Laju (Sesi #${existingScope.adjustment.checkpointSessionIndex})`
                  : 'Kalibrasi Laju Silabus'}
              </span>
            </button>
          )}
        </div>

        {/* Meta details & Pacing Status */}
        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 text-xs text-slate-500 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <span className="text-slate-400">Total:</span>
              <span className="font-semibold text-slate-700">
                {pacingData?.projection.length || 0} Pertemuan
                <span className="text-slate-500 font-normal ml-1">
                  ({activeCount} Aktif, <span className="text-rose-600 font-medium">{cancelledCount} Dibatalkan</span>)
                </span>
              </span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <span className="text-slate-400">Cakupan:</span>
              <span className="font-semibold text-amber-700">
                {pacingData?.scopedUnits.length || 0} Bab
              </span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <span className="text-slate-400">Total:</span>
              <span className="font-semibold text-slate-700">
                {pacingData?.totalPages || 0} Hal
              </span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-2">
              <span className="text-slate-400">Target Rata-Rata:</span>
              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                ±{pacingData?.pagesPerSession || 0} Hal / Sesi Aktif
              </span>
            </span>
          </div>

          {/* Pacing status indicator */}
          {pacingStatus ? (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Laju Kurikulum:</span>
              {pacingStatus.diff > 0 ? (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300"
                  title={`Tercatat hal. ${pacingStatus.actualPage} vs target hal. ${pacingStatus.targetPage} pada Sesi #${displayNumber(pacingStatus.meetingIndex)}`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+{pacingStatus.diff} Hal (Lebih Cepat)</span>
                  <span className="text-emerald-700/70 font-normal text-[11px] ml-0.5">
                    • Sesi #{displayNumber(pacingStatus.meetingIndex)}
                  </span>
                </span>
              ) : pacingStatus.diff < 0 ? (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-800 border border-rose-300"
                  title={`Tercatat hal. ${pacingStatus.actualPage} vs target hal. ${pacingStatus.targetPage} pada Sesi #${displayNumber(pacingStatus.meetingIndex)}`}
                >
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                  <span>{pacingStatus.diff} Hal (Tertinggal)</span>
                  <span className="text-rose-700/70 font-normal text-[11px] ml-0.5">
                    • Sesi #{displayNumber(pacingStatus.meetingIndex)}
                  </span>
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 text-slate-800 border border-slate-300"
                  title={`Tercatat tepat pada target hal. ${pacingStatus.targetPage} pada Sesi #${displayNumber(pacingStatus.meetingIndex)}`}
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tepat Target (Sesuai Rencana)</span>
                  <span className="text-slate-500 font-normal text-[11px] ml-0.5">
                    • Sesi #{displayNumber(pacingStatus.meetingIndex)}
                  </span>
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400 italic text-xs">
              <span>Laju Kurikulum: Belum ada progres sesi tercatat</span>
            </div>
          )}
        </div>

        {/* Latest Journal Notes Display */}
        {latestNotes && (
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-start gap-2 text-xs">
            <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="font-bold text-slate-700">Catatan Jurnal KBM Terakhir: </span>
              <span className="text-slate-600 italic">{latestNotes}</span>
              {latestMeetingWithNotes && (
                <span className="text-slate-400 ml-1.5 font-normal">
                  ({latestMeetingWithNotes.session.date} • #{latestMeetingWithNotes.session.meetingIndex})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SESSIONS TIMELINE LIST */}
      {!pacingData || pacingData.projection.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">Tidak Ada Sesi Terjadwal</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Tidak ditemukan jadwal aktif untuk mata pelajaran ini pada kelas {currentClass?.name} dalam rentang periode kalender akademik.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pacingData.projection.map((item) => {
            const { session, units, isCheckpoint, isAdjusted } = item;
            const teacher = teacherMap.get(session.teacherId);
            const room = roomMap.get(session.roomId);

            const isCancelled = session.isCancelled || session.status === 'cancelled';
            const isPast = session.date < todayStr;
            const isToday = session.date === todayStr;
            const isFuture = session.date > todayStr;
            const isTargetHighlighted = activeHighlightDate === session.date;
            const isCurrent = currentSessionItem?.session.id === session.id;

            const recordedUnit = !isCancelled && (units.length === 0 || (session.actual_page && session.actual_page > 0))
              ? (session.actual_materi_id
                  ? pacingData.scopedUnits?.find((u) => u.id === session.actual_materi_id)
                  : session.actual_page
                  ? pacingData.scopedUnits?.find((u) => {
                      const s = Number(u.page_start);
                      const e = Number(u.page_end);
                      return !isNaN(s) && !isNaN(e) && session.actual_page! >= Math.min(s, e) && session.actual_page! <= Math.max(s, e);
                    })
                  : null)
              : null;

            const displayUnits = units.length > 0 ? units : (recordedUnit ? [recordedUnit] : []);

            return (
              <div
                key={session.id}
                ref={(el) => {
                  if (isCurrent) currentSessionRef.current = el;
                  if (isToday || isTargetHighlighted) todayRowRef.current = el;
                }}
                className={`rounded-2xl border transition-all p-4 relative overflow-hidden ${
                  isCancelled
                    ? 'bg-rose-50/40 border-rose-200/80'
                    : isToday
                    ? 'bg-amber-50 border-amber-300 shadow-md ring-2 ring-amber-400'
                    : isTargetHighlighted
                    ? 'bg-indigo-50 border-indigo-300 shadow-md ring-2 ring-indigo-400'
                    : isPast
                    ? 'bg-slate-50/70 border-slate-200 opacity-90'
                    : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  {/* Left: Session timing, meeting badge, room */}
                  <div className="flex items-start gap-3 min-w-0 md:w-5/12">
                    {/* Number badge */}
                    {isCancelled ? (
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 bg-rose-100 text-rose-600 border border-rose-200"
                        title="Sesi Dibatalkan"
                      >
                        <Ban className="w-4 h-4 text-rose-500" />
                      </div>
                    ) : (
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                          isToday
                            ? 'bg-amber-500 text-white shadow-xs'
                            : isPast
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        #{displayNumber(session.meetingIndex)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">
                          {session.day}, {session.date}
                        </span>
                        {isCancelled ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <Ban className="w-2.5 h-2.5" />
                            Sesi Dibatalkan
                          </span>
                        ) : (
                          <>
                            {isToday && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white uppercase tracking-wider animate-pulse">
                                HARI INI
                              </span>
                            )}
                            {isPast && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                                Selesai
                              </span>
                            )}
                            {isFuture && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Akan Datang
                              </span>
                            )}
                            {session.actual_page && session.actual_page > 0 && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1"
                                title={`Materi aktual tercatat sampai halaman ${session.actual_page}`}
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                Tercatat s/d hal. {session.actual_page}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {session.startTime} - {session.endTime} ({session.sessionName})
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {room?.name || session.roomId}
                        </span>
                        {teacher && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {teacher.panggilan || teacher.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Units rendered per specification */}
                  <div className="md:w-7/12 pt-2 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                      <span>
                        {isCancelled
                          ? 'Status Pertemuan:'
                          : session.actual_page && session.actual_page > 0
                          ? 'Materi Terlaksana:'
                          : 'Materi Target:'}
                      </span>
                      {isAdjusted && !isCancelled && (
                        <SlidersHorizontal
                          className="w-3 h-3 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                          title="Laju materi sesi ini telah disesuaikan dari kalibrasi"
                        />
                      )}
                    </span>

                    {isCancelled ? (
                      <div className="space-y-2">
                        <div className="text-xs text-rose-600 italic flex items-center gap-1.5 bg-rose-50/80 p-2.5 rounded-xl border border-rose-200/60 font-medium">
                          <Ban className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>Sesi Dibatalkan — Tidak dialokasikan materi silabus</span>
                        </div>
                        {session.meetingNotes && (
                          <div className="text-xs text-slate-600 bg-white/80 p-2 rounded-xl border border-rose-200/50">
                            <span className="font-semibold text-slate-700">Keterangan: </span>
                            <span>{session.meetingNotes}</span>
                          </div>
                        )}
                      </div>
                    ) : displayUnits.length === 0 ? (
                      <div className="text-xs text-slate-400 italic">
                        (Distribusi / Pembahasan Mandiri &amp; Evaluasi)
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {displayUnits.map((unit) => {
                          const bId =
                            unit.bookId ||
                            currentSubject?.default_book ||
                            currentSubject?.defaultBookId ||
                            currentSubject?.primary_book_code;
                          const book = bId
                            ? bookMap.get(bId) ||
                              Array.from(bookMap.values()).find(
                                (b: any) =>
                                  b.id === bId || b.displayCode === bId || b.title === bId
                              )
                            : null;

                          return (
                            <div
                              key={unit.id}
                              className={`text-xs px-3 py-2 rounded-xl flex items-start justify-between gap-2 border ${
                                isToday
                                  ? 'bg-amber-100/60 border-amber-200/80 text-amber-950 font-bold'
                                  : 'bg-slate-50 border-slate-200/70 text-slate-800 font-medium'
                              }`}
                            >
                              {/* Left: (bullet) (book) (material) */}
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                                {book && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNavigateToBooks?.(book.id);
                                    }}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer shrink-0"
                                    title={`Kitab: ${book.title}${book.altTitle ? ` (${book.altTitle})` : ''} • Klik untuk melihat info kitab`}
                                  >
                                    <Book className="w-3 h-3 text-indigo-600 shrink-0" />
                                    <span className="truncate max-w-[120px] sm:max-w-[160px]">
                                      {book.altTitle || book.title || book.displayCode}
                                    </span>
                                  </button>
                                )}
                                <span className="leading-snug break-words">
                                  {formatUnitDisplay(unit)}
                                </span>
                              </div>

                              {/* Right: page numbers */}
                              <div className="flex items-center gap-1 shrink-0">
                                {unit.isPartialStart && (
                                  <ArrowRight
                                    className="w-3 h-3 text-amber-500 shrink-0"
                                  />
                                )}
                                <span className="text-[10px] font-mono text-slate-500 shrink-0 px-1.5 py-0.5 rounded bg-white/70 border border-slate-200">
                                  {String(unit.page_start) === String(unit.page_end)
                                    ? `hal. ${unit.page_start}`
                                    : `hal. ${unit.page_start}-${unit.page_end}`}
                                </span>
                                {unit.isPartialEnd && (
                                  <ArrowRight
                                    className="w-3 h-3 text-amber-500 shrink-0"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {session.meetingNotes && (
                          <div className="mt-1.5 text-xs text-slate-600 bg-amber-50/60 p-2 rounded-xl border border-amber-200/60">
                            <span className="font-semibold text-slate-700">Catatan Sesi: </span>
                            <span>{session.meetingNotes}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
