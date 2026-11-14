import React, { useMemo, useState } from 'react';
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
  ClipboardCheck
} from 'lucide-react';
import type {
  Subject,
  ClassEntity,
  Teacher,
  Room,
  SyllabusScope,
  ScheduledSessionOccurrence
} from '../../types';
import { formatUnitDisplay, computePacingStatus } from '../../utils/pacingEngine';
import { PacingStatusBadge } from './PacingStatusBadge';

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
  targetPacingData?: {
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
  onOpenAttendance?: (session: ScheduledSessionOccurrence) => void;
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
  targetPacingData,
  existingScope,
  isAdmin,
  onNavigateToSyllabusScope,
  onNavigateToRuleManager,
  onNavigateToBooks,
  onOpenAttendance,
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
  const [viewMode, setViewMode] = useState<'adjusted' | 'target'>('adjusted');
  const isTargetMode = viewMode === 'target';
  const effectivePacingData = isTargetMode && targetPacingData ? targetPacingData : pacingData;

  const activeCount = isTargetMode
    ? effectivePacingData?.projection.length || 0
    : effectivePacingData?.projection.filter((p) => !p.session.isCancelled).length || 0;
  const cancelledCount = isTargetMode
    ? 0
    : effectivePacingData?.projection.filter((p) => p.session.isCancelled).length || 0;

  // Calculate Pacing Progress (Behind vs Ahead vs On Track) via shared engine helper (only in adjusted mode)
  const pacingStatus = useMemo(() => {
    if (isTargetMode || !effectivePacingData?.projection || effectivePacingData.projection.length === 0) {
      return null;
    }
    return computePacingStatus(
      undefined,
      currentSubject?.id || '',
      currentClass?.id || '',
      {
        adjustedProjection: effectivePacingData.projection as any,
        targetProjection: targetPacingData?.projection as any,
        scopedUnits: effectivePacingData.scopedUnits,
        pagesPerSession: Number(effectivePacingData.pagesPerSession || 1),
      }
    );
  }, [effectivePacingData, targetPacingData, isTargetMode, currentSubject?.id, currentClass?.id]);

  const latestMeetingWithNotes = effectivePacingData?.projection
    ?.slice()
    ?.reverse()
    ?.find((p) => p.session.meetingNotes && p.session.meetingNotes.trim().length > 0);
  const latestNotes = latestMeetingWithNotes?.session.meetingNotes || existingScope?.notes;

  return (
    <div className="space-y-4">
      {/* Breadcrumb & Header Card */}
      <div className="sticky top-30 z-20 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1 mb-1">
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

          <div className="flex items-center gap-2">
            {/* View Mode Switcher: Progres Disesuaikan vs Target Awal */}
            <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('adjusted')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'adjusted'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilkan proyeksi dinamis berdasarkan presensi nyata, kompensasi laju, dan pembatalan"
              >
                Progres Disesuaikan
              </button>
              <button
                type="button"
                onClick={() => setViewMode('target')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'target'
                    ? 'bg-amber-500 text-white shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilkan target silabus awal kurikulum tanpa pembatalan atau pergeseran materi"
              >
                Target Awal
              </button>
            </div>

            {/* Action Button: Kalibrasi Laju (Retained for admin) */}
            {isAdmin && onNavigateToSyllabusScope && (
              <button
                type="button"
                onClick={() =>
                  onNavigateToSyllabusScope(
                    currentSubject?.id || undefined,
                    currentClass?.id || undefined
                  )
                }
                className="rounded-full px-2 py-2 text-amber-900 hover:bg-amber-100 transition-all cursor-pointer shadow-2xs"
                title="Buka pengaturan silabus dan kalibrasi laju materi di Syllabus Scope Modal"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
              </button>
            )}
          </div>
        </div>

        {/* Meta details & Pacing Status */}
        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 text-xs text-slate-500 pt-0.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
              <span className="text-slate-400">Total:</span>
              <span className="font-semibold text-slate-700">
                {effectivePacingData?.projection.length || 0} Pertemuan
                <span className="text-slate-500 font-normal ml-1">
                  ({activeCount} Aktif{cancelledCount > 0 && <>, <span className="text-rose-600 font-medium">{cancelledCount} Dibatalkan</span></>})
                </span>
              </span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <span className="text-slate-400">Cakupan:</span>
              <span className="font-semibold text-amber-700">
                {effectivePacingData?.scopedUnits.length || 0} Bab
              </span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <span className="text-slate-400">Total:</span>
              <span className="font-semibold text-slate-700">
                {effectivePacingData?.totalPages || 0} Hal
              </span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-2">
              <span className="text-slate-400">Target Laju:</span>
              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                ±{effectivePacingData?.pagesPerSession || 0} Hal
              </span>
              {/* Pacing status indicator */}
              {pacingStatus ? (
                <PacingStatusBadge status={pacingStatus} formatNumber={displayNumber} variant="detailed" />
              ) : (
                <div className="flex items-center gap-1.5 text-slate-400 italic text-xs">
                  <span>Laju Kurikulum: Belum ada progres sesi tercatat</span>
                </div>
              )}
              {pacingStatus && (
                <span className="font-semibold text-amber-600">(Sesi #{displayNumber(pacingStatus.meetingIndex)})</span>
              )}
            </span>
          </div>

        </div>

        {/* Latest Journal Notes Display */}
        {latestNotes && !isTargetMode && (
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
      {!effectivePacingData || effectivePacingData.projection.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">Tidak Ada Sesi Terjadwal</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Tidak ditemukan jadwal aktif untuk mata pelajaran ini pada kelas {currentClass?.name} dalam rentang periode kalender akademik.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {effectivePacingData.projection.map((item, idx) => {
            const { session, units, isCheckpoint, isAdjusted } = item;
            const teacher = teacherMap.get(session.teacherId);
            const room = roomMap.get(session.roomId);

            const isCancelled = isTargetMode ? false : (session.isCancelled || session.status === 'cancelled');
            const isPast = session.date < todayStr;
            const isToday = session.date === todayStr;
            const isFuture = session.date > todayStr;
            const isTargetHighlighted = activeHighlightDate === session.date;
            const isCurrent = currentSessionItem?.session.id === session.id;

            const isRecorded = !isTargetMode && !isCancelled && Boolean(
              (typeof session.actual_page === 'number' && session.actual_page > 0) ||
              (typeof session.actual_start_page === 'number' && session.actual_start_page > 0) ||
              (session.actual_materi_id && session.actual_materi_id.trim() !== '') ||
              (session.actual_start_materi_id && session.actual_start_materi_id.trim() !== '')
            );

            // Directly read units from projection:
            // In target view, display pure baseline target units.
            // In adjusted view: past unrecorded are stripped (units: []), recorded sessions have exact DB units, and current/future sessions have projected units.
            const displayUnits = units;

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
                        #{isTargetMode ? idx + 1 : displayNumber(session.meetingIndex)}
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
                            {isRecorded && (() => {
                              const startUnit = session.actual_start_materi_id
                                ? pacingData?.scopedUnits.find((u) => u.id === session.actual_start_materi_id)
                                : null;
                              const endUnit = session.actual_materi_id
                                ? pacingData?.scopedUnits.find((u) => u.id === session.actual_materi_id)
                                : null;
                              const startPart = startUnit?.part || (startUnit as any)?.volumeNumber;
                              const endPart = endUnit?.part || (endUnit as any)?.volumeNumber;

                              const sp = session.actual_start_page;
                              const ep = session.actual_page;

                              let labelText = '';
                              if (sp && ep && sp !== ep) {
                                if (startPart && endPart && startPart !== endPart) {
                                  labelText = `Tercatat Jilid ${startPart} hal. ${sp} – Jilid ${endPart} hal. ${ep}`;
                                } else if (endPart && Number(endPart) > 0) {
                                  labelText = `Tercatat Jilid ${endPart}, hal. ${sp}–${ep}`;
                                } else {
                                  labelText = `Tercatat hal. ${sp}–${ep}`;
                                }
                              } else if (ep) {
                                const partText = endPart && Number(endPart) > 0 ? `Jilid ${endPart}, ` : '';
                                labelText = `Tercatat s/d ${partText}hal. ${ep}`;
                              } else if (sp) {
                                const partText = startPart && Number(startPart) > 0 ? `Jilid ${startPart}, ` : '';
                                labelText = `Tercatat mulai ${partText}hal. ${sp}`;
                              } else {
                                labelText = `Tercatat: ${endUnit?.title || startUnit?.title || 'Materi Terlaksana'}`;
                              }

                              return (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1"
                                  title={`Materi aktual tercatat: ${labelText}`}
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                  <span>{labelText}</span>
                                </span>
                              );
                            })()}
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
                        {isAdmin && onOpenAttendance && !isCancelled && (
                          <button
                            type="button"
                            onClick={() => onOpenAttendance(session)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 transition-all cursor-pointer shadow-2xs"
                            title="Buka presensi & kalibrasi materi sesi ini"
                          >
                            <ClipboardCheck className="w-3 h-3 text-amber-600" />
                            <span>Edit Presensi / Materi</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Units rendered per specification */}
                  <div className="md:w-7/12 pt-2 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-4">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                      <span>
                        {isTargetMode
                          ? 'Materi Target (Awal):'
                          : isCancelled
                          ? 'Status Pertemuan:'
                          : isRecorded
                          ? 'Materi Terlaksana:'
                          : isPast
                          ? 'Status Pertemuan:'
                          : 'Materi Target:'}
                      </span>
                      {!isTargetMode && isAdjusted && !isCancelled && !isPast && (
                        <ClipboardCheck
                          className="w-3 h-3 text-indigo-400 hover:text-indigo-600 transition-colors shrink-0"
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
                    ) : isPast && !isRecorded ? (
                      <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50/50 border border-dashed border-slate-200">
                        <span className="text-xs text-slate-400 italic">
                          Materi tidak tercatat
                        </span>
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

                          const pStartStr = unit.page_start !== undefined && unit.page_start !== null ? String(unit.page_start).trim() : '';
                          const pEndStr = unit.page_end !== undefined && unit.page_end !== null ? String(unit.page_end).trim() : '';
                          const hasPages = pStartStr !== '' && pStartStr !== '0';

                          return (
                            <div
                              key={unit.id}
                              className={`text-xs px-3 py-2 rounded-xl flex items-start justify-between gap-2 border ${
                                isToday
                                  ? 'bg-amber-100/60 border-amber-200/80 text-amber-950 font-bold'
                                  : isRecorded
                                  ? 'bg-emerald-50/50 border-emerald-200/70 text-slate-800 font-medium'
                                  : 'bg-slate-50 border-slate-200/70 text-slate-800 font-medium'
                              }`}
                            >
                              {/* Left: (bullet) (book) (material) */}
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                                  isRecorded ? 'bg-emerald-500' : 'bg-amber-500'
                                }`} />
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
                              {hasPages && (
                                <div className="flex items-center gap-1 shrink-0">
                                  {unit.isPartialStart && (
                                    <ArrowRight
                                      className="w-3 h-3 text-amber-500 shrink-0"
                                    />
                                  )}
                                  <span className="text-[10px] font-mono text-slate-500 shrink-0 px-1.5 py-0.5 rounded bg-white/70 border border-slate-200">
                                    {pStartStr === pEndStr || !pEndStr || pEndStr === '0'
                                      ? `hal. ${pStartStr}`
                                      : `hal. ${pStartStr}-${pEndStr}`}
                                  </span>
                                  {unit.isPartialEnd && (
                                    <ArrowRight
                                      className="w-3 h-3 text-amber-500 shrink-0"
                                    />
                                  )}
                                </div>
                              )}
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
