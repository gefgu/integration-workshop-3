/** Bench screen state (SFR17: exactly one screen at a time) and lesson ordering, kept pure for tests. */
import type { BenchPackage } from '../../../protocol/bench.ts';
import type { ProgressRow, RankRow } from './benchApi.ts';

export type Screen =
  | { name: 'locked' }
  | { name: 'home'; notice?: string }
  | { name: 'student' }
  | { name: 'lesson'; lessonId: string; phase: number }
  | { name: 'score'; lessonId: string; score: number; durationS: number; ranking: RankRow[]; next: string | null }
  | { name: 'ranking' }
  /** live camera board view (SFR17.1); Esc returns to `back` */
  | { name: 'camera'; back: Screen };

export interface LessonState {
  // biome-ignore lint/suspicious/noExplicitAny: lesson documents are the editor's Lesson
  lesson: any;
  done: boolean;
  /** resume phase inside the lesson */
  phase: number;
  /** lessons unlock in order: a lesson opens once every earlier one is done */
  locked: boolean;
}

export function lessonStates(pkg: BenchPackage, progress: Record<string, ProgressRow>): LessonState[] {
  let open = true;
  return pkg.lessons.map((lesson) => {
    const row = progress[lesson.id];
    const done = Boolean(row?.completed);
    const state = { lesson, done, phase: row && !done ? row.step_idx : 0, locked: !open };
    if (!done) open = false;
    return state;
  });
}

/** The lesson after this one in the module (the order the teacher set), or null at the end. */
export function nextLessonId(pkg: Pick<BenchPackage, 'lessons'>, lessonId: string): string | null {
  const at = pkg.lessons.findIndex((l) => l.id === lessonId);
  return at >= 0 && at + 1 < pkg.lessons.length ? pkg.lessons[at + 1].id : null;
}

/**
 * After a challenge the score screen (SFR39) with the top 3 (SFR40), whose Continuar opens the next lesson;
 * after a guided lesson, straight into the next one. At the end of the module, back to the student's screen.
 */
export function screenAfterLesson(
  lessonId: string,
  result: { kind: string; score: number | null; durationS: number; ranking: RankRow[] },
  next: string | null = null
): Screen {
  if (result.kind === 'challenge' && result.score != null) {
    return {
      name: 'score',
      lessonId,
      score: result.score,
      durationS: result.durationS,
      ranking: result.ranking,
      next,
    };
  }
  return next ? { name: 'lesson', lessonId: next, phase: 0 } : { name: 'student' };
}
