import webpush from 'web-push';
import type { Client } from '@libsql/client';
import type { DatabaseState, DayOfWeek } from '../src/types.ts';

interface VapidKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface PushSubscriptionRecord {
  id: number;
  uid: string;
  role: string;
  teacher_id: string | null;
  student_id: string | null;
  class_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  class_reminders: number;
  attendance_reminders: number;
  lead_minutes: number;
}

let cachedVapidKeys: VapidKeyPair | null = null;
let vapidInitPromise: Promise<VapidKeyPair> | null = null;

export async function ensureVapidKeys(client: Client): Promise<VapidKeyPair> {
  if (cachedVapidKeys) return cachedVapidKeys;
  if (vapidInitPromise) return vapidInitPromise;

  vapidInitPromise = (async () => {
    const envPublic = (process.env.VAPID_PUBLIC_KEY || '').trim();
    const envPrivate = (process.env.VAPID_PRIVATE_KEY || '').trim();
    const subject = (process.env.VAPID_SUBJECT || 'mailto:mahadasysyifa1@gmail.com').trim();

    if (envPublic && envPrivate) {
      webpush.setVapidDetails(subject, envPublic, envPrivate);
      cachedVapidKeys = { publicKey: envPublic, privateKey: envPrivate };
      return cachedVapidKeys;
    }

    const existing = await client.execute({
      sql: "SELECT key, value FROM push_config WHERE key IN ('vapid_public_key', 'vapid_private_key')",
      args: [],
    });

    let pub = '';
    let priv = '';
    for (const row of existing.rows) {
      if (row.key === 'vapid_public_key') pub = String(row.value || '');
      if (row.key === 'vapid_private_key') priv = String(row.value || '');
    }

    if (!pub || !priv) {
      const generated = webpush.generateVAPIDKeys();
      await client.execute({
        sql: "INSERT OR IGNORE INTO push_config (key, value) VALUES ('vapid_public_key', ?)",
        args: [generated.publicKey],
      });
      await client.execute({
        sql: "INSERT OR IGNORE INTO push_config (key, value) VALUES ('vapid_private_key', ?)",
        args: [generated.privateKey],
      });

      const reloaded = await client.execute({
        sql: "SELECT key, value FROM push_config WHERE key IN ('vapid_public_key', 'vapid_private_key')",
        args: [],
      });
      for (const row of reloaded.rows) {
        if (row.key === 'vapid_public_key') pub = String(row.value || '');
        if (row.key === 'vapid_private_key') priv = String(row.value || '');
      }
    }

    webpush.setVapidDetails(subject, pub, priv);
    cachedVapidKeys = { publicKey: pub, privateKey: priv };
    return cachedVapidKeys;
  })();

  try {
    return await vapidInitPromise;
  } finally {
    vapidInitPromise = null;
  }
}

export async function upsertPushSubscription(
  client: Client,
  payload: {
    uid: string;
    role: string;
    teacherId?: string;
    studentId?: string;
    classId?: string;
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    prefs?: { classReminders?: boolean; attendanceReminders?: boolean; leadMinutes?: number };
  }
) {
  const { uid, role, teacherId, studentId, classId, subscription, prefs } = payload;
  const endpoint = String(subscription?.endpoint || '').trim();
  const p256dh = String(subscription?.keys?.p256dh || '').trim();
  const authSecret = String(subscription?.keys?.auth || '').trim();
  if (!uid || !endpoint || !p256dh || !authSecret) {
    throw new Error('Data langganan Web Push tidak lengkap.');
  }

  const classReminders = prefs?.classReminders === false ? 0 : 1;
  const attendanceReminders = prefs?.attendanceReminders === false ? 0 : 1;
  const leadMinutes = [5, 10, 15, 30].includes(Number(prefs?.leadMinutes)) ? Number(prefs?.leadMinutes) : 10;

  await client.execute({
    sql: `INSERT INTO push_subscriptions (
            uid, role, teacher_id, student_id, class_id, endpoint, p256dh, auth,
            class_reminders, attendance_reminders, lead_minutes, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(endpoint) DO UPDATE SET
            uid = excluded.uid,
            role = excluded.role,
            teacher_id = excluded.teacher_id,
            student_id = excluded.student_id,
            class_id = excluded.class_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            class_reminders = excluded.class_reminders,
            attendance_reminders = excluded.attendance_reminders,
            lead_minutes = excluded.lead_minutes,
            updated_at = CURRENT_TIMESTAMP`,
    args: [
      uid,
      role || 'guest',
      teacherId || null,
      studentId || null,
      classId || null,
      endpoint,
      p256dh,
      authSecret,
      classReminders,
      attendanceReminders,
      leadMinutes,
    ],
  });

  return {
    subscribed: true,
    prefs: {
      classReminders: classReminders === 1,
      attendanceReminders: attendanceReminders === 1,
      leadMinutes,
    },
  };
}

