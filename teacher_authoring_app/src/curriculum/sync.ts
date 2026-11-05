/**
 * Puts the TedTronics curriculum (20 lessons, 5 modules) into a teacher's account, or brings it up to date.
 * Used by the teacher website (automatically for an account without it, or from the Modules page) and by
 * scripts/seed-curriculum.ts.
 *
 * Non-destructive: it only writes lessons whose id starts with "curriculo-" and modules whose title it owns,
 * leaves identical ones alone, and only deletes what the curriculum itself retired.
 */
import type { Lesson } from '../model/types.ts';
import {
  curriculumLessons,
  curriculumModules,
  RETIRED_LESSON_IDS,
  RETIRED_MODULE_TITLES,
  SEED_PREFIX,
} from './lessons.ts';

export interface CurriculumApi {
  listLessons(): Promise<Record<string, unknown>[]>;
  saveLesson(lesson: Lesson): Promise<unknown>;
  deleteLesson(id: string): Promise<unknown>;
  listModules(): Promise<{ id: number; title: string; lesson_ids: string[] }[]>;
  createModule(body: { title: string; description: string; lesson_ids: string[] }): Promise<{ id: number }>;
  updateModule(id: number, body: { title: string; description: string; lesson_ids: string[] }): Promise<{ id: number }>;
  deleteModule(id: number): Promise<unknown>;
}

export interface Tally {
  created: number;
  updated: number;
  unchanged: number;
}

export interface SyncReport {
  lessons: Tally & { others: number };
  modules: Tally & { others: number };
  retired: { lessons: number; modules: number };
  moduleIds: number[];
}

/**
 * Lesson ids are unique across the whole server, so a second teacher cannot reuse "curriculo-01-guiada". An
 * account that already holds the plain ids (the demo teacher, seeded by the script) keeps them; any other account
 * gets its own copies, suffixed with its teacher id.
 */
export function curriculumSuffix(teacherId: number | undefined, existingIds: string[]): string {
  if (teacherId == null) return '';
  const plain = new Set(curriculumLessons().map((l) => l.id));
  return existingIds.some((id) => plain.has(id)) ? '' : `-p${teacherId}`;
}

/** Does this list of lessons already hold the curriculum (any lesson of it)? */
export const hasCurriculum = (lessons: { id: string }[]) => lessons.some((l) => l.id.startsWith(SEED_PREFIX));

/** What identifies a lesson's content: everything the server does not stamp itself. */
export const lessonContent = (lesson: Record<string, unknown>) => {
  const { updatedAt: _u, audio: _a, ...rest } = lesson;
  return JSON.stringify(rest, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );
};

export async function syncCurriculum(
  api: CurriculumApi,
  { dryRun = false, teacherId }: { dryRun?: boolean; teacherId?: number } = {}
): Promise<SyncReport> {
  // Lessons: create or update only our own ids; leave identical ones untouched.
  const existing = new Map((await api.listLessons()).map((l) => [l.id as string, l]));
  const suffix = curriculumSuffix(teacherId, [...existing.keys()]);
  const lid = (id: string) => `${id}${suffix}`;
  const lessons = curriculumLessons().map((l) => ({ ...l, id: lid(l.id) }));
  const modules = curriculumModules().map((m) => ({ ...m, lessonIds: m.lessonIds.map(lid) }));

  const lessonTally = { created: 0, updated: 0, unchanged: 0, others: 0 };
  for (const lesson of lessons) {
    if (!lesson.id.startsWith(SEED_PREFIX)) throw new Error(`refusing to write ${lesson.id}`);
    const have = existing.get(lesson.id);
    if (have && lessonContent(have) === lessonContent(lesson as unknown as Record<string, unknown>)) {
      lessonTally.unchanged++;
      continue;
    }
    lessonTally[have ? 'updated' : 'created']++;
    if (!dryRun) await api.saveLesson(lesson);
  }
  lessonTally.others = [...existing.keys()].filter((id) => !id.startsWith(SEED_PREFIX)).length;

  // Modules: matched by title; only ours are touched.
  const haveModules = await api.listModules();
  const moduleTally = { created: 0, updated: 0, unchanged: 0, others: 0 };
  const moduleIds: number[] = [];
  for (const m of modules) {
    const found = haveModules.find((x) => x.title === m.title);
    if (found && JSON.stringify(found.lesson_ids) === JSON.stringify(m.lessonIds)) {
      moduleTally.unchanged++;
      moduleIds.push(found.id);
      continue;
    }
    moduleTally[found ? 'updated' : 'created']++;
    if (dryRun) continue;
    const body = { title: m.title, description: m.description, lesson_ids: m.lessonIds };
    const saved = found ? await api.updateModule(found.id, body) : await api.createModule(body);
    moduleIds.push(saved.id);
  }
  moduleTally.others = haveModules.filter((x) => !modules.some((m) => m.title === x.title)).length;

  // Retire what the curriculum no longer has. Modules first, so none points at a lesson about to go.
  const retiredModules = haveModules.filter((x) => RETIRED_MODULE_TITLES.includes(x.title));
  const retiredLessons = RETIRED_LESSON_IDS.map(lid).filter((id) => id.startsWith(SEED_PREFIX) && existing.has(id));
  if (!dryRun) {
    for (const m of retiredModules) await api.deleteModule(m.id);
    for (const id of retiredLessons) await api.deleteLesson(id);
  }

  return {
    lessons: lessonTally,
    modules: moduleTally,
    retired: { lessons: retiredLessons.length, modules: retiredModules.length },
    moduleIds,
  };
}
