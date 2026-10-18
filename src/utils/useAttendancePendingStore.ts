import { useState, useCallback, useMemo } from 'react';
import type { AttendanceStatus } from '../types';

export interface PendingStatusUpdate {
  meetingId: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface PendingRollCallLog {
  meetingId: string;
  teacherLog?: { id: string; status: AttendanceStatus; timestampStart?: string; note?: string };
  studentLogs?: Array<{
    studentId: string;
    status: AttendanceStatus;
    timestampStart?: string;
    timestampEnd?: string;
    note?: string;
  }>;
  meetingNotes?: string;
  materialProgress?: { materi?: string; hal?: number; unitId?: string };
}

export interface AttendancePendingStore {
  statusDrafts: Map<string, 'scheduled' | 'completed' | 'cancelled'>;
  rollCallDrafts: Map<string, PendingRollCallLog>;
  pendingCount: number;
  isDirty: boolean;
  setSessionStatusDraft: (meetingId: string, status: 'scheduled' | 'completed' | 'cancelled') => void;
  setRollCallDraft: (meetingId: string, payload: Omit<PendingRollCallLog, 'meetingId'>) => void;
  getEffectiveStatus: (
    meetingId: string,
    serverStatus?: 'scheduled' | 'completed' | 'cancelled'
  ) => 'scheduled' | 'completed' | 'cancelled';
  getRollCallDraft: (meetingId: string) => PendingRollCallLog | undefined;
  isMeetingDrafted: (meetingId: string) => boolean;
  clearDrafts: () => void;
  discardDraft: (meetingId: string) => void;
  flushBatchSave: () => Promise<{ success: boolean; updatedCount: number }>;
}

export function useAttendancePendingStore(): AttendancePendingStore {
  const [statusDrafts, setStatusDrafts] = useState<Map<string, 'scheduled' | 'completed' | 'cancelled'>>(
    () => new Map()
  );
  const [rollCallDrafts, setRollCallDrafts] = useState<Map<string, PendingRollCallLog>>(
    () => new Map()
  );

  const setSessionStatusDraft = useCallback(
    (meetingId: string, status: 'scheduled' | 'completed' | 'cancelled') => {
      setStatusDrafts((prev) => {
        const next = new Map(prev);
        next.set(meetingId, status);
        return next;
      });
    },
    []
  );

  const setRollCallDraft = useCallback(
    (meetingId: string, payload: Omit<PendingRollCallLog, 'meetingId'>) => {
      setRollCallDrafts((prev) => {
        const next = new Map(prev);
        next.set(meetingId, { meetingId, ...payload });
        return next;
      });
      // Also mark status as completed in statusDrafts
      setStatusDrafts((prev) => {
        const next = new Map(prev);
        next.set(meetingId, 'completed');
        return next;
      });
    },
    []
  );

  const getEffectiveStatus = useCallback(
    (
      meetingId: string,
      serverStatus: 'scheduled' | 'completed' | 'cancelled' = 'scheduled'
    ): 'scheduled' | 'completed' | 'cancelled' => {
      if (statusDrafts.has(meetingId)) {
        return statusDrafts.get(meetingId)!;
      }
      return serverStatus;
    },
    [statusDrafts]
  );

  const getRollCallDraft = useCallback(
    (meetingId: string): PendingRollCallLog | undefined => {
      return rollCallDrafts.get(meetingId);
    },
    [rollCallDrafts]
  );

  const isMeetingDrafted = useCallback(
    (meetingId: string): boolean => {
      return statusDrafts.has(meetingId) || rollCallDrafts.has(meetingId);
    },
    [statusDrafts, rollCallDrafts]
  );

  const clearDrafts = useCallback(() => {
    setStatusDrafts(new Map());
    setRollCallDrafts(new Map());
  }, []);

  const discardDraft = useCallback((meetingId: string) => {
    setStatusDrafts((prev) => {
      if (!prev.has(meetingId)) return prev;
      const next = new Map(prev);
      next.delete(meetingId);
      return next;
    });
    setRollCallDrafts((prev) => {
      if (!prev.has(meetingId)) return prev;
      const next = new Map(prev);
      next.delete(meetingId);
      return next;
    });
  }, []);

  const pendingCount = useMemo(() => {
    const keys = new Set([...statusDrafts.keys(), ...rollCallDrafts.keys()]);
    return keys.size;
  }, [statusDrafts, rollCallDrafts]);

  const isDirty = pendingCount > 0;

  const flushBatchSave = useCallback(async (): Promise<{ success: boolean; updatedCount: number }> => {
    if (pendingCount === 0) {
      return { success: true, updatedCount: 0 };
    }

    const statusUpdates: Array<{ meetingId: string; status: 'scheduled' | 'completed' | 'cancelled' }> = [];
    statusDrafts.forEach((status, meetingId) => {
      statusUpdates.push({ meetingId, status });
    });

    const rollCallLogs: PendingRollCallLog[] = [];
    rollCallDrafts.forEach((log) => {
      rollCallLogs.push(log);
    });

    const res = await fetch('/api/attendance/batch-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusUpdates, rollCallLogs }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'Failed to batch save attendance');
    }

    const data = await res.json();
    clearDrafts();
    return data;
  }, [pendingCount, statusDrafts, rollCallDrafts, clearDrafts]);

  return {
    statusDrafts,
    rollCallDrafts,
    pendingCount,
    isDirty,
    setSessionStatusDraft,
    setRollCallDraft,
    getEffectiveStatus,
    getRollCallDraft,
    isMeetingDrafted,
    clearDrafts,
    discardDraft,
    flushBatchSave,
  };
}
