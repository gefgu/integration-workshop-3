/** A ready-to-use package for "Modo demonstração": the first curriculum module and one student with tag TAG-1. */
import type { BenchPackage } from '../../../protocol/bench.ts';
import { curriculumLessons, curriculumModules } from '../curriculum/lessons.ts';

export const DEMO_TAG = 'TAG-1';

export function demoPackage(): BenchPackage {
  const [module] = curriculumModules();
  const all = curriculumLessons();
  const lessons = module.lessonIds.flatMap((id) => all.filter((lesson) => lesson.id === id));
  return {
    format: 1,
    version_id: 'demo',
    created_at: new Date().toISOString(),
    teacher: { id: 0, name: 'Modo demonstração' },
    module: { id: 0, title: module.title, description: module.description, lesson_ids: module.lessonIds },
    class: { id: 0, name: 'Turma demonstração' },
    lessons: lessons.map((lesson) => ({ ...lesson, lessonVersion: 'demo' })),
    students: [{ id: 9001, name: 'Aluno demonstração', nickname: 'Demo', nfc_code: DEMO_TAG }],
  };
}
