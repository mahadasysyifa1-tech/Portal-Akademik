import React from 'react';
import { ClassIcon } from '../ClassIcon';

export interface FixedBlockState {
  id: string;
  label: string; // e.g. "10A" (for View 3) or "S1" (for View 4)
  isFilled?: boolean;
  occupied?: boolean; // backwards compatibility alias
  color?: string; // color of subject if filled
  teacherColor?: string; // color of teacher for chip border
  tooltip: string;
  subjectName?: string;
  subjectCode?: string;
  teacherName?: string;
  roomName?: string;
  hasException?: boolean;
  ruleId?: string;
  slot?: any;
  attendanceStatus?: 'scheduled' | 'completed' | 'cancelled';
  isDraft?: boolean;
}

export interface FixedBlockHeaderClass {
  id: string;
  name: string;
  icon?: string;
  grade?: number;
  color?: string;
}

interface FixedBlockHeaderGridProps {
  classes: FixedBlockHeaderClass[];
}

export const FixedBlockHeaderGrid: React.FC<FixedBlockHeaderGridProps> = ({ classes }) => {
  const count = classes.length;
  const isUltraDense = count > 10;
  const isDense = count > 5;
  const isMinimal = count > 2;

  // Ultra dense: 20 per row. Minimal & Dense: all classes forced inline in 1 row.
  const colCount = isUltraDense ? Math.min(count, 20) : Math.max(1, count);

  return (
    <div
      className={`w-full rounded-xl bg-slate-100/90 border border-slate-200/90 grid items-stretch ${
        isUltraDense
          ? 'p-0.5 gap-0.5'
          : isDense
          ? 'p-1 gap-1'
          : isMinimal
          ? 'p-1 gap-1'
          : 'p-1 gap-1.5'
      }`}
      style={{
        gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`
      }}
    >
      {classes.map((cls, idx) => {
        const titleText = `${cls.name}${cls.grade ? ` (Tingkat ${cls.grade})` : ''}`;
        return (
          <div
            key={cls.id || idx}
            title={titleText}
            className={`rounded-lg bg-white border border-slate-200/90 text-slate-700 flex items-center justify-center shadow-2xs font-semibold overflow-hidden select-none transition-all ${
              isUltraDense
                ? 'min-h-[20px] h-5 p-0.5 text-[9px]'
                : isDense
                ? 'min-h-[24px] h-6 px-1 py-0.5 text-[10px]'
                : isMinimal
                ? 'min-h-[24px] h-6 px-1 py-0.5 text-[10px]'
                : 'min-h-[28px] h-7 px-1.5 py-0.5 text-[11px]'
            }`}
          >
            <ClassIcon
              name={cls.icon}
              className={`${
                isUltraDense
                  ? 'w-2.5 h-2.5 text-slate-600 shrink-0'
                  : isDense
                  ? 'w-3.5 h-3.5 text-slate-600 shrink-0'
                  : 'w-3.5 h-3.5 text-slate-600 shrink-0'
              }`}
            />
            {!isDense && (
              <span className="truncate max-w-full ml-1 font-bold text-slate-800">
                {cls.name}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface FixedBlockSubGridProps {
  count: number;
  getStateFn: (index: number) => FixedBlockState;
  onBlockClick?: (index: number, state: FixedBlockState) => void;
  interactive?: boolean;
}

export const FixedBlockSubGrid: React.FC<FixedBlockSubGridProps> = ({
  count,
  getStateFn,
  onBlockClick,
  interactive = false
}) => {
  const blocks = Array.from({ length: count }, (_, i) => getStateFn(i));

  const isUltraDense = count > 10;
  const isDense = count > 5;
  const isMinimal = count > 2;

  // Layout:
  // - Ultra dense: each 20 chips are forced inline with each other (up to 20 columns per row)
  // - Minimal & Dense: all chips are forced inline with each other in a single row
  // - Normal (count <= 2): all chips inline in a single row
  const colCount = isUltraDense ? Math.min(count, 20) : Math.max(1, count);

  return (
    <div
      className={`w-full h-full min-h-[36px] rounded-xl bg-slate-50/60 border border-slate-200/80 grid items-stretch ${
        isUltraDense
          ? 'p-0.5 gap-0.5'
          : isDense
          ? 'p-1 gap-1'
          : isMinimal
          ? 'p-1 gap-1'
          : 'p-1 gap-1.5'
      }`}
      style={{
        gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`
      }}
    >
      {blocks.map((block, idx) => {
        const filled = Boolean(block.isFilled ?? block.occupied);
        const { color, teacherColor, tooltip, hasException, subjectName, subjectCode } = block;
        const blockColor = color || '#4F46E5';
        const borderColor = teacherColor || blockColor;

        if (filled) {
          const isCompleted = block.attendanceStatus === 'completed';
          const isCancelled = block.attendanceStatus === 'cancelled';
          const isDraft = Boolean(block.isDraft);

          // 1. ULTRA DENSE: Vertical strips/streaks instead of squares (no text, pure color streak)
          if (isUltraDense) {
            return (
              <button
                key={block.id || idx}
                type="button"
                title={`${tooltip}${isCompleted ? ' • Presensi Selesai' : isCancelled ? ' • Sesi Dibatalkan' : ''}${isDraft ? ' (Draft)' : ''}`}
                disabled={!interactive}
                onClick={() => interactive && onBlockClick && onBlockClick(idx, block)}
                style={{
                  backgroundColor: isCancelled ? '#94A3B8' : blockColor,
                  borderColor: isCancelled ? '#64748B' : borderColor,
                  opacity: isCancelled ? 0.6 : 1
                }}
                className={`w-full h-8 sm:h-9 border-2 rounded-xs shadow-2xs transition-all overflow-hidden relative ${
                  interactive
                    ? 'cursor-pointer hover:scale-110 hover:brightness-110 hover:z-10 active:scale-95 focus:outline-none focus:ring-1 focus:ring-indigo-400'
                    : 'cursor-default'
                } ${isDraft ? 'ring-2 ring-amber-400' : ''}`}
              >
                {hasException && (
                  <span className="w-1 h-1 rounded-full bg-amber-300 block mx-auto mt-0.5 shadow-xs" />
                )}
                {isCompleted && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 block mx-auto mt-0.5 shadow-xs" />
                )}
                {isCancelled && (
                  <span className="w-1.5 h-0.5 bg-rose-500 block mx-auto mt-1 shadow-xs" />
                )}
              </button>
            );
          }

          // 2. DENSE: Small squares like palettes without any texts inside, relying only on color indicators
          if (isDense) {
            return (
              <button
                key={block.id || idx}
                type="button"
                title={`${tooltip}${isCompleted ? ' • Presensi Selesai' : isCancelled ? ' • Sesi Dibatalkan' : ''}${isDraft ? ' (Draft)' : ''}`}
                disabled={!interactive}
                onClick={() => interactive && onBlockClick && onBlockClick(idx, block)}
                style={{
                  backgroundColor: isCancelled ? '#94A3B8' : blockColor,
                  borderColor: isCancelled ? '#64748B' : borderColor,
                  opacity: isCancelled ? 0.6 : 1
                }}
                className={`w-full aspect-square max-h-7 border-2 rounded-md shadow-2xs transition-all overflow-hidden flex items-center justify-center relative ${
                  interactive
                    ? 'cursor-pointer hover:scale-110 hover:brightness-110 hover:z-10 active:scale-95 focus:outline-none focus:ring-1 focus:ring-indigo-400'
                    : 'cursor-default'
                } ${isDraft ? 'ring-2 ring-amber-400' : ''}`}
              >
                {hasException && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300 block shadow-xs" />
                )}
                {isCompleted && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-white shadow-xs" />
                )}
                {isCancelled && (
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-black bg-rose-900/30">✕</span>
                )}
              </button>
            );
          }

          // 3. MINIMAL: Chips forced inline with each other. Hide teacher name subtitle.
          const subjectDisplay = subjectCode || subjectName || 'Mapel';

          if (isMinimal) {
            return (
              <button
                key={block.id || idx}
                type="button"
                title={`${tooltip}${isCompleted ? ' • Presensi Selesai' : isCancelled ? ' • Sesi Dibatalkan' : ''}${isDraft ? ' (Draft)' : ''}`}
                disabled={!interactive}
                onClick={() => interactive && onBlockClick && onBlockClick(idx, block)}
                style={{
                  backgroundColor: isCancelled ? '#94A3B8' : blockColor,
                  borderColor: isCancelled ? '#64748B' : borderColor
                }}
                className={`w-full h-8 sm:h-9 border-2 rounded-lg flex items-center justify-center font-medium text-white shadow-xs transition-all overflow-hidden px-1 relative ${
                  interactive
                    ? 'cursor-pointer hover:scale-[1.03] hover:brightness-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400'
                    : 'cursor-default'
                } ${isCancelled ? 'opacity-65' : ''} ${isDraft ? 'ring-2 ring-amber-400' : ''}`}
              >
                <span className={`truncate leading-tight font-bold text-[10px] sm:text-[11px] select-none flex items-center justify-center gap-0.5 max-w-full ${isCancelled ? 'line-through text-slate-200' : ''}`}>
                  {hasException && <span className="text-[9px] text-amber-300 font-sans shrink-0">⚡</span>}
                  <span className="truncate">{subjectDisplay}</span>
                </span>
                {/* Attendance Corner Badges */}
                {isCompleted && (
                  <span
                    className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[7px] font-black shadow-xs ring-1 ring-white/70"
                    title="Presensi sudah dicatat"
                  >
                    ✓
                  </span>
                )}
                {isCancelled && (
                  <span
                    className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-rose-600 text-white flex items-center justify-center text-[7px] font-black shadow-xs ring-1 ring-white/70"
                    title="Sesi dibatalkan"
                  >
                    ✕
                  </span>
                )}
                {isDraft && (
                  <span
                    className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse ring-1 ring-white"
                    title="Perubahan draft belum disimpan"
                  />
                )}
              </button>
            );
          }

          // 4. NORMAL (count <= 2): Full chip with subject name AND teacher name subtitle
          return (
            <button
              key={block.id || idx}
              type="button"
              title={`${tooltip}${isCompleted ? ' • Presensi Selesai' : isCancelled ? ' • Sesi Dibatalkan' : ''}${isDraft ? ' (Draft)' : ''}`}
              disabled={!interactive}
              onClick={() => interactive && onBlockClick && onBlockClick(idx, block)}
              style={{
                backgroundColor: isCancelled ? '#94A3B8' : blockColor,
                borderColor: isCancelled ? '#64748B' : borderColor
              }}
              className={`border-2 rounded-lg flex flex-col items-center justify-center font-medium text-white shadow-xs transition-all overflow-hidden h-10 px-1.5 py-1 relative ${
                interactive
                  ? 'cursor-pointer hover:scale-[1.03] hover:brightness-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400'
                  : 'cursor-default'
              } ${isCancelled ? 'opacity-65' : ''} ${isDraft ? 'ring-2 ring-amber-400' : ''}`}
            >
              <div className="w-full text-center flex flex-col items-center justify-center">
                <span className={`truncate leading-tight font-bold text-[11px] select-none flex items-center justify-center gap-1 max-w-full ${isCancelled ? 'line-through text-slate-200' : ''}`}>
                  {hasException && <span className="text-[9px] text-amber-300 font-sans shrink-0">⚡</span>}
                  <span className="truncate">{subjectName || subjectDisplay}</span>
                </span>
                {block.teacherName && (
                  <span className="text-[9px] font-sans opacity-90 truncate max-w-full leading-none mt-0.5">
                    {block.teacherName}
                  </span>
                )}
              </div>
              {/* Attendance Corner Badges */}
              {isCompleted && (
                <span
                  className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-black shadow-xs ring-1 ring-white/70"
                  title="Presensi sudah dicatat"
                >
                  ✓
                </span>
              )}
              {isCancelled && (
                <span
                  className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[8px] font-black shadow-xs ring-1 ring-white/70"
                  title="Sesi dibatalkan"
                >
                  ✕
                </span>
              )}
              {isDraft && (
                <span
                  className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse ring-1 ring-white"
                  title="Perubahan draft belum disimpan"
                />
              )}
            </button>
          );
        }

        // Hollow / Outlined block: free session represented as blank chip
        if (isUltraDense) {
          return (
            <button
              key={block.id || idx}
              type="button"
              title={tooltip}
              disabled={!interactive}
              onClick={() => interactive && onBlockClick && onBlockClick(idx, block)}
              className={`w-full h-8 sm:h-9 border border-dashed border-slate-300/80 bg-white/60 rounded-xs flex items-center justify-center transition-colors ${
                interactive
                  ? 'cursor-pointer hover:border-slate-400 hover:bg-slate-50 active:scale-95 focus:outline-none focus:ring-1 focus:ring-indigo-300'
                  : 'cursor-default'
              }`}
            >
              <span className="w-0.5 h-2 rounded-full bg-slate-200 block" />
            </button>
          );
        }

        if (isDense) {
          return (
            <button
              key={block.id || idx}
              type="button"
              title={tooltip}
              disabled={!interactive}
              onClick={() => interactive && onBlockClick && onBlockClick(idx, block)}
              className={`w-full aspect-square max-h-7 border border-dashed border-slate-300/90 bg-white/70 rounded-md flex items-center justify-center text-slate-300 transition-colors ${
                interactive
                  ? 'cursor-pointer hover:border-slate-400 hover:bg-slate-50 active:scale-95 focus:outline-none focus:ring-1 focus:ring-indigo-300'
                  : 'cursor-default'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-200 block" />
            </button>
          );
        }

        if (isMinimal) {
          return (
            <button
              key={block.id || idx}
              type="button"
              title={tooltip}
              disabled={!interactive}
              onClick={() => interactive && onBlockClick && onBlockClick(idx, block)}
              className={`w-full h-8 sm:h-9 border border-dashed border-slate-300/80 bg-white/70 rounded-lg flex items-center justify-center text-slate-300 transition-colors ${
                interactive
                  ? 'cursor-pointer hover:border-slate-400 hover:bg-slate-50 active:scale-95 focus:outline-none focus:ring-1 focus:ring-indigo-300'
                  : 'cursor-default'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-200 block" />
            </button>
          );
        }

        return (
          <button
            key={block.id || idx}
            type="button"
            title={tooltip}
            disabled={!interactive}
            onClick={() => interactive && onBlockClick && onBlockClick(idx, block)}
            className={`border border-dashed border-slate-300/80 bg-white/70 rounded-lg flex items-center justify-center text-slate-300 transition-colors overflow-hidden h-10 px-1.5 py-1 ${
              interactive
                ? 'cursor-pointer hover:border-slate-400 hover:bg-slate-50/80 active:scale-95 focus:outline-none focus:ring-1 focus:ring-indigo-300'
                : 'cursor-default'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-200/90 block" />
          </button>
        );
      })}
    </div>
  );
};
