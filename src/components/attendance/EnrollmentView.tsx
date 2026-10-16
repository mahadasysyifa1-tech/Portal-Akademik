import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sparkles, X } from 'lucide-react';
import { DatabaseState, StudentRecord, EnrollmentRecord } from '../../types';
import {
  EnrollmentStudent,
  EnrollmentClass,
  EnrollmentTeacher,
  NewStudentFormData,
  NewClassFormData,
} from './enrollment/EnrollmentTypes';
import { EnrollmentClassList } from './enrollment/EnrollmentClassList';
import { EnrollmentPeopleList } from './enrollment/EnrollmentPeopleList';
import { EnrollmentModals } from './enrollment/EnrollmentModals';

export type {
  EnrollmentStudent,
  EnrollmentClass,
  EnrollmentTeacher,
  NewStudentFormData,
  NewClassFormData,
};

interface EnrollmentViewProps {
  db: DatabaseState;
  isAdmin: boolean;
  onOpenAdminLogin: () => void;
  onBackToPresensi?: () => void;
  onUpdateDb?: (updater: (prev: DatabaseState) => DatabaseState) => void;
}

export const EnrollmentView: React.FC<EnrollmentViewProps> = ({
  db,
  isAdmin,
  onOpenAdminLogin,
  onBackToPresensi: _onBackToPresensi,
  onUpdateDb,
}) => {
  // Mutually exclusive selection:
  // If selectedClassId is set, selectedPerson is null
  // If selectedPerson is set, selectedClassId is null
  // If both are empty/null, full default view without dimming
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedPerson, setSelectedPerson] = useState<{ type: 'teacher' | 'student'; id: string } | null>(null);

  // Search queries
  const [classSearch, setClassSearch] = useState('');
  const [peopleSearch, setPeopleSearch] = useState('');

  // Local data state
  const [_loading, setLoading] = useState(true);
  const [students, setStudents] = useState<EnrollmentStudent[]>([]);
  const [classes, setClasses] = useState<EnrollmentClass[]>([]);
  const [teachers, setTeachers] = useState<EnrollmentTeacher[]>([]);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ text: string; type: 'info' | 'success' | 'warn' } | null>(null);

  // Modal for new student
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    nisn: '',
    gender: 'L' as 'L' | 'P',
    phone: '',
    classId: '',
  });

  // Modal for edit student
  const [editStudentModal, setEditStudentModal] = useState<EnrollmentStudent | null>(null);

  // Modal for quick new class
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [newClassForm, setNewClassForm] = useState({
    name: '',
    grade: 7,
    section: 'A',
  });

  // Flash temporary notification
  const notify = (text: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setActionNotice({ text, type });
    setTimeout(() => {
      setActionNotice((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Build enrollment overview from local db and initial server state
  const loadInitialData = useCallback(() => {
    try {
      setLoading(true);

      // 1. Build classes from db
      const classMap = new Map<string, EnrollmentClass>();
      (db.classes || []).forEach((c) => {
        classMap.set(c.id, {
          id: c.id,
          name: c.name,
          grade: c.grade,
          section: c.section,
          color: c.color,
          studentCount: c.studentCount || 0,
        });
      });

      // 2. Build teachers from db (read assignedClassIds and rules)
      const teacherClassMap = new Map<string, Set<string>>();
      (db.teachers || []).forEach((t) => {
        if (Array.isArray(t.assignedClassIds)) {
          if (!teacherClassMap.has(t.id)) teacherClassMap.set(t.id, new Set());
          t.assignedClassIds.forEach((cId) => teacherClassMap.get(t.id)!.add(cId));
        }
      });
      (db.rules || []).forEach((r) => {
        if (r.active !== false && r.teacherId && r.classId) {
          if (!teacherClassMap.has(r.teacherId)) teacherClassMap.set(r.teacherId, new Set());
          teacherClassMap.get(r.teacherId)!.add(r.classId);
        }
      });

      const teacherList: EnrollmentTeacher[] = (db.teachers || []).map((t) => ({
        id: t.id,
        name: t.name,
        panggilan: t.panggilan,
        color: t.color,
        department: t.department,
        assignedClassIds: Array.from(teacherClassMap.get(t.id) || []),
      }));
      setTeachers(teacherList);

      // 3. Build students from db.students or fetch from overview
      if (Array.isArray(db.students) && db.students.length > 0) {
        // Build enrollment map from db.enrollments
        const studentEnrollMap = new Map<string, string[]>();
        if (Array.isArray(db.enrollments)) {
          db.enrollments.forEach((e) => {
            if (e.active !== false && e.active !== 0 && e.studentId && e.classId) {
              const list = studentEnrollMap.get(e.studentId) || [];
              if (!list.includes(e.classId)) list.push(e.classId);
              studentEnrollMap.set(e.studentId, list);
            }
          });
        }

        const studentList: EnrollmentStudent[] = db.students.map((s) => ({
          id: s.id,
          nisn: s.nisn || '',
          name: s.name,
          gender: s.gender === 'P' ? 'P' : 'L',
          phone: s.phone,
          enrolledClassIds: s.enrolledClassIds || studentEnrollMap.get(s.id) || [],
        }));

        // Recalculate live class counts
        const classCountMap = new Map<string, number>();
        studentList.forEach((s) => {
          s.enrolledClassIds.forEach((cId) => {
            classCountMap.set(cId, (classCountMap.get(cId) || 0) + 1);
          });
        });

        const classList = Array.from(classMap.values()).map((c) => ({
          ...c,
          studentCount: classCountMap.get(c.id) ?? c.studentCount,
        }));

        setStudents(studentList);
        setClasses(classList);
        setLoading(false);
      } else {
        // Fetch from API overview once
        fetch('/api/enrollment/overview')
          .then((res) => {
            if (!res.ok) throw new Error('API offline');
            return res.json();
          })
          .then((data) => {
            if (data.students && Array.isArray(data.students)) {
              setStudents(data.students);
            }
            if (data.classes && Array.isArray(data.classes)) {
              setClasses(data.classes);
            } else {
              setClasses(Array.from(classMap.values()));
            }
            if (data.teachers && Array.isArray(data.teachers)) {
              setTeachers(data.teachers);
            }
          })
          .catch(() => {
            // Fallback purely on local db
            setClasses(Array.from(classMap.values()));
            setStudents([]);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    } catch {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Sync state changes to db without writing to network (Client-First)
  const syncToDb = (
    nextStudents: EnrollmentStudent[],
    nextClasses: EnrollmentClass[],
    nextTeachers: EnrollmentTeacher[]
  ) => {
    setHasPendingChanges(true);

    if (onUpdateDb) {
      onUpdateDb((prevDb) => {
        // 1. Build updated enrollments array
        const enrollments: EnrollmentRecord[] = [];
        nextStudents.forEach((s) => {
          s.enrolledClassIds.forEach((cId) => {
            enrollments.push({
              classId: cId,
              studentId: s.id,
              academicYear: '2025/2026',
              active: 1,
            });
          });
        });

        // 2. Updated student records
        const studentRecords: StudentRecord[] = nextStudents.map((s) => ({
          id: s.id,
          nisn: s.nisn,
          name: s.name,
          gender: s.gender,
          phone: s.phone,
          enrolledClassIds: s.enrolledClassIds,
        }));

        // 3. Updated classes with correct live counts
        const classCountMap = new Map<string, number>();
        nextStudents.forEach((s) => {
          s.enrolledClassIds.forEach((cId) => {
            classCountMap.set(cId, (classCountMap.get(cId) || 0) + 1);
          });
        });

        const updatedClasses = (prevDb.classes || []).map((c) => ({
          ...c,
          studentCount: classCountMap.get(c.id) ?? 0,
        }));

        // 4. Update teachers with assignedClassIds
        const teacherMap = new Map(nextTeachers.map((nt) => [nt.id, nt]));
        const updatedTeachers = (prevDb.teachers || []).map((t) => {
          const match = teacherMap.get(t.id);
          return match ? { ...t, assignedClassIds: match.assignedClassIds } : t;
        });

        // 5. Keep rules synchronized so teacher assignments persist
        const currentRules = [...(prevDb.rules || [])];
        nextTeachers.forEach((t) => {
          t.assignedClassIds.forEach((cId) => {
            const hasRule = currentRules.some(
              (r) => r.active !== false && r.teacherId === t.id && r.classId === cId
            );
            if (!hasRule) {
              currentRules.push({
                id: `rul-assign-${t.id}-${cId}`,
                subjectId: prevDb.subjects?.[0]?.id || 'sub-1',
                classId: cId,
                teacherId: t.id,
                roomId: prevDb.rooms?.[0]?.id || 'rom-1',
                sessionId: prevDb.sessions?.[0]?.id || 'ses-1',
                periodIds: [],
                repeatDetail: 'Weekly',
                active: true,
              });
            }
          });
        });

        const finalRules = currentRules.map((r) => {
          const teacherAssignedClasses = teacherMap.get(r.teacherId)?.assignedClassIds;
          if (teacherAssignedClasses && !teacherAssignedClasses.includes(r.classId)) {
            return { ...r, active: false };
          }
          return r;
        });

        return {
          ...prevDb,
          classes: updatedClasses,
          teachers: updatedTeachers,
          rules: finalRules,
          students: studentRecords,
          enrollments,
        };
      });
    }

    notify('Tekan tombol Simpan Perubahan untuk menyimpan.', 'info');
  };

  // ============================================================================
  // Mutually Exclusive Selection Handlers
  // ============================================================================

  // Clicking a class card ALWAYS selects/deselects the class and activates Class div
  const handleClassClick = (classId: string) => {
    if (selectedClassId === classId) {
      setSelectedClassId('');
    } else {
      setSelectedClassId(classId);
      setSelectedPerson(null); // Clears person selection immediately!
    }
  };

  // Clicking a person card ALWAYS selects/deselects the person and activates Person div
  const handlePersonClick = (type: 'teacher' | 'student', id: string) => {
    if (selectedPerson?.id === id && selectedPerson?.type === type) {
      setSelectedPerson(null);
    } else {
      setSelectedPerson({ type, id });
      setSelectedClassId(''); // Clears class selection immediately!
    }
  };

  const handleClearClassSelection = () => {
    setSelectedClassId('');
  };

  const handleClearPersonSelection = () => {
    setSelectedPerson(null);
  };

  // ============================================================================
  // Checkbox Toggle Handlers (Client-First)
  // ============================================================================

  // When Class div is active: toggle Student enrollment in active class
  const handleToggleStudentInActiveClass = (studentId: string, currentEnrolled: boolean) => {
    if (!isAdmin) {
      onOpenAdminLogin();
      return;
    }
    if (!selectedClassId) return;

    const nextStudents = students.map((s) => {
      if (s.id !== studentId) return s;
      const set = new Set(s.enrolledClassIds);
      if (currentEnrolled) {
        set.delete(selectedClassId);
      } else {
        set.add(selectedClassId);
      }
      return { ...s, enrolledClassIds: Array.from(set) };
    });

    const nextClasses = classes.map((c) => {
      if (c.id !== selectedClassId) return c;
      return {
        ...c,
        studentCount: Math.max(0, c.studentCount + (currentEnrolled ? -1 : 1)),
      };
    });

    setStudents(nextStudents);
    setClasses(nextClasses);
    syncToDb(nextStudents, nextClasses, teachers);
  };

  // When Class div is active: toggle Teacher assignment in active class
  const handleToggleTeacherInActiveClass = (teacherId: string, currentAssigned: boolean) => {
    if (!isAdmin) {
      onOpenAdminLogin();
      return;
    }
    if (!selectedClassId) return;

    const nextTeachers = teachers.map((t) => {
      if (t.id !== teacherId) return t;
      const set = new Set(t.assignedClassIds);
      if (currentAssigned) {
        set.delete(selectedClassId);
      } else {
        set.add(selectedClassId);
      }
      return { ...t, assignedClassIds: Array.from(set) };
    });

    setTeachers(nextTeachers);
    syncToDb(students, classes, nextTeachers);
  };

  // When Person div is active: ONLY clicking the checkbox toggles assignment to that class
  const handleToggleClassForActivePerson = (classId: string, isAssigned: boolean) => {
    if (!isAdmin) {
      onOpenAdminLogin();
      return;
    }
    if (!selectedPerson) return;

    if (selectedPerson.type === 'student') {
      const nextStudents = students.map((s) => {
        if (s.id !== selectedPerson.id) return s;
        const set = new Set(s.enrolledClassIds);
        if (isAssigned) {
          set.delete(classId);
        } else {
          set.add(classId);
        }
        return { ...s, enrolledClassIds: Array.from(set) };
      });

      const nextClasses = classes.map((c) => {
        if (c.id !== classId) return c;
        return {
          ...c,
          studentCount: Math.max(0, c.studentCount + (isAssigned ? -1 : 1)),
        };
      });

      setStudents(nextStudents);
      setClasses(nextClasses);
      syncToDb(nextStudents, nextClasses, teachers);
    } else {
      // Teacher
      const nextTeachers = teachers.map((t) => {
        if (t.id !== selectedPerson.id) return t;
        const set = new Set(t.assignedClassIds);
        if (isAssigned) {
          set.delete(classId);
        } else {
          set.add(classId);
        }
        return { ...t, assignedClassIds: Array.from(set) };
      });

      setTeachers(nextTeachers);
      syncToDb(students, classes, nextTeachers);
    }
  };

  // ============================================================================
  // Add / Edit / Delete Student Handlers (Client-First)
  // ============================================================================

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentForm.name.trim()) return;

    const newId = `std-${Date.now()}`;
    const targetClass = newStudentForm.classId || selectedClassId || '';
    const newStudent: EnrollmentStudent = {
      id: newId,
      nisn: newStudentForm.nisn.trim(),
      name: newStudentForm.name.trim(),
      gender: newStudentForm.gender,
      phone: newStudentForm.phone.trim() || undefined,
      enrolledClassIds: targetClass ? [targetClass] : [],
    };

    const nextStudents = [newStudent, ...students];
    const nextClasses = classes.map((c) => {
      if (c.id !== targetClass) return c;
      return { ...c, studentCount: c.studentCount + 1 };
    });

    setStudents(nextStudents);
    setClasses(nextClasses);
    syncToDb(nextStudents, nextClasses, teachers);

    setIsAddStudentOpen(false);
    setNewStudentForm({
      name: '',
      nisn: '',
      gender: 'L',
      phone: '',
      classId: '',
    });
    notify(`Siswa "${newStudent.name}" berhasil ditambahkan ke memori lokal.`, 'success');
  };

  const handleSaveEditStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudentModal || !editStudentModal.name.trim()) return;

    const nextStudents = students.map((s) => (s.id === editStudentModal.id ? editStudentModal : s));
    setStudents(nextStudents);
    syncToDb(nextStudents, classes, teachers);
    setEditStudentModal(null);
    notify(`Data siswa "${editStudentModal.name}" berhasil diperbarui.`, 'success');
  };

  const handleDeleteStudent = (studentId: string, studentName: string) => {
    if (!isAdmin) {
      onOpenAdminLogin();
      return;
    }
    if (!window.confirm(`Hapus siswa "${studentName}" dari daftar?`)) return;

    const studentToDelete = students.find((s) => s.id === studentId);
    const affectedClasses = new Set(studentToDelete?.enrolledClassIds || []);

    const nextStudents = students.filter((s) => s.id !== studentId);
    const nextClasses = classes.map((c) => {
      if (!affectedClasses.has(c.id)) return c;
      return { ...c, studentCount: Math.max(0, c.studentCount - 1) };
    });

    if (selectedPerson?.id === studentId) {
      setSelectedPerson(null);
    }

    setStudents(nextStudents);
    setClasses(nextClasses);
    syncToDb(nextStudents, nextClasses, teachers);
    notify(`Siswa "${studentName}" telah dihapus.`, 'info');
  };

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassForm.name.trim()) return;

    const newId = `cls-${newClassForm.grade}${newClassForm.section.toLowerCase()}-${Date.now().toString(36).substring(4)}`;
    const newClass: EnrollmentClass = {
      id: newId,
      name: newClassForm.name.trim(),
      grade: Number(newClassForm.grade) || 7,
      section: newClassForm.section.trim() || 'A',
      color: '#4F46E5',
      studentCount: 0,
    };

    const nextClasses = [...classes, newClass];
    setClasses(nextClasses);

    if (onUpdateDb) {
      onUpdateDb((prevDb) => ({
        ...prevDb,
        classes: [
          ...(prevDb.classes || []),
          {
            id: newClass.id,
            name: newClass.name,
            grade: newClass.grade,
            section: newClass.section,
            studentCount: 0,
            color: newClass.color,
          },
        ],
      }));
    }

    setIsAddClassOpen(false);
    setSelectedClassId(newClass.id);
    setSelectedPerson(null);
    notify(`Rombel "${newClass.name}" berhasil dibuat.`, 'success');
  };

  // ============================================================================
  // Derived Data, Filtering & Dynamic Sorting (Selection Always on Top)
  // ============================================================================

  const activeClass = useMemo(() => {
    if (!selectedClassId) return null;
    return classes.find((c) => c.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

  const activePersonObj = useMemo(() => {
    if (!selectedPerson) return null;
    if (selectedPerson.type === 'teacher') {
      const t = teachers.find((tch) => tch.id === selectedPerson.id);
      return t ? { isTeacher: true, name: t.name, panggilan: t.panggilan, entity: t } : null;
    }
    const s = students.find((std) => std.id === selectedPerson.id);
    return s ? { isTeacher: false, name: s.name, nisn: s.nisn, entity: s } : null;
  }, [selectedPerson, teachers, students]);

  // Helper: check if a class is related to active person
  const isClassRelatedToPerson = useCallback(
    (classId: string) => {
      if (!selectedPerson) return false;
      if (selectedPerson.type === 'student') {
        const s = students.find((std) => std.id === selectedPerson.id);
        return Boolean(s && s.enrolledClassIds.includes(classId));
      } else {
        const t = teachers.find((tch) => tch.id === selectedPerson.id);
        return Boolean(t && t.assignedClassIds.includes(classId));
      }
    },
    [selectedPerson, students, teachers]
  );

  // 1. FILTER & SORT CLASSES (Keep natural stable order as usual)
  const displayClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    const filtered = classes.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.section && c.section.toLowerCase().includes(q)) ||
        (c.grade && String(c.grade).includes(q))
      );
    });

    // Stable natural sort by grade, section, and name
    return [...filtered].sort((a, b) => {
      if ((a.grade || 0) !== (b.grade || 0)) return (a.grade || 0) - (b.grade || 0);
      return a.name.localeCompare(b.name, 'id');
    });
  }, [classes, classSearch]);

  // Unified Filter for People in Div 2: Filters both teachers and students simultaneously
  const queryPeople = peopleSearch.trim().toLowerCase();

  // 2. FILTER & SORT TEACHERS (Keep natural stable alphabetical order as usual)
  const displayTeachers = useMemo(() => {
    const filtered = teachers.filter((t) => {
      if (!queryPeople) return true;
      return (
        t.name.toLowerCase().includes(queryPeople) ||
        (t.panggilan && t.panggilan.toLowerCase().includes(queryPeople)) ||
        (t.department && t.department.toLowerCase().includes(queryPeople)) ||
        t.id.toLowerCase().includes(queryPeople)
      );
    });

    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [teachers, queryPeople]);

  // 3. FILTER & SORT STUDENTS (Keep natural stable alphabetical order as usual)
  const displayStudents = useMemo(() => {
    const filtered = students.filter((s) => {
      if (!queryPeople) return true;
      return (
        s.name.toLowerCase().includes(queryPeople) ||
        (s.nisn && s.nisn.toLowerCase().includes(queryPeople)) ||
        (s.phone && s.phone.includes(queryPeople)) ||
        s.id.toLowerCase().includes(queryPeople)
      );
    });

    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [students, queryPeople]);

  // Quick statistics for active class
  const classAssignedTeachersCount = useMemo(() => {
    if (!selectedClassId) return 0;
    return teachers.filter((t) => t.assignedClassIds.includes(selectedClassId)).length;
  }, [teachers, selectedClassId]);

  const classAssignedStudentsCount = useMemo(() => {
    if (!selectedClassId) return 0;
    return students.filter((s) => s.enrolledClassIds.includes(selectedClassId)).length;
  }, [students, selectedClassId]);

  // Summarize classes the active person relates to
  const personRelatedClasses = useMemo(() => {
    if (!selectedPerson) return [];
    return classes.filter((c) => isClassRelatedToPerson(c.id));
  }, [classes, selectedPerson, isClassRelatedToPerson]);

  const personRelatedClassesCount = personRelatedClasses.length;

  // Split teachers into assigned & unassigned (based on active class, or having any class if no class selected)
  const { assignedTeachers, unassignedTeachers } = useMemo(() => {
    const assigned: EnrollmentTeacher[] = [];
    const unassigned: EnrollmentTeacher[] = [];

    displayTeachers.forEach((tch) => {
      const isAssigned = selectedClassId
        ? tch.assignedClassIds.includes(selectedClassId)
        : tch.assignedClassIds.length > 0;

      if (isAssigned) {
        assigned.push(tch);
      } else {
        unassigned.push(tch);
      }
    });

    return { assignedTeachers: assigned, unassignedTeachers: unassigned };
  }, [displayTeachers, selectedClassId]);

  // Split students into assigned & unassigned (based on active class, or having any class if no class selected)
  const { assignedStudents, unassignedStudents } = useMemo(() => {
    const assigned: EnrollmentStudent[] = [];
    const unassigned: EnrollmentStudent[] = [];

    displayStudents.forEach((std) => {
      const isAssigned = selectedClassId
        ? std.enrolledClassIds.includes(selectedClassId)
        : std.enrolledClassIds.length > 0;

      if (isAssigned) {
        assigned.push(std);
      } else {
        unassigned.push(std);
      }
    });

    return { assignedStudents: assigned, unassignedStudents: unassigned };
  }, [displayStudents, selectedClassId]);

  // Small hide/unhide state for each of the 4 people sections
  const [collapsedSections, setCollapsedSections] = useState({
    assignedTeachers: false,
    unassignedTeachers: false,
    assignedStudents: false,
    unassignedStudents: false,
  });

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="fixed top-16 right-6 z-50 transition-all transform animate-in fade-in slide-in-from-top-4">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium border ${
              actionNotice.type === 'success'
                ? 'bg-slate-900 text-white border-slate-700'
                : actionNotice.type === 'warn'
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-indigo-50 text-indigo-800 border-indigo-300'
            }`}
          >
            <Sparkles className="w-4 h-4 flex-shrink-0 text-indigo-400" />
            <span>{actionNotice.text}</span>
            <button
              onClick={() => setActionNotice(null)}
              className="ml-2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Dual-Panel View: 2 main divs, no top banner */}
      <div className="flex-1 p-3 lg:p-5 max-w-[1700px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* DIV 1: DAFTAR ROMBEL / KELAS */}
        <EnrollmentClassList
          classes={classes}
          displayClasses={displayClasses}
          selectedClassId={selectedClassId}
          activeClass={activeClass}
          selectedPerson={selectedPerson}
          activePersonObj={activePersonObj}
          personRelatedClasses={personRelatedClasses}
          personRelatedClassesCount={personRelatedClassesCount}
          classSearch={classSearch}
          setClassSearch={setClassSearch}
          isClassRelatedToPerson={isClassRelatedToPerson}
          handleClassClick={handleClassClick}
          handleClearClassSelection={handleClearClassSelection}
          handleClearPersonSelection={handleClearPersonSelection}
          handleToggleClassForActivePerson={handleToggleClassForActivePerson}
          isAdmin={isAdmin}
          onOpenAddClass={() => setIsAddClassOpen(true)}
        />

        {/* DIV 2: DAFTAR ORANG */}
        <EnrollmentPeopleList
          teachers={teachers}
          students={students}
          assignedTeachers={assignedTeachers}
          unassignedTeachers={unassignedTeachers}
          assignedStudents={assignedStudents}
          unassignedStudents={unassignedStudents}
          selectedClassId={selectedClassId}
          activeClass={activeClass}
          classAssignedTeachersCount={classAssignedTeachersCount}
          classAssignedStudentsCount={classAssignedStudentsCount}
          selectedPerson={selectedPerson}
          activePersonObj={activePersonObj}
          peopleSearch={peopleSearch}
          setPeopleSearch={setPeopleSearch}
          hasPendingChanges={hasPendingChanges}
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
          handlePersonClick={handlePersonClick}
          handleClearClassSelection={handleClearClassSelection}
          handleClearPersonSelection={handleClearPersonSelection}
          handleToggleTeacherInActiveClass={handleToggleTeacherInActiveClass}
          handleToggleStudentInActiveClass={handleToggleStudentInActiveClass}
          isAdmin={isAdmin}
          onOpenAddStudent={() => {
            setNewStudentForm({
              name: "",
              nisn: "",
              gender: "L",
              phone: "",
              classId: selectedClassId || "",
            });
            setIsAddStudentOpen(true);
          }}
          onOpenEditStudent={(std) => setEditStudentModal(std)}
          onDeleteStudent={handleDeleteStudent}
        />
      </div>

      {/* MODALS */}
      <EnrollmentModals
        classes={classes}
        isAddStudentOpen={isAddStudentOpen}
        setIsAddStudentOpen={setIsAddStudentOpen}
        newStudentForm={newStudentForm}
        setNewStudentForm={setNewStudentForm}
        handleCreateStudent={handleCreateStudent}
        editStudentModal={editStudentModal}
        setEditStudentModal={setEditStudentModal}
        handleSaveEditStudent={handleSaveEditStudent}
        isAddClassOpen={isAddClassOpen}
        setIsAddClassOpen={setIsAddClassOpen}
        newClassForm={newClassForm}
        setNewClassForm={setNewClassForm}
        handleCreateClass={handleCreateClass}
      />

    </div>
  );
};
