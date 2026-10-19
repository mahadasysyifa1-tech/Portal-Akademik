import React from 'react';
import { ClassIcon } from '../ClassIcon';

export interface FixedBlockState {
  id: string;
  meetingId?: string;
  label: string;
  isFilled?: boolean;
  occupied?: boolean;
  color?: string;
  teacherColor?: string;
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

// Corner badge. Each badge has a larger clickable area than what you see:
// the ::before pseudo-element extends the hit area by 6px on every side.
const BADGE_BASE =
"absolute -top-2 -right-2 w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-black shadow-sm ring-2 ring-white z-20 before:content-[''] before:absolute before:-inset-1.5 before:rounded-full";

          const SessionBadge: React.FC<{
            block: FixedBlockState;
            onClick?: (block: FixedBlockState) => void;
          }> = ({ block, onClick }) => {
            const isCompleted = block.attendanceStatus === 'completed';
            const isCancelled = block.attendanceStatus === 'cancelled';
            const isDraft = Boolean(block.isDraft);

            // Check badge: record saved, no draft, no action
            if (isCompleted && !isDraft) {
              return (
                <span title="Presensi sudah dicatat" className={`${BADGE_BASE} bg-emerald-600`}>
                ✓
                </span>
              );
            }

            // Draft badge takes priority: click discards the draft
            // Otherwise: cancelled -> restore, scheduled -> cancel
            const config = isDraft
            ? { cls: 'bg-amber-400 animate-pulse', text: '•', title: 'Draft belum disimpan. Klik untuk membuang.' }
            : isCancelled
            ? { cls: 'bg-slate-500 hover:bg-slate-600', text: '↺', title: 'Pulihkan sesi' }
            : { cls: 'bg-rose-600 hover:bg-rose-700', text: '✕', title: 'Batalkan sesi' };

            const handle = (e: React.SyntheticEvent) => {
              e.stopPropagation();
              onClick?.(block);
            };
            const handleKey = (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onClick?.(block);
              }
            };

