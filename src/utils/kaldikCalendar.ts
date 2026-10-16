import type { DayOfWeek, KaldikEvent, Period, ResolvedSlot } from '../types';
import { isDateInRanges } from './dateNormalizer';
import { eventOccursOn, type EventFilters } from './kaldikEventFilter';

export const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const INDONESIAN_DAYS = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Monday-first column headers
export const WEEKDAY_COLUMNS: { name: string; isWeekend?: boolean }[] = [
  { name: 'Senin' },
  { name: 'Selasa' },
  { name: 'Rabu' },
  { name: 'Kamis' },
  { name: 'Jumat' },
  { name: 'Sabtu', isWeekend: true },
  { name: 'Ahad', isWeekend: true }
];

const DAY_NAME_MAP: Record<number, DayOfWeek> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

export interface CalendarDay {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfWeek: DayOfWeek;
  activePeriods: Period[];
  events: KaldikEvent[];
  classSlots: ResolvedSlot[];
}

export interface MonthlyStats {
  kbmDaysCount: number;
  holidayCount: number;
  totalSessions: number;
}

export interface BuildCalendarParams {
  year: number;
  month: number; // 0-11
  periods: Period[];
  events: KaldikEvent[];
  slots: ResolvedSlot[];
  filters: EventFilters;
  todayStr: string;
}

/** YYYY-MM-DD from a 0-based month. */
export function toDateKey(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function dayOfWeekOf(dateStr: string): DayOfWeek {
  return DAY_NAME_MAP[new Date(dateStr + 'T00:00:00').getDay()];
}

export function getMonthBounds(year: number, month0: number) {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  return {
    startStr: toDateKey(year, month0, 1),
    endStr: toDateKey(year, month0, daysInMonth),
    daysInMonth
  };
}

function makeFillerDay(dateStr: string, dayNumber: number, todayStr: string): CalendarDay {
  return {
    dateStr,
    dayNumber,
    isCurrentMonth: false,
    isToday: dateStr === todayStr,
    dayOfWeek: dayOfWeekOf(dateStr),
    activePeriods: [],
    events: [],
    classSlots: []
  };
}

/**
 * Class slots for one date. Respects the period filter, per-rule date ranges,
 * and removes duplicate rule ids on the same day.
 */
function slotsForDate(
  dateStr: string,
  dayOfWeek: DayOfWeek,
  slots: ResolvedSlot[],
  targetPeriod: Period | undefined
): ResolvedSlot[] {
  const isDateInFilter =
    !targetPeriod ||
    !targetPeriod.startDate ||
    !targetPeriod.endDate ||
    (dateStr >= targetPeriod.startDate && dateStr <= targetPeriod.endDate);
  if (!isDateInFilter) return [];

  const matching = slots.filter((slot) => {
    if (slot.day !== dayOfWeek) return false;
    if (slot.dateRanges && slot.dateRanges.length > 0) {
      return isDateInRanges(dateStr, slot.dateRanges);
    }
    return true;
  });

  const seenRuleIds = new Set<string>();
  return matching.filter((slot) => {
    if (!slot.ruleId) return true;
    if (seenRuleIds.has(slot.ruleId)) return false;
    seenRuleIds.add(slot.ruleId);
    return true;
  });
}

/** Builds a 35- or 42-cell Monday-first grid including leading and trailing filler days. */
export function buildCalendarDays(params: BuildCalendarParams): CalendarDay[] {
  const { year, month, periods, events, slots, filters, todayStr } = params;
  const { daysInMonth } = getMonthBounds(year, month);
  const days: CalendarDay[] = [];

  // Leading filler: previous month tail, Monday-first
  const firstDow = new Date(year, month, 1).getDay();
  const leadDays = firstDow === 0 ? 6 : firstDow - 1;
  const prevMonthEnd = new Date(year, month, 0);
  for (let i = leadDays - 1; i >= 0; i--) {
    const pDay = prevMonthEnd.getDate() - i;
    const dateStr = toDateKey(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), pDay);
    days.push(makeFillerDay(dateStr, pDay, todayStr));
  }

  // Current month
  const targetPeriod =
    filters.selectedPeriodFilter !== 'all'
      ? periods.find((p) => p.id === filters.selectedPeriodFilter)
      : undefined;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateKey(year, month, d);
    const dayOfWeek = dayOfWeekOf(dateStr);

    days.push({
      dateStr,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      dayOfWeek,
      activePeriods: periods.filter((p) => dateStr >= p.startDate && dateStr <= p.endDate),
      events: events.filter((evt) => eventOccursOn(evt, dateStr, dayOfWeek, periods, filters)),
      classSlots: slotsForDate(dateStr, dayOfWeek, slots, targetPeriod)
    });
  }

  // Trailing filler: fill to 35 cells, or 42 when the month needs six rows
  const target = days.length <= 35 ? 35 : 42;
  const nextMonthStart = new Date(year, month + 1, 1);
  for (let n = 1; days.length < target; n++) {
    const dateStr = toDateKey(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), n);
    days.push(makeFillerDay(dateStr, n, todayStr));
  }

  return days;
}

export function computeMonthlyStats(days: CalendarDay[]): MonthlyStats {
  let kbmDaysCount = 0;
  let holidayCount = 0;
  let totalSessions = 0;

  for (const d of days) {
    if (!d.isCurrentMonth) continue;
    if (d.activePeriods.length > 0 || d.events.some((e) => e.isKbm)) kbmDaysCount++;
    if (d.events.some((e) => e.type === 'holiday')) holidayCount++;
    totalSessions += d.classSlots.length;
  }

  return { kbmDaysCount, holidayCount, totalSessions };
}
