import type { Lesson } from '../model/types.ts';

export interface SchoolClass {
  id: number;
  name: string;
  description: string;
}

export interface Student {
  id: number;
  class_id: number;
  name: string;
  nickname: string;
  nfc_code: string | null;
  active: boolean;
}

export interface ClassDetail extends SchoolClass {
  students: Student[];
  lesson_ids: string[];
}

export type StudentInput = Omit<Student, 'id' | 'class_id'>;

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/workspace${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Confira se a API está ativa.');
  }
  if (response.ok) return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  let detail: unknown;
  try {
    detail = (await response.json()).detail;
  } catch {
    // The proxy may return HTML while the API is offline.
  }
  throw new Error(
    typeof detail === 'string'
      ? detail
      : response.status >= 500
        ? 'Servidor indisponível. Confira a API e o banco de dados.'
        : 'Não foi possível concluir a operação.'
  );
}

export const workspace = {
  listLessons: () => request<Lesson[]>('/lessons'),
  saveLesson: (lesson: Lesson) => request<Lesson>(`/lessons/${encodeURIComponent(lesson.id)}`, 'PUT', lesson),
  deleteLesson: (id: string) => request<void>(`/lessons/${encodeURIComponent(id)}`, 'DELETE'),
  listClasses: () => request<SchoolClass[]>('/classes'),
  getClass: (id: number) => request<ClassDetail>(`/classes/${id}`),
  createClass: (body: Pick<SchoolClass, 'name' | 'description'>) => request<SchoolClass>('/classes', 'POST', body),
  updateClass: (id: number, body: Pick<SchoolClass, 'name' | 'description'>) =>
    request<SchoolClass>(`/classes/${id}`, 'PUT', body),
  deleteClass: (id: number) => request<void>(`/classes/${id}`, 'DELETE'),
  setClassLessons: (id: number, lesson_ids: string[]) =>
    request<{ lesson_ids: string[] }>(`/classes/${id}/lessons`, 'PUT', { lesson_ids }),
  createStudent: (classId: number, body: StudentInput) =>
    request<Student>(`/classes/${classId}/students`, 'POST', body),
  updateStudent: (id: number, body: StudentInput) => request<Student>(`/students/${id}`, 'PUT', body),
  deleteStudent: (id: number) => request<void>(`/students/${id}`, 'DELETE'),
};
