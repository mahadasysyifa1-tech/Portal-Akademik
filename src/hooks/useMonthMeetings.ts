import { useEffect, useMemo, useState } from 'react';

/**
 * Loads one month of attendance meetings and per-day summary counts.
 * @param month1 1-based month (1 = January)
 */
export function useMonthMeetings(year: number, month1: number) {
  const [monthMeetings, setMonthMeetings] = useState<any[]>([]);
  const [monthSummary, setMonthSummary] = useState<Record<string, any>>({});

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetch(`/api/attendance/month-meetings?year=${year}&month=${month1}`)
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => []),
      fetch(`/api/attendance/month-summary?year=${year}&month=${month1}`)
        .then((res) => (res.ok ? res.json() : {}))
        .catch(() => ({}))
    ]).then(([meetingsData, summaryData]) => {
      if (!isMounted) return;
      setMonthMeetings(Array.isArray(meetingsData) ? meetingsData : []);
      setMonthSummary(summaryData || {});
    });

    return () => {
      isMounted = false;
    };
  }, [year, month1]);

  // Index meetings by 'YYYY-MM-DD' for constant-time lookup per calendar cell
  const monthMeetingsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const m of monthMeetings) {
      const dateKey = m.meetingDate || m.meeting_date;
      if (!dateKey) continue;
      const list = map.get(dateKey) || [];
      list.push(m);
      map.set(dateKey, list);
    }
    return map;
  }, [monthMeetings]);

  return { monthMeetingsMap, monthSummary };
}
