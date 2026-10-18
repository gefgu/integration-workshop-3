import type { Lesson } from '../model/types.ts';
import { api, apiBlob } from './http.ts';

export interface SchoolClass {
  id: number;
  name: string;
  description: string;
  student_count?: number;
}

export interface Student {
  id: number;
  class_id: number;
  name: string;
  nickname: string;
  nfc_code: string | null;
  active: boolean;
  class_name?: string;
}

export interface ClassDetail extends SchoolClass {
  students: Student[];
  lesson_ids: string[];
  module_ids: number[];
}

export interface Module {
  id: number;
  title: string;
  description: string;
  lesson_ids: string[];
  class_ids: number[];
  updated_at: string;
}

export interface TagEvent {
  nfc_code: string;
  action: 'link' | 'unlink';
  at: string;
}

export interface StudentSummary {
  lessons_done: number;
  lessons_total: number;
  progress: number;
  best_score: number | null;
  last_score: number | null;
  challenges: number;
  time_spent_s: number;
  last_activity: string | null;
}

export interface ClassDashboard {
  class: { id: number; name: string };
  lesson_ids: string[];
  summary: { students: number; avg_progress: number; avg_best_score: number | null; time_spent_s: number };
  students: (StudentSummary & { student: Pick<Student, 'id' | 'name' | 'nickname' | 'nfc_code' | 'active'> })[];
}

export interface StudentDashboard extends StudentSummary {
  student: Pick<Student, 'id' | 'name' | 'nickname' | 'nfc_code' | 'class_id'>;
  lessons: {
    lesson_id: string;
    title: string;
    status: 'done' | 'in_progress' | 'not_started';
    steps_done: number;
    best_score: number | null;
    time_spent_s: number;
  }[];
  events: {
    event_id: string;
    kind: string;
    lesson_id: string | null;
    lesson_title: string | null;
    step_idx: number | null;
    score: number | null;
    duration_s: number | null;
    at: string;
    bench_id: string;
  }[];
}

export type StudentInput = Pick<Student, 'name' | 'nickname' | 'nfc_code' | 'active'> & { class_id?: number };
export type ModuleInput = Pick<Module, 'title' | 'description'> & { lesson_ids?: string[] };

const w = <T>(path: string, method = 'GET', body?: unknown) => api<T>(`/workspace${path}`, method, body);
const id = encodeURIComponent;

export const workspace = {
  /** lesson.json + audio/*.mp3 (the tutor's voice), as the workbench loads it. */
  exportZip: (lessonId: string) => apiBlob(`/workspace/lessons/${id(lessonId)}/export.zip`),
  listLessons: () => w<Lesson[]>('/lessons'),
  saveLesson: (lesson: Lesson) => w<Lesson>(`/lessons/${id(lesson.id)}`, 'PUT', lesson),
  deleteLesson: (lessonId: string) => w<void>(`/lessons/${id(lessonId)}`, 'DELETE'),

  listModules: () => w<Module[]>('/modules'),
  createModule: (body: ModuleInput) => w<Module>('/modules', 'POST', body),
  updateModule: (moduleId: number, body: ModuleInput) => w<Module>(`/modules/${moduleId}`, 'PUT', body),
  setModuleLessons: (moduleId: number, lesson_ids: string[]) =>
    w<Module>(`/modules/${moduleId}/lessons`, 'PUT', { lesson_ids }),
  deleteModule: (moduleId: number) => w<void>(`/modules/${moduleId}`, 'DELETE'),

  listClasses: () => w<SchoolClass[]>('/classes'),
  getClass: (classId: number) => w<ClassDetail>(`/classes/${classId}`),
  createClass: (body: Pick<SchoolClass, 'name' | 'description'>) => w<SchoolClass>('/classes', 'POST', body),
  updateClass: (classId: number, body: Pick<SchoolClass, 'name' | 'description'>) =>
    w<SchoolClass>(`/classes/${classId}`, 'PUT', body),
  deleteClass: (classId: number) => w<void>(`/classes/${classId}`, 'DELETE'),
  setClassLessons: (classId: number, lesson_ids: string[]) =>
    w<{ lesson_ids: string[] }>(`/classes/${classId}/lessons`, 'PUT', { lesson_ids }),
  setClassModules: (classId: number, module_ids: number[]) =>
    w<{ module_ids: number[] }>(`/classes/${classId}/modules`, 'PUT', { module_ids }),

  listStudents: (classId?: number) => w<Student[]>(classId == null ? '/students' : `/students?class_id=${classId}`),
  createStudent: (classId: number, body: StudentInput) => w<Student>(`/classes/${classId}/students`, 'POST', body),
  updateStudent: (studentId: number, body: StudentInput) => w<Student>(`/students/${studentId}`, 'PUT', body),
  deleteStudent: (studentId: number) => w<void>(`/students/${studentId}`, 'DELETE'),
  linkTag: (studentId: number, nfc_code: string) => w<Student>(`/students/${studentId}/tag`, 'POST', { nfc_code }),
  unlinkTag: (studentId: number) => w<Student>(`/students/${studentId}/tag`, 'DELETE'),
  tagHistory: (studentId: number) => w<TagEvent[]>(`/students/${studentId}/tag-history`),
};

export const dashboard = {
  forClass: (classId: number) => api<ClassDashboard>(`/dashboard/classes/${classId}`),
  forStudent: (studentId: number) => api<StudentDashboard>(`/dashboard/students/${studentId}`),
};

export const bench = {
  /** The same package the phone app sends over Bluetooth; downloadable as a fallback. */
  package: (moduleId: number, classId: number) => api<unknown>(`/bench/package/${moduleId}?class_id=${classId}`),
};

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h) return `${h}h ${String(m).padStart(2, '0')}min`;
  if (m) return `${m}min ${String(total % 60).padStart(2, '0')}s`;
  return `${total}s`;
}
