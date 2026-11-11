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

type Density = 'ultra' | 'dense' | 'minimal' | 'normal';

const getDensity = (count: number): Density =>
  count > 10 ? 'ultra' : count > 5 ? 'dense' : count > 2 ? 'minimal' : 'normal';

const getColCount = (count: number, density: Density) =>
  density === 'ultra' ? Math.min(count, 20) : Math.max(1, count);

// Shared container padding/gap. Header and sub-grid both use this so columns line up.
const GRID_GAP: Record<Density, string> = {
  ultra: 'p-0.5 gap-0.5 lg:p-1 lg:gap-1',
  dense: 'p-1 gap-1 lg:p-1.5 lg:gap-2',
  minimal: 'p-1 gap-1 lg:p-1.5 lg:gap-2',
  normal: 'p-1 gap-1.5 lg:p-2 lg:gap-3',
};

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

const HEADER_CELL: Record<Density, string> = {
  ultra: 'min-h-[20px] h-5 p-0.5 text-[9px] lg:h-6 lg:text-[10px]',
  dense: 'min-h-[24px] h-6 px-1 py-0.5 text-[10px] lg:h-7 lg:text-xs',
  minimal: 'min-h-[24px] h-6 px-1 py-0.5 text-[10px] lg:h-7 lg:text-xs',
  normal: 'min-h-[28px] h-7 px-1.5 py-0.5 text-[11px] lg:h-9 lg:text-sm',
};

const HEADER_ICON: Record<Density, string> = {
  ultra: 'w-2.5 h-2.5 text-slate-600 shrink-0 lg:w-3 lg:h-3',
  dense: 'w-3.5 h-3.5 text-slate-600 shrink-0 lg:w-4 lg:h-4',
  minimal: 'w-3.5 h-3.5 text-slate-600 shrink-0 lg:w-4 lg:h-4',
  normal: 'w-3.5 h-3.5 text-slate-600 shrink-0 lg:w-4 lg:h-4',
};

interface FixedBlockHeaderGridProps {
  classes: FixedBlockHeaderClass[];
}

