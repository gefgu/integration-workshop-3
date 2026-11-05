/** HTTP client for the local bench service (bench/service, port 8765). */
import type { BenchPackage, BenchStatus, BenchStudent } from '../../../protocol/bench.ts';

export interface ProgressRow {
  lesson_id: string;
  step_idx: number;
  completed: number;
}
export interface Resume {
  lesson_id: string | null;
  step_idx: number;
}
export interface RankRow {
  student_id: number;
  nickname: string;
  score: number;
  duration_s: number;
}
/** Camera board (bench/service/bench_service/vision.py): the pieces the vision pipeline sees right now. */
export interface VisionPiece {
  id: string;
  type: string;
  a: number;
  b: number;
  row: number;
}
export interface VisionState {
  available: boolean;
  running?: boolean;
  /** last frame was usable (grid found, no hand in front, scene still) */
  valid?: boolean;
  reason?: string;
  /** bumps each time the stable circuit changes */
  version?: number;
  pieces?: VisionPiece[];
  /** components the lesson cannot use (ambiguous colour, unsupported part), with a pt-BR reason */
  unknown?: (VisionPiece & { reason: string })[];
}
export interface LoginResult {
  student: BenchStudent;
  progress: Record<string, ProgressRow>;
  resume: Resume;
}

/** `?servico=http://host:8765` overrides the default (same host as the page, port 8765). */
export function serviceUrl(location: Pick<Location, 'search' | 'hostname' | 'protocol'> = window.location): string {
  const fromQuery = new URLSearchParams(location.search).get('servico');
  if (fromQuery) return fromQuery.replace(/\/+$/, '');
  const port = import.meta.env?.VITE_BENCH_PORT || '8765';
  return `${location.protocol === 'https:' ? 'https' : 'http'}://${location.hostname || 'localhost'}:${port}`;
}

export class BenchApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export function benchApi(base: string, fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {
  async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new BenchApiError('O serviço da bancada não está respondendo.', 0);
    }
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new BenchApiError(json?.detail ?? 'Erro na bancada.', response.status);
    return json as T;
  }
  return {
    status: () => call<BenchStatus>('/status'),
    package: () => call<BenchPackage>('/package'),
    login: (nfc_code: string) => call<LoginResult>('/login', 'POST', { nfc_code }),
    step: (
      studentId: number,
      body: { lesson_id: string; step_idx: number; lesson_done?: boolean; duration_s?: number }
    ) => call<{ resume: Resume }>(`/students/${studentId}/step`, 'POST', body),
    quiz: (studentId: number, body: { lesson_id: string; quiz_id: string; correct: boolean }) =>
      call(`/students/${studentId}/quiz`, 'POST', body),
    score: (studentId: number, body: { lesson_id: string; score: number; duration_s: number }) =>
      call<{ ranking: RankRow[] }>(`/students/${studentId}/score`, 'POST', body),
    logout: (studentId: number, duration_s: number) => call(`/students/${studentId}/logout`, 'POST', { duration_s }),
    ranking: (lessonId?: string) =>
      call<RankRow[]>(`/ranking${lessonId ? `?lesson_id=${encodeURIComponent(lessonId)}` : ''}`),
    devUnlock: () => call<BenchStatus>('/dev/unlock', 'POST'),
    devDemo: (pkg: BenchPackage) => call<BenchStatus>('/dev/demo', 'POST', pkg),
    vision: () => call<VisionState>('/vision/state'),
    visionRecalibrate: () => call('/vision/recalibrate', 'POST'),
    visionFrameUrl: (stamp: number) => `${base}/vision/frame.jpg?t=${stamp}`,
  };
}

export type BenchApi = ReturnType<typeof benchApi>;
