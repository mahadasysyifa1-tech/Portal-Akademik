import React from 'react';
import {
  Clock,
  Filter,
  User,
  MapPin,
  RotateCcw,
  CheckCircle2,
  X,
  BookOpen,
  ExternalLink,
  CalendarCheck2,
  Calendar as CalendarIcon
} from 'lucide-react';
import type { AttendanceMeetingSummary, ClassEntity } from '../../types';

export interface MeetingTargetInfo {
  unitTitles: string;
  minPage?: number;
  maxPage?: number;
  targetUnitId?: string;
  availableUnits?: any[];
}

export interface JournalMeetingsAgendaProps {
  selectedDateLabel: string;
  selectedClassId: string;
  setSelectedClassId: (classId: string) => void;
  classes: ClassEntity[];
  loadingDayMeetings: boolean;
  filteredMeetings: AttendanceMeetingSummary[];
  getTargetInfoForMeeting: (mtg: AttendanceMeetingSummary) => MeetingTargetInfo | null;
  onToggleMeetingStatus: (meetingId: string, newStatus: 'scheduled' | 'completed' | 'cancelled') => void;
  onOpenAttendanceModal: (mtg: AttendanceMeetingSummary) => void;
  onNavigateToSyllabusScope?: (subjectId?: string, classId?: string) => void;
  onNavigateToRuleManager?: () => void;
}

export const JournalMeetingsAgenda: React.FC<JournalMeetingsAgendaProps> = ({
  selectedDateLabel,
  selectedClassId,
  setSelectedClassId,
  classes,
  loadingDayMeetings,
  filteredMeetings,
  getTargetInfoForMeeting,
  onToggleMeetingStatus,
  onOpenAttendanceModal,
  onNavigateToSyllabusScope,
  onNavigateToRuleManager,
}) => {
  return (
    <div className="lg:col-span-5 space-y-4">
        {/* Header: Selected Date Title & Class Filter */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white mt-0.5">
              {selectedDateLabel}
            </h3>
          </div>

          {/* Class Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-white shrink-0" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="all">Semua Kelas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.section})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* List of Sessions for Selected Day */}
        {loadingDayMeetings ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Clock className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
            <p className="text-xs font-medium">Memuat jadwal sesi...</p>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="py-12 px-4 rounded-2xl bg-slate-50/70 border border-dashed border-slate-200 text-center space-y-2">
            <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-bold text-slate-700">Tidak Ada Sesi KBM</div>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Tidak ada jadwal kelas aktif yang terjadwal pada tanggal ini. Periksa kalender akademik atau aturan jadwal.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMeetings.map((mtg) => {
              const isCancelled = mtg.status === 'cancelled';
              const isCompleted = mtg.status === 'completed';
              const summary = mtg.summary;
              const targetInfo = getTargetInfoForMeeting(mtg);

              return (
                <div
                  key={mtg.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCancelled
                      ? 'border-dashed border-rose-200 bg-rose-50/20 opacity-80'
                      : isCompleted
                      ? 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-300'
                      : 'border-slate-200 bg-white hover:border-amber-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {/* Badges: Meeting Index, Time & Class */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {isCancelled ? (
                          <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                            Dibatalkan
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[11px] font-extrabold rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-mono shadow-2xs">
                            #{mtg.meetingIndex ?? '?'}
                          </span>
                        )}

                        <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-100 text-slate-700 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {mtg.startTime} - {mtg.endTime} ({mtg.sessionName})
                        </span>

                        <span
                          className="px-2 py-0.5 text-[11px] font-bold rounded-md border"
                          style={{
                            backgroundColor: `${mtg.classColor || '#E2E8F0'}25`,
                            borderColor: `${mtg.classColor || '#CBD5E1'}`,
                            color: '#1E293B',
                          }}
                        >
                          Kelas: {mtg.className}
                        </span>
                      </div>

                      {/* Subject & Room */}
                      <h4 className={`text-sm sm:text-base font-bold flex items-center gap-1.5 ${isCancelled ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: mtg.subjectColor || '#3B82F6' }}
                        />
                        <span>{mtg.subjectName}</span>
                      </h4>

                      {/* Teacher & Room subtitle */}
                      <div className="text-xs text-slate-500 flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {mtg.teacherName}
                        </span>
                        {mtg.roomName && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {mtg.roomName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Top-Right Action: Status / Restore / Cancel X */}
                    <div>
                      {isCancelled ? (
                        <button
                          type="button"
                          onClick={() => onToggleMeetingStatus(mtg.id, 'scheduled')}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                          title="Pulihkan sesi pertemuan ini (otomatis menghitung kembali nomor pertemuan)"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-600" />
                          <span>Pulihkan</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {isCompleted ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-xl">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Selesai</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                              Belum Diisi
                            </span>
                          )}

                          {/* Simple X icon to cancel meeting */}
                          <button
                            type="button"
                            onClick={() => onToggleMeetingStatus(mtg.id, 'cancelled')}
                            className="w-7 h-7 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                            title="Batalkan sesi pertemuan ini (otomatis menata ulang nomor pertemuan berikutnya)"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Main Card: Target Silabus Preview & Penyesuaian Silabus Deep Link */}
                  {!isCancelled && targetInfo && (
                    <div className="mt-3 p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                          <BookOpen className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Target Materi Silabus
                          </span>
                          <span className="font-semibold text-slate-900">
                            {targetInfo.unitTitles} {targetInfo.minPage ? `(Hal. ${targetInfo.minPage}${targetInfo.maxPage && targetInfo.maxPage !== targetInfo.minPage ? `–${targetInfo.maxPage}` : ''})` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Deep link button to Unified Studio Syllabus Scope Modal */}
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateToSyllabusScope) {
                            onNavigateToSyllabusScope(mtg.subjectId, mtg.classId);
                          } else if (onNavigateToRuleManager) {
                            onNavigateToRuleManager();
                          }
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-100/80 rounded-xl border border-indigo-200 shadow-2xs transition-all cursor-pointer"
                        title="Buka penyesuaian kurikulum di Unified Studio / Syllabus Scope"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Penyesuaian Silabus</span>
                      </button>
                    </div>
                  )}

                  {/* Summary Row & Action Button */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs">
                      {isCancelled ? (
                        <span className="text-rose-600 font-semibold text-xs">
                          Sesi pertemuan ini dibatalkan (dilewati dari perhitungan laju)
                        </span>
                      ) : isCompleted ? (
                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                          <span className="text-emerald-700 font-bold">{summary.hadirCount} Hadir</span>
                          {summary.izinCount > 0 && <span>· {summary.izinCount} Izin</span>}
                          {summary.sakitCount > 0 && <span>· {summary.sakitCount} Sakit</span>}
                          {summary.alpaCount > 0 && <span className="text-rose-600 font-bold">· {summary.alpaCount} Alpa</span>}
                        </div>
                      ) : (
                        <span className="text-slate-400">
                          {summary.totalEnrolled} santri terdaftar
                        </span>
                      )}
                    </div>

                    {!isCancelled && (
                      <button
                        type="button"
                        onClick={() => onOpenAttendanceModal(mtg)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs ${
                          isCompleted
                            ? 'text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200/80'
                            : 'text-white bg-amber-500 hover:bg-amber-600'
                        }`}
                      >
                        <CalendarCheck2 className="w-3.5 h-3.5" />
                        <span>{isCompleted ? 'Ubah Presensi' : 'Isi Presensi'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
};
