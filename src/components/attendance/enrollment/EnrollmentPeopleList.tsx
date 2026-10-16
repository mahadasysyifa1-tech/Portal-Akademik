import React from 'react';
import {
  Users,
  Search,
  X,
  UserPlus,
  AlertCircle,
  GraduationCap,
  Eye,
  EyeOff,
  Check,
  Edit2,
  Trash2
} from 'lucide-react';
import {
  EnrollmentClass,
  EnrollmentStudent,
  EnrollmentTeacher,
} from './EnrollmentTypes';

export interface EnrollmentPeopleListProps {
  teachers: EnrollmentTeacher[];
  students: EnrollmentStudent[];
  assignedTeachers: EnrollmentTeacher[];
  unassignedTeachers: EnrollmentTeacher[];
  assignedStudents: EnrollmentStudent[];
  unassignedStudents: EnrollmentStudent[];
  selectedClassId: string;
  activeClass?: EnrollmentClass;
  classAssignedTeachersCount: number;
  classAssignedStudentsCount: number;
  selectedPerson: { type: 'teacher' | 'student'; id: string } | null;
  activePersonObj: { name: string; type: string } | null;
  peopleSearch: string;
  setPeopleSearch: (q: string) => void;
  hasPendingChanges: boolean;
  collapsedSections: {
    assignedTeachers: boolean;
    unassignedTeachers: boolean;
    assignedStudents: boolean;
    unassignedStudents: boolean;
  };
  toggleSection: (section: 'assignedTeachers' | 'unassignedTeachers' | 'assignedStudents' | 'unassignedStudents') => void;
  handlePersonClick: (type: 'teacher' | 'student', id: string) => void;
  handleClearClassSelection: () => void;
  handleClearPersonSelection: () => void;
  handleToggleTeacherInActiveClass: (teacherId: string, isAssigned: boolean) => void;
  handleToggleStudentInActiveClass: (studentId: string, isAssigned: boolean) => void;
  isAdmin: boolean;
  onOpenAddStudent: () => void;
  onOpenEditStudent: (std: EnrollmentStudent) => void;
  onDeleteStudent: (id: string, name: string) => void;
}

