import { Client } from '@libsql/client';
import type {
  DatabaseState,
  AttendanceStatus,
  AttendancePersonType,
  DayOfWeek,
} from '../../src/types.ts';

// ----------------------------------------------------------------------------
// Types for Attendance Engine
// ----------------------------------------------------------------------------
export interface StudentRecord {
  id: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  phone?: string;
}

export interface MeetingSummaryRow {
  id: string;
  meetingDate: string;
  meetingIndex?: number;
  classId: string;
  className: string;
  classColor?: string;
  classGrade?: number;
  classSection?: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  teacherId: string;
  teacherName: string;
  roomId: string;
  roomName: string;
  sessionId: string;
  sessionName: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  actual_materi_id?: string;
  actual_page?: number;
  notes?: string;
  summary: {
    totalEnrolled: number;
    hadirCount: number;
    izinCount: number;
    sakitCount: number;
    terlambatCount: number;
    alpaCount: number;
    teacherStatus?: AttendanceStatus;
  };
}

export interface MeetingRollCallData {
  meeting: MeetingSummaryRow;
  teacher: {
    id: string;
    name: string;
    status: AttendanceStatus;
    timestampStart?: string;
    note?: string;
  };
  students: Array<{
    studentId: string;
    name: string;
    nisn: string;
    gender: 'L' | 'P';
    status: AttendanceStatus;
    timestampStart?: string;
    timestampEnd?: string;
    note?: string;
  }>;
}

// ----------------------------------------------------------------------------
// Seed Student Records
// ----------------------------------------------------------------------------
export const SEED_STUDENTS: Array<{ student: StudentRecord; classIds: string[] }> = [
  // Class: cls-10a (Dasar - Grade 1)
  { student: { id: 'std-101', nisn: '0089123001', name: 'Ahmad Fauzi Al-Ghifari', gender: 'L' }, classIds: ['cls-10a'] },
  { student: { id: 'std-102', nisn: '0089123002', name: 'Fathimah Az-Zahra', gender: 'P' }, classIds: ['cls-10a'] },
  { student: { id: 'std-103', nisn: '0089123003', name: 'Muhammad Rayhan Pratama', gender: 'L' }, classIds: ['cls-10a'] },
  { student: { id: 'std-104', nisn: '0089123004', name: 'Zahra Maulida Rahmah', gender: 'P' }, classIds: ['cls-10a'] },
  { student: { id: 'std-105', nisn: '0089123005', name: 'Umar Abdullah Hakim', gender: 'L' }, classIds: ['cls-10a'] },

  // Class: cls-25914 (Lanjutan - Grade 2)
  { student: { id: 'std-201', nisn: '0078124001', name: 'Bilal bin Rabah As-Syamil', gender: 'L' }, classIds: ['cls-25914'] },
  { student: { id: 'std-202', nisn: '0078124002', name: 'Aisyah Humaira', gender: 'P' }, classIds: ['cls-25914'] },
  { student: { id: 'std-203', nisn: '0078124003', name: 'Salman Al-Farisi', gender: 'L' }, classIds: ['cls-25914'] },
  { student: { id: 'std-204', nisn: '0078124004', name: 'Khadijah Al-Kubra', gender: 'P' }, classIds: ['cls-25914'] },
  { student: { id: 'std-205', nisn: '0078124005', name: 'Zaid bin Tsabit', gender: 'L' }, classIds: ['cls-25914'] },
  { student: { id: 'std-206', nisn: '0078124006', name: 'Maryam binti Imran', gender: 'P' }, classIds: ['cls-25914'] },
  { student: { id: 'std-207', nisn: '0078124007', name: 'Abdullah bin Mas\'ud', gender: 'L' }, classIds: ['cls-25914'] },
  { student: { id: 'std-208', nisn: '0078124008', name: 'Hafshah binti Umar', gender: 'P' }, classIds: ['cls-25914'] },
  { student: { id: 'std-209', nisn: '0078124009', name: 'Ali bin Abi Thalib', gender: 'L' }, classIds: ['cls-25914'] },
  { student: { id: 'std-210', nisn: '0078124010', name: 'Asma binti Abi Bakar', gender: 'P' }, classIds: ['cls-25914'] },

  // Class: cla-1789583887114 (Iltizam - Grade 10)
  { student: { id: 'std-301', nisn: '0067125001', name: 'Hamzah bin Abdul Muthalib', gender: 'L' }, classIds: ['cla-1789583887114'] },
  { student: { id: 'std-302', nisn: '0067125002', name: 'Ruqayyah binti Muhammad', gender: 'P' }, classIds: ['cla-1789583887114'] },
  { student: { id: 'std-303', nisn: '0067125003', name: 'Sa\'ad bin Abi Waqqash', gender: 'L' }, classIds: ['cla-1789583887114'] },
  { student: { id: 'std-304', nisn: '0067125004', name: 'Ummu Salamah Hindun', gender: 'P' }, classIds: ['cla-1789583887114'] },
  { student: { id: 'std-305', nisn: '0067125005', name: 'Thalhah bin Ubaidillah', gender: 'L' }, classIds: ['cla-1789583887114'] },
  { student: { id: 'std-306', nisn: '0067125006', name: 'Zubair bin Awwam', gender: 'L' }, classIds: ['cla-1789583887114'] },
  { student: { id: 'std-307', nisn: '0067125007', name: 'Shafiyyah binti Huyay', gender: 'P' }, classIds: ['cla-1789583887114'] },
  { student: { id: 'std-308', nisn: '0067125008', name: 'Abu Ubaidah bin Jarrah', gender: 'L' }, classIds: ['cla-1789583887114'] },
];

export async function seedInitialStudentsIfEmpty(client: Client): Promise<void> {
  const checkRes = await client.execute('SELECT COUNT(*) as cnt FROM students');
  const count = Number(checkRes.rows[0]?.cnt || 0);

  if (count > 0) return;

  const stmts: Array<{ sql: string; args: any[] }> = [];

  for (const item of SEED_STUDENTS) {
    const s = item.student;
    stmts.push({
      sql: `INSERT INTO students (id, nisn, name, gender, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name, nisn = excluded.nisn`,
      args: [s.id, s.nisn, s.name, s.gender],
    });

    for (const classId of item.classIds) {
      stmts.push({
        sql: `INSERT INTO attnd_enroll (class_id, student_id, academic_year, active) VALUES (?, ?, '2025/2026', 1)
              ON CONFLICT(class_id, student_id) DO NOTHING`,
        args: [classId, s.id],
      });
    }
  }

  if (stmts.length > 0) {
    await client.batch(stmts, 'write');
    console.log(`✅ [Attendance] Seeded ${SEED_STUDENTS.length} students & enrollments`);
  }
}

// ----------------------------------------------------------------------------
// Helper: Map JS Date to DayOfWeek
// ----------------------------------------------------------------------------
const DOW_MAP: Record<number, DayOfWeek> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  0: 'Sunday',
};

