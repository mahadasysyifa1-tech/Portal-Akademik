import React from 'react';
import {
  BookOpen,
  ChevronRight,
  ArrowLeft,
  Layers,
  Search,
  School
} from 'lucide-react';
import type { DatabaseState, Subject, ClassEntity, Teacher } from '../../types';
import { getUnitsForSubject, computePacingProjection } from '../../utils/pacingEngine';

export type SyllabusFilterMode = 'all' | 'class' | 'teacher';

export interface SyllabusSubjectPickerProps {
  db: DatabaseState;
  selectedSubjectId: string | null;
  selectedClassId: string | null;
  onSelectSubject: (subjectId: string) => void;
  onSelectClass: (classId: string) => void;
  onBackToSubjects: () => void;
  filterMode: SyllabusFilterMode;
  setFilterMode: (mode: SyllabusFilterMode) => void;
  filterClassId: string;
  setFilterClassId: (id: string) => void;
  filterTeacherId: string;
  setFilterTeacherId: (id: string) => void;
  subjectSearch: string;
  setSubjectSearch: (search: string) => void;
  availableSubjects: Subject[];
  applicableClasses: ClassEntity[];
  currentSubject?: Subject;
  selectedFilterClass?: ClassEntity;
  selectedFilterTeacher?: Teacher;
}

export const SyllabusSubjectPicker: React.FC<SyllabusSubjectPickerProps> = ({
  db,
  selectedSubjectId,
  selectedClassId,
  onSelectSubject,
  onSelectClass,
  onBackToSubjects,
  filterMode,
  setFilterMode,
  filterClassId,
  setFilterClassId,
  filterTeacherId,
  setFilterTeacherId,
  subjectSearch,
  setSubjectSearch,
  availableSubjects,
  applicableClasses,
  currentSubject,
  selectedFilterClass,
  selectedFilterTeacher,
}) => {
  // STEP 1: SUBJECT PICKER (If no subject is selected)
  if (!selectedSubjectId) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              Pilih Mata Pelajaran
            </h3>
            <p className="text-xs text-slate-100">
              {filterMode === 'class'
                ? `Menampilkan mata pelajaran untuk ${selectedFilterClass?.name || 'kelas terpilih'}`
                : filterMode === 'teacher'
                ? `Menampilkan mata pelajaran yang diampu oleh ${selectedFilterTeacher?.panggilan || selectedFilterTeacher?.name || 'guru terpilih'}`
                : 'Menampilkan seluruh mata pelajaran aktif'}
            </p>
          </div>

          {/* Filter controls & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Manual Filter Selector Div */}
            <div
              id="journal-subject-filter-selector"
              className="flex items-center gap-1.5 text-xs bg-slate-50 p-1 rounded-xl border border-slate-200/90"
            >
              <span className="text-[11px] text-slate-400 font-semibold px-1.5 hidden sm:inline">
                Filter:
              </span>
              <div className="inline-flex rounded-lg p-0.5 bg-slate-200/60">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-white text-amber-800 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('class');
                    if (!filterClassId && db.classes.length > 0) {
                      setFilterClassId(db.classes[0].id);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    filterMode === 'class'
                      ? 'bg-white text-amber-800 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kelas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('teacher');
                    if (!filterTeacherId && db.teachers.length > 0) {
                      setFilterTeacherId(db.teachers[0].id);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    filterMode === 'teacher'
                      ? 'bg-white text-amber-800 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Guru
                </button>
              </div>

              {/* Dropdown if 'class' is active */}
              {filterMode === 'class' && (
                <select
                  value={filterClassId || db.classes[0]?.id || ''}
                  onChange={(e) => setFilterClassId(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  {db.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Dropdown if 'teacher' is active */}
              {filterMode === 'teacher' && (
                <select
                  value={filterTeacherId || db.teachers[0]?.id || ''}
                  onChange={(e) => setFilterTeacherId(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  {db.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.panggilan || t.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari mata pelajaran..."
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {availableSubjects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Tidak Ada Mata Pelajaran</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Belum ada jadwal aktif untuk peran atau sudut pandang yang Anda pilih. Silakan ganti peran atau periksa jadwal master.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {availableSubjects
              .filter(
                (s) =>
                  s.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
                  s.code.toLowerCase().includes(subjectSearch.toLowerCase()) ||
                  s.department.toLowerCase().includes(subjectSearch.toLowerCase())
              )
              .map((subject) => {
                const unitCount = getUnitsForSubject(db, subject.id).length;

                return (
                  <div
                    key={subject.id}
                    onClick={() => onSelectSubject(subject.id)}
                    className="group bg-white rounded-2xl border border-slate-200/90 p-4 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1.5"
                      style={{ backgroundColor: subject.color || '#3B82F6' }}
                    />

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                          {subject.code}
                        </span>
                        <span className="text-lg font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                          {subject.name}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {subject.department}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                          <Layers className="w-3.5 h-3.5 text-amber-600" />
                          {unitCount} Bab Silabus
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    );
  }

  // STEP 2: CLASS-SECTION PICKER (If subject selected but multiple classes available)
  if (selectedSubjectId && !selectedClassId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToSubjects}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
            title="Kembali ke daftar pelajaran"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              Pilih Kelas &amp; Rombel: {currentSubject?.name}
            </h3>
            <p className="text-xs text-slate-100">
              Pelajaran ini dijadwalkan pada lebih dari satu rombel kelas. Pilih kelas yang ingin ditinjau.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {applicableClasses.map((cls) => {
            const sessions = computePacingProjection(db, selectedSubjectId, cls.id);

            return (
              <div
                key={cls.id}
                onClick={() => onSelectClass(cls.id)}
                className="bg-white rounded-2xl border border-slate-200/90 p-4 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
                    <School className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{cls.name}</h4>
                    <p className="text-xs text-slate-500">
                      Kelas {cls.grade} • Rombel {cls.section} • {cls.studentCount} Peserta
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-semibold">
                  <span>{sessions.length} Sesi Terjadwal</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};
