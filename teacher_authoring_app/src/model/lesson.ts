import { COLS, ROWS } from '../engine/board.ts';
import { AMMETER_SLOT, slotOf } from '../engine/nodes.ts';
import {
  configProblems,
  countByType,
  isCapsule,
  KIT_LIMITS,
  MAX_CAPSULES,
  TYPES,
} from '../engine/sim.ts';
import { uid } from './ids.ts';
import { ACTIONS, autoSplit, CATEGORIES, connectionStep, stepProblems } from './steps.ts';
import type {
  Illustration,
  Lesson,
  LessonSettings,
  LessonStep,
  LessonValidation,
  Piece,
  Quiz,
  QuizOption,
  QuizPosition,
} from './types.ts';

export const LESSON_VERSION = 4;
/** Versions `validateLesson` reads; v1/v2 guided lessons migrate to explicit connection steps. */
const READABLE_VERSIONS = [1, 2, 3, 4];
export const KINDS = ['guided', 'challenge'];
/** `step` quizzes belong to an interact step (SFR19) and are not shown before/after the build. */
export const POSITIONS = ['before', 'after', 'step'];

export { uid };

export function newLesson(): Lesson {
  return {
    version: LESSON_VERSION,
    id: uid('lesson'),
    title: '',
    instruction: '',
    kind: 'guided',
    board: { cols: COLS, rows: ROWS, pieces: [] },
    steps: [],
    timeLimitS: null,
    quizzes: [],
    updatedAt: new Date().toISOString(),
  };
}

export function newQuiz(position: QuizPosition = 'before'): Quiz {
  const o1 = uid('o'),
    o2 = uid('o');
  return {
    id: uid('q'),
    position,
    prompt: '',
    options: [
      { id: o1, text: '', feedback: '' },
      { id: o2, text: '', feedback: '' },
    ],
    correctId: o1,
  };
}

export function newOption(): QuizOption {
  return { id: uid('o'), text: '', feedback: '' };
}

/** Problems that block saving. Empty array = lesson is saveable. */
export function lessonProblems(lesson: Lesson): string[] {
  const out = [];
  if (!lesson.title.trim()) out.push('Dê um título à lição.');
  lesson.quizzes.forEach((q, i) => {
    const n = i + 1;
    if (!q.prompt.trim()) out.push(`Pergunta ${n}: escreva o enunciado.`);
    if (q.options.length < 2) out.push(`Pergunta ${n}: precisa de pelo menos 2 alternativas.`);
    if (q.options.some((o) => !o.text.trim())) out.push(`Pergunta ${n}: há alternativa em branco.`);
    if (!q.options.some((o) => o.id === q.correctId)) out.push(`Pergunta ${n}: marque a alternativa correta.`);
  });
  out.push(...stepProblems(lesson));
  return out;
}

const isInt = (n) => Number.isInteger(n);

/** Shape, kit and slot rules shared by a lesson's target board and its starting bench. Error text or null. */
function checkPieces(pieces: any[]): string | null {
  const ids = new Set();
  for (const p of pieces) {
    if (p && p.type === 'resistor') p.type = 'resistor_470'; // lessons saved before resistor values existed
    if (!p || !TYPES.includes(p.type)) return `Peça desconhecida: ${p?.type}.`;
    if (!isInt(p.a) || !isInt(p.b) || p.a < 1 || p.b < 1 || p.a > COLS || p.b > COLS) return 'Peça fora das 11 colunas.';
    if (!isInt(p.row) || p.row < 0 || p.row >= ROWS) return 'Peça fora das linhas da bancada.';
    if (isCapsule(p.type)) {
      if (!isInt(p.c) || p.b !== p.a + 1 || p.c !== p.a + 2 || p.c > COLS)
        return `${p.type} precisa de três colunas seguidas (P1, P2, P3).`;
      const slot = slotOf(p);
      if (slot == null) return `${p.type} só cabe nos 6 encaixes de cápsula da bancada.`;
      if (p.type === 'capsula_amperimetro' && slot !== AMMETER_SLOT)
        return `O amperímetro só funciona no encaixe ${AMMETER_SLOT}.`;
      const bad = configProblems(p.type, p.config);
      if (bad.length) return `${p.type}: ${bad[0]}`;
    } else if (p.c != null || p.config != null) return `${p.type} não tem terceira coluna nem configuração.`;
    if (typeof p.id !== 'string' || ids.has(p.id)) return 'Peças com id repetido.';
    ids.add(p.id);
  }
  const used = countByType(pieces);
  for (const t of TYPES) if ((used[t] || 0) > KIT_LIMITS[t]) return `Peças demais: o kit tem só ${KIT_LIMITS[t]} × ${t}.`;
  if (pieces.filter((p) => isCapsule(p.type)).length > MAX_CAPSULES)
    return `No máximo ${MAX_CAPSULES} cápsulas inteligentes ao mesmo tempo.`;
  return null;
}

