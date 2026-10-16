import React from 'react';
import { ResolvedSlot, Subject, Teacher, Room, ClassEntity } from '../../types';
import { ClassIcon } from '../ClassIcon';
import { Video } from 'lucide-react';

export interface SingleEntryCellConfig {
  colorKey: 'subject' | 'class';
  primaryField: 'subject' | 'class';
  secondaryField: 'teacher' | 'subject';
}

export interface EntryFullData {
  slot: ResolvedSlot;
  subject?: Subject;
  teacher?: Teacher;
  room?: Room;
  classEntity?: ClassEntity;
  day: string;
  sessionName: string;
  sessionTime: string;
  periodName: string;
}

interface SingleEntryCellProps {
  entry?: EntryFullData | null;
  config: SingleEntryCellConfig;
  onEntryClick?: (data: EntryFullData) => void;
}

// Generate consistent pastel/distinct color for a class if colorKey is class
const CLASS_COLORS = [
  '#0284C7', // Sky
  '#059669', // Emerald
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#DB2777', // Pink
  '#4F46E5', // Indigo
  '#0D9488', // Teal
  '#EA580C', // Orange
  '#475569', // Slate
  '#9333EA', // Purple
];

export function getClassColor(classId: string, index: number = 0): string {
  let hash = 0;
  for (let i = 0; i < classId.length; i++) {
    hash = (hash << 5) - hash + classId.charCodeAt(i);
    hash |= 0;
  }
  return CLASS_COLORS[Math.abs(hash + index) % CLASS_COLORS.length];
}

export const SingleEntryCell: React.FC<SingleEntryCellProps> = ({
  entry,
  config,
  onEntryClick
}) => {
  if (!entry) {
    // Empty cell: neutral background or blank, leave empty, don't label "Free", non-interactive
    return (
      <div
        className="w-full h-full min-h-[76px] bg-slate-50/40 rounded-lg border border-slate-100/80 transition-colors pointer-events-none"
        aria-label="Empty Slot"
      />
    );
  }

  const { subject, teacher, room, classEntity, day, sessionName, sessionTime, slot } = entry;
  const isSubjectPrimary = config.primaryField === 'subject';

  const isClassMode = config.colorKey === 'class';
  const classColor = classEntity?.color || getClassColor(classEntity?.id || 'cls-0');
  const subjectColor = subject?.color || '#4F46E5';

  const teacherShortName = teacher?.panggilan || teacher?.name || 'Teacher';
  const roomName = room?.name || 'Ruang';
  const subjectName = subject?.name || subject?.code || 'Pelajaran';

  // Title row (bold, colored) — subject name for Murid, class name for Guru
  const titleText = isSubjectPrimary ? subjectName : classEntity?.name || 'Class';

  // Detailed tooltip text
  const tooltip = `${titleText}
Class: ${classEntity?.name || 'N/A'} (Gr.${classEntity?.grade || '?'})
Teacher: ${teacher?.name || 'N/A'}${teacher?.panggilan ? ` ("${teacher.panggilan}")` : ''} (${teacher?.department || ''})
Room: ${room?.name || 'Unassigned'} (${room?.type || ''})
${subject?.book ? `Buku: ${subject.book}\n` : ''}Time: ${sessionName} (${sessionTime}) • ${day}
${slot.hasException ? `⚡ Exception: ${slot.exceptionDetail || 'Overridden slot'}` : ''}
Click to inspect details`;

  if (isClassMode) {
    return (
      <button
        type="button"
        title={tooltip}
        onClick={() => onEntryClick && onEntryClick(entry)}
        style={{
          backgroundColor: classColor,
          borderColor: 'rgba(0, 0, 0, 0.12)',
          borderLeftColor: 'rgba(0, 0, 0, 0.45)',
          borderLeftWidth: '3.5px'
        }}
        className="w-full h-full min-h-[76px] p-2 rounded-lg border text-left transition-all duration-150 hover:shadow-xs hover:brightness-95 cursor-pointer flex flex-col justify-between group focus:outline-none focus:ring-2 focus:ring-amber-500/50"
      >
        <div className="flex items-center justify-between gap-1 w-full">
          <div className="flex items-center gap-1.5 min-w-0">
            <ClassIcon
              name={classEntity?.icon || 'GraduationCap'}
              className="w-3.5 h-3.5 text-slate-700 shrink-0"
            />
            <span className="font-extrabold text-xs text-slate-900 truncate">
              {classEntity?.name || 'Kelas'}
            </span>
          </div>
          {slot.hasException && (
            <span className="text-[10px] text-amber-700 font-mono font-bold shrink-0" title="Pengecualian aktif">
              ⚡
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[10px] text-slate-800 truncate font-semibold leading-snug my-0.5">
          <span
            className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
            style={{ backgroundColor: subjectColor }}
          />
          <span className="truncate">{subjectName}</span>
          {subject?.book && <span className="text-slate-500 font-normal truncate">({subject.book})</span>}
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-600 font-medium leading-tight">
          <span className="truncate">{roomName}</span>
          {classEntity?.onlineClassLink && (
            <span className="text-blue-700 hover:text-blue-900 shrink-0 ml-1" title="Tautan Kelas Online Tersedia">
              <Video className="w-3 h-3" />
            </span>
          )}
        </div>
      </button>
    );
  }

  // Student view mode: primary color is subject color
  const infoLines = [subject?.book, roomName, teacherShortName].filter(Boolean);

  return (
    <button
      type="button"
      title={tooltip}
      onClick={() => onEntryClick && onEntryClick(entry)}
      style={{
        backgroundColor: `${subjectColor}16`,
        borderColor: `${subjectColor}40`,
        borderLeftColor: subjectColor,
        borderLeftWidth: '3px'
      }}
      className="w-full h-full min-h-[76px] p-1.5 rounded-lg border text-left transition-all duration-150 hover:shadow-xs hover:brightness-95 cursor-pointer flex flex-col justify-center gap-0.5 group focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
    >
      <div className="flex items-center justify-between gap-1 w-full">
        <span className="font-bold text-xs truncate" style={{ color: subjectColor }}>
          {titleText}
        </span>
        {slot.hasException && (
          <span className="text-[10px] text-amber-600 font-mono font-bold shrink-0" title="Exception active">
            ⚡
          </span>
        )}
      </div>

      {infoLines.map((line, i) => (
        <div key={i} className="text-[10px] text-slate-600 truncate font-medium leading-snug">
          {line}
        </div>
      ))}
    </button>
  );
};