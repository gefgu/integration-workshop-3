/** Lesson phases as the player walks them; pure, shared by the editor preview and the bench. */
import { challengeSteps, cumulativeBoard, effectiveSteps, needsBuild, startPieces } from '../model/steps.ts';
import type { LessonStep } from '../model/types.ts';

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

/**
 * The board the student had when `phase` begins (bench resume, SFR37.1): replays the phases before it.
 * Build steps leave the cumulative target; an experiment with its own board replaces it; a finished
 * challenge build leaves the final circuit.
 */
export function boardBefore(lesson, phase: number) {
  const phases = buildPhases(lesson);
  let board = lesson.kind === 'challenge' && !needsBuild(lesson) ? startPieces(lesson) : [];
  for (const p of phases.slice(0, phase)) {
    if (p.type === 'step') board = cumulativeBoard(lesson, p.idx).map((x) => ({ ...x }));
    else if (p.type === 'challenge') board = lesson.board.pieces.map((x) => ({ ...x }));
    else if (p.type === 'experiment' && p.step.experiment?.board) board = p.step.experiment.board.map((x) => ({ ...x }));
  }
  return board;
}

type Phase =
  | { type: 'quiz'; quiz: any }
  | { type: 'step'; idx: number; step: LessonStep }
  | { type: 'interact'; idx: number; step: LessonStep; quiz: any; local: boolean }
  | { type: 'explain'; idx: number; step: LessonStep }
  | { type: 'experiment'; idx: number; step: LessonStep }
  | { type: 'challenge' }
  | { type: 'done' };

export function buildPhases(lesson): Phase[] {
  const quiz = (pos) => lesson.quizzes.filter((q) => q.position === pos).map((q) => ({ type: 'quiz', quiz: q }));
  const clientPhase = (step: LessonStep, idx: number, local: boolean): Phase => {
    if (step.action === 'explain') return { type: 'explain', idx, step };
    if (step.action === 'experiment') return { type: 'experiment', idx, step };
    return { type: 'interact', idx, step, quiz: lesson.quizzes.find((q) => q.id === step.quizId), local };
  };
  let middle: Phase[] = [];
  if (lesson.kind === 'challenge') {
    if (needsBuild(lesson)) middle = [{ type: 'challenge' }];
    // Explanations, experiments and questions come after the build; the validator is not involved.
    middle.push(...(lesson.steps || []).map((step, idx) => ({ step, idx })).filter(({ step }) => challengeSteps(lesson).includes(step)).map(({ step, idx }) => clientPhase(step, idx, true)));
  } else {
    middle = effectiveSteps(lesson).map((step, idx) =>
      ['interact', 'explain', 'experiment'].includes(step.action) ? clientPhase(step, idx, false) : { type: 'step', idx, step }
    );
  }
  return [...quiz('before'), ...middle, ...quiz('after'), { type: 'done' }] as Phase[];
}