export const EnrollmentPeopleList: React.FC<EnrollmentPeopleListProps> = ({
  teachers,
  students,
  assignedTeachers,
  unassignedTeachers,
  assignedStudents,
  unassignedStudents,
  selectedClassId,
  activeClass,
  classAssignedTeachersCount,
  classAssignedStudentsCount,
  selectedPerson,
  activePersonObj,
  peopleSearch,
  setPeopleSearch,
  hasPendingChanges,
  collapsedSections,
  toggleSection,
  handlePersonClick,
  handleClearClassSelection,
  handleClearPersonSelection,
  handleToggleTeacherInActiveClass,
  handleToggleStudentInActiveClass,
  isAdmin,
  onOpenAddStudent,
  onOpenEditStudent,
  onDeleteStudent,
}) => {
  return (
    <div
      className={`lg:col-span-7 xl:col-span-8 rounded-xl border shadow-xs flex flex-col overflow-hidden min-h-[550px] max-h-[calc(100vh-100px)] transition-all duration-200 ${
        selectedPerson
          ? 'border-amber-400 ring-2 ring-amber-200/60 bg-amber-50/10'
          : 'border-slate-200 bg-white'
      }`}
    >
      {/* Div 2 Minimal Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="font-semibold text-sm text-slate-800 tracking-tight">Orang</span>
          <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 rounded-md">
            {teachers.length} Guru • {students.length} Siswa
          </span>
        </div>

        {/* Selection Status Badge */}
        <div className="flex items-center gap-1.5 min-w-0">
          {selectedClassId && activeClass && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full max-w-[200px] truncate">
              <span className="truncate">
                ({classAssignedTeachersCount} Guru • {classAssignedStudentsCount} Siswa)
              </span>
              <button
                type="button"
                onClick={handleClearClassSelection}
                title="Tampilkan semua orang"
                className="hover:text-red-600 ml-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {selectedPerson && activePersonObj && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-amber-100 text-amber-700 border border-amber-200 rounded-full max-w-[180px] truncate">
              <span className="truncate">Terpilih: {activePersonObj.name}</span>
              <button
                type="button"
                onClick={handleClearPersonSelection}
                title="Hapus pilihan"
                className="hover:text-red-600 ml-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={onOpenAddStudent}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded transition shadow-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Siswa</span>
            </button>
          )}
        </div>
      </div>

      {/* Div 2 Minimal Unified Filter */}
      <div className="p-2 flex-shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={peopleSearch}
            onChange={(e) => setPeopleSearch(e.target.value)}
            placeholder="Cari guru atau siswa (nama, kode, NISN)..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition"
          />
          {peopleSearch && (
            <button
              type="button"
              onClick={() => setPeopleSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Pending Changes In-Memory Notification Banner */}
      {hasPendingChanges && (
        <div className="px-3 py-1.5 bg-amber-50/90 border-b border-amber-200 text-amber-800 text-[11px] flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="truncate">
              Perubahan dicatat di memori lokal. Tekan tombol <strong>Simpan Perubahan</strong> di header atas untuk menyimpan ke Turso.
            </span>
          </div>
        </div>
      )}

      {/* Div 2 People List Container: 4 Main Sub-sections */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3.5">
        {/* ================================================================ */}
        {/* SUB-DIV 1: GURU DITUGASKAN                                       */}
        {/* ================================================================ */}
        {assignedTeachers.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-bold bg-amber-300 text-slate-700 uppercase tracking-wider bg-slate-100/70 border border-slate-200/60 rounded-md">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                <span>Guru Ditugaskan</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full">
                  {assignedTeachers.length}
                </span>
              </span>
              <button
                type="button"
                onClick={() => toggleSection('assignedTeachers')}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded transition cursor-pointer"
                title={collapsedSections.assignedTeachers ? 'Tampilkan Guru Ditugaskan' : 'Sembunyikan Guru Ditugaskan'}
              >
                {collapsedSections.assignedTeachers ? (
                  <>
                    <EyeOff className="w-3 h-3 text-slate-400" />
                    <span className="font-normal text-[10px]">Sembunyi</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3 text-slate-600" />
                    <span className="font-normal text-[10px]">Tampil</span>
                  </>
                )}
              </button>
            </div>

            {!collapsedSections.assignedTeachers && (
              <div className="space-y-1">
                {assignedTeachers.map((tch) => {
                  const isTeacherAssignedToActiveClass = selectedClassId
                    ? tch.assignedClassIds.includes(selectedClassId)
                    : tch.assignedClassIds.length > 0;

                  const isPersonSelected =
                    selectedPerson?.type === 'teacher' && selectedPerson.id === tch.id;

                  const isDimmed = selectedPerson && !isPersonSelected;

                  return (
                    <div
                      key={`tch-assigned-${tch.id}`}
                      onClick={() => handlePersonClick('teacher', tch.id)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition cursor-pointer text-xs ${
                        isPersonSelected
                          ? 'bg-amber-50 border-amber-400 text-amber-950 ring-1 ring-amber-400 shadow-xs font-semibold opacity-100'
                          : isDimmed
                          ? 'bg-white border-transparent text-slate-400 opacity-40 hover:opacity-90 hover:bg-slate-50 hover:border-slate-200'
                          : selectedClassId && isTeacherAssignedToActiveClass
                          ? 'bg-amber-100 border-slate-300 text-slate-900 shadow-xs opacity-100'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-amber-300 hover:bg-amber-50 opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {selectedClassId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTeacherInActiveClass(tch.id, true);
                            }}
                            title="Keluarkan guru dari rombel ini"
                            className="w-4 h-4 flex items-center justify-center rounded border transition flex-shrink-0 bg-amber-600 border-amber-600 text-white cursor-pointer"
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </button>
                        )}

                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded flex-shrink-0 ${
                            isPersonSelected
                              ? 'bg-amber-600 text-white'
                              : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          Guru
                        </span>

                        <span className="truncate font-medium">{tch.name}</span>
                        {tch.panggilan && (
                          <span className="text-[11px] text-slate-400 truncate">
                            ({tch.panggilan})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                        {tch.assignedClassIds.length > 0 ? (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded truncate max-w-[150px]">
                            {tch.assignedClassIds.join(', ')}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[10px]">Belum ada rombel</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* SUB-DIV 2: GURU BELUM DITUGASKAN                                 */}
        {/* ================================================================ */}
        {unassignedTeachers.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider bg-slate-100/50 border border-slate-200/50 rounded-md">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-slate-300" />
                <span className="text-slate-400">Guru Belum Ditugaskan</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-slate-200/70 text-slate-700 rounded-full">
                  {unassignedTeachers.length}
                </span>
              </span>
              <button
                type="button"
                onClick={() => toggleSection('unassignedTeachers')}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded transition cursor-pointer"
                title={collapsedSections.unassignedTeachers ? 'Tampilkan Guru Belum Ditugaskan' : 'Sembunyikan'}
              >
                {collapsedSections.unassignedTeachers ? (
                  <>
                    <EyeOff className="w-3 h-3 text-slate-400" />
                    <span className="font-normal text-[10px]">Sembunyi</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3 text-slate-600" />
                    <span className="font-normal text-[10px]">Tampil</span>
                  </>
                )}
              </button>
            </div>

            {!collapsedSections.unassignedTeachers && (
              <div className="space-y-1">
                {unassignedTeachers.map((tch) => {
                  const isPersonSelected =
                    selectedPerson?.type === 'teacher' && selectedPerson.id === tch.id;
                  const isDimmed = selectedPerson && !isPersonSelected;

                  return (
                    <div
                      key={`tch-unassigned-${tch.id}`}
                      onClick={() => handlePersonClick('teacher', tch.id)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition cursor-pointer text-xs ${
                        isPersonSelected
                          ? 'bg-amber-50 border-amber-400 text-amber-950 ring-1 ring-amber-400 shadow-xs font-semibold opacity-100'
                          : isDimmed
                          ? 'bg-white border-transparent text-slate-400 opacity-40 hover:opacity-90 hover:bg-slate-50 hover:border-slate-200'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-amber-300 hover:bg-slate-50 opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {selectedClassId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleTeacherInActiveClass(tch.id, false);
                            }}
                            title="Tugaskan guru ke rombel aktif ini"
                            className="w-4 h-4 flex items-center justify-center rounded border transition flex-shrink-0 bg-white border-slate-300 text-transparent hover:border-amber-500 cursor-pointer"
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </button>
                        )}

                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded flex-shrink-0 ${
                            isPersonSelected
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Guru
                        </span>

                        <span className="truncate font-medium">{tch.name}</span>
                        {tch.panggilan && (
                          <span className="text-[11px] text-slate-400 truncate">
                            ({tch.panggilan})
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        Belum mengajar
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* SUB-DIV 3: SISWA DITUGASKAN                                      */}
        {/* ================================================================ */}
        {assignedStudents.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider bg-slate-100/70 border border-slate-200/60 rounded-md">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-600" />
                <span>Siswa Terdaftar</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full">
                  {assignedStudents.length}
                </span>
              </span>
              <button
                type="button"
                onClick={() => toggleSection('assignedStudents')}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded transition cursor-pointer"
                title={collapsedSections.assignedStudents ? 'Tampilkan Siswa Ditugaskan' : 'Sembunyikan'}
              >
                {collapsedSections.assignedStudents ? (
                  <>
                    <EyeOff className="w-3 h-3 text-slate-400" />
                    <span className="font-normal text-[10px]">Sembunyi</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3 text-slate-600" />
                    <span className="font-normal text-[10px]">Tampil</span>
                  </>
                )}
              </button>
            </div>

            {!collapsedSections.assignedStudents && (
              <div className="space-y-1">
                {assignedStudents.map((std) => {
                  const isStudentEnrolledInActiveClass = selectedClassId
                    ? std.enrolledClassIds.includes(selectedClassId)
                    : std.enrolledClassIds.length > 0;

                  const isPersonSelected =
                    selectedPerson?.type === 'student' && selectedPerson.id === std.id;

                  const isDimmed = selectedPerson && !isPersonSelected;

                  return (
                    <div
                      key={`std-assigned-${std.id}`}
                      onClick={() => handlePersonClick('student', std.id)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition cursor-pointer text-xs ${
                        isPersonSelected
                          ? 'bg-amber-50 border-amber-400 text-amber-950 ring-1 ring-amber-400 shadow-xs font-semibold opacity-100'
                          : isDimmed
                          ? 'bg-white border-transparent text-slate-400 opacity-40 hover:opacity-90 hover:bg-slate-50 hover:border-slate-200'
                          : selectedClassId && isStudentEnrolledInActiveClass
                          ? 'bg-amber-100 border-slate-300 text-slate-900 shadow-xs opacity-100'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-amber-300 hover:bg-amber-50 opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {selectedClassId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStudentInActiveClass(std.id, true);
                            }}
                            title="Keluarkan santri dari rombel ini"
                            className="w-4 h-4 flex items-center justify-center rounded border transition flex-shrink-0 bg-indigo-600 border-indigo-600 text-white cursor-pointer"
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </button>
                        )}

                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded flex-shrink-0 ${
                            std.gender === 'P'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {std.gender}
                        </span>

                        <span className="truncate font-medium">{std.name}</span>

                        {std.nisn && (
                          <span className="text-[11px] text-slate-400 font-mono truncate">
                            {std.nisn}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {std.enrolledClassIds.length > 0 ? (
                          <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded truncate max-w-[150px]">
                            {std.enrolledClassIds.join(', ')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                            Belum ada rombel
                          </span>
                        )}

                        {isAdmin && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenEditStudent(std);
                              }}
                              title="Edit Siswa"
                              className="p-1 text-slate-400 hover:text-amber-600 rounded cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteStudent(std.id, std.name);
                              }}
                              title="Hapus Siswa"
                              className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* SUB-DIV 4: SISWA BELUM DITUGASKAN                                */}
        {/* ================================================================ */}
        {unassignedStudents.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider bg-slate-100/50 border border-slate-200/50 rounded-md">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Siswa Belum Terdaftar</span>
                <span className="px-1.5 py-0.2 text-[10px] font-bold bg-slate-200/70 text-slate-700 rounded-full">
                  {unassignedStudents.length}
                </span>
              </span>
              <button
                type="button"
                onClick={() => toggleSection('unassignedStudents')}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded transition cursor-pointer"
                title={collapsedSections.unassignedStudents ? 'Tampilkan Siswa Belum Ditugaskan' : 'Sembunyikan'}
              >
                {collapsedSections.unassignedStudents ? (
                  <>
                    <EyeOff className="w-3 h-3 text-slate-400" />
                    <span className="font-normal text-[10px]">Sembunyi</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3 text-slate-600" />
                    <span className="font-normal text-[10px]">Tampil</span>
                  </>
                )}
              </button>
            </div>

            {!collapsedSections.unassignedStudents && (
              <div className="space-y-1">
                {unassignedStudents.map((std) => {
                  const isPersonSelected =
                    selectedPerson?.type === 'student' && selectedPerson.id === std.id;
                  const isDimmed = selectedPerson && !isPersonSelected;

                  return (
                    <div
                      key={`std-unassigned-${std.id}`}
                      onClick={() => handlePersonClick('student', std.id)}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition cursor-pointer text-xs ${
                        isPersonSelected
                          ? 'bg-amber-50 border-amber-400 text-amber-950 ring-1 ring-amber-400 shadow-xs font-semibold opacity-100'
                          : isDimmed
                          ? 'bg-white border-transparent text-slate-400 opacity-40 hover:opacity-90 hover:bg-slate-50 hover:border-slate-200'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-300 hover:bg-slate-50 opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {selectedClassId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStudentInActiveClass(std.id, false);
                            }}
                            title="Tugaskan santri ke rombel aktif ini"
                            className="w-4 h-4 flex items-center justify-center rounded border transition flex-shrink-0 bg-white border-slate-300 text-transparent hover:border-indigo-500 cursor-pointer"
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </button>
                        )}

                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded flex-shrink-0 ${
                            std.gender === 'P'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {std.gender}
                        </span>

                        <span className="truncate font-medium">{std.name}</span>

                        {std.nisn && (
                          <span className="text-[11px] text-slate-400 font-mono truncate">
                            {std.nisn}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {std.enrolledClassIds.length > 0 ? (
                          <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded truncate max-w-[150px]">
                            {std.enrolledClassIds.join(', ')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                            Belum ada rombel
                          </span>
                        )}

                        {isAdmin && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenEditStudent(std);
                              }}
                              title="Edit Siswa"
                              className="p-1 text-slate-400 hover:text-amber-600 rounded cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteStudent(std.id, std.name);
                              }}
                              title="Hapus Siswa"
                              className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Empty state when all 4 categories have 0 people */}
        {assignedTeachers.length === 0 &&
          unassignedTeachers.length === 0 &&
          assignedStudents.length === 0 &&
          unassignedStudents.length === 0 && (
            <div className="text-center py-8 text-xs text-slate-400 italic">
              {peopleSearch
                ? `Tidak ada guru atau siswa yang cocok dengan pencarian "${peopleSearch}".`
                : 'Tidak ada data orang.'}
            </div>
          )}
      </div>

      {/* Div 2 Bottom Status Footer */}
      <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between flex-shrink-0">
        <span>
          {selectedPerson
            ? 'Klik person aktif untuk batal pilih'
            : selectedClassId
            ? 'Centang kotak untuk memasukkan/mengeluarkan dari rombel'
            : 'Pilih guru atau siswa untuk melihat rombel terhubung'}
        </span>
        {selectedPerson && (
          <button
            type="button"
            onClick={handleClearPersonSelection}
            className="text-amber-600 hover:underline font-medium cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};