// ----------------------------------------------------------------------------
// Pre-populate & Retrieve Meetings for a Given Date
// ----------------------------------------------------------------------------
export async function getOrCreateDayMeetings(
  client: Client,
  dateStr: string,
  state: DatabaseState
): Promise<MeetingSummaryRow[]> {
  // 1. Fetch existing meetings for this date
  const existingRes = await client.execute({
    sql: 'SELECT * FROM attnd_meeting WHERE meeting_date = ?',
    args: [dateStr],
  });

  const existingMeetings = existingRes.rows as any[];

  // 2. If no meetings exist yet, auto pre-populate from schedule rules and kaldik
  if (existingMeetings.length === 0 && state.rules && state.rules.length > 0) {
    const d = new Date(dateStr);
    const dow = DOW_MAP[d.getDay()];

    if (dow) {
      // Find matching rules for this day
      const matchingRules = state.rules.filter((r) => {
        if (r.active === false) return false;
        const days = r.daysOfWeek || (r as any).days_of_week || (r.dayOfWeek ? [r.dayOfWeek] : []);
        return days.includes(dow);
      });

      // Filter rules by active period dates if defined
      const activeRulesForDate = matchingRules.filter((r) => {
        const periodIds = r.periodIds || (r as any).period_ids || [];
        if (periodIds.length === 0) return true;
        // Check if dateStr falls within any of the rule's periods
        return (state.periods || []).some((p) => {
          if (!periodIds.includes(p.id) && !periodIds.includes((p as any).code)) return false;
          return p.startDate <= dateStr && dateStr <= p.endDate;
        });
      });

      if (activeRulesForDate.length > 0) {
        const insertStmts: Array<{ sql: string; args: any[] }> = [];

        for (const rule of activeRulesForDate) {
          const ruleCode = rule.id || (rule as any).code || '';
          const classId = rule.classId || (rule as any).class_id || (rule as any).class_code || '';
          const sessionId = rule.sessionId || (rule as any).session_id || (rule as any).session_code || '';
          const subjectId = rule.subjectId || (rule as any).subject_id || (rule as any).subject_code || '';
          const teacherId = rule.teacherId || (rule as any).teacher_id || (rule as any).teacher_code || '';
          const roomId = rule.roomId || (rule as any).room_id || (rule as any).room_code || '';

          if (!classId || !sessionId) continue;

          const meetingId = `mtg-${dateStr}-${classId}-${sessionId}`;

          insertStmts.push({
            sql: `INSERT INTO attnd_meeting (
                    id, meeting_date, class_id, subject_id, teacher_id, room_id, session_id, rule_code, status, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', CURRENT_TIMESTAMP)
                  ON CONFLICT(meeting_date, class_id, session_id) DO NOTHING`,
            args: [meetingId, dateStr, classId, subjectId, teacherId, roomId, sessionId, ruleCode],
          });
        }

        if (insertStmts.length > 0) {
          await client.batch(insertStmts, 'write');
        }
      }
    }
  }

  // 3. Load full meetings list with joined metadata and attendance log summary (optimized, no correlated subquery)
  const querySql = `
    SELECT 
      m.id,
      m.meeting_date,
      m.meeting_index,
      COALESCE(m.active_meeting_index, m.meeting_index, 1) as active_meeting_index,
      COALESCE(m.present_count, 0) as present_count,
      COALESCE(m.absent_count, 0) as absent_count,
      COALESCE(m.enrolled_count, 0) as enrolled_count,
      COALESCE(m.is_logged, 0) as is_logged,
      m.target_unit_id,
      m.target_unit_title,
      m.target_page_range,
      m.class_id,
      m.subject_id,
      m.teacher_id,
      m.room_id,
      m.session_id,
      m.rule_code,
      m.status,
      m.notes,
      c.name as class_name,
      c.color as class_color,
      c.grade as class_grade,
      c.section as class_section,
      s.name as subject_name,
      s.color as subject_color,
      t.name as teacher_name,
      r.name as room_name,
      ses.name as session_name,
      ses.start_time,
      ses.end_time,
      ses.sort_order as session_order
    FROM attnd_meeting m
    LEFT JOIN classes c ON c.id = m.class_id
    LEFT JOIN subjects s ON s.id = m.subject_id
    LEFT JOIN teachers t ON t.id = m.teacher_id
    LEFT JOIN rooms r ON r.id = m.room_id
    LEFT JOIN sessions ses ON ses.id = m.session_id
    WHERE m.meeting_date = ?
    ORDER BY ses.sort_order ASC, c.grade ASC, c.name ASC
  `;

  const meetingsRes = await client.execute({ sql: querySql, args: [dateStr] });
  const rawMeetings = meetingsRes.rows as any[];

  if (rawMeetings.length === 0) return [];

  // 4. Batch query logs ONLY for meetings that have been logged / completed
  const loggedMeetingIds = rawMeetings
    .filter((m) => m.is_logged === 1 || m.status === 'completed')
    .map((m) => m.id);

  const summaryMap = new Map<
    string,
    {
      hadirCount: number;
      izinCount: number;
      sakitCount: number;
      terlambatCount: number;
      alpaCount: number;
      teacherStatus?: AttendanceStatus;
    }
  >();

  if (loggedMeetingIds.length > 0) {
    const placeholders = loggedMeetingIds.map(() => '?').join(',');
    const logsRes = await client.execute({
      sql: `SELECT meeting_id, person_type, status FROM attnd_meeting_log WHERE meeting_id IN (${placeholders})`,
      args: loggedMeetingIds,
    });

    for (const log of logsRes.rows as any[]) {
      const mId = log.meeting_id;
      if (!summaryMap.has(mId)) {
        summaryMap.set(mId, { hadirCount: 0, izinCount: 0, sakitCount: 0, terlambatCount: 0, alpaCount: 0 });
      }
      const sum = summaryMap.get(mId)!;

      if (log.person_type === 'teacher') {
        sum.teacherStatus = log.status as AttendanceStatus;
      } else if (log.person_type === 'student') {
        if (log.status === 'Hadir') sum.hadirCount++;
        else if (log.status === 'Izin') sum.izinCount++;
        else if (log.status === 'Sakit') sum.sakitCount++;
        else if (log.status === 'Terlambat') sum.terlambatCount++;
        else if (log.status === 'Alpa') sum.alpaCount++;
      }
    }
  }

  // Query enrolled student counts per class using covering index
  const classIds = Array.from(new Set(rawMeetings.map((m) => m.class_id)));
  const classPlaceholders = classIds.map(() => '?').join(',');
  const enrollRes = await client.execute({
    sql: `SELECT class_id, COUNT(*) as cnt FROM attnd_enroll WHERE active = 1 AND class_id IN (${classPlaceholders}) GROUP BY class_id`,
    args: classIds,
  });

  const enrollCountMap = new Map<string, number>();
  for (const row of enrollRes.rows as any[]) {
    enrollCountMap.set(row.class_id, Number(row.cnt));
  }

  return rawMeetings.map((m) => {
    const totalEnrolled = enrollCountMap.get(m.class_id) || 0;
    const stats = summaryMap.get(m.id) || {
      hadirCount: 0,
      izinCount: 0,
      sakitCount: 0,
      terlambatCount: 0,
      alpaCount: 0,
    };

    return {
      id: m.id,
      meetingDate: m.meeting_date,
      meetingIndex: m.status === 'cancelled' ? undefined : (m.active_meeting_index !== null && m.active_meeting_index !== undefined ? Number(m.active_meeting_index) : (m.meeting_index ?? undefined)),
      classId: m.class_id,
      className: m.class_name || m.class_id,
      classColor: m.class_color || '#E2E8F0',
      classGrade: m.class_grade,
      classSection: m.class_section,
      subjectId: m.subject_id || '',
      subjectName: m.subject_name || m.subject_id || 'Pelajaran',
      subjectColor: m.subject_color || '#3B82F6',
      teacherId: m.teacher_id || '',
      teacherName: m.teacher_name || m.teacher_id || 'Ustadz / Guru',
      roomId: m.room_id || '',
      roomName: m.room_name || m.room_id || 'Ruang',
      sessionId: m.session_id || '',
      sessionName: m.session_name || m.session_id || 'Sesi',
      startTime: m.start_time || '08:00',
      endTime: m.end_time || '10:00',
      status: m.status as any,
      notes: m.notes,
      summary: {
        totalEnrolled,
        hadirCount: stats.hadirCount,
        izinCount: stats.izinCount,
        sakitCount: stats.sakitCount,
        terlambatCount: stats.terlambatCount,
        alpaCount: stats.alpaCount,
        teacherStatus: stats.teacherStatus,
      },
    };
  });
}