export async function removePushSubscription(client: Client, endpoint: string): Promise<void> {
  if (!endpoint) return;
  await client.execute({
    sql: 'DELETE FROM push_subscriptions WHERE endpoint = ?',
    args: [endpoint],
  });
}

export async function getPushSubscriptionStatus(client: Client, endpoint?: string, uid?: string) {
  if (!endpoint && !uid) {
    return { subscribed: false };
  }
  const res = endpoint
    ? await client.execute({
        sql: 'SELECT class_reminders, attendance_reminders, lead_minutes FROM push_subscriptions WHERE endpoint = ? LIMIT 1',
        args: [endpoint],
      })
    : await client.execute({
        sql: 'SELECT class_reminders, attendance_reminders, lead_minutes FROM push_subscriptions WHERE uid = ? ORDER BY updated_at DESC LIMIT 1',
        args: [String(uid)],
      });

  if (res.rows.length === 0) {
    return { subscribed: false };
  }

  const row = res.rows[0];
  return {
    subscribed: true,
    prefs: {
      classReminders: Number(row.class_reminders) === 1,
      attendanceReminders: Number(row.attendance_reminders) === 1,
      leadMinutes: Number(row.lead_minutes) || 10,
    },
  };
}

async function deliverNotification(
  client: Client,
  sub: PushSubscriptionRecord,
  payload: { title: string; body: string; url: string; tag?: string; renotify?: boolean }
): Promise<boolean> {
  await ensureVapidKeys(client);
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (err: any) {
    const statusCode = Number(err?.statusCode || 0);
    if (statusCode === 404 || statusCode === 410) {
      await removePushSubscription(client, sub.endpoint);
    } else {
      console.warn('[WebPush] Delivery error:', err?.message || err);
    }
    return false;
  }
}

export async function sendTestPushToEndpoint(client: Client, endpoint: string): Promise<boolean> {
  const res = await client.execute({
    sql: 'SELECT * FROM push_subscriptions WHERE endpoint = ? LIMIT 1',
    args: [endpoint],
  });
  if (res.rows.length === 0) {
    throw new Error('Perangkat belum terdaftar untuk Web Push.');
  }
  const sub = res.rows[0] as unknown as PushSubscriptionRecord;
  return deliverNotification(client, sub, {
    title: 'Tes Notifikasi Portal IJMA',
    body: 'Notifikasi Web Push aktif. Anda akan menerima pengingat kelas dan presensi di perangkat ini.',
    url: '/?tab=home',
    tag: 'ijma-push-test',
    renotify: true,
  });
}

async function claimDispatchKey(client: Client, dispatchKey: string): Promise<boolean> {
  const res = await client.execute({
    sql: 'INSERT OR IGNORE INTO push_dispatch_log (dispatch_key) VALUES (?)',
    args: [dispatchKey],
  });
  return Number(res.rowsAffected || 0) > 0;
}

function getWibNow(): { dateStr: string; dayOfWeek: DayOfWeek; minutesOfDay: number } {
  const now = new Date();
  const wibParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const partMap: Record<string, string> = {};
  for (const p of wibParts) {
    partMap[p.type] = p.value;
  }

  const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
  const hour = Number(partMap.hour || 0) % 24;
  const minute = Number(partMap.minute || 0);
  const weekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
  }).format(now) as DayOfWeek;

  return {
    dateStr,
    dayOfWeek: weekdayName,
    minutesOfDay: hour * 60 + minute,
  };
}

