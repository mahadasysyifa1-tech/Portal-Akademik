import React from 'react';
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
  Ban
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

          {/* Action Buttons: Kalibrasi Pacing (via SyllabusScopeModal deep-link) & Rule Manager Scope */}
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin ? (
              <>
                {onNavigateToSyllabusScope && (
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

                {onNavigateToRuleManager && (
                  <button
                    type="button"
                    onClick={onNavigateToRuleManager}
                    className="flex items-center rounded-xl gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Buka Rule Manager Studio untuk mengatur batas bab silabus"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                    <span>Ubah Rentang Silabus</span>
                  </button>
                )}
              </>
            ) : existingScope?.adjustment ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-xl">
                <CheckCircle2 className="w-3 h-3 text-amber-600" />
                <span>
                  Telah Disesuaikan Guru (Sesi #{existingScope.adjustment.checkpointSessionIndex})
                </span>
              </span>
            ) : (
              onOpenAdminLogin && (
                <button
                  type="button"
                  onClick={onOpenAdminLogin}
                  className="text-[11px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                >
                  Masuk admin untuk kalibrasi laju
                </button>
              )
            )}
          </div>
        </div>

        {/* Meta details */}
        <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-3 text-xs text-slate-500 pt-0.5">
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
              <span className="text-slate-400">Total Halaman:</span>
              <span className="font-semibold text-slate-700">
                {pacingData?.totalPages || 0} Hal
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Target Rata-Rata:</span>
            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
              ±{pacingData?.pagesPerSession || 0} Hal / Sesi Aktif
            </span>
          </div>
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
                {/* Checkpoint Indicator Banner */}
                {/* {isCheckpoint && !isCancelled && (
                  <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-amber-900">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <span className="font-bold">Titik Awal Kalibrasi Ulang:</span>{' '}
                        <span>
                          Mulai hal. {existingScope?.adjustment?.checkpointPage || '?'} (
                          {existingScope?.adjustment?.strategy === 'cut'
                            ? `Pangkas ${(existingScope?.adjustment?.cutUnitIds || []).length} Bab`
                            : 'disesuaikan tanpa pemangkasan'}
                          )
                        </span>
                      </div>
                    </div>
                    {isAdmin && onNavigateToSyllabusScope && (
                      <button
                        type="button"
                        onClick={() => {
                          onNavigateToSyllabusScope(
                            currentSubject?.id || undefined,
                            currentClass?.id || undefined
                          );
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                        title="Buka pengaturan silabus di Syllabus Scope Modal"
                      >
                        <ExternalLink className="w-3 h-3 text-amber-700" />
                        <span>Buka di Scope Silabus</span>
                      </button>
                    )}
                  </div>
                )} */}

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
                            {isAdjusted && !isCheckpoint && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300/80 flex items-center gap-1"
                                title="Laju materi pada sesi ini telah disesuaikan dari kalibrasi guru"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 text-amber-600" />
                                Terkalibrasi
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
                        {isCurrent && isAdmin && onNavigateToSyllabusScope && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToSyllabusScope(
                                currentSubject?.id || undefined,
                                currentClass?.id || undefined
                              );
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-amber-700 hover:bg-amber-100/80 transition-colors cursor-pointer shrink-0 ml-1"
                            title="Buka pengaturan silabus & kalibrasi laju materi di Syllabus Scope Modal"
                            aria-label="Buka Scope Silabus"
                          >
                            <ExternalLink className="w-4 h-4 text-amber-600" />
                          </button>
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
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      {isCancelled ? 'Status Pertemuan:' : 'Materi Target:'}
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
                    ) : units.length === 0 ? (
                      <div className="text-xs text-slate-400 italic">
                        (Distribusi / Pembahasan Mandiri &amp; Evaluasi)
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {units.map((unit) => {
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
