/** Bench screen state (SFR17: exactly one screen at a time) and lesson ordering, kept pure for tests. */
import type { BenchPackage } from '../../../protocol/bench.ts';
import type { ProgressRow, RankRow } from './benchApi.ts';

export type Screen =
  | { name: 'locked' }
  | { name: 'home'; notice?: string }
  | { name: 'student' }
  | { name: 'lesson'; lessonId: string; phase: number }
  | { name: 'score'; lessonId: string; score: number; durationS: number; ranking: RankRow[] }
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

/** After a challenge the score screen (SFR39) with the top 3 (SFR40); after a guided lesson, back home. */
export function screenAfterLesson(
  lessonId: string,
  result: { kind: string; score: number | null; durationS: number; ranking: RankRow[] }
): Screen {
  if (result.kind === 'challenge' && result.score != null) {
    return { name: 'score', lessonId, score: result.score, durationS: result.durationS, ranking: result.ranking };
  }
  return { name: 'student' };
}
