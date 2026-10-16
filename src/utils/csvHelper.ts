import { DatabaseState } from '../types';

/**
 * Escapes a field for CSV format (RFC 4180)
 */
export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes('\t')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export rules starting with id column followed by all rule and entity details
 */
export function exportRulesToCsv(db: DatabaseState): string {
  const subjectMap = new Map((db.subjects || []).map((s) => [s.id, s.name]));
  const classMap = new Map((db.classes || []).map((c) => [c.id, c.name]));
  const teacherMap = new Map((db.teachers || []).map((t) => [t.id, t.panggilan || t.name]));
  const roomMap = new Map((db.rooms || []).map((r) => [r.id, r.name]));
  const sessionMap = new Map((db.sessions || []).map((s) => [s.id, s.name]));

  const headers = [
    'id',
    'subjectId',
    'subjectName',
    'classId',
    'className',
    'teacherId',
    'teacherName',
    'roomId',
    'roomName',
    'sessionId',
    'sessionName',
    'dayOfWeek',
    'daysOfWeek',
    'periodIds',
    'repeatDetail',
    'active',
    'notes'
  ];

  const rows = (db.rules || []).map((rule) => {
    const rawDays = rule.daysOfWeek || (rule as any).days_of_week || [];
    const daysStr = Array.isArray(rawDays) ? rawDays.join(';') : String(rawDays);

    const rawPids = rule.periodIds || (rule as any).period_ids || [];
    const pidsStr = Array.isArray(rawPids) ? rawPids.join(';') : String(rawPids);

    const sId = rule.subjectId || (rule as any).subject_id || '';
    const cId = rule.classId || (rule as any).class_id || '';
    const tId = rule.teacherId || (rule as any).teacher_id || '';
    const rId = rule.roomId || (rule as any).room_id || '';
    const sesId = rule.sessionId || (rule as any).session_id || '';

    return [
      escapeCsvValue(rule.id),
      escapeCsvValue(sId),
      escapeCsvValue(subjectMap.get(sId) || sId),
      escapeCsvValue(cId),
      escapeCsvValue(classMap.get(cId) || cId),
      escapeCsvValue(tId),
      escapeCsvValue(teacherMap.get(tId) || tId),
      escapeCsvValue(rId),
      escapeCsvValue(roomMap.get(rId) || rId),
      escapeCsvValue(sesId),
      escapeCsvValue(sessionMap.get(sesId) || sesId),
      escapeCsvValue(rule.dayOfWeek || ''),
      escapeCsvValue(daysStr),
      escapeCsvValue(pidsStr),
      escapeCsvValue(rule.repeatDetail || 'Weekly'),
      escapeCsvValue(rule.active ? '1' : '0'),
      escapeCsvValue(rule.notes || '')
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

/**
 * Parses a standard CSV string into array of rows
 */
export function parseCsvRows(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let curVal = '';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          curVal += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        curVal += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(curVal.trim());
        curVal = '';
      } else if (c === '\r' && next === '\n') {
        row.push(curVal.trim());
        lines.push(row);
        row = [];
        curVal = '';
        i++;
      } else if (c === '\n' || c === '\r') {
        row.push(curVal.trim());
        lines.push(row);
        row = [];
        curVal = '';
      } else {
        curVal += c;
      }
    }
  }

  if (curVal.length > 0 || row.length > 0) {
    row.push(curVal.trim());
    lines.push(row);
  }

  return lines.filter((r) => r.length > 0 && r.some((cell) => cell.length > 0));
}

/**
 * Supported tables for Universal Database CSV Hub
 */
export type UniversalTableKey =
  | 'students'
  | 'enrollments'
  | 'classes'
  | 'teachers'
  | 'subjects'
  | 'rooms'
  | 'books'
  | 'sessions'
  | 'rules'
  | 'syllabus';

export interface TableExportConfig {
  key: UniversalTableKey;
  label: string;
  description: string;
  headers: string[];
  sampleRow: string[];
}

export const UNIVERSAL_TABLE_CONFIGS: Record<UniversalTableKey, TableExportConfig> = {
  students: {
    key: 'students',
    label: 'Santri & Siswa',
    description: 'Data induk santri madrasah (NISN, Nama, Gender, Telepon).',
    headers: ['id', 'nisn', 'name', 'gender', 'phone'],
    sampleRow: ['std-101', '0089123001', 'Ahmad Fauzi', 'L', '081234567890'],
  },
  enrollments: {
    key: 'enrollments',
    label: 'Penugasan Rombel (Enrollment)',
    description: 'Relasi keanggotaan santri di rombel kelas & wali kelas.',
    headers: ['class_id', 'student_id', 'academic_year', 'active'],
    sampleRow: ['cls-10a', 'std-101', '2025/2026', '1'],
  },
  classes: {
    key: 'classes',
    label: 'Rombongan Belajar (Kelas)',
    description: 'Daftar kelas madrasah, tingkatan, warna, dan kapasitas.',
    headers: ['id', 'name', 'grade', 'section', 'color', 'defaultRoomId'],
    sampleRow: ['cls-10a', 'Kelas 10-A', '10', 'REGULER', '#E0F2FE', 'rm-101'],
  },
  teachers: {
    key: 'teachers',
    label: 'Pengajar & Ustadz',
    description: 'Daftar guru/ustadz pengampu dan bidang ilmu.',
    headers: ['id', 'name', 'panggilan', 'email', 'department', 'color', 'maxPeriodsPerWeek'],
    sampleRow: ['tch-101', 'Ustadz Ridwan', 'Ust. Ridwan', 'ridwan@pesantren.id', 'Bahasa Arab', '#0284C7', '18'],
  },
  subjects: {
    key: 'subjects',
    label: 'Mata Pelajaran',
    description: 'Kurikulum mata pelajaran dan kode beban.',
    headers: ['id', 'name', 'code', 'category', 'color', 'weeklyPeriods'],
    sampleRow: ['sub-arb', 'Bahasa Arab', 'ARB', 'Bahasa', '#3B82F6', '4'],
  },
  rooms: {
    key: 'rooms',
    label: 'Ruangan & Gedung',
    description: 'Ruang kelas, laboratorium, dan kapasitas.',
    headers: ['id', 'name', 'building', 'capacity', 'type'],
    sampleRow: ['rm-101', 'Ruang Kelas 1', 'Gedung Utama', '30', 'Standard'],
  },
  books: {
    key: 'books',
    label: 'Kitab & Buku Acuan',
    description: 'Pustaka rujukan kitab kuning dan buku ajar santri.',
    headers: ['id', 'title', 'author', 'publisher', 'volumeCount', 'displayCode'],
    sampleRow: ['bk-101', 'Al-Ajurrumiyyah', 'Ibnu Ajurrum', 'Dar Ihya', '1', 'BK-AJR'],
  },
  sessions: {
    key: 'sessions',
    label: 'Sesi Waktu Pembelajaran',
    description: 'Jam pelajaran (start time, end time, urutan sesi).',
    headers: ['id', 'name', 'start_time', 'end_time', 'sort_order'],
    sampleRow: ['ses-1', 'Sesi 1 (Pagi)', '07:30', '08:50', '1'],
  },
  rules: {
    key: 'rules',
    label: 'Aturan Jadwal (Rules)',
    description: 'Penugasan guru mengajar kelas di sesi & hari tertentu.',
    headers: ['id', 'subjectId', 'classId', 'teacherId', 'roomId', 'sessionId', 'daysOfWeek', 'active'],
    sampleRow: ['rul-101', 'sub-arb', 'cls-10a', 'tch-101', 'rm-101', 'ses-1', 'Monday;Wednesday', '1'],
  },
  syllabus: {
    key: 'syllabus',
    label: 'Silabus Materi Pelajaran',
    description: 'Rincian bab, pokok bahasan, dan rentang halaman buku.',
    headers: ['id', 'subjectId', 'bookId', 'title', 'chapter', 'pageStart', 'pageEnd'],
    sampleRow: ['syl-101', 'sub-arb', 'bk-101', 'Bab Kalam', '1', '1', '15'],
  },
};

/**
 * Triggers a browser download of CSV text
 */
export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
