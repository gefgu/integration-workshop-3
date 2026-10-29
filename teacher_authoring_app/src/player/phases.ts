/** Lesson phases as the player walks them; pure, shared by the editor preview and the bench. */
import { cumulativeBoard, effectiveSteps } from '../model/steps.ts';

/** What the bench records as the student goes (SFR38, SFR39); `phase` is the resume point. */
export type PlayerEvent =
  | { type: 'phase_done'; phase: number; phases: number; stepIdx: number | null }
  | { type: 'quiz'; quizId: string; correct: boolean }
  | { type: 'lesson_done'; durationS: number; score: number | null };

/**
 * Challenge score (SFR39): 100 for a circuit built right away, down to 50 when it takes the whole
 * time limit (or 10 minutes without a limit); 0 when time runs out.
 */
export function challengeScore(elapsedS: number, limitS: number | null, expired: boolean): number {
  if (expired) return 0;
  const budget = limitS && limitS > 0 ? limitS : 600;
  return Math.round(100 - 50 * Math.min(1, elapsedS / budget));
}

/** The board the student had after the build steps before `phase` (bench resume, SFR37.1). */
export function boardBefore(lesson, phase: number) {
  const phases = buildPhases(lesson);
  const done = phases.slice(0, phase).filter((p) => p.type === 'step' || p.type === 'interact');
  if (!done.length || lesson.kind === 'challenge') return [];
  return cumulativeBoard(lesson, done[done.length - 1].idx).map((p) => ({ ...p }));
}

export function buildPhases(lesson) {
  const quiz = (pos) => lesson.quizzes.filter((q) => q.position === pos).map((q) => ({ type: 'quiz', quiz: q }));
  let middle = [];
  if (lesson.kind === 'challenge') {
    if (lesson.board.pieces.length > 0) middle = [{ type: 'challenge' }];
  } else {
    middle = effectiveSteps(lesson).map((step, idx) =>
      step.action === 'interact'
        ? { type: 'interact', idx, step, quiz: lesson.quizzes.find((q) => q.id === step.quizId) }
        : { type: 'step', idx, step }
    );
  }
  return [...quiz('before'), ...middle, ...quiz('after'), { type: 'done' }];
}
