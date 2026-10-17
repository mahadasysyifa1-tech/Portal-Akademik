import { useCallback, useEffect, useMemo, useState } from 'react';

export function useMonthMeetings(year: number, month1: number) {
  const [monthMeetings, setMonthMeetings] = useState<any[]>([]);
  const [monthSummary, setMonthSummary] = useState<Record<string, any>>({});
  const [version, setVersion] = useState(0);

  const refetch = useCallback(() => setVersion((v) => v + 1), []);

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
  }, [year, month1, version]);

  // Refresh after App finishes a batch save
  useEffect(() => {
    window.addEventListener('attendance:saved', refetch);
    return () => window.removeEventListener('attendance:saved', refetch);
  }, [refetch]);

  // Pick up changes from other devices: on tab focus, and every 60 seconds
  useEffect(() => {
    const onFocus = () => refetch();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refetch();
    }, 60_000);
      window.addEventListener('focus', onFocus);
      return () => {
        clearInterval(timer);
        window.removeEventListener('focus', onFocus);
      };
  }, [refetch]);

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

  return { monthMeetingsMap, monthSummary, refetch };
}
