import { Period, ScheduleRule } from '../types';

export interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Normalizes an array of date ranges:
 * 1. Filters out invalid/reversed ranges.
 * 2. Sorts ranges by startDate ascending.
 * 3. Merges any overlapping or strictly adjacent ranges into disjoint intervals.
 */
export function normalizeDateRanges(ranges: DateRange[]): DateRange[] {
  if (!ranges || ranges.length === 0) return [];

  const valid = ranges
    .filter((r) => r && r.startDate && r.endDate && r.startDate <= r.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (valid.length <= 1) return valid;

  const merged: DateRange[] = [{ startDate: valid[0].startDate, endDate: valid[0].endDate }];

  for (let i = 1; i < valid.length; i++) {
    const current = valid[i];
    const prev = merged[merged.length - 1];

    // If current starts on or before prev.endDate -> Overlapping
    if (current.startDate <= prev.endDate) {
      if (current.endDate > prev.endDate) {
        prev.endDate = current.endDate;
      }
    } else {
      // Check if consecutive day (e.g. prev ends 2026-09-30 and current starts 2026-10-01)
      const nextDay = new Date(prev.endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().slice(0, 10);

      if (current.startDate <= nextDayStr) {
        if (current.endDate > prev.endDate) {
          prev.endDate = current.endDate;
        }
      } else {
        merged.push({ startDate: current.startDate, endDate: current.endDate });
      }
    }
  }

  return merged;
}

/**
 * Resolves a rule's selected period presets into normalized, disjoint date ranges.
 * If periods overlap, their dates are seamlessly merged so calculations never duplicate sessions.
 */
export function getNormalizedDateRangesForRule(
  rule: ScheduleRule,
  periods: Period[]
): DateRange[] {
  const periodMap = new Map((periods || []).map((p) => [p.id, p]));
  const rawPids: string[] = rule.periodIds || (rule as any).period_ids || [];

  const selectedPeriods = rawPids
    .map((pid) => periodMap.get(pid))
    .filter((p): p is Period => Boolean(p && (p.startDate || p.start_date) && (p.endDate || p.end_date)));

  if (selectedPeriods.length > 0) {
    const ranges: DateRange[] = selectedPeriods.map((p) => ({
      startDate: p.startDate || p.start_date || '',
      endDate: p.endDate || p.end_date || ''
    }));
    return normalizeDateRanges(ranges);
  }

  // Fallback: If no periods selected on rule, default to global span of available periods
  if (periods && periods.length > 0) {
    const valid = periods.filter((p) => (p.startDate || p.start_date) && (p.endDate || p.end_date));
    if (valid.length > 0) {
      const allStarts = valid.map((p) => p.startDate || p.start_date || '').sort();
      const allEnds = valid.map((p) => p.endDate || p.end_date || '').sort();
      return [{ startDate: allStarts[0], endDate: allEnds[allEnds.length - 1] }];
    }
  }

  return [];
}

/**
 * Checks whether two sets of normalized date ranges overlap in time.
 * Returns true and the intersection range if they collide.
 */
export function checkDateRangesOverlap(
  rangesA: DateRange[],
  rangesB: DateRange[]
): { overlap: boolean; overlapRange?: DateRange } {
  if (!rangesA || rangesA.length === 0 || !rangesB || rangesB.length === 0) {
    return { overlap: false };
  }

  for (const a of rangesA) {
    for (const b of rangesB) {
      const maxStart = a.startDate > b.startDate ? a.startDate : b.startDate;
      const minEnd = a.endDate < b.endDate ? a.endDate : b.endDate;
      if (maxStart <= minEnd) {
        return {
          overlap: true,
          overlapRange: { startDate: maxStart, endDate: minEnd }
        };
      }
    }
  }

  return { overlap: false };
}

/**
 * Checks whether a given set of date ranges intersects a target [targetStart, targetEnd]
 */
export function doesIntersectRange(
  ranges: DateRange[],
  targetStart: string,
  targetEnd: string
): boolean {
  if (!ranges || ranges.length === 0) return true;
  return ranges.some((r) => !(r.endDate < targetStart || r.startDate > targetEnd));
}

/**
 * Checks if a specific date (YYYY-MM-DD) falls within any of the date ranges.
 */
export function isDateInRanges(dateStr: string, ranges: DateRange[]): boolean {
  if (!ranges || ranges.length === 0) return true;
  return ranges.some((r) => dateStr >= r.startDate && dateStr <= r.endDate);
}

/**
 * Formats a list of DateRanges into a human-readable string.
 * e.g. "01 Sep 2026 - 31 Okt 2026"
 */
export function formatDateRangesSummary(ranges: DateRange[]): string {
  if (!ranges || ranges.length === 0) return 'Semua Tanggal';
  return ranges
    .map((r) => `${r.startDate} s/d ${r.endDate}`)
    .join(', ');
}