// ----------------------------------------------------------------------------
// Meeting Roll-Call Roster Data (for Attendance Roll-Call Sheet / Modal)
// ----------------------------------------------------------------------------
export async function getMeetingRollCall(
  client: Client,
  meetingId: string
): Promise<MeetingRollCallData | null> {
  const meetingRes = await client.execute({
    sql: `
      SELECT 
        m.*,
        COALESCE(m.active_meeting_index, m.meeting_index, 1) as active_meeting_index,
        c.name as class_name,
        c.color as class_color,
        c.grade as class_grade,
        c.section as class_section,
        s.name as subject_name,
        s.color as subject_color,
        t.name as teacher_name,
        r.name as room_name,
        ses.name as session_name,
        ses.start_time,
        ses.end_time
      FROM attnd_meeting m
      LEFT JOIN classes c ON c.id = m.class_id
      LEFT JOIN subjects s ON s.id = m.subject_id
      LEFT JOIN teachers t ON t.id = m.teacher_id
      LEFT JOIN rooms r ON r.id = m.room_id
      LEFT JOIN sessions ses ON ses.id = m.session_id
      WHERE m.id = ?
    `,
    args: [meetingId],
  });

  const m = meetingRes.rows[0] as any;
  if (!m) return null;

  // 1. Fetch Enrolled Students for this Class
  const enrolledStudentsRes = await client.execute({
    sql: `
      SELECT s.id, s.nisn, s.name, s.gender, s.phone
      FROM attnd_enroll e
      JOIN students s ON s.id = e.student_id
      WHERE e.class_id = ? AND e.active = 1
      ORDER BY s.name ASC
    `,
    args: [m.class_id],
  });

  // 2. Fetch Existing Attendance Logs for this Meeting
  const logsRes = await client.execute({
    sql: `SELECT * FROM attnd_meeting_log WHERE meeting_id = ?`,
    args: [meetingId],
  });

  const logs = logsRes.rows as any[];
  const teacherLog = logs.find((l) => l.person_type === 'teacher' && l.person_id === m.teacher_id);
  const studentLogsMap = new Map<string, any>();
  for (const l of logs) {
    if (l.person_type === 'student') {
      studentLogsMap.set(l.person_id, l);
    }
  }

  const teacherData = {
    id: m.teacher_id || '',
    name: m.teacher_name || 'Ustadz / Pengajar',
    status: (teacherLog?.status as AttendanceStatus) || null,
    timestampStart: teacherLog?.timestamp_start || null,
    timestampEnd: teacherLog?.timestamp_end || null,
    note: teacherLog?.note || '',
  };

  const studentList = (enrolledStudentsRes.rows as any[]).map((s) => {
    const existing = studentLogsMap.get(s.id);
    return {
      studentId: s.id,
      name: s.name,
      nisn: s.nisn || '',
      gender: s.gender as 'L' | 'P',
      status: (existing?.status as AttendanceStatus) || null,
      timestampStart: existing?.timestamp_start || null,
      timestampEnd: existing?.timestamp_end || null,
      note: existing?.note || '',
    };
  });

  return {
    meeting: {
      id: m.id,
      meetingDate: m.meeting_date,
      meetingIndex: m.status === 'cancelled' ? undefined : (m.active_meeting_index !== null && m.active_meeting_index !== undefined ? Number(m.active_meeting_index) : (m.meeting_index ?? undefined)),
      classId: m.class_id,
      className: m.class_name || m.class_id,
      classColor: m.class_color || '#E2E8F0',
      classGrade: m.class_grade,
      classSection: m.class_section,
      subjectId: m.subject_id || '',
      subjectName: m.subject_name || 'Pelajaran',
      subjectColor: m.subject_color || '#3B82F6',
      teacherId: m.teacher_id || '',
      teacherName: m.teacher_name || 'Ustadz / Pengajar',
      roomId: m.room_id || '',
      roomName: m.room_name || 'Ruang',
      sessionId: m.session_id || '',
      sessionName: m.session_name || 'Sesi',
      startTime: m.start_time || '08:00',
      endTime: m.end_time || '10:00',
      status: m.status as any,
      actual_materi_id: m.actual_materi_id || undefined,
      actual_page: m.actual_page !== null && m.actual_page !== undefined ? Number(m.actual_page) : undefined,
      notes: m.notes,
      summary: {
        totalEnrolled: studentList.length,
        hadirCount: studentList.filter((s) => s.status === 'Hadir').length,
        izinCount: studentList.filter((s) => s.status === 'Izin').length,
        sakitCount: studentList.filter((s) => s.status === 'Sakit').length,
        terlambatCount: studentList.filter((s) => s.status === 'Terlambat').length,
        alpaCount: studentList.filter((s) => s.status === 'Alpa').length,
        teacherStatus: teacherData.status,
      },
    },
    teacher: teacherData,
    students: studentList,
  };
}

