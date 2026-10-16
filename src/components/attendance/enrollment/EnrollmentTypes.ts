export interface EnrollmentStudent {
  id: string;
  nisn: string;
  name: string;
  gender: 'L' | 'P';
  phone?: string;
  enrolledClassIds: string[];
}

export interface EnrollmentClass {
  id: string;
  name: string;
  grade?: number;
  section?: string;
  color?: string;
  studentCount: number;
  homeroomTeacherId?: string;
  homeroomTeacherName?: string;
}

export interface EnrollmentTeacher {
  id: string;
  name: string;
  panggilan?: string;
  color?: string;
  department?: string;
  assignedClassIds: string[];
}

export interface NewStudentFormData {
  name: string;
  nisn: string;
  gender: 'L' | 'P';
  phone: string;
  classId: string;
}

export interface NewClassFormData {
  name: string;
  grade: number;
  section: string;
}
