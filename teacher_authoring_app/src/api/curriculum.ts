import { curriculumLessons, curriculumModules } from '../curriculum/lessons.ts';
import { workspace } from './workspace.ts';

export interface CurriculumProgress {
  done: number;
  total: number;
}

/**
 * Imports the ready-made TedTronics curriculum (lessons, then modules) under the signed-in teacher.
 * Same rules as scripts/seed-curriculum.ts: only `curriculo-` lessons and modules matched by title are written,
 * nothing is deleted, and modules that are already identical are left alone.
 */
export async function importCurriculum(onProgress?: (progress: CurriculumProgress) => void): Promise<void> {
  const lessons = curriculumLessons();
  const modules = curriculumModules();
  const total = lessons.length + modules.length;
  let done = 0;
  const tick = () => onProgress?.({ done: ++done, total });
  onProgress?.({ done, total });

  const existing = new Map((await workspace.listLessons()).map((lesson) => [lesson.id, lesson]));
  for (const lesson of lessons) {
    const have = existing.get(lesson.id);
    // Compare content only: the server stamps updatedAt and the audio itself.
    const strip = (l: unknown) => JSON.stringify({ ...(l as object), updatedAt: 0, audio: 0 });
    if (!have || strip(have) !== strip(lesson)) await workspace.saveLesson(lesson);
    tick();
  }

  const haveModules = await workspace.listModules();
  for (const item of modules) {
    const found = haveModules.find((m) => m.title === item.title);
    if (!found || JSON.stringify(found.lesson_ids) !== JSON.stringify(item.lessonIds)) {
      const body = { title: item.title, description: item.description, lesson_ids: item.lessonIds };
      if (found) await workspace.updateModule(found.id, body);
      else await workspace.createModule(body);
    }
    tick();
  }
}