export async function updateMeetingStatus(
  client: Client,
  meetingId: string,
  status: 'scheduled' | 'completed' | 'cancelled'
): Promise<void> {
  const statements: Array<{ sql: string; args?: any[] }> = [
    {
      sql: `UPDATE attnd_meeting SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [status, meetingId],
    },
  ];
  await client.batch(statements, 'write');
}

// ----------------------------------------------------------------------------
// Save Roll-Call Data for a Meeting (Optimized with helper columns & cache sync)
// ----------------------------------------------------------------------------
export async function saveMeetingRollCall(
  client: Client,
  meetingId: string,
  teacherLog: { id: string; status: AttendanceStatus; timestampStart?: string; timestampEnd?: string; note?: string },
  studentLogs: Array<{ studentId: string; status: AttendanceStatus; timestampStart?: string; timestampEnd?: string; note?: string }>,
  meetingNotes?: string,
  materialProgress?: { materi?: string; hal?: number | string; unitId?: string }
): Promise<void> {
  const statements: Array<{ sql: string; args: any[] }> = [];

  const actualMateriId = materialProgress?.unitId || materialProgress?.materi || null;
  const actualPage =
    materialProgress?.hal !== undefined && materialProgress.hal !== '' && !isNaN(Number(materialProgress.hal))
      ? Number(materialProgress.hal)
      : null;
  const cleanNotes = meetingNotes ? meetingNotes.trim() : null;

  // Precalculate helper aggregation counts (logged students only)
  // Both 'Hadir' and 'Terlambat' count as present attendees
  const loggedStudents = studentLogs.filter((s) => !!s.status);
  const hadirCount = loggedStudents.filter((s) => s.status === 'Hadir' || s.status === 'Terlambat').length;
  const absentCount = loggedStudents.filter((s) => s.status !== 'Hadir' && s.status !== 'Terlambat').length;
  const enrolledCount = studentLogs.length;
  const isLoggedNow = loggedStudents.length > 0 || (teacherLog && !!teacherLog.status) ? 1 : 0;

  // Update meeting status, progress columns, and clean plain-text notes in one atomic write
  statements.push({
    sql: `UPDATE attnd_meeting 
          SET status = CASE WHEN status = 'cancelled' THEN 'cancelled' ELSE (CASE WHEN ? = 1 THEN 'completed' ELSE 'scheduled' END) END,
              notes = ?, 
              actual_materi_id = ?,
              actual_page = ?,
              present_count = ?, 
              absent_count = ?, 
              enrolled_count = ?, 
              is_logged = ?, 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?`,
    args: [isLoggedNow, cleanNotes, actualMateriId, actualPage, hadirCount, absentCount, enrolledCount, isLoggedNow, meetingId],
  });

  // Upsert or Delete Teacher Log
  if (teacherLog && teacherLog.id) {
    if (teacherLog.status) {
      statements.push({
        sql: `INSERT INTO attnd_meeting_log (
                meeting_id, person_type, person_id, status, timestamp_start, timestamp_end, note, updated_at
              ) VALUES (?, 'teacher', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(meeting_id, person_type, person_id) DO UPDATE SET
                status = excluded.status,
                timestamp_start = excluded.timestamp_start,
                timestamp_end = excluded.timestamp_end,
                note = excluded.note,
                updated_at = CURRENT_TIMESTAMP`,
        args: [meetingId, teacherLog.id, teacherLog.status, teacherLog.timestampStart || null, teacherLog.timestampEnd || null, teacherLog.note || null],
      });
    } else {
      // Teacher deselected: delete row from attnd_meeting_log
      statements.push({
        sql: `DELETE FROM attnd_meeting_log WHERE meeting_id = ? AND person_type = 'teacher' AND person_id = ?`,
        args: [meetingId, teacherLog.id],
      });
    }
  }

  // Upsert or Delete Student Logs
  for (const s of studentLogs) {
    if (s.status) {
      statements.push({
        sql: `INSERT INTO attnd_meeting_log (
                meeting_id, person_type, person_id, status, timestamp_start, timestamp_end, note, updated_at
              ) VALUES (?, 'student', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(meeting_id, person_type, person_id) DO UPDATE SET
                status = excluded.status,
                timestamp_start = excluded.timestamp_start,
                timestamp_end = excluded.timestamp_end,
                note = excluded.note,
                updated_at = CURRENT_TIMESTAMP`,
        args: [meetingId, s.studentId, s.status, s.timestampStart || null, s.timestampEnd || null, s.note || null],
      });
    } else {
      // Student status cleared / null: delete row from attnd_meeting_log
      statements.push({
        sql: `DELETE FROM attnd_meeting_log WHERE meeting_id = ? AND person_type = 'student' AND person_id = ?`,
        args: [meetingId, s.studentId],
      });
    }
  }

  await client.batch(statements, 'write');
}

// ----------------------------------------------------------------------------
// Month Meetings Loader (Month-at-Once for instant 0ms day switching)
// ----------------------------------------------------------------------------
export async function getMonthMeetings(
  client: Client,
  startDate: string,
  endDate: string
): Promise<MeetingSummaryRow[]> {
  const querySql = `
    SELECT 
      m.id,
      m.meeting_date,
      m.meeting_index,
      COALESCE(m.active_meeting_index, m.meeting_index, 1) as active_meeting_index,
      COALESCE(m.present_count, 0) as present_count,
      COALESCE(m.absent_count, 0) as absent_count,
      COALESCE(m.enrolled_count, 0) as enrolled_count,
      COALESCE(m.is_logged, 0) as is_logged,
      m.target_unit_id,
      m.target_unit_title,
      m.target_page_range,
      m.class_id,
      m.subject_id,
      m.teacher_id,
      m.room_id,
      m.session_id,
      m.rule_code,
      m.status,
      m.actual_materi_id,
      m.actual_page,
      m.notes,
      c.name as class_name,
      c.color as class_color,
      c.grade as class_grade,
      c.section as class_section,
      s.name as subject_name,
      s.color as subject_color,
      t.name as teacher_name,
      r.name as room_name,
      ses.name as session_name,
      ses.start_time,
      ses.end_time,
      ses.sort_order as session_order
    FROM attnd_meeting m
    LEFT JOIN classes c ON c.id = m.class_id
    LEFT JOIN subjects s ON s.id = m.subject_id
    LEFT JOIN teachers t ON t.id = m.teacher_id
    LEFT JOIN rooms r ON r.id = m.room_id
    LEFT JOIN sessions ses ON ses.id = m.session_id
    WHERE m.meeting_date >= ? AND m.meeting_date <= ?
    ORDER BY m.meeting_date ASC, ses.sort_order ASC, c.grade ASC, c.name ASC
  `;

  const meetingsRes = await client.execute({ sql: querySql, args: [startDate, endDate] });
  const rawMeetings = meetingsRes.rows as any[];

  if (rawMeetings.length === 0) return [];

  // Batch query class enrollment counts
  const classIds = Array.from(new Set(rawMeetings.map((m) => m.class_id).filter(Boolean)));
  const enrollCountMap = new Map<string, number>();
  if (classIds.length > 0) {
    const placeholders = classIds.map(() => '?').join(',');
    const enrollRes = await client.execute({
      sql: `SELECT class_id, COUNT(*) as cnt FROM attnd_enroll WHERE class_id IN (${placeholders}) AND active = 1 GROUP BY class_id`,
      args: classIds,
    });
    for (const row of enrollRes.rows as any[]) {
      enrollCountMap.set(row.class_id, Number(row.cnt));
    }
  }

  return rawMeetings.map((m) => {
    const totalEnrolled = enrollCountMap.get(m.class_id) || m.enrolled_count || 0;
    return {
      id: m.id,
      meetingDate: m.meeting_date,
      meetingIndex: m.status === 'cancelled' ? undefined : (m.active_meeting_index !== null && m.active_meeting_index !== undefined ? Number(m.active_meeting_index) : (m.meeting_index ?? undefined)),
      classId: m.class_id,
      className: m.class_name || m.class_id,
      classColor: m.class_color || '#E2E8F0',
      classGrade: m.class_grade,
      classSection: m.class_section,
      subjectId: m.subject_id || '',
      subjectName: m.subject_name || m.subject_id || 'Pelajaran',
      subjectColor: m.subject_color || '#3B82F6',
      teacherId: m.teacher_id || '',
      teacherName: m.teacher_name || m.teacher_id || 'Ustadz / Guru',
      roomId: m.room_id || '',
      roomName: m.room_name || m.room_id || 'Ruang',
      sessionId: m.session_id || '',
      sessionName: m.session_name || m.session_id || 'Sesi',
      startTime: m.start_time || '08:00',
      endTime: m.end_time || '10:00',
      status: m.status as any,
      actual_materi_id: m.actual_materi_id || undefined,
      actual_page: m.actual_page !== null && m.actual_page !== undefined ? Number(m.actual_page) : undefined,
      notes: m.notes,
      summary: {
        totalEnrolled,
        hadirCount: m.present_count || 0,
        izinCount: 0,
        sakitCount: 0,
        terlambatCount: 0,
        alpaCount: m.absent_count || 0,
      },
    };
  });
}

// ----------------------------------------------------------------------------
// Batch Save Attendance (Atomic Turso Batch Transaction for Pending Store)
// ----------------------------------------------------------------------------
export interface BatchSaveAttendancePayload {
  statusUpdates?: Array<{ meetingId: string; status: 'scheduled' | 'completed' | 'cancelled' }>;
  rollCallLogs?: Array<{
    meetingId: string;
    teacherLog?: { id: string; status: AttendanceStatus; timestampStart?: string; note?: string };
    studentLogs?: Array<{ studentId: string; status: AttendanceStatus; timestampStart?: string; timestampEnd?: string; note?: string }>;
    meetingNotes?: string;
    materialProgress?: { materi?: string; hal?: number; unitId?: string };
  }>;
}

export async function batchSaveAttendance(
  client: Client,
  payload: BatchSaveAttendancePayload
): Promise<{ success: boolean; updatedCount: number }> {
  const statements: Array<{ sql: string; args: any[] }> = [];
  let updatedCount = 0;

  // 1. Process status updates (e.g. cancel / restore)
  if (payload.statusUpdates && payload.statusUpdates.length > 0) {
    for (const update of payload.statusUpdates) {
      statements.push({
        sql: `UPDATE attnd_meeting SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [update.status, update.meetingId],
      });
      updatedCount++;
    }
  }

  // 2. Process roll call logs
  if (payload.rollCallLogs && payload.rollCallLogs.length > 0) {
    for (const item of payload.rollCallLogs) {
      const { meetingId, teacherLog, studentLogs = [], meetingNotes, materialProgress } = item;
      const loggedStudents = studentLogs.filter((s) => !!s.status);
      const hadirCount = loggedStudents.filter((s) => s.status === 'Hadir').length;
      const absentCount = loggedStudents.filter((s) => s.status !== 'Hadir').length;
      const enrolledCount = studentLogs.length;
      const actualMateriId = materialProgress?.unitId || materialProgress?.materi || null;
      const actualPage =
        materialProgress?.hal !== undefined && materialProgress.hal !== null && !isNaN(Number(materialProgress.hal))
          ? Number(materialProgress.hal)
          : null;
      const cleanNotes = meetingNotes ? meetingNotes.trim() : null;

      statements.push({
        sql: `UPDATE attnd_meeting 
              SET status = CASE WHEN status = 'cancelled' THEN 'cancelled' ELSE 'completed' END,
                  notes = ?, 
                  actual_materi_id = ?,
                  actual_page = ?,
                  present_count = ?, 
                  absent_count = ?, 
                  enrolled_count = ?, 
                  is_logged = 1, 
                  updated_at = CURRENT_TIMESTAMP 
              WHERE id = ?`,
        args: [cleanNotes, actualMateriId, actualPage, hadirCount, absentCount, enrolledCount, meetingId],
      });

      if (teacherLog && teacherLog.id && teacherLog.status) {
        statements.push({
          sql: `INSERT INTO attnd_meeting_log (
                  meeting_id, person_type, person_id, status, timestamp_start, note, updated_at
                ) VALUES (?, 'teacher', ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(meeting_id, person_type, person_id) DO UPDATE SET
                  status = excluded.status,
                  timestamp_start = excluded.timestamp_start,
                  note = excluded.note,
                  updated_at = CURRENT_TIMESTAMP`,
          args: [meetingId, teacherLog.id, teacherLog.status, teacherLog.timestampStart || null, teacherLog.note || null],
        });
      }
      for (const s of loggedStudents) {
        statements.push({
          sql: `INSERT INTO attnd_meeting_log (
                  meeting_id, person_type, person_id, status, timestamp_start, timestamp_end, note, updated_at
                ) VALUES (?, 'student', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(meeting_id, person_type, person_id) DO UPDATE SET
                  status = excluded.status,
                  timestamp_start = excluded.timestamp_start,
                  timestamp_end = excluded.timestamp_end,
                  note = excluded.note,
                  updated_at = CURRENT_TIMESTAMP`,
          args: [meetingId, s.studentId, s.status, s.timestampStart || null, s.timestampEnd || null, s.note || null],
        });
      }

      updatedCount++;
    }
  }

  if (statements.length > 0) {
    await client.batch(statements, 'write');
  }

  return { success: true, updatedCount };
}

