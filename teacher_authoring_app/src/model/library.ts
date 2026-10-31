import type { Lesson } from './types.ts';

export function orderLessons(lessons: Lesson[]): Lesson[] {
  const key = (l: Lesson) => l.id.replace(/-(guiada|desafio|potenciometro)$/, '');
  return [...lessons].sort((a, b) => {
    const ac = !!a.tags?.includes('currículo'),
      bc = !!b.tags?.includes('currículo');
    if (ac !== bc) return ac ? 1 : -1;
    return ac
      ? key(a).localeCompare(key(b)) || Number(a.kind === 'challenge') - Number(b.kind === 'challenge')
      : b.updatedAt.localeCompare(a.updatedAt);
  });
}
export function lessonLabel(lesson: Lesson): string {
  return /\((guiada|desafio|versão com potenciômetro)\)/.test(lesson.title)
    ? lesson.title
    : `${lesson.title} (${lesson.kind === 'challenge' ? 'desafio' : 'guiada'})`;
}
