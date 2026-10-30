import { uid } from './ids.ts';
import type { Lesson, LessonStep, Piece, StepAction, StepOptions } from './types.ts';

export const ACTIONS = [
  'place_component',
  'place_connection',
  'connect_circuit',
  'interact',
  'explain',
  'experiment',
];
/** Steps only the app plays: the graph_validator never judges them. */
export const CLIENT_ACTIONS = ['explain', 'experiment'];
export const isClientStep = (s: Pick<LessonStep, 'action'>) => CLIENT_ACTIONS.includes(s.action);

/**
 * The steps a challenge plays after its build: explanations, questions and experiments only.
 * (Guided lessons use `effectiveSteps`.)
 */
export function challengeSteps(lesson: Lesson): LessonStep[] {
  return lesson.kind === 'challenge' ? (lesson.steps || []).filter((s) => isClientStep(s) || s.action === 'interact') : [];
}

/** The bench a lesson starts from: its preassembled pieces (one of `removeOneOf` removed at random). */
export function startPieces(lesson: Lesson, random: () => number = Math.random): Piece[] {
  const start = lesson.start;
  if (!start) return [];
  const pool = start.removeOneOf?.length ? start.removeOneOf : null;
  const drop = pool ? pool[Math.floor(random() * pool.length)] : null;
  return start.pieces.filter((p) => p.id !== drop).map((p) => ({ ...p }));
}

/** A challenge only needs a build phase when its starting bench is not already the finished circuit. */
export function needsBuild(lesson: Lesson): boolean {
  if (lesson.kind !== 'challenge' || lesson.board.pieces.length === 0) return false;
  const key = (p: Piece) => `${p.type}:${p.a}:${p.b}:${p.row}:${p.value ?? ''}:${p.loose ? 'x' : ''}`;
  const have = (lesson.start?.pieces || []).map(key).sort().join('|');
  const want = lesson.board.pieces.map(key).sort().join('|');
  return have !== want || !!lesson.start?.removeOneOf?.length;
}
export const CATEGORIES = [
  'missing_component',
  'missing_connection',
  'excess_connection',
  'excess_component',
  'incorrect_connection',
  'reversed_polarity',
  'wrong_value',
  'wrong_component',
  'wrong_config',
  'misconnected_component',
  'open_circuit',
  'short_circuit',
];

const isJumper = (type) => type.startsWith('jumper');
const isCapsule = (type) => type.startsWith('capsula_');
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
  capsula_pulso: 'a cápsula de pulso',
  capsula_voltimetro: 'a cápsula voltímetro',
  capsula_amperimetro: 'a cápsula amperímetro',
  capsula_porta: 'a cápsula de porta lógica',
  capsula_memoria: 'a cápsula de memória',
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

// Jumpers are named the way the tray names them, so the step text matches what the student sees.
const JUMPER_NOME = {
  jumper_curto: 'o jumper curto',
  jumper_longo: 'o jumper longo',
  jumper_3: 'o jumper de 3 colunas',
  jumper_4: 'o jumper de 4 colunas',
  jumper_5: 'o jumper de 5 colunas',
};

export function stepText(piece: Piece): string {
  if (isJumper(piece.type)) {
    return `Coloque ${JUMPER_NOME[piece.type] || 'um jumper'} na bancada. As conexões serão conferidas no passo final.`;
  }
  return `Coloque ${NOME[piece.type] || 'a peça'} na bancada.`;
}

/** True when the text is one `stepText` generated (so it is safe to regenerate), not something the teacher wrote. */
const isGeneratedText = (text: string) =>
  /^Coloque [^.]+ na bancada\.( As conexões serão conferidas no passo final\.)?$/.test(text.trim());

/**
 * Steps whose text was generated for a piece other than the one now bound to them (the teacher swapped the piece)
 * get the text of the current piece. Custom text is never touched.
 */
export function refreshGeneratedText(lesson: Lesson): Lesson {
  const byId = new Map(lesson.board.pieces.map((p) => [p.id, p]));
  let changed = false;
  const steps = lesson.steps.map((s) => {
    const piece = s.pieceId ? byId.get(s.pieceId) : null;
    if (!piece || s.text === stepText(piece) || !(!s.text.trim() || isGeneratedText(s.text))) return s;
    changed = true;
    return { ...s, text: stepText(piece) };
  });
  return changed ? { ...lesson, steps } : lesson;
}

/**
 * One step per piece of the final board: the battery first, other components by column,
 * then the jumpers (SFR4: exactly one action per step).
 */
export function autoSplit(pieces: Piece[]): LessonStep[] {
  const lo = (p) => Math.min(p.a, p.b);
  const rank = (p) => (p.type === 'bateria' ? 0 : isJumper(p.type) ? 3 : isCapsule(p.type) ? 2 : 1);
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
      (s) =>
        !['interact', 'connect_circuit', ...CLIENT_ACTIONS].includes(s.action) && (!s.pieceId || !ids.has(s.pieceId))
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
  const quizzes = new Map(lesson.quizzes.map((q) => [q.id, q]));
  const clientProblem = (s: LessonStep, n: number) => {
    if (s.action === 'experiment') {
      const goals = s.experiment?.goals;
      if (!goals?.length) out.push(`Passo ${n}: o experimento precisa de pelo menos uma missão.`);
      else if (goals.some((g) => !g.label.trim())) out.push(`Passo ${n}: escreva o texto de cada missão.`);
    }
    if (s.action === 'explain' && !s.text.trim() && !s.illustration)
      out.push(`Passo ${n}: escreva a explicação ou adicione uma ilustração.`);
  };
  if (lesson.kind === 'challenge') {
    lesson.steps.forEach((s, i) => {
      const n = i + 1;
      if (isClientStep(s)) clientProblem(s, n);
      else if (s.action === 'interact') {
        if (quizzes.get(s.quizId)?.position !== 'step')
          out.push(`Passo ${n}: escolha uma pergunta para o passo de interação.`);
      } else out.push(`Passo ${n}: o desafio só aceita explicações, experimentos e perguntas depois da montagem.`);
    });
    return out;
  }
  if (lesson.kind !== 'guided' || lesson.steps.length === 0) return out;
  const byId = new Map(lesson.board.pieces.map((p) => [p.id, p]));
  const seen = new Set();
  lesson.steps.forEach((s, i) => {
    const n = i + 1;
    if (isClientStep(s)) {
      clientProblem(s, n);
      return;
    }
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

/** A piece as the graph_validator expects it: only the fields that apply to its type. */
export const pieceOut = (p: Piece) => ({
  id: p.id,
  type: p.type,
  a: p.a,
  b: p.b,
  row: p.row,
  ...(p.value != null ? { value: p.value } : {}),
  ...(p.c != null ? { c: p.c } : {}),
  ...(p.config ? { config: p.config } : {}),
});
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
      steps: [
        {
          id: 'final',
          action: 'place_component',
          pieces: lesson.board.pieces.map(pieceOut),
          options: optsOut(lesson.settings),
        },
      ],
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
    // Explanations and experiments are the app's: to the validator they are questions nobody answers.
    if (isClientStep(s)) return { ...base, action: 'interact', interact: { quiz_correct_id: '' } };
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