export const FixedBlockHeaderGrid: React.FC<FixedBlockHeaderGridProps> = ({ classes }) => {
  const density = getDensity(classes.length);
  const colCount = getColCount(classes.length, density);
  const showLabel = density === 'minimal' || density === 'normal';

  return (
    <div
      className={`w-full rounded-xl bg-slate-100/90 border border-slate-200/90 grid items-stretch ${GRID_GAP[density]}`}
      style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
    >
      {classes.map((cls, idx) => {
        const titleText = `${cls.name}${cls.grade ? ` (Tingkat ${cls.grade})` : ''}`;
        return (
          <div
            key={cls.id || idx}
            title={titleText}
            className={`rounded-lg bg-white border border-slate-200/90 text-slate-700 flex items-center justify-center shadow-2xs font-semibold overflow-hidden select-none transition-all ${HEADER_CELL[density]}`}
          >
            <ClassIcon name={cls.icon} className={HEADER_ICON[density]} />
            {showLabel && (
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

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

// Clickable badge: a circle with a hit area larger than what's drawn.
const ACTION_BADGE =
  "absolute -top-2 -right-2 w-5 h-5 lg:w-6 lg:h-6 lg:text-xs rounded-full text-white flex items-center justify-center text-[10px] font-black shadow-sm ring-2 ring-white z-20 cursor-pointer transition-transform hover:scale-110 before:content-[''] before:absolute before:-inset-1.5 before:rounded-full";

// Check badge: display only, no circle, no action.
const CHECK_BADGE =
  'absolute -top-3.5 -right-2 lg:-top-7 lg:-right-3 z-20 text-emerald-500 text-[16px] lg:text-[30px] font-black leading-none drop-shadow-2xl pointer-events-none';  
interface SessionBadgeProps {
  block: FixedBlockState;
  canAct: boolean;
  onClick?: (block: FixedBlockState) => void;
}

const SessionBadge: React.FC<SessionBadgeProps> = ({ block, canAct, onClick }) => {
  const isCompleted = block.attendanceStatus === 'completed';
  const isCancelled = block.attendanceStatus === 'cancelled';
  const isDraft = Boolean(block.isDraft);

  // Drafts and actions are for admins only
  if (isDraft) {
    if (!canAct) return null;
    return (
      <ActionBadge
        block={block}
        onClick={onClick}
        className="bg-amber-400 animate-pulse"
        title="Draft belum disimpan. Klik untuk membuang."
        text="•"
      />
    );
  }

  if (isCompleted) {
    return (
      <span title="Presensi sudah dicatat" className={CHECK_BADGE}>
        ✓
      </span>
    );
  }

  if (!canAct) return null;

  return isCancelled ? (
    <ActionBadge
      block={block}
      onClick={onClick}
      className="bg-slate-500 hover:bg-slate-600"
      title="Pulihkan sesi"
      text="↺"
    />
  ) : (
    <ActionBadge
      block={block}
      onClick={onClick}
      className="bg-rose-600 hover:bg-rose-700"
      title="Batalkan sesi"
      text="✕"
    />
  );
};

const ActionBadge: React.FC<{
  block: FixedBlockState;
  onClick?: (block: FixedBlockState) => void;
  className: string;
  title: string;
  text: string;
}> = ({ block, onClick, className, title, text }) => {
  const handle = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
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
      title={title}
      onClick={handle}
      onKeyDown={handleKey}
      className={`${ACTION_BADGE} ${className}`}
    >
      {text}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Sub-grid sizing (phone first, larger screens via lg: prefix)
// ---------------------------------------------------------------------------

// Used by both filled and empty blocks so they always match in size.
const CHIP_SIZE: Record<Density, string> = {
  ultra: 'w-full h-8 sm:h-9 lg:h-11 rounded-xs',
  dense: 'w-full aspect-square max-h-7 lg:max-h-12 rounded-md',
  minimal: 'w-full h-8 sm:h-9 lg:h-11 rounded-lg',
  normal: 'w-full h-10 lg:h-14 rounded-lg',
};

const CHIP_LAYOUT: Record<Density, string> = {
  ultra: 'flex items-center justify-center',
  dense: 'flex items-center justify-center',
  minimal: 'flex items-center justify-center px-1',
  normal: 'flex flex-col items-center justify-center px-1.5 py-1',
};

// Font size per density. Set here only, so visibility classes don't conflict.
const LABEL_TEXT: Record<Density, string> = {
  ultra: 'text-[8px] lg:text-[10px]',
  dense: 'text-[9px] lg:text-[11px]',
  minimal: 'text-[10px] sm:text-[11px] lg:text-xs',
  normal: 'text-[11px] lg:text-sm',
};

const TEACHER_TEXT =
  'text-[9px] lg:text-[11px] font-sans opacity-90 truncate max-w-full leading-none mt-0.5';

// Exception dot for tiny chips (ultra/dense), where text can't fit
const EXCEPTION_DOT =
  'w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full bg-amber-300 block shadow-xs shrink-0';

// Dot inside empty blocks
const EMPTY_DOT: Record<Density, string> = {
  ultra: 'w-0.5 h-2 rounded-full bg-slate-200 block',
  dense: 'w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-slate-200 block',
  minimal: 'w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-slate-200 block',
  normal: 'w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-slate-200 block',
};

const EMPTY_BASE =
  'border border-dashed border-slate-300/80 bg-white/70 flex items-center justify-center transition-colors overflow-hidden';
const EMPTY_INTERACTIVE =
  'cursor-pointer hover:border-slate-400 hover:bg-slate-50 active:scale-95 focus:outline-none focus:ring-1 focus:ring-indigo-300';

// ---------------------------------------------------------------------------
// Chip label: picks the text level from the chip's own width (container queries)
// Widths below are starting guesses. Tune them against your screens.
//   >= 7rem   subject + teacher
//   >= 4.5rem subject only
//   >= 2rem   code only
//   smaller   nothing, just the color and the exception mark
// ---------------------------------------------------------------------------

interface ChipLabelProps {
  subject: string;
  code: string;
  teacher?: string;
  density: Density;
  cancelled: boolean;
  exception: boolean;
}

const ChipLabel: React.FC<ChipLabelProps> = ({
  subject,
  code,
  teacher,
  density,
  cancelled,
  exception,
}) => {
  const textClass = `${LABEL_TEXT[density]} truncate leading-tight font-bold select-none ${
    cancelled ? 'line-through text-slate-200' : ''
  }`;

  // Tiny chips get a dot, larger chips get a bolt. The mark always renders,
  // so it stays visible even when no text fits.
  const isTiny = density === 'ultra' || density === 'dense';
  const exceptionMark = exception ? (
    isTiny ? (
      <span className={EXCEPTION_DOT} />
    ) : (
      <span className="text-[9px] lg:text-[11px] text-amber-300 font-sans shrink-0">⚡</span>
    )
  ) : null;

  return (
    // @container makes this element the reference for the @[...] checks below
    <span className="@container block w-full h-full min-w-0">
      <span className="flex h-full w-full items-center justify-center gap-0.5 overflow-hidden">
        {exceptionMark}

        {/* Level 1: subject + teacher (widest) */}
        <span className="hidden @[7rem]:flex flex-col items-center min-w-0 max-w-full">
          <span className={`${textClass} w-full text-center`}>{subject}</span>
          {teacher && <span className={TEACHER_TEXT}>{teacher}</span>}
        </span>

        {/* Level 2: subject only */}
        <span className={`hidden @[4.5rem]:block @[7rem]:hidden max-w-full ${textClass}`}>
          {subject}
        </span>

        {/* Level 3: code only */}
        <span className={`hidden @[2rem]:block @[4.5rem]:hidden max-w-full ${textClass}`}>
          {code}
        </span>

        {/* Below @[2rem]: no text, only the color and the exception mark remain */}
      </span>
    </span>
  );
};

// ---------------------------------------------------------------------------
// Sub-grid
// ---------------------------------------------------------------------------

interface FixedBlockSubGridProps {
  count: number;
  getStateFn: (index: number) => FixedBlockState;
  onBlockClick?: (index: number, state: FixedBlockState) => void;
  onBadgeClick?: (state: FixedBlockState) => void;
  interactive?: boolean;
  // Badges are shown only where the caller opts in (Jurnal mode in KaldikView)
  showBadges?: boolean;
  // Clickable badges additionally require admin
  isAdmin?: boolean;
}

export const FixedBlockSubGrid: React.FC<FixedBlockSubGridProps> = ({
  count,
  getStateFn,
  onBlockClick,
  onBadgeClick,
  interactive = false,
  showBadges = false,
  isAdmin = false,
}) => {
  const blocks = Array.from({ length: count }, (_, i) => getStateFn(i));
  const density = getDensity(count);
  const colCount = getColCount(count, density);

  return (
    <div
      className={`w-full h-full min-h-[36px] rounded-xl bg-slate-50/60 border border-slate-200/80 grid items-stretch ${GRID_GAP[density]}`}
      style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
    >
      {blocks.map((block, idx) => {
        const key = block.id || idx;
        const onActivate = () => interactive && onBlockClick && onBlockClick(idx, block);

        // ---- Empty block ----
        const filled = Boolean(block.isFilled ?? block.occupied);
        if (!filled) {
          return (
            <button
              key={key}
              type="button"
              title={block.tooltip}
              disabled={!interactive}
              onClick={onActivate}
              className={`${CHIP_SIZE[density]} ${EMPTY_BASE} ${
                interactive ? EMPTY_INTERACTIVE : 'cursor-default'
              }`}
            >
              <span className={EMPTY_DOT[density]} />
            </button>
          );
        }

        // ---- Filled block ----
        const { color, teacherColor, tooltip, hasException, subjectName, subjectCode } = block;
        const blockColor = color || '#4F46E5';
        const borderColor = teacherColor || blockColor;

        const isCancelled = block.attendanceStatus === 'cancelled';
        const isCompleted = block.attendanceStatus === 'completed';
        const isDraft = Boolean(block.isDraft);

        // Completed keeps its subject colour. Only cancelled turns grey.
        const chipBg = isCancelled ? '#94A3B8' : blockColor;
        const chipBorder = isCancelled ? '#64748B' : borderColor;

        // Scheduled: 60% opaque background and border. Text and badge stay fully opaque.
        const isScheduled = block.attendanceStatus === 'scheduled';
        const fade = (c: string) => `color-mix(in srgb, ${c} 40%, transparent)`;
        const chipStyle = {
          backgroundColor: isScheduled ? fade(chipBg) : chipBg,
          borderColor: isScheduled ? fade(chipBorder) : chipBorder,
        };
        const title = `${tooltip}${isCompleted ? ' • Presensi Selesai' : ''}${
          isCancelled ? ' • Sesi Dibatalkan' : ''
        }${isDraft ? ' (Draft)' : ''}`;
        const draftRing = isDraft ? 'ring-2 ring-amber-400' : '';
        // No scale on hover for chips. Brightness only. The badge itself is what reacts.
        const chipHover = interactive ? 'cursor-pointer hover:brightness-110 active:scale-95' : 'cursor-default';
        const hoverLift = 'relative hover:z-10';

        const badge = showBadges ? (
          <SessionBadge block={block} canAct={isAdmin} onClick={onBadgeClick} />
        ) : null;

        const subjectDisplay = subjectCode || subjectName || 'Mapel';

        return (
          <button
            key={key}
            type="button"
            title={title}
            disabled={!interactive}
            onClick={onActivate}
            style={chipStyle}
            className={`${CHIP_SIZE[density]} ${CHIP_LAYOUT[density]} border-2 font-medium ${isScheduled ? 'text-slate-500' : 'text-white'} shadow-xs transition-all ${hoverLift} ${chipHover} ${draftRing}`}
          >
            <ChipLabel
              subject={subjectName || subjectDisplay}
              code={subjectCode || subjectDisplay}
              teacher={block.teacherName}
              density={density}
              cancelled={isCancelled}
              exception={Boolean(hasException)}
            />
            {badge}
          </button>
        );
      })}
    </div>
  );
};