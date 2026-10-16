import { Period } from '../types';

export interface KbmDateValidationResult {
  validStartDate: string;
  validEndDate: string;
  matchedPeriod: Period | null;
  wasAdjusted: boolean;
  message?: string;
}

/**
 * Validates manual inputs of dates for KBM (Kegiatan Belajar Mengajar).
 * If dates span outside valid period range, rejects invalid range and forces dates
 * to fit the closest valid period boundaries.
 */
export function validateAndFitKbmPeriodDates(
  inputStartDate: string,
  inputEndDate: string,
  selectedPeriodId: string | undefined,
  periods: Period[]
): KbmDateValidationResult {
  if (!periods || periods.length === 0) {
    return {
      validStartDate: inputStartDate,
      validEndDate: inputEndDate,
      matchedPeriod: null,
      wasAdjusted: false
    };
  }

  // Find targeted period: either by selectedPeriodId, or closest matching by start date
  let matchedPeriod: Period | undefined = periods.find((p) => p.id === selectedPeriodId);

  if (!matchedPeriod) {
    // Find period where inputStartDate falls within, or closest by start date distance
    matchedPeriod = periods.find(
      (p) => inputStartDate >= p.startDate && inputStartDate <= p.endDate
    );

    if (!matchedPeriod) {
      // Find closest period
      let minDiff = Infinity;
      let closest = periods[0];
      const targetTime = new Date(inputStartDate).getTime();
      for (const p of periods) {
        const pStartTime = new Date(p.startDate).getTime();
        const diff = Math.abs(targetTime - pStartTime);
        if (diff < minDiff) {
          minDiff = diff;
          closest = p;
        }
      }
      matchedPeriod = closest;
    }
  }

  let validStartDate = inputStartDate;
  let validEndDate = inputEndDate || inputStartDate;
  let wasAdjusted = false;
  const reasons: string[] = [];

  const periodStart = matchedPeriod.startDate;
  const periodEnd = matchedPeriod.endDate;

  // Rule 1: startDate cannot be before period.startDate
  if (validStartDate < periodStart) {
    validStartDate = periodStart;
    wasAdjusted = true;
    reasons.push(`Tanggal mulai tidak boleh mendahului awal periode (${periodStart})`);
  }

  // Rule 2: startDate cannot be after period.endDate
  if (validStartDate > periodEnd) {
    validStartDate = periodStart;
    wasAdjusted = true;
    reasons.push(`Tanggal mulai melampaui akhir periode (${periodEnd})`);
  }

  // Rule 3: endDate cannot exceed period.endDate
  if (validEndDate > periodEnd) {
    validEndDate = periodEnd;
    wasAdjusted = true;
    reasons.push(`Tanggal selesai dibatasi maksimal hingga akhir periode (${periodEnd})`);
  }

  // Rule 4: endDate cannot be before validStartDate
  if (validEndDate < validStartDate) {
    validEndDate = validStartDate > periodEnd ? periodEnd : validStartDate;
    wasAdjusted = true;
    reasons.push(`Tanggal selesai tidak boleh sebelum tanggal mulai`);
  }

  let message: string | undefined = undefined;
  if (wasAdjusted) {
    message = `Tanggal KBM disesuaikan otomatis agar berada di dalam rentang ${matchedPeriod.name} (${periodStart} s.d. ${periodEnd}). ${reasons.join('. ')}.`;
  }

  return {
    validStartDate,
    validEndDate,
    matchedPeriod,
    wasAdjusted,
    message
  };
}