function cleanPiece(p: any): Piece {
  const base: any = { id: p.id, type: p.type, a: p.a, b: p.b, row: p.row };
  if (isCapsule(p.type)) {
    base.c = p.c;
    if (p.config) base.config = p.config;
  } else if (p.type === 'potenciometro' && Number.isInteger(p.value) && p.value > 0) base.value = p.value;
  if (p.loose === true) base.loose = true;
  return base;
}

const SETTING_FLAGS = ['statusLed', 'allowNoResistor', 'requireLit', 'matchValues', 'strictPositions'];

function cleanSettings(raw: any): LessonSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: LessonSettings = {};
  for (const k of SETTING_FLAGS) if (raw[k] === true) out[k] = true;
  if (Number.isInteger(raw.hintAfter) && raw.hintAfter >= 2) out.hintAfter = raw.hintAfter;
  if (Array.isArray(raw.tray)) out.tray = raw.tray.filter((t) => TYPES.includes(t));
  return Object.keys(out).length ? out : undefined;
}

/** Parses/validates untrusted JSON (imported file). Returns { ok, lesson } or { ok:false, error }. */
export function validateLesson(raw: any): LessonValidation {
  const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
  if (!raw || typeof raw !== 'object') return fail('O arquivo não contém uma lição.');
  if (!READABLE_VERSIONS.includes(raw.version)) return fail(`Versão do arquivo não suportada (${raw.version}).`);
  if (typeof raw.id !== 'string' || !raw.id) return fail('Lição sem id.');
  if (typeof raw.title !== 'string') return fail('Título inválido.');
  if (typeof raw.instruction !== 'string') return fail('Instrução inválida.');
  if (!KINDS.includes(raw.kind)) return fail('Tipo de lição inválido.');
  const pieces = raw.board?.pieces;
  if (!Array.isArray(pieces)) return fail('Bancada inválida.');
  const pieceError = checkPieces(pieces);
  if (pieceError) return fail(pieceError);
  const startRaw = raw.start == null ? null : raw.start;
  if (startRaw) {
    if (!Array.isArray(startRaw.pieces)) return fail('Bancada inicial inválida.');
    const startError = checkPieces(startRaw.pieces);
    if (startError) return fail(`Bancada inicial: ${startError}`);
  }
  if (!Array.isArray(raw.quizzes)) return fail('Perguntas inválidas.');
  for (const q of raw.quizzes) {
    if (!q || typeof q.id !== 'string' || !POSITIONS.includes(q.position) || typeof q.prompt !== 'string')
      return fail('Pergunta inválida.');
    if (
      !Array.isArray(q.options) ||
      q.options.some((o) => !o || typeof o.id !== 'string' || typeof o.text !== 'string')
    )
      return fail('Alternativas inválidas.');
    if (!q.options.some((o) => o.id === q.correctId)) return fail('Pergunta sem alternativa correta.');
  }
  const rawSteps = raw.steps === undefined ? [] : raw.steps;
  if (!Array.isArray(rawSteps)) return fail('Passos inválidos.');
  let steps = [];
  for (const st of rawSteps) {
    if (!st || typeof st.id !== 'string' || !ACTIONS.includes(st.action)) return fail('Passo inválido.');
    steps.push(cleanStep(st));
  }
  const timeLimitS = Number.isInteger(raw.timeLimitS) ? raw.timeLimitS : null;
  const lesson = {
    version: LESSON_VERSION,
    id: raw.id,
    title: raw.title,
    instruction: raw.instruction,
    kind: raw.kind,
    board: {
      cols: COLS,
      rows: ROWS,
      pieces: pieces.map(cleanPiece),
    },
    steps,
    timeLimitS,
    quizzes: raw.quizzes.map((q) => ({
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      correctId: q.correctId,
      options: q.options.map((o) => ({
        id: o.id,
        text: o.text,
        feedback: typeof o.feedback === 'string' ? o.feedback : '',
      })),
    })),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  } as Lesson;
  if (startRaw) {
    lesson.start = { pieces: startRaw.pieces.map(cleanPiece) };
    const drop = Array.isArray(startRaw.removeOneOf) ? startRaw.removeOneOf.filter((id) => typeof id === 'string') : [];
    if (drop.length) lesson.start.removeOneOf = drop;
  }
  const settings = cleanSettings(raw.settings);
  if (settings) lesson.settings = settings;
  if (typeof raw.teacherNotes === 'string' && raw.teacherNotes.trim()) lesson.teacherNotes = raw.teacherNotes;
  if (Array.isArray(raw.tags)) lesson.tags = raw.tags.filter((t) => typeof t === 'string' && t.trim());
  if (raw.version < 3 && lesson.kind === 'guided' && lesson.board.pieces.length) {
    if (steps.length === 0) steps = autoSplit(lesson.board.pieces);
    else if (!steps.some((s) => s.action === 'connect_circuit')) {
      const usedIds = new Set(steps.map((s) => s.id));
      let id = `${lesson.id}-connect-circuit`;
      for (let suffix = 2; usedIds.has(id); suffix++) id = `${lesson.id}-connect-circuit-${suffix}`;
      const circuit = connectionStep(id);
      let insertAt = 0;
      steps.forEach((s, i) => {
        if (s.action === 'place_component' || s.action === 'place_connection') insertAt = i + 1;
      });
      steps.splice(insertAt, 0, circuit);
    }
    lesson.steps = steps;
  }
  return { ok: true, lesson };
}

