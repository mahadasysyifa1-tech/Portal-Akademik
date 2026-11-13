import React from 'react';
import {
  Users,
  GraduationCap,
  DoorOpen,
  BookOpen,
  BookmarkCheck,
  Clock,
  Calendar,
  Layers,
  Database,
  UserCheck
} from 'lucide-react';
import { DatabaseState } from '../../types';

export type DatabaseSubTab =
  | 'classes'
  | 'teachers'
  | 'students'
  | 'rooms'
  | 'subjects'
  | 'books'
  | 'sessions'
  | 'periods'
  | 'materi'
  | 'requests';

export interface EntityTabDef {
  id: DatabaseSubTab;
  name: string;
  singularName: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  getCount: (db: DatabaseState) => number;
}

export const ENTITY_TABS: EntityTabDef[] = [
  {
    id: 'classes',
    name: 'Kelas',
    singularName: 'Kelas',
    icon: Users,
    description: 'Kelola rombongan belajar, jenjang tingkat, dan seksi kelas.',
    getCount: (db) => (db.classes || []).length
  },
  {
    id: 'teachers',
    name: 'Pengajar',
    singularName: 'Ustadz / Pengajar',
    icon: Users,
    description: 'Kelola direktori dewan ustadz, panggilan, email, dan departemen.',
    getCount: (db) => (db.teachers || []).length
  },
  {
    id: 'students',
    name: 'Santri',
    singularName: 'Santri',
    icon: GraduationCap,
    description: 'Kelola biodata santri, NISN, kontak wali, dan nomor panggilan.',
    getCount: (db) => (db.students || []).length
  },
  {
    id: 'rooms',
    name: 'Ruangan',
    singularName: 'Ruangan',
    icon: DoorOpen,
    description: 'Kelola ruang kelas, laboratorium, gedung, dan kapasitas daya tampung.',
    getCount: (db) => (db.rooms || []).length
  },
  {
    id: 'subjects',
    name: 'Mapel',
    singularName: 'Mata Pelajaran',
    icon: BookOpen,
    description: 'Kelola kurikulum mata pelajaran, kode singkatan, warna tema, dan kitab default.',
    getCount: (db) => (db.subjects || []).length
  },
  {
    id: 'books',
    name: 'Kitab',
    singularName: 'Kitab Ajar',
    icon: BookmarkCheck,
    description: 'Kelola referensi kitab ajar, jilid/volume, dan tautan dokumen pendukung.',
    getCount: (db) => (db.books || []).length
  },
  {
    id: 'sessions',
    name: 'Sesi KBM',
    singularName: 'Sesi KBM',
    icon: Clock,
    description: 'Kelola slot waktu jam pelajaran. Urutan otomatis dan soft warning tumpang-tindih.',
    getCount: (db) => (db.sessions || []).length
  },
  {
    id: 'periods',
    name: 'Periode',
    singularName: 'Periode / Cawu',
    icon: Calendar,
    description: 'Kelola rentang cawu atau semester kalender pendidikan akademik.',
    getCount: (db) => (db.periods || []).length
  },
  {
    id: 'materi',
    name: 'Materi Silabus',
    singularName: 'Bab Materi',
    icon: Layers,
    description: 'Kelola butir-butir bab silabus per kitab ajar dan rentang halamannya.',
    getCount: (db) => (db.syllabusUnits || []).length
  },
  {
    id: 'requests',
    name: 'Permintaan Akun',
    singularName: 'Permintaan Akun',
    icon: UserCheck,
    description: 'Verifikasi dan aktivasi permohonan akun santri dan pengajar.',
    getCount: (db) => 0
  }
];

export const ROOM_TYPES = [
  { value: 'Standard', label: 'Ruang Kelas / Teori' },
  { value: 'Computer Lab', label: 'Lab Komputer' },
  { value: 'Science Lab', label: 'Lab Sains' },
  { value: 'Auditorium', label: 'Aula / Auditorium' },
  { value: 'Masjid', label: 'Masjid / Musholla' },
  { value: 'Lainnya', label: 'Lainnya' }
] as const;

export const DEFAULT_PALETTE_COLORS = [
  '#3B82F6', // Blue
  '#4F46E5', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#059669', // Teal
  '#F59E0B', // Amber
  '#EA580C', // Orange
  '#DC2626', // Red
  '#64748B'  // Slate
];

// Helper: check time string overlap (HH:MM vs HH:MM)
export const checkTimeOverlap = (
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean => {
  if (!startA || !endA || !startB || !endB) return false;
  return startA < endB && endA > startB;
};
