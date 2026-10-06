import { toValidatorLesson } from '../model/steps.ts';
import type { Lesson, Piece } from '../model/types.ts';

/** The Vite dev server proxies /api to the graph_validator service (see vite.config.js). */
export const BASE = '/api';

const pieceOut = (p: Piece) =>
  p.value != null
    ? { id: p.id, type: p.type, a: p.a, b: p.b, row: p.row, value: p.value }
    : { id: p.id, type: p.type, a: p.a, b: p.b, row: p.row };

/** Result: { ok:true, data } | { ok:false, offline:true } | { ok:false, error, problems? }. */
type FetchLike = (input: string, init?: RequestInit) => Promise<any>;
async function call(path: string, body: unknown, fetchImpl: FetchLike): Promise<any> {
  let res: any;
  try {
    res = await fetchImpl(
      BASE + path,
      body === undefined
        ? undefined
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
  } catch {
    return { ok: false, offline: true, error: 'Validador offline.' };
  }
  // A proxy with nothing behind it answers 500/502/503/504.
  if (res.status >= 500) return { ok: false, offline: true, error: 'Validador offline.' };
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (res.ok) return { ok: true, data: json };
  const detail = json?.detail;
  if (detail && detail.error === 'invalid_board') {
    return { ok: false, error: 'Há peças em lugar inválido na bancada.', problems: detail.problems || [] };
  }
  if (detail && detail.error === 'invalid_input') {
    return { ok: false, error: `Entrada inválida: ${detail.detail}` };
  }
  if (Array.isArray(detail)) {
    const fields = detail.map((issue) => `${issue.loc?.join('.') || 'entrada'}: ${issue.msg}`).join('; ');
    return { ok: false, error: fields || 'O validador recusou a requisição.' };
  }
  return { ok: false, error: typeof detail === 'string' ? detail : 'O validador recusou a requisição.' };
}

function stepResult(d: any) {
  return {
    approved: d.approved,
    category: d.category,
    message: d.message,
    hint: d.hint,
    awaitingAnswer: d.awaiting_answer,
    graphHash: d.graph_hash,
    issues: (d.issues || []).map((issue: any) => ({
      category: issue.category,
      family: issue.family,
      partId: issue.part_id,
      expectedPartId: issue.expected_part_id,
      actualPartId: issue.actual_part_id,
    })),
    debug: d.debug
      ? {
          stepId: d.debug.step_id,
          action: d.debug.action,
          expectedPieces: d.debug.expected_pieces,
          actualPieces: d.debug.actual_pieces,
          matchValues: d.debug.match_values,
          strictPositions: d.debug.strict_positions,
          expectedNets: d.debug.expected_nets ?? [],
          actualNets: d.debug.actual_nets ?? [],
          expectedCircuit: d.debug.expected_circuit ?? null,
          actualCircuit: d.debug.actual_circuit ?? null,
        }
      : null,
  };
}

/** Validates the student's `pieces` against step `stepIdx` of `lesson` (challenges: stepIdx 0). */
export async function validateStep(
  {
    lesson,
    pieces,
    stepIdx,
    previousHash = null,
    answer = null,
    debug = false,
  }: {
    lesson: Lesson;
    pieces: Piece[];
    stepIdx: number;
    previousHash?: string | null;
    answer?: string | null;
    debug?: boolean;
  },
  fetchImpl: FetchLike = globalThis.fetch
): Promise<any> {
  const r = await call(
    '/validate/step',
    {
      lesson: toValidatorLesson(lesson),
      board: { pieces: pieces.map(pieceOut) },
      step_idx: stepIdx,
      previous_graph_hash: previousHash,
      answer,
      debug,
    },
    fetchImpl
  );
  return r.ok === true ? { ok: true, result: stepResult(r.data) } : r;
}

/** Advisory lint: { ok, problems:[string], byStep:[{stepId,message}] }. */
export async function lintLesson(lesson: Lesson, fetchImpl: FetchLike = globalThis.fetch): Promise<any> {
  const r = await call('/lessons/lint', toValidatorLesson(lesson), fetchImpl);
  return r.ok === true ? { ok: true, problems: r.data.problems, byStep: r.data.byStep } : r;
}

/** Default pt-BR messages and component names for the override UI. */
export async function feedbackCatalog(fetchImpl: FetchLike = globalThis.fetch): Promise<any> {
  const r = await call('/feedback/categories', undefined, fetchImpl);
  return r.ok === true ? { ok: true, categories: r.data.categories, families: r.data.families } : r;
}
