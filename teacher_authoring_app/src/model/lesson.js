import { COLS, ROWS } from '../engine/board.js';
import { DIRECTED, KIT_LIMITS, POT_VALUES, TYPES, countByType } from '../engine/sim.js';

export const LESSON_VERSION = 1;
export const KINDS = ['guided', 'challenge'];
export const POSITIONS = ['before', 'after'];

export function uid(prefix = 'id') {
  const rnd = (globalThis.crypto && globalThis.crypto.randomUUID)
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return prefix + '-' + rnd;
}

export function newLesson() {
  return {
    version: LESSON_VERSION,
    id: uid('lesson'),
    title: '',
    instruction: '',
    kind: 'guided',
    board: { cols: COLS, rows: ROWS, pieces: [] },
    quizzes: [],
    updatedAt: new Date().toISOString()
  };
}

export function newQuiz(position = 'before') {
  const o1 = uid('o'), o2 = uid('o');
  return {
    id: uid('q'),
    position,
    prompt: '',
    options: [{ id: o1, text: '', feedback: '' }, { id: o2, text: '', feedback: '' }],
    correctId: o1
  };
}

export function newOption() { return { id: uid('o'), text: '', feedback: '' }; }

/** Problems that block saving. Empty array = lesson is saveable. */
export function lessonProblems(lesson) {
  const out = [];
  if (!lesson.title.trim()) out.push('Dê um título à lição.');
  lesson.quizzes.forEach((q, i) => {
    const n = i + 1;
    if (!q.prompt.trim()) out.push(`Pergunta ${n}: escreva o enunciado.`);
    if (q.options.length < 2) out.push(`Pergunta ${n}: precisa de pelo menos 2 alternativas.`);
    if (q.options.some(o => !o.text.trim())) out.push(`Pergunta ${n}: há alternativa em branco.`);
    if (!q.options.some(o => o.id === q.correctId)) out.push(`Pergunta ${n}: marque a alternativa correta.`);
  });
  return out;
}

const isInt = (n) => Number.isInteger(n);

/** Parses/validates untrusted JSON (imported file). Returns { ok, lesson } or { ok:false, error }. */
export function validateLesson(raw) {
  const fail = (error) => ({ ok: false, error });
  if (!raw || typeof raw !== 'object') return fail('O arquivo não contém uma lição.');
  if (raw.version !== LESSON_VERSION) return fail(`Versão do arquivo não suportada (${raw.version}).`);
  if (typeof raw.id !== 'string' || !raw.id) return fail('Lição sem id.');
  if (typeof raw.title !== 'string') return fail('Título inválido.');
  if (typeof raw.instruction !== 'string') return fail('Instrução inválida.');
  if (!KINDS.includes(raw.kind)) return fail('Tipo de lição inválido.');
  const pieces = raw.board && raw.board.pieces;
  if (!Array.isArray(pieces)) return fail('Bancada inválida.');
  const ids = new Set();
  for (const p of pieces) {
    if (p && p.type === 'resistor') p.type = 'resistor_470'; // lessons saved before resistor values existed
    if (!p || !TYPES.includes(p.type)) return fail(`Peça desconhecida: ${p && p.type}.`);
    if (!isInt(p.a) || !isInt(p.b) || p.a < 1 || p.b < 1 || p.a > COLS || p.b > COLS) return fail('Peça fora das 11 colunas.');
    if (!isInt(p.row) || p.row < 0 || p.row >= ROWS) return fail('Peça fora das linhas da bancada.');
    if (typeof p.id !== 'string' || ids.has(p.id)) return fail('Peças com id repetido.');
    ids.add(p.id);
  }
  const used = countByType(pieces);
  for (const t of TYPES) if ((used[t] || 0) > KIT_LIMITS[t]) return fail(`Peças demais: o kit tem só ${KIT_LIMITS[t]} × ${t}.`);
  if (!Array.isArray(raw.quizzes)) return fail('Perguntas inválidas.');
  for (const q of raw.quizzes) {
    if (!q || typeof q.id !== 'string' || !POSITIONS.includes(q.position) || typeof q.prompt !== 'string') return fail('Pergunta inválida.');
    if (!Array.isArray(q.options) || q.options.some(o => !o || typeof o.id !== 'string' || typeof o.text !== 'string')) return fail('Alternativas inválidas.');
    if (!q.options.some(o => o.id === q.correctId)) return fail('Pergunta sem alternativa correta.');
  }
  const lesson = {
    version: LESSON_VERSION,
    id: raw.id,
    title: raw.title,
    instruction: raw.instruction,
    kind: raw.kind,
    board: {
      cols: COLS, rows: ROWS,
      pieces: pieces.map(p => (p.type === 'potenciometro' && POT_VALUES.includes(p.value)
        ? { id: p.id, type: p.type, a: p.a, b: p.b, row: p.row, value: p.value }
        : { id: p.id, type: p.type, a: p.a, b: p.b, row: p.row }))
    },
    quizzes: raw.quizzes.map(q => ({
      id: q.id, position: q.position, prompt: q.prompt, correctId: q.correctId,
      options: q.options.map(o => ({ id: o.id, text: o.text, feedback: typeof o.feedback === 'string' ? o.feedback : '' }))
    })),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString()
  };
  return { ok: true, lesson };
}

function pieceKey(p) {
  const [x, y] = DIRECTED.has(p.type) ? [p.a, p.b] : [Math.min(p.a, p.b), Math.max(p.a, p.b)];
  return `${p.type}:${x}-${y}`;
}

/**
 * True when the student's board has exactly the target's pieces: same type and
 * columns (direction matters only for bateria/LED), whatever row they sit on.
 */
export function matchesTarget(student, target) {
  if (student.length !== target.length) return false;
  const a = student.map(pieceKey).sort();
  const b = target.map(pieceKey).sort();
  return a.every((k, i) => k === b[i]);
}

export function slugify(title) {
  const s = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'licao';
}
