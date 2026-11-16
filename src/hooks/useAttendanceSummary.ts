import { useEffect, useState } from 'react';
import { AttendanceSummaryItem } from '../types';

export function useAttendanceSummary(
  type: 'teacher' | 'student' | null
): Record<string, AttendanceSummaryItem> {
  const [summaryMap, setSummaryMap] = useState<Record<string, AttendanceSummaryItem>>({});

  useEffect(() => {
    if (!type) {
      setSummaryMap({});
      return;
    }

    let isMounted = true;
    fetch(`/api/attendance/summary?type=${type}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data && typeof data === 'object') {
          setSummaryMap(data);
        }
      })
      .catch((err) => {
        console.error(`Failed to load ${type} attendance summary:`, err);
      });

    return () => {
      isMounted = false;
    };
  }, [type]);

  return summaryMap;
}
