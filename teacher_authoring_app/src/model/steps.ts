import { uid } from './ids.ts';
import type { Lesson, LessonStep, Piece, StepAction, StepOptions } from './types.ts';

export const ACTIONS = ['place_component', 'place_connection', 'connect_circuit', 'interact'];
export const CATEGORIES = [
  'missing_component',
  'missing_connection',
  'excess_connection',
  'excess_component',
  'incorrect_connection',
  'reversed_polarity',
  'wrong_value',
  'wrong_component',
  'misconnected_component',
  'open_circuit',
  'short_circuit',
];

const isJumper = (type) => type.startsWith('jumper');
const NOME = {
  bateria: 'a bateria',
  led: 'o LED',
  buzzer: 'o buzzer',
  resistor_220: 'o resistor de 220 Ω',
  resistor_470: 'o resistor de 470 Ω',
  resistor_1k: 'o resistor de 1 kΩ',
  capacitor: 'o capacitor',
  botao: 'o botão',
  potenciometro: 'o potenciômetro',
};

export function actionFor(piece: Piece): StepAction {
  return isJumper(piece.type) ? 'place_connection' : 'place_component';
}

export function newStep(patch: Partial<LessonStep> = {}): LessonStep {
  return {
    id: uid('step'),
    action: 'place_component',
    pieceId: null,
    quizId: null,
    text: '',
    options: { matchValues: false, strictPositions: false },
    overrides: {},
    ...patch,
  };
}

export function stepText(piece: Piece): string {
  if (isJumper(piece.type)) {
    return `Coloque um jumper de ${Math.abs(piece.a - piece.b)} colunas na bancada. As conexões serão conferidas no passo final.`;
  }
  return `Coloque ${NOME[piece.type] || 'a peça'} na bancada.`;
}

/**
 * One step per piece of the final board: the battery first, other components by column,
 * then the jumpers (SFR4: exactly one action per step).
 */
export function autoSplit(pieces: Piece[]): LessonStep[] {
  const lo = (p) => Math.min(p.a, p.b);
  const rank = (p) => (p.type === 'bateria' ? 0 : isJumper(p.type) ? 2 : 1);
  const ordered = [...pieces].sort((x, y) => rank(x) - rank(y) || lo(x) - lo(y) || x.id.localeCompare(y.id));
  if (!ordered.length) return [];
  return [...ordered.map((p) => newStep({ action: actionFor(p), pieceId: p.id, text: stepText(p) })), connectionStep()];
}

export function connectionStep(id = uid('step')): LessonStep {
  return newStep({
    id,
    action: 'connect_circuit',
    text: 'Agora conecte os componentes conforme o circuito pedido. As ligações serão conferidas nesta etapa.',
  });
}

/** The steps a lesson plays: its own, or (for old lessons) an on-the-fly split of the board. */
export function effectiveSteps(lesson: Lesson): LessonStep[] {
  if (lesson.kind === 'challenge') return [];
  return lesson.steps?.length ? lesson.steps : autoSplit(lesson.board.pieces);
}

/** Student-visible target after steps[0..idx]: the pieces those steps place. */
export function cumulativeBoard(lesson: Lesson, idx: number, steps: LessonStep[] = effectiveSteps(lesson)): Piece[] {
  const byId = new Map(lesson.board.pieces.map((p) => [p.id, p]));
  const out = [];
  for (const s of steps.slice(0, idx + 1)) {
    const p = s.pieceId && byId.get(s.pieceId);
    if (p) out.push(p);
  }
  return out;
}

/** Pieces with no step, and steps whose piece is gone. */
export function reconcile(lesson: Lesson): { unassigned: Piece[]; dangling: LessonStep[] } {
  const ids = new Set(lesson.board.pieces.map((p) => p.id));
  const used = new Set(lesson.steps.filter((s) => s.pieceId).map((s) => s.pieceId));
  return {
    unassigned: lesson.board.pieces.filter((p) => !used.has(p.id)),
    dangling: lesson.steps.filter(
      (s) => !['interact', 'connect_circuit'].includes(s.action) && (!s.pieceId || !ids.has(s.pieceId))
    ),
  };
}