function cleanStep(st: any) {
  const overrides: LessonStep['overrides'] = {};
  for (const c of CATEGORIES) {
    const per = st.overrides?.[c];
    if (!per || typeof per !== 'object') continue;
    const clean = {};
    for (const [fam, text] of Object.entries(per)) if (typeof text === 'string' && text.trim()) clean[fam] = text;
    if (Object.keys(clean).length) overrides[c] = clean;
  }
  return {
    id: st.id,
    action: st.action,
    pieceId: typeof st.pieceId === 'string' ? st.pieceId : null,
    quizId: typeof st.quizId === 'string' ? st.quizId : null,
    text: typeof st.text === 'string' ? st.text : '',
    options: {
      matchValues: !!st.options?.matchValues,
      strictPositions: !!st.options?.strictPositions,
    },
    overrides,
    ...cleanClientFields(st),
  };
}

function cleanIllustration(raw: any): Illustration | null {
  if (!raw || typeof raw.svg !== 'string' || !raw.svg.trim().startsWith('<svg')) return null;
  return { svg: raw.svg, alt: typeof raw.alt === 'string' ? raw.alt : '', ...(typeof raw.caption === 'string' && raw.caption ? { caption: raw.caption } : {}) };
}

/** Optional fields of explain/experiment steps; absent on the older step kinds. */
function cleanClientFields(st: any): Partial<LessonStep> {
  const out: Partial<LessonStep> = {};
  if (typeof st.title === 'string' && st.title) out.title = st.title;
  const illustration = cleanIllustration(st.illustration);
  if (illustration) out.illustration = illustration;
  if (st.widget === 'nodes') out.widget = 'nodes';
  if (st.action === 'experiment' && st.experiment && Array.isArray(st.experiment.goals)) {
    const e = st.experiment;
    out.experiment = {
      goals: e.goals.map((g) => ({ id: String(g.id), label: String(g.label ?? ''), ...(g.seen ? { seen: g.seen } : {}), ...(g.now ? { now: g.now } : {}), ...(g.ccDistinct ? { ccDistinct: g.ccDistinct } : {}), ...(g.presetsLit ? { presetsLit: g.presetsLit } : {}), ...(g.presetsFaded ? { presetsFaded: g.presetsFaded } : {}) })),
      ...(Array.isArray(e.board) ? { board: e.board.map(cleanPiece) } : {}),
      ...(Array.isArray(e.presets) ? { presets: e.presets.map((p) => ({ label: String(p.label), pieces: p.pieces.map(cleanPiece) })) } : {}),
      ...(e.slider ? { slider: { pieceId: String(e.slider.pieceId), label: String(e.slider.label ?? '') } } : {}),
      ...(e.clips ? { clips: { a: Number(e.clips.a), b: Number(e.clips.b) } } : {}),
    };
  }
  return out;
}

export function slugify(title: string): string {
  const s = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'licao';
}