// ----------------------------------------------------------------------------
// Optimization Data Synchronization & Backfill (One-time and on boot)
// ----------------------------------------------------------------------------
export async function syncAttendanceOptimizationData(client: Client): Promise<void> {
  try {
    // 1. Backfill active_meeting_index for meetings where active_meeting_index is null
    await client.execute(`
      UPDATE attnd_meeting
      SET active_meeting_index = COALESCE(meeting_index, 1)
      WHERE active_meeting_index IS NULL
    `);

    // 2. Backfill enrolled_count where enrolled_count is 0 or null
    await client.execute(`
      UPDATE attnd_meeting
      SET enrolled_count = COALESCE((
        SELECT COUNT(*) 
        FROM attnd_enroll 
        WHERE attnd_enroll.class_id = attnd_meeting.class_id AND attnd_enroll.active = 1
      ), 0)
      WHERE enrolled_count IS NULL OR enrolled_count = 0
    `);

    // 3. Backfill present_count, absent_count, is_logged where meeting has logs
    await client.execute(`
      UPDATE attnd_meeting
      SET 
        present_count = (
          SELECT COUNT(*) FROM attnd_meeting_log 
          WHERE meeting_id = attnd_meeting.id AND person_type = 'student' AND status = 'Hadir'
        ),
        absent_count = (
          SELECT COUNT(*) FROM attnd_meeting_log 
          WHERE meeting_id = attnd_meeting.id AND person_type = 'student' AND status != 'Hadir'
        ),
        is_logged = CASE WHEN EXISTS (SELECT 1 FROM attnd_meeting_log WHERE meeting_id = attnd_meeting.id) THEN 1 ELSE 0 END
      WHERE is_logged = 0 AND EXISTS (SELECT 1 FROM attnd_meeting_log WHERE meeting_id = attnd_meeting.id)
    `);

    console.log('✅ [Attendance] Optimization helper data & monthly cache synced successfully');
  } catch (err: any) {
    console.warn('⚠️ [Attendance] syncAttendanceOptimizationData notice:', err.message);
  }
}

