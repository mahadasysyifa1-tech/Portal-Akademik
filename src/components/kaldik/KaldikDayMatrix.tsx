import React from 'react';
import { Clock, BookOpen, Users, DoorOpen } from 'lucide-react';
import type {
  DatabaseState,
  ResolvedSlot,
  Period,
  DayOfWeek,
  ClassEntity,
  Session
} from '../../types';
import {
  FixedBlockSubGrid,
  FixedBlockHeaderGrid,
  type FixedBlockState
} from '../schedule/FixedBlockSubGrid';
import { getUnitsForSubject, type PacingSessionProjection } from '../../utils/pacingEngine';
import {
  buildMeetingId,
  resolveSlotUnits,
  type MeetingStatus
} from '../../utils/kaldikHelpers';
import { SlotSyllabusLine } from './SlotSyllabusLine';

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
  dayPacingMap: Map<string, PacingSessionProjection[]>;
  onNavigateToBooks?: (bookId?: string) => void;
  onNavigateToJournal?: (subjectId?: string, classId?: string, date?: string) => void;
  meetingsForDay?: any[];
  getEffectiveStatus?: (
    meetingId: string,
    serverStatus?: MeetingStatus
  ) => MeetingStatus;
  isMeetingDrafted?: (meetingId: string) => boolean;
  onOpenAttendanceModal?: (slot: ResolvedSlot, meeting?: any) => void;
  onToggleSessionStatus?: (meetingId: string, currentStatus: string) => void;
}

interface SlotStatusActionsProps {
  status: MeetingStatus;
  isDraft: boolean;
  onOpenAttendance?: () => void;
  onToggleStatus?: () => void;
}

const SlotStatusActions: React.FC<SlotStatusActionsProps> = ({
  status,
  isDraft,
  onOpenAttendance,
  onToggleStatus
}) => {
  const draftTag = isDraft ? ' (Draft)' : '';

  return (
    <div className="flex items-center gap-1.5">
      {status === 'completed' ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
          ✓ Selesai{draftTag}
        </span>
      ) : status === 'cancelled' ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 line-through">
          Dibatalkan{draftTag}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
          Belum Absen{draftTag}
        </span>
      )}

      {onOpenAttendance && (
        <button
          type="button"
          onClick={onOpenAttendance}
          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
          title="Buka absensi santri"
        >
          {status === 'completed' ? 'Presensi' : 'Isi Absen'}
        </button>
      )}

      {onToggleStatus && (
        <button
          type="button"
          onClick={onToggleStatus}
          className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer ${
            status === 'cancelled'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
          }`}
          title={status === 'cancelled' ? 'Aktifkan kembali sesi ini' : 'Batalkan sesi pada tanggal ini'}
        >
          {status === 'cancelled' ? 'Pulihkan' : 'Batal'}
        </button>
      )}
    </div>
  );
};

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
  const dateStr = selectedDayData.dateStr;

  // One lookup for meeting record, effective status and draft flag of a class-session cell
  const getMeetingInfo = (classId: string, sessionId: string) => {
    const meeting = meetingsForDay.find((m) => m.classId === classId && m.sessionId === sessionId);
    const meetingId = buildMeetingId(dateStr, classId, sessionId, meeting?.id);
    const status: MeetingStatus = getEffectiveStatus
      ? getEffectiveStatus(meetingId, meeting?.status || 'scheduled')
      : meeting?.status || 'scheduled';
    const isDraft = isMeetingDrafted ? isMeetingDrafted(meetingId) : false;
    return { meeting, meetingId, status, isDraft };
  };

  // Maps one (session, class) cell to the FixedBlockSubGrid block shape
  const buildCellState = (session: Session, cls: ClassEntity): FixedBlockState => {
    const slot = selectedDayData.classSlots.find(
      (s) => s.sessionId === session.id && s.classId === cls.id
    );

    if (!slot) {
      return {
        id: `free_${session.id}_${cls.id}`,
        label: cls.name,
        isFilled: false,
        occupied: false,
        tooltip: `${cls.name}: Kosong (Tidak ada jadwal)`
      };
    }

    const sub = subjectMap.get(slot.subjectId);
    const tch = teacherMap.get(slot.teacherId);
    const rm = roomMap.get(slot.roomId);
    const { status, isDraft } = getMeetingInfo(cls.id, session.id);
    const statusDesc =
      status === 'completed'
        ? 'Presensi Selesai'
        : status === 'cancelled'
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
      attendanceStatus: status,
      isDraft
    };
  };

  const handleBlockClick = (_idx: number, block: FixedBlockState) => {
    if (block.isFilled && block.slot) {
      const { meeting } = getMeetingInfo(block.slot.classId, block.slot.sessionId);
      onOpenAttendanceModal?.(block.slot, meeting);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Matriks Sesi Waktu: one row per session, one FixedBlockSubGrid per row */}
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
                {sortedSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50/40 transition-colors">
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

                    <td className="p-2 align-middle">
                      <FixedBlockSubGrid
                        count={sortedClasses.length}
                        interactive={true}
                        onBlockClick={handleBlockClick}
                        getStateFn={(classIndex) => buildCellState(session, sortedClasses[classIndex])}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. Jadwal Pelajaran Kelas Aktif: per-slot detail list */}
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

              const { units, meetingIndex } = resolveSlotUnits(db, slot, dateStr, dayPacingMap);
              const hasSyllabus = getUnitsForSubject(db, slot.subjectId).length > 0;
              const { meeting, meetingId, status, isDraft } = getMeetingInfo(slot.classId, slot.sessionId);
              const fallbackBookId =
                subject?.default_book || subject?.defaultBookId || subject?.primary_book_code || undefined;

              return (
                <div
                  key={`${slot.ruleId}-${slot.sessionId}-${idx}`}
                  className="p-3 bg-white hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div className="w-20 shrink-0">
                      <span className="text-[10px] font-bold text-amber-800 block">
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

                      <SlotSyllabusLine
                        units={units}
                        hasSyllabus={hasSyllabus}
                        fallbackBookId={fallbackBookId}
                        bookMap={bookMap}
                        onNavigateToBooks={onNavigateToBooks}
                        onOpenJournal={
                          onNavigateToJournal
                            ? () => onNavigateToJournal(slot.subjectId, slot.classId, dateStr)
                            : undefined
                        }
                      />
                    </div>
                  </div>

                  {/* 3. Badges & attendance actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                    {slot.hasException && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        Pengecualian Periode
                      </span>
                    )}
                    <SlotStatusActions
                      status={status}
                      isDraft={isDraft}
                      onOpenAttendance={
                        onOpenAttendanceModal ? () => onOpenAttendanceModal(slot, meeting) : undefined
                      }
                      onToggleStatus={
                        onToggleSessionStatus ? () => onToggleSessionStatus(meetingId, status) : undefined
                      }
                    />
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
