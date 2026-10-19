import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadMonthRollCalls } from '../utils/rollCallCache';

export function useMonthMeetings(year: number, month1: number) {
  const [monthMeetings, setMonthMeetings] = useState<any[]>([]);
  const [version, setVersion] = useState(0);
  const refetch = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let isMounted = true;
    loadMonthRollCalls(year, month1).catch(() => {});
    fetch(`/api/attendance/month-meetings?year=${year}&month=${month1}`)
    .then((res) => (res.ok ? res.json() : []))
    .catch(() => [])
    .then((meetingsData) => {
      if (!isMounted) return;
      setMonthMeetings(Array.isArray(meetingsData) ? meetingsData : []);
    });
    return () => {
      isMounted = false;
    };
  }, [year, month1, version]);

  useEffect(() => {
    window.addEventListener('attendance:saved', refetch);
    return () => window.removeEventListener('attendance:saved', refetch);
  }, [refetch]);

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

  return { monthMeetingsMap, refetch };
}