// ----------------------------------------------------------------------------
// Enrollment & Roster Management Endpoints (Dual Interactive Lists)
// ----------------------------------------------------------------------------
export interface EnrollmentOverviewData {
  students: Array<{
    id: string;
    nisn: string;
    name: string;
    gender: 'L' | 'P';
    phone?: string;
    enrolledClassIds: string[];
  }>;
  enrollments: Array<{
    id: number;
    classId: string;
    studentId: string;
    teacherId?: string;
    academicYear: string;
    active: number;
  }>;
  classes: Array<{
    id: string;
    name: string;
    grade?: number;
    section?: string;
    color?: string;
    studentCount: number;
    homeroomTeacherId?: string;
    homeroomTeacherName?: string;
  }>;
  teachers: Array<{
    id: string;
    name: string;
    panggilan?: string;
    color?: string;
    department?: string;
    assignedClassIds: string[];
  }>;
}

export async function getEnrollmentOverview(
  client: Client,
  state: DatabaseState
): Promise<EnrollmentOverviewData> {
  // 1. Fetch all students
  const stdRes = await client.execute('SELECT id, nisn, name, gender, phone FROM students ORDER BY name ASC');
  const rawStudents = stdRes.rows as any[];

  // 2. Fetch all enrollments
  const enrRes = await client.execute('SELECT id, class_id, student_id, teacher_id, academic_year, active FROM attnd_enroll WHERE active = 1');
  const rawEnrollments = enrRes.rows as any[];

  const enrollments = rawEnrollments.map((r) => ({
    id: Number(r.id),
    classId: String(r.class_id),
    studentId: String(r.student_id),
    teacherId: r.teacher_id ? String(r.teacher_id) : undefined,
    academicYear: String(r.academic_year || '2025/2026'),
    active: Number(r.active ?? 1),
  }));

  // Build map of studentId -> classIds[]
  const studentClassMap = new Map<string, string[]>();
  for (const enr of enrollments) {
    const list = studentClassMap.get(enr.studentId) || [];
    if (!list.includes(enr.classId)) list.push(enr.classId);
    studentClassMap.set(enr.studentId, list);
  }

  // Count enrolled students per class
  const classCountMap = new Map<string, number>();
  for (const enr of enrollments) {
    classCountMap.set(enr.classId, (classCountMap.get(enr.classId) || 0) + 1);
  }

  // Homeroom teacher per class from enrollments or state
  const classHomeroomMap = new Map<string, string>();
  for (const enr of enrollments) {
    if (enr.teacherId) {
      classHomeroomMap.set(enr.classId, enr.teacherId);
    }
  }

  // Classes list enriched with live counts
  const classes = (state.classes || []).map((c) => {
    const homeroomTeacherId = classHomeroomMap.get(c.id);
    const homeroomTeacher = homeroomTeacherId
      ? (state.teachers || []).find((t) => t.id === homeroomTeacherId)
      : undefined;
    return {
      id: c.id,
      name: c.name,
      grade: c.grade,
      section: c.section,
      color: c.color,
      studentCount: classCountMap.get(c.id) || 0,
      homeroomTeacherId: homeroomTeacherId,
      homeroomTeacherName: homeroomTeacher ? (homeroomTeacher.panggilan || homeroomTeacher.name) : undefined,
    };
  });

  // Teachers with classes they teach from rules
  const teacherClassMap = new Map<string, Set<string>>();
  for (const r of state.rules || []) {
    if (r.active !== false && r.teacherId && r.classId) {
      if (!teacherClassMap.has(r.teacherId)) teacherClassMap.set(r.teacherId, new Set());
      teacherClassMap.get(r.teacherId)!.add(r.classId);
    }
  }

  const teachers = (state.teachers || []).map((t) => ({
    id: t.id,
    name: t.name,
    panggilan: t.panggilan,
    color: t.color,
    department: t.department,
    assignedClassIds: Array.from(teacherClassMap.get(t.id) || []),
  }));

  const students = rawStudents.map((s) => ({
    id: String(s.id),
    nisn: String(s.nisn || ''),
    name: String(s.name || ''),
    gender: (s.gender === 'P' ? 'P' : 'L') as 'L' | 'P',
    phone: s.phone ? String(s.phone) : undefined,
    enrolledClassIds: studentClassMap.get(String(s.id)) || [],
  }));

  return {
    students,
    enrollments,
    classes,
    teachers,
  };
}

export async function quickAssignStudentToClass(
  client: Client,
  studentId: string,
  classId: string
): Promise<void> {
  await client.execute({
    sql: `INSERT INTO attnd_enroll (class_id, student_id, academic_year, active, created_at)
          VALUES (?, ?, '2025/2026', 1, CURRENT_TIMESTAMP)
          ON CONFLICT(class_id, student_id) DO UPDATE SET active = 1`,
    args: [classId, studentId],
  });
}

export async function quickUnassignStudentFromClass(
  client: Client,
  studentId: string,
  classId: string
): Promise<void> {
  await client.execute({
    sql: `DELETE FROM attnd_enroll WHERE class_id = ? AND student_id = ?`,
    args: [classId, studentId],
  });
}

export async function upsertStudent(
  client: Client,
  student: StudentRecord,
  classId?: string
): Promise<void> {
  const id = student.id || `std-${Date.now()}`;
  await client.execute({
    sql: `INSERT INTO students (id, nisn, name, gender, phone, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            nisn = excluded.nisn,
            name = excluded.name,
            gender = excluded.gender,
            phone = excluded.phone,
            updated_at = CURRENT_TIMESTAMP`,
    args: [id, student.nisn || null, student.name, student.gender || 'L', student.phone || null],
  });

  if (classId) {
    await quickAssignStudentToClass(client, id, classId);
  }
}

export async function deleteStudentRecord(
  client: Client,
  studentId: string
): Promise<void> {
  await client.execute({
    sql: `DELETE FROM students WHERE id = ?`,
    args: [studentId],
  });
}