            return (
              <span
              role="button"
              tabIndex={0}
              title={config.title}
              onClick={handle}
              onKeyDown={handleKey}
              className={`${BADGE_BASE} ${config.cls} cursor-pointer transition-transform hover:scale-110`}
              >
              {config.text}
              </span>
            );
          };

          interface FixedBlockSubGridProps {
            count: number;
            getStateFn: (index: number) => FixedBlockState;
            onBlockClick?: (index: number, state: FixedBlockState) => void;
            onBadgeClick?: (state: FixedBlockState) => void;
            interactive?: boolean;
          }

          export const FixedBlockSubGrid: React.FC<FixedBlockSubGridProps> = ({
            count,
            getStateFn,
            onBlockClick,
            onBadgeClick,
            interactive = false
          }) => {
            const blocks = Array.from({ length: count }, (_, i) => getStateFn(i));
            const isUltraDense = count > 10;
            const isDense = count > 5;
            const isMinimal = count > 2;
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

                  // Chip colour follows the session state: completed green, cancelled grey, otherwise subject colour
                  const chipBg = isCompleted ? '#10B981' : isCancelled ? '#94A3B8' : blockColor;
                  const chipBorder = isCompleted ? '#047857' : isCancelled ? '#64748B' : borderColor;
                  const chipStyle = { backgroundColor: chipBg, borderColor: chipBorder };

                  const title = `${tooltip}${isCompleted ? ' • Presensi Selesai' : isCancelled ? ' • Sesi Dibatalkan' : ''}${isDraft ? ' (Draft)' : ''}`;
                  const onChip = () => interactive && onBlockClick && onBlockClick(idx, block);
                  const draftRing = isDraft ? 'ring-2 ring-amber-400' : '';
                  // hover:z-10 lifts the hovered chip above its neighbours so its badge is clickable
                  const hoverLift = 'relative hover:z-10';
                  const badge = <SessionBadge block={block} onClick={onBadgeClick} />;

                  if (isUltraDense) {
                    return (
                      <button
                      key={block.id || idx}
                      type="button"
                      title={title}
                      disabled={!interactive}
                      onClick={onChip}
                      style={chipStyle}
                      className={`w-full h-8 sm:h-9 border-2 rounded-xs shadow-2xs transition-all ${hoverLift} ${
                        interactive
                        ? 'cursor-pointer hover:scale-110 hover:brightness-110 active:scale-95 focus:outline-none focus:ring-1 focus:ring-indigo-400'
                        : 'cursor-default'
                      } ${draftRing}`}
                      >
                      {hasException && (
                        <span className="w-1 h-1 rounded-full bg-amber-300 block mx-auto mt-0.5 shadow-xs" />
                      )}
                      {badge}
                      </button>
                    );
                  }

                  if (isDense) {
                    return (
                      <button
                      key={block.id || idx}
                      type="button"
                      title={title}
                      disabled={!interactive}
                      onClick={onChip}
                      style={chipStyle}
                      className={`w-full aspect-square max-h-7 border-2 rounded-md shadow-2xs transition-all flex items-center justify-center ${hoverLift} ${
                        interactive
                        ? 'cursor-pointer hover:scale-110 hover:brightness-110 active:scale-95 focus:outline-none focus:ring-1 focus:ring-indigo-400'
                        : 'cursor-default'
                      } ${draftRing}`}
                      >
                      {hasException && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-300 block shadow-xs" />
                      )}
                      {badge}
                      </button>
                    );
                  }

                  const subjectDisplay = subjectCode || subjectName || 'Mapel';

              if (isMinimal) {
                return (
                  <button
                  key={block.id || idx}
                  type="button"
                  title={title}
                  disabled={!interactive}
                  onClick={onChip}
                  style={chipStyle}
                  className={`w-full h-8 sm:h-9 border-2 rounded-lg flex items-center justify-center font-medium text-white shadow-xs transition-all px-1 ${hoverLift} ${
                    interactive
                    ? 'cursor-pointer hover:scale-[1.03] hover:brightness-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400'
                    : 'cursor-default'
                  } ${draftRing}`}
                  >
                  <span
                  className={`truncate leading-tight font-bold text-[10px] sm:text-[11px] select-none flex items-center justify-center gap-0.5 max-w-full ${
                    isCancelled ? 'line-through text-slate-200' : ''
                  }`}
                  >
                  {hasException && <span className="text-[9px] text-amber-300 font-sans shrink-0">⚡</span>}
                  <span className="truncate">{subjectDisplay}</span>
                  </span>
                  {badge}
                  </button>
                );
              }

              return (
                <button
                key={block.id || idx}
                type="button"
                title={title}
                disabled={!interactive}
                onClick={onChip}
                style={chipStyle}
                className={`border-2 rounded-lg flex flex-col items-center justify-center font-medium text-white shadow-xs transition-all h-10 px-1.5 py-1 ${hoverLift} ${
                  interactive
                  ? 'cursor-pointer hover:scale-[1.03] hover:brightness-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400'
                  : 'cursor-default'
                } ${draftRing}`}
                >
                <div className="w-full text-center flex flex-col items-center justify-center">
                <span
                className={`truncate leading-tight font-bold text-[11px] select-none flex items-center justify-center gap-1 max-w-full ${
                  isCancelled ? 'line-through text-slate-200' : ''
                }`}
                >
                {hasException && <span className="text-[9px] text-amber-300 font-sans shrink-0">⚡</span>}
                <span className="truncate">{subjectName || subjectDisplay}</span>
                </span>
                {block.teacherName && (
                  <span className="text-[9px] font-sans opacity-90 truncate max-w-full leading-none mt-0.5">
                  {block.teacherName}
                  </span>
                )}
                </div>
                {badge}
                </button>
              );
                }

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