/** Structural problems that block saving. Empty = ok. The validator's lint stays advisory. */
export function stepProblems(lesson: Lesson): string[] {
  const out = [];
  if (lesson.timeLimitS != null) {
    if (lesson.kind !== 'challenge') out.push('O tempo limite só vale para desafios.');
    else if (!Number.isInteger(lesson.timeLimitS) || lesson.timeLimitS < 1)
      out.push('O tempo limite precisa ser um número de segundos maior que zero.');
  }
  if (lesson.kind !== 'guided' || lesson.steps.length === 0) return out;
  const byId = new Map(lesson.board.pieces.map((p) => [p.id, p]));
  const quizzes = new Map(lesson.quizzes.map((q) => [q.id, q]));
  const seen = new Set();
  lesson.steps.forEach((s, i) => {
    const n = i + 1;
    if (s.action === 'interact') {
      const q = quizzes.get(s.quizId);
      if (q?.position !== 'step') out.push(`Passo ${n}: escolha uma pergunta para o passo de interação.`);
      return;
    }
    if (s.action === 'connect_circuit') {
      if (s.pieceId) out.push(`Passo ${n}: o passo de conexão não deve conter uma peça.`);
      return;
    }
    const p = byId.get(s.pieceId);
    if (!p) {
      out.push(`Passo ${n}: a peça deste passo não está mais na bancada.`);
      return;
    }
    if (seen.has(p.id)) out.push(`Passo ${n}: a peça já foi usada em outro passo.`);
    seen.add(p.id);
    if (s.action !== actionFor(p)) out.push(`Passo ${n}: a ação deveria ser "${actionFor(p)}".`);
  });
  const missing = lesson.board.pieces.filter((p) => !seen.has(p.id));
  if (missing.length) out.push(`${missing.length} peça(s) da bancada ainda não têm passo.`);
  const circuitSteps = lesson.steps.filter((s) => s.action === 'connect_circuit');
  if (lesson.board.pieces.length && circuitSteps.length !== 1)
    out.push('Adicione exatamente um passo “Conectar circuito” após colocar as peças.');
  if (circuitSteps.length === 1) {
    const circuitIndex = lesson.steps.indexOf(circuitSteps[0]);
    if (
      lesson.steps
        .slice(circuitIndex + 1)
        .some((s) => s.action === 'place_component' || s.action === 'place_connection')
    )
      out.push('O passo “Conectar circuito” deve vir depois de todos os passos de colocação.');
  }
  return out;
}

const pieceOut = (p: Piece) =>
  p.value != null
    ? { id: p.id, type: p.type, a: p.a, b: p.b, row: p.row, value: p.value }
    : { id: p.id, type: p.type, a: p.a, b: p.b, row: p.row };
const optsOut = (o: Partial<StepOptions> = {}) => ({
  match_values: !!o.matchValues,
  strict_positions: !!o.strictPositions,
});

/** The graph_validator Lesson JSON. Step text stays app-side (the validator ignores it). */
export function toValidatorLesson(lesson: Lesson): any {
  if (lesson.kind === 'challenge') {
    const out: any = {
      id: lesson.id,
      kind: 'challenge',
      steps: [{ id: 'final', action: 'place_component', pieces: lesson.board.pieces.map(pieceOut) }],
    };
    if (lesson.timeLimitS != null) out.time_limit_s = lesson.timeLimitS;
    return out;
  }
  const byId = new Map(lesson.board.pieces.map((p) => [p.id, p]));
  const quizzes = new Map(lesson.quizzes.map((q) => [q.id, q]));
  const steps = effectiveSteps(lesson).map((s) => {
    const base = { id: s.id, action: s.action, options: optsOut(s.options), overrides: s.overrides || {} };
    if (s.action === 'interact') {
      const q = quizzes.get(s.quizId);
      return { ...base, interact: { quiz_correct_id: q ? q.correctId : '' } };
    }
    if (s.action === 'connect_circuit') return { ...base, add: [] };
    const p = byId.get(s.pieceId);
    return { ...base, add: p ? [pieceOut(p)] : [] };
  });
  return { id: lesson.id, kind: 'guided', steps };
}

/** overrides {category:{family:text}} <-> editable rows [{category,family,text}] (SFR15.1). */
export function overrideRows(overrides: LessonStep['overrides'] = {}) {
  return Object.entries(overrides).flatMap(([category, per]) =>
    Object.entries(per).map(([family, text]) => ({ category, family, text }))
  );
}

export function rowsToOverrides(rows: { category: string; family: string; text: string }[]): LessonStep['overrides'] {
  const out: LessonStep['overrides'] = {};
  for (const r of rows) {
    if (!out[r.category]) out[r.category] = {};
    out[r.category][r.family] = r.text;
  }
  return out;
}