export async function saveAllEnrollmentData(
  client: Client,
  students?: Array<{ id: string; nisn?: string; name: string; gender?: string; phone?: string }>,
  enrollments?: Array<{ classId: string; studentId: string; teacherId?: string; academicYear?: string; active?: number | boolean }>
): Promise<void> {
  const statements: Array<{ sql: string; args?: any[] }> = [];

  const seenStd = new Set<string>();
  const studentIds: string[] = [];

  if (Array.isArray(students)) {
    for (const s of students) {
      if (!s.id || seenStd.has(s.id)) continue;
      seenStd.add(s.id);
      studentIds.push(s.id);
      statements.push({
        sql: `INSERT INTO students (id, nisn, name, gender, phone, updated_at)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET
                nisn = excluded.nisn,
                name = excluded.name,
                gender = excluded.gender,
                phone = excluded.phone,
                updated_at = CURRENT_TIMESTAMP`,
        args: [s.id, s.nisn || null, s.name, s.gender || 'L', s.phone || null],
      });
    }

    if (studentIds.length > 0) {
      const placeholders = studentIds.map(() => '?').join(', ');
      statements.push({
        sql: `DELETE FROM attnd_enroll WHERE student_id NOT IN (${placeholders})`,
        args: [...studentIds],
      });
      statements.push({
        sql: `DELETE FROM students WHERE id NOT IN (${placeholders})`,
        args: [...studentIds],
      });
    }
  }

  if (Array.isArray(enrollments)) {
    statements.push({ sql: 'DELETE FROM attnd_enroll' });
    const seenEnr = new Set<string>();
    for (const e of enrollments) {
      if (!e.classId || !e.studentId) continue;
      const key = `${e.classId}__${e.studentId}`;
      if (seenEnr.has(key)) continue;
      seenEnr.add(key);
      const activeVal = e.active === false || e.active === 0 ? 0 : 1;
      statements.push({
        sql: `INSERT INTO attnd_enroll (class_id, student_id, teacher_id, academic_year, active, created_at)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(class_id, student_id) DO UPDATE SET
                teacher_id = excluded.teacher_id,
                academic_year = excluded.academic_year,
                active = excluded.active`,
        args: [e.classId, e.studentId, e.teacherId || null, e.academicYear || '2025/2026', activeVal],
      });
    }
  }

  if (statements.length > 0) {
    await client.batch(statements as any, 'write');
  }
}

/**
 * Generates all meetings across active rules into attnd_meeting table:
 * - Records all active schedule rules (subject, class, teacher, room, session, day of week)
 * - Traverses dates within rules' defined periods (or global periods)
 * - Skips holidays and non-effective calendar events (kaldikEvents where isKbm === false or type === 'holiday')
 * - Numbers meetingIndex chronologically per (subject, class)
 * - Preserves existing completed meetings (status = 'completed' and roll-call logs untouched)
 * - Does NOT touch syllabus_scopes or teacher calibration data
 */
export async function generateAllRuleMeetings(
  client: Client,
  state: DatabaseState
): Promise<{
  totalProcessed: number;
  totalUpserted: number;
  holidaysSkipped: number;
  preservedCompleted: number;
  activeRulesCount: number;
}> {
  const activeRules = (state.rules || []).filter((r) => r.active !== false);
  if (activeRules.length === 0) {
    return {
      totalProcessed: 0,
      totalUpserted: 0,
      holidaysSkipped: 0,
      preservedCompleted: 0,
      activeRulesCount: 0,
    };
  }

  // 1. Build fast lookup of non-KBM / holiday date strings ('YYYY-MM-DD')
  const nonKbmDates = new Set<string>();
  const kaldikEvents = state.kaldikEvents || [];
  for (const ev of kaldikEvents) {
    if (ev.isKbm === false || ev.type === 'holiday') {
      if (!ev.startDate || !ev.endDate) continue;
      const s = new Date(ev.startDate);
      const e = new Date(ev.endDate);
      if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) continue;
      const curr = new Date(s);
      while (curr <= e) {
        nonKbmDates.add(curr.toISOString().slice(0, 10));
        curr.setDate(curr.getDate() + 1);
      }
    }
  }

  // 2. Query existing completed meetings to protect them
  const completedRes = await client.execute(
    "SELECT id, meeting_date, class_id, session_id FROM attnd_meeting WHERE status = 'completed'"
  );
  const completedKeys = new Set<string>();
  for (const row of completedRes.rows as any[]) {
    completedKeys.add(`${row.meeting_date}__${row.class_id}__${row.session_id}`);
  }

  // 3. Prepare periods lookup
  const periods = state.periods || [];
  const periodMap = new Map((periods || []).map((p) => [p.id, p]));

  // 4. Collect occurrences per (subjectId, classId)
  interface RawOccurrence {
    date: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    roomId: string;
    sessionId: string;
    ruleCode: string;
    startTime: string;
  }

  const sessionMap = new Map((state.sessions || []).map((s) => [s.id, s]));
  const occurrencesBySubjectClass = new Map<string, RawOccurrence[]>();
  const seenSlot = new Set<string>(); // to avoid duplicate per date+class+session
  let holidaysSkippedCount = 0;

  for (const rule of activeRules) {
    const rawDays = rule.daysOfWeek || (rule as any).days_of_week || (rule.dayOfWeek ? [rule.dayOfWeek] : []);
    const ruleDays = Array.isArray(rawDays) ? rawDays : [rawDays];
    if (ruleDays.length === 0) continue;

    const classId = rule.classId || (rule as any).class_id || '';
    const sessionId = rule.sessionId || (rule as any).session_id || '';
    const subjectId = rule.subjectId || (rule as any).subject_id || '';
    const teacherId = rule.teacherId || (rule as any).teacher_id || '';
    const roomId = rule.roomId || (rule as any).room_id || '';
    const ruleCode = rule.id || (rule as any).code || '';

    if (!classId || !sessionId) continue;

    // Determine target periods for this rule
    const rawPids: string[] = rule.periodIds || (rule as any).period_ids || [];
    let selPeriods = rawPids.map((pid) => periodMap.get(pid)).filter(Boolean) as typeof periods;
    if (selPeriods.length === 0) {
      selPeriods = periods;
    }

    const sessionObj = sessionMap.get(sessionId);
    const startTime = sessionObj?.startTime || (sessionObj as any)?.start_time || '08:00';

    for (const p of selPeriods) {
      const pStart = p.startDate || (p as any).start_date;
      const pEnd = p.endDate || (p as any).end_date;
      if (!pStart || !pEnd) continue;

      const curr = new Date(pStart);
      const end = new Date(pEnd);
      if (isNaN(curr.getTime()) || isNaN(end.getTime()) || curr > end) continue;

      while (curr <= end) {
        const jsDay = curr.getDay();
        const dow = DOW_MAP[jsDay];
        if (dow && ruleDays.includes(dow)) {
          const dStr = curr.toISOString().slice(0, 10);
          const slotKey = `${dStr}__${classId}__${sessionId}`;

          if (nonKbmDates.has(dStr)) {
            holidaysSkippedCount++;
          } else if (!seenSlot.has(slotKey)) {
            seenSlot.add(slotKey);
            const groupKey = `${subjectId}__${classId}`;
            if (!occurrencesBySubjectClass.has(groupKey)) {
              occurrencesBySubjectClass.set(groupKey, []);
            }
            occurrencesBySubjectClass.get(groupKey)!.push({
              date: dStr,
              classId,
              subjectId,
              teacherId,
              roomId,
              sessionId,
              ruleCode,
              startTime,
            });
          }
        }
        curr.setDate(curr.getDate() + 1);
      }
    }
  }

  // 5. Build statements with ordered meeting_index per (subject, class)
  const statements: Array<{ sql: string; args: any[] }> = [];
  let totalUpserted = 0;
  let preservedCompleted = 0;

  for (const occurrences of occurrencesBySubjectClass.values()) {
    // Sort chronologically by date, then session start time
    occurrences.sort((a, b) => {
      const cDate = a.date.localeCompare(b.date);
      if (cDate !== 0) return cDate;
      return a.startTime.localeCompare(b.startTime);
    });

    occurrences.forEach((occ, idx) => {
      const meetingIndex = idx + 1;
      const slotKey = `${occ.date}__${occ.classId}__${occ.sessionId}`;

      if (completedKeys.has(slotKey)) {
        preservedCompleted++;
        // Keep completed meeting untouched (do not alter its status or teacher logs)
        return;
      }

      totalUpserted++;
      const meetingId = `mtg-${occ.date}-${occ.classId}-${occ.sessionId}`;
      statements.push({
        sql: `INSERT INTO attnd_meeting (
                id, meeting_date, meeting_index, class_id, subject_id, teacher_id, room_id, session_id, rule_code, status, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', CURRENT_TIMESTAMP)
              ON CONFLICT(meeting_date, class_id, session_id) DO UPDATE SET
                meeting_index = excluded.meeting_index,
                subject_id = excluded.subject_id,
                teacher_id = excluded.teacher_id,
                room_id = excluded.room_id,
                rule_code = excluded.rule_code,
                updated_at = CURRENT_TIMESTAMP
              WHERE status != 'completed'`,
        args: [
          meetingId,
          occ.date,
          meetingIndex,
          occ.classId,
          occ.subjectId,
          occ.teacherId || null,
          occ.roomId || null,
          occ.sessionId,
          occ.ruleCode,
        ],
      });
    });
  }

  // 6. Execute in batches of 50 to avoid request size limits
  const BATCH_SIZE = 50;
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const chunk = statements.slice(i, i + BATCH_SIZE);
    await client.batch(chunk as any, 'write');
  }

  return {
    totalProcessed: totalUpserted + preservedCompleted,
    totalUpserted,
    holidaysSkipped: holidaysSkippedCount,
    preservedCompleted,
    activeRulesCount: activeRules.length,
  };
}

