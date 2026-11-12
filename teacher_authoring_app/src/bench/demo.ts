import type { BenchPackage, BenchStudent } from '../../../protocol/bench.ts';

/**
 * Demo mode: test the bench without the teacher's phone. The bench screen builds a package from the TedTronics
 * curriculum (the same lessons the teacher site imports) for one of three demo students (the home screen switches
 * between them), and the bench service (started with --dev) loads it. Demo progress stays on the bench and is
 * never sent to the server.
 */
export const DEMO_STUDENTS: BenchStudent[] = [
  { id: 9001, uid: 'demo-ana', name: 'Ana (demonstração)', nickname: 'ana' },
  { id: 9002, uid: 'demo-bia', name: 'Bia (demonstração)', nickname: 'bia' },
  { id: 9003, uid: 'demo-caio', name: 'Caio (demonstração)', nickname: 'caio' },
];

export interface DemoChoice {
  key: string;
  title: string;
  description: string;
  lessonIds: string[] | null; // null = the whole curriculum
}

/** The demo modules: the whole curriculum or one of its tracks. */
export async function demoChoices(): Promise<DemoChoice[]> {
  const { curriculumModules } = await import('../curriculum/lessons.ts');
  return [
    {
      key: 'all',
      title: 'Currículo completo',
      description: 'Todas as 20 lições, na ordem de ensino.',
      lessonIds: null,
    },
    ...curriculumModules()
      .filter((m) => !m.title.startsWith('Currículo'))
      .map((m, i) => ({ key: `t${i + 1}`, title: m.title, description: m.description, lessonIds: m.lessonIds })),
  ];
}

export async function demoPackage(choice: DemoChoice): Promise<BenchPackage> {
  const { curriculumLessons } = await import('../curriculum/lessons.ts');
  const all = curriculumLessons();
  const lessons = choice.lessonIds
    ? choice.lessonIds.map((id) => all.find((l) => l.id === id)).filter((l) => l != null)
    : all;
  const versionId = `demo-${Date.now().toString(36)}`;
  return {
    format: 1,
    version_id: versionId,
    created_at: new Date().toISOString(),
    demo: true,
    teacher: { id: 0, name: 'Modo demonstração' },
    module: {
      id: 0,
      title: choice.title,
      description: choice.description,
      lesson_ids: lessons.map((l) => l.id),
    },
    class: { id: 0, name: 'Turma de demonstração' },
    lessons: lessons.map((l) => ({ ...l, lessonVersion: versionId })),
    student: DEMO_STUDENTS[0],
  };
}