function parseTimeMinutes(hhmm?: string): number | null {
  if (!hhmm || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export async function notifyAttendanceLoggedForMeeting(
  client: Client,
  meetingId: string,
  state?: DatabaseState
): Promise<void> {
  try {
    const meetingRes = await client.execute({
      sql: 'SELECT id, meeting_date, class_id, subject_id, teacher_id, session_id, status FROM attnd_meeting WHERE id = ? LIMIT 1',
      args: [meetingId],
    });
    if (meetingRes.rows.length === 0) return;

    const m = meetingRes.rows[0];
    const subsRes = await client.execute({
      sql: 'SELECT * FROM push_subscriptions WHERE attendance_reminders = 1',
      args: [],
    });
    if (subsRes.rows.length === 0) return;

    const subjectName =
      state?.subjects?.find((s) => s.id === String(m.subject_id))?.name || String(m.subject_id || 'Mapel');
    const className =
      state?.classes?.find((c) => c.id === String(m.class_id))?.name || String(m.class_id || 'Kelas');
    const teacherName =
      state?.teachers?.find((t) => t.id === String(m.teacher_id))?.panggilan ||
      state?.teachers?.find((t) => t.id === String(m.teacher_id))?.name ||
      'Pengajar';

    const subs = subsRes.rows as unknown as PushSubscriptionRecord[];
    const targets = subs.filter(
      (sub) =>
        sub.role === 'admin' ||
        (sub.role === 'teacher' && sub.teacher_id === String(m.teacher_id)) ||
        (sub.role === 'student' && sub.class_id === String(m.class_id))
    );

    await Promise.all(
      targets.map((sub) =>
        deliverNotification(client, sub, {
          title: `Presensi Tercatat: ${subjectName}`,
          body: `${teacherName} telah mencatat presensi ${className} (${String(m.meeting_date)}).`,
          url: '/?tab=kaldik',
          tag: `attnd-logged-${meetingId}`,
          renotify: true,
        })
      )
    );
  } catch (err) {
    console.warn('[WebPush] notifyAttendanceLogged error:', err);
  }
}

export async function runPushSchedulerTick(
  client: Client,
  getDbStateFn: () => Promise<DatabaseState>
): Promise<void> {
  try {
    const subsRes = await client.execute({
      sql: 'SELECT * FROM push_subscriptions WHERE class_reminders = 1 OR attendance_reminders = 1',
      args: [],
    });
    if (subsRes.rows.length === 0) return;

    const subs = subsRes.rows as unknown as PushSubscriptionRecord[];
    const state = await getDbStateFn();
    const { dateStr, dayOfWeek, minutesOfDay } = getWibNow();

    // Check Kaldik holidays on today's date
    const isHolidayToday = (state.kaldikEvents || []).some((ev) => {
      const start = ev.startDate;
      const end = ev.endDate || ev.startDate;
      const inRange = dateStr >= start && dateStr <= end;
      if (!inRange) return false;
      const t = String(ev.type || '').toLowerCase();
      return t === 'holiday' || t === 'libur';
    });
    if (isHolidayToday) return;

    const subjectMap = new Map((state.subjects || []).map((s) => [s.id, s]));
    const classMap = new Map((state.classes || []).map((c) => [c.id, c]));
    const roomMap = new Map((state.rooms || []).map((r) => [r.id, r]));
    const sessionMap = new Map((state.sessions || []).map((s) => [s.id, s]));
    const periodMap = new Map((state.periods || []).map((p) => [p.id, p]));

    // 1. Upcoming class reminders
    for (const rule of state.rules || []) {
      if (!rule.active) continue;
      const days = rule.daysOfWeek && rule.daysOfWeek.length > 0 ? rule.daysOfWeek : rule.dayOfWeek ? [rule.dayOfWeek] : [];
      if (!days.includes(dayOfWeek)) continue;

      const inActivePeriod = (rule.periodIds || []).some((pid) => {
        const p = periodMap.get(pid);
        if (!p) return false;
        const start = p.startDate || p.start_date || '';
        const end = p.endDate || p.end_date || '';
        return dateStr >= start && dateStr <= end;
      });
      if ((rule.periodIds || []).length > 0 && !inActivePeriod) continue;

      const session = sessionMap.get(rule.sessionId);
      const startMins = parseTimeMinutes(session?.startTime);
      if (!session || startMins === null) continue;

      const diff = startMins - minutesOfDay;
      if (diff < 0 || diff > 30) continue;

      const subjectName = subjectMap.get(rule.subjectId)?.name || 'Pelajaran';
      const className = classMap.get(rule.classId)?.name || 'Kelas';
      const roomName = roomMap.get(rule.roomId)?.name || 'Ruang';

      for (const sub of subs) {
        if (sub.class_reminders !== 1) continue;
        if (diff > sub.lead_minutes) continue;

        const matchesTeacher = sub.role === 'teacher' && sub.teacher_id === rule.teacherId;
        const matchesStudent = sub.role === 'student' && sub.class_id === rule.classId;
        if (!matchesTeacher && !matchesStudent) continue;

        const dispatchKey = `class:${dateStr}:${rule.id}:${session.id}:${sub.id}`;
        const claimed = await claimDispatchKey(client, dispatchKey);
        if (!claimed) continue;

        await deliverNotification(client, sub, {
          title: `Kelas Segera Dimulai: ${subjectName}`,
          body: `${className} · ${roomName} pukul ${session.startTime} WIB (${diff === 0 ? 'sekarang' : `${diff} menit lagi`}).`,
          url: '/?tab=jadwal',
          tag: `class-${rule.id}-${dateStr}`,
        });
      }
    }

    // 2. Pending / unlogged attendance alerts for today's meetings
    const todayMeetings = await client.execute({
      sql: 'SELECT id, class_id, subject_id, teacher_id, session_id, status, is_logged FROM attnd_meeting WHERE meeting_date = ?',
      args: [dateStr],
    });

    for (const row of todayMeetings.rows) {
      if (Number(row.is_logged || 0) === 1) continue;
      if (String(row.status || 'scheduled') === 'cancelled') continue;

      const session = sessionMap.get(String(row.session_id));
      const startMins = parseTimeMinutes(session?.startTime);
      const endMins = parseTimeMinutes(session?.endTime);
      if (!session || startMins === null || endMins === null) continue;

      // Remind 20 minutes after session start up until 3 hours after session end
      if (minutesOfDay < startMins + 20 || minutesOfDay > endMins + 180) continue;

      const meetingId = String(row.id);
      const subjectName = subjectMap.get(String(row.subject_id))?.name || 'Pelajaran';
      const className = classMap.get(String(row.class_id))?.name || 'Kelas';

      for (const sub of subs) {
        if (sub.attendance_reminders !== 1) continue;
        const matchesTeacher = sub.role === 'teacher' && sub.teacher_id === String(row.teacher_id);
        const matchesAdmin = sub.role === 'admin';
        if (!matchesTeacher && !matchesAdmin) continue;

        const dispatchKey = `attnd-pending:${dateStr}:${meetingId}:${sub.id}`;
        const claimed = await claimDispatchKey(client, dispatchKey);
        if (!claimed) continue;

        await deliverNotification(client, sub, {
          title: 'Presensi Belum Dicatat',
          body: `Sesi ${subjectName} (${className}, ${session.startTime} WIB) belum memiliki catatan presensi.`,
          url: '/?tab=kaldik',
          tag: `attnd-pending-${meetingId}`,
        });
      }
    }
  } catch (err) {
    console.warn('[WebPush Scheduler] Tick error:', err);
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;

export function startPushScheduler(client: Client, getDbStateFn: () => Promise<DatabaseState>) {
  if (schedulerInterval) return;
  ensureVapidKeys(client).catch((err) => console.warn('[WebPush] VAPID init warning:', err));
  schedulerInterval = setInterval(() => {
    runPushSchedulerTick(client, getDbStateFn).catch(() => {});
  }, 60_000);
}