function assembleRollCall(m: any, enrolledRows: any[], logs: any[]): MeetingRollCallData {
  const teacherLog = logs.find((l) => l.person_type === 'teacher' && l.person_id === m.teacher_id);
  const studentLogsMap = new Map<string, any>();
  for (const l of logs) {
    if (l.person_type === 'student') studentLogsMap.set(l.person_id, l);
  }

  const teacherData = {
    id: m.teacher_id || '',
    name: m.teacher_name || 'Ustadz / Pengajar',
    status: (teacherLog?.status as AttendanceStatus) || null,
    timestampStart: teacherLog?.timestamp_start || null,
    note: teacherLog?.note || '',
  };

  const studentList = enrolledRows.map((s) => {
    const existing = studentLogsMap.get(s.id);
    return {
      studentId: s.id,
      name: s.name,
      nisn: s.nisn || '',
      gender: s.gender as 'L' | 'P',
      status: (existing?.status as AttendanceStatus) || null,
                                       timestampStart: existing?.timestamp_start || null,
                                       timestampEnd: existing?.timestamp_end || null,
                                       note: existing?.note || '',
    };
  });

  return {
    meeting: {
      id: m.id,
      meetingDate: m.meeting_date,
      meetingIndex: m.status === 'cancelled' ? undefined : (m.active_meeting_index !== null && m.active_meeting_index !== undefined ? Number(m.active_meeting_index) : (m.meeting_index ?? undefined)),
      classId: m.class_id,
      className: m.class_name || m.class_id,
      classColor: m.class_color || '#E2E8F0',
      classGrade: m.class_grade,
      classSection: m.class_section,
      subjectId: m.subject_id || '',
      subjectName: m.subject_name || 'Pelajaran',
      subjectColor: m.subject_color || '#3B82F6',
      teacherId: m.teacher_id || '',
      teacherName: m.teacher_name || 'Ustadz / Pengajar',
      roomId: m.room_id || '',
      roomName: m.room_name || 'Ruang',
      sessionId: m.session_id || '',
      sessionName: m.session_name || 'Sesi',
      startTime: m.start_time || '08:00',
      endTime: m.end_time || '10:00',
      status: m.status as any,
      notes: m.notes,
      summary: {
        totalEnrolled: studentList.length,
        hadirCount: studentList.filter((s) => s.status === 'Hadir').length,
        izinCount: studentList.filter((s) => s.status === 'Izin').length,
        sakitCount: studentList.filter((s) => s.status === 'Sakit').length,
        terlambatCount: studentList.filter((s) => s.status === 'Terlambat').length,
        alpaCount: studentList.filter((s) => s.status === 'Alpa').length,
        teacherStatus: teacherData.status,
      },
    },
    teacher: teacherData,
    students: studentList,
  } as MeetingRollCallData;
}

export async function getMonthRollCalls(
  client: Client,
  startDate: string,
  endDate: string
): Promise<MeetingRollCallData[]> {
  const meetingsRes = await client.execute({
    sql: `
    SELECT
    m.*,
    COALESCE(m.active_meeting_index, m.meeting_index, 1) as active_meeting_index,
                                           c.name as class_name, c.color as class_color, c.grade as class_grade, c.section as class_section,
                                           s.name as subject_name, s.color as subject_color,
                                           t.name as teacher_name, r.name as room_name,
                                           ses.name as session_name, ses.start_time, ses.end_time
                                           FROM attnd_meeting m
                                           LEFT JOIN classes c ON c.id = m.class_id
                                           LEFT JOIN subjects s ON s.id = m.subject_id
                                           LEFT JOIN teachers t ON t.id = m.teacher_id
                                           LEFT JOIN rooms r ON r.id = m.room_id
                                           LEFT JOIN sessions ses ON ses.id = m.session_id
                                           WHERE m.meeting_date >= ? AND m.meeting_date <= ?
                                           ORDER BY m.meeting_date, m.session_id
                                           `,
                                           args: [startDate, endDate],
  });
  const meetings = meetingsRes.rows as any[];
  if (meetings.length === 0) return [];

  const enrollRes = await client.execute({
    sql: `
    SELECT e.class_id, s.id, s.nisn, s.name, s.gender, s.phone
    FROM attnd_enroll e
    JOIN students s ON s.id = e.student_id
    WHERE e.active = 1
    AND e.class_id IN (SELECT DISTINCT class_id FROM attnd_meeting WHERE meeting_date >= ? AND meeting_date <= ?)
    ORDER BY s.name ASC
    `,
    args: [startDate, endDate],
  });
  const enrollByClass = new Map<string, any[]>();
  for (const r of enrollRes.rows as any[]) {
    if (!enrollByClass.has(r.class_id)) enrollByClass.set(r.class_id, []);
    enrollByClass.get(r.class_id)!.push(r);
  }

  const logsRes = await client.execute({
    sql: `
    SELECT l.*, m.id AS roll_meeting_id
    FROM attnd_meeting_log l
    JOIN attnd_meeting m ON m.id = l.meeting_id
    WHERE m.meeting_date >= ? AND m.meeting_date <= ?
    `,
    args: [startDate, endDate],
  });
  const logsByMeeting = new Map<string, any[]>();
  for (const l of logsRes.rows as any[]) {
    if (!logsByMeeting.has(l.meeting_id)) logsByMeeting.set(l.meeting_id, []);
    logsByMeeting.get(l.meeting_id)!.push(l);
  }

  return meetings.map((m) =>
  assembleRollCall(m, enrollByClass.get(m.class_id) || [], logsByMeeting.get(m.id) || [])
  );
}
