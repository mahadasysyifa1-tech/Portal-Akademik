import type { DayOfWeek, KaldikEvent, Period } from '../types';

export interface EventFilters {
  selectedPeriodFilter: string;
  eventTypeFilter: string;
}

function passesTypeFilter(evt: KaldikEvent, filter: string): boolean {
  switch (filter) {
    case 'kbm':
      return Boolean(evt.isKbm);
    case 'holiday':
      return evt.type === 'holiday';
    case 'exam':
      return evt.type === 'exam';
    case 'activity':
      return evt.type === 'activity';
    default:
      return true;
  }
}

/**
 * KBM events take their date range live from the linked period, so edits to a period
 * propagate to the calendar without touching the event record.
 */
function resolveEventRange(
  evt: KaldikEvent,
  periods: Period[],
  defaultEndToStart: boolean
): { start: string; end: string } {
  let start = evt.startDate;
  let end = defaultEndToStart ? evt.endDate || evt.startDate : evt.endDate;

  if (evt.isKbm) {
    const livePeriod = evt.periodId ? periods.find((p) => p.id === evt.periodId) : undefined;
    if (livePeriod) {
      start = livePeriod.startDate;
      end = livePeriod.endDate;
    }
  }

  return { start, end };
}

/** True when the event should appear on the given calendar date under the active filters. */
export function eventOccursOn(
  evt: KaldikEvent,
  dateStr: string,
  dayOfWeek: DayOfWeek,
  periods: Period[],
  filters: EventFilters
): boolean {
  if (!passesTypeFilter(evt, filters.eventTypeFilter)) return false;

  if (
    filters.selectedPeriodFilter !== 'all' &&
    evt.periodId &&
    evt.periodId !== filters.selectedPeriodFilter
  ) {
    return false;
  }

  if (evt.isRecurring) {
    if (!evt.daysOfWeek || !evt.daysOfWeek.includes(dayOfWeek)) return false;
    const { start, end } = resolveEventRange(evt, periods, false);
    if (start && dateStr < start) return false;
    if (end && dateStr > end) return false;
    return true;
  }

  const { start, end } = resolveEventRange(evt, periods, true);
  return dateStr >= start && dateStr <= end;
}
