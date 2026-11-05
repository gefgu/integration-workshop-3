/** A class's progress, scores and time per student: the same summary as the website's dashboard. */
import type { ClassDetail, Student } from './api.ts';

export interface StudentProgress {
  student: Pick<Student, 'id' | 'name' | 'nickname' | 'nfc_code' | 'active'>;
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
  students: StudentProgress[];
}

export interface ProgressRow {
  student_id: number;
  lesson_id: string | null;
  kind: string;
  score: number | null;
  duration_s: number | null;
  at: string;
  seq: number;
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

/** Mirrors graph_validator.service.dashboard.summarize. */
export function summarize(events: ProgressRow[], lessonIds: string[]): Omit<StudentProgress, 'student'> {
  const done = new Set(
    events.filter((e) => e.kind === 'lesson_done' && e.lesson_id && lessonIds.includes(e.lesson_id)).map((e) => e.lesson_id)
  );
  const scores = events.filter((e) => e.kind === 'challenge_score' && e.score != null);
  const sessions = events.filter((e) => e.kind === 'session').map((e) => e.duration_s ?? 0);
  const time = sessions.length
    ? sessions.reduce((a, b) => a + b, 0)
    : events.filter((e) => e.kind === 'lesson_done').reduce((a, e) => a + (e.duration_s ?? 0), 0);
  const latest = [...scores].sort((a, b) => (a.at === b.at ? a.seq - b.seq : a.at < b.at ? -1 : 1)).pop();
  const last = events.reduce<string | null>((max, e) => (!max || e.at > max ? e.at : max), null);
  return {
    lessons_done: done.size,
    lessons_total: lessonIds.length,
    progress: lessonIds.length ? round(done.size / lessonIds.length, 3) : 0,
    best_score: scores.length ? Math.max(...scores.map((e) => e.score as number)) : null,
    last_score: latest?.score ?? null,
    challenges: scores.length,
    time_spent_s: round(time, 1),
    last_activity: last,
  };
}

export function buildDashboard(detail: ClassDetail, lessonIds: string[], events: ProgressRow[]): ClassDashboard {
  const rows = detail.students.map((s) => ({
    student: { id: s.id, name: s.name, nickname: s.nickname, nfc_code: s.nfc_code, active: s.active },
    ...summarize(
      events.filter((e) => e.student_id === s.id),
      lessonIds
    ),
  }));
  const scored = rows.map((r) => r.best_score).filter((n): n is number => n != null);
  return {
    class: { id: detail.id, name: detail.name },
    lesson_ids: lessonIds,
    summary: {
      students: rows.length,
      avg_progress: rows.length ? round(rows.reduce((a, r) => a + r.progress, 0) / rows.length, 3) : 0,
      avg_best_score: scored.length ? round(scored.reduce((a, b) => a + b, 0) / scored.length, 1) : null,
      time_spent_s: round(
        rows.reduce((a, r) => a + r.time_spent_s, 0),
        1
      ),
    },
    students: rows,
  };
}

/** "12 min", "1 h 05 min" */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}
