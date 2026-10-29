/** TedTronics server API for the phone app. Pure TypeScript: the storage and fetch are injected. */
import type { BenchEvent, BenchPackage } from '../../../protocol/bench.ts';

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface Teacher {
  id: number;
  name: string;
  email: string;
}
export interface SchoolClass {
  id: number;
  name: string;
  description: string;
  student_count?: number;
}
export interface Student {
  id: number;
  class_id: number;
  name: string;
  nickname: string;
  nfc_code: string | null;
  active: boolean;
}
export interface ClassDetail extends SchoolClass {
  students: Student[];
  lesson_ids: string[];
  module_ids: number[];
}
export interface Module {
  id: number;
  title: string;
  description: string;
  lesson_ids: string[];
  class_ids: number[];
}
export interface SyncResult {
  acked: string[];
  rejected: { event_id: string; reason: string }[];
  inserted: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/** Network failure (no internet / server down), as opposed to the server refusing the request. */
export class OfflineError extends Error {}

type Fetch = typeof fetch;
const KEYS = { server: 'tedtronics.server', token: 'tedtronics.token', teacher: 'tedtronics.teacher' };

export class Api {
  server = '';
  token: string | null = null;
  teacher: Teacher | null = null;

  constructor(
    private store: KeyValueStore,
    private fetchImpl: Fetch = fetch,
    private timeoutMs = 10_000
  ) {}

  async load(): Promise<void> {
    this.server = (await this.store.getItem(KEYS.server)) ?? '';
    this.token = await this.store.getItem(KEYS.token);
    const teacher = await this.store.getItem(KEYS.teacher);
    this.teacher = teacher ? JSON.parse(teacher) : null;
  }

  /** Kept in memory only: login() saves it once it works, so a mistyped address is not remembered. */
  async setServer(url: string): Promise<void> {
    this.server = url.trim().replace(/\/+$/, '');
  }

  async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    if (!this.server) throw new ApiError('Informe o endereço do servidor.', 0);
    let response: Response;
    // A wrong address or a firewall drops packets silently; without a timeout the request never ends.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.timeoutMs);
    try {
      response = await this.fetchImpl(`${this.server}${path}`, {
        method,
        headers: {
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: abort.signal,
      });
    } catch (cause) {
      const why = abort.signal.aborted ? 'sem resposta em 10 s' : String((cause as Error)?.message ?? cause);
      console.warn(`fetch ${this.server}${path} failed:`, cause);
      throw new OfflineError(
        `Sem conexão com o servidor ${this.server} (${why}). Confira o endereço e se o celular está na mesma rede.`
      );
    } finally {
      clearTimeout(timer);
    }
    if (response.ok) return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
    let detail: unknown;
    try {
      detail = (await response.json()).detail;
    } catch {
      // not JSON
    }
    if (response.status === 401 && path !== '/auth/login') await this.forget();
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => String(d?.msg ?? '').replace(/^Value error, /, '')).join(' ')
          : response.status >= 500
            ? 'Servidor indisponível.'
            : 'Não foi possível concluir a operação.';
    throw new ApiError(message, response.status);
  }

  async login(email: string, password: string): Promise<Teacher> {
    const session = await this.request<{ token: string; teacher: Teacher }>('/auth/login', 'POST', { email, password });
    this.token = session.token;
    this.teacher = session.teacher;
    await this.store.setItem(KEYS.server, this.server);
    await this.store.setItem(KEYS.token, session.token);
    await this.store.setItem(KEYS.teacher, JSON.stringify(session.teacher));
    return session.teacher;
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', 'POST').catch(() => undefined);
    await this.forget();
  }

  private async forget(): Promise<void> {
    this.token = null;
    this.teacher = null;
    await this.store.removeItem(KEYS.token);
    await this.store.removeItem(KEYS.teacher);
  }

  classes = () => this.request<SchoolClass[]>('/workspace/classes');
  classDetail = (id: number) => this.request<ClassDetail>(`/workspace/classes/${id}`);
  modules = () => this.request<Module[]>('/workspace/modules');
  benchSession = () => this.request<{ token: string; expires_at: number }>('/bench/session', 'POST');
  benchPackage = (moduleId: number, classId: number) =>
    this.request<BenchPackage>(`/bench/package/${moduleId}?class_id=${classId}`);
  sync = (benchId: string, events: BenchEvent[]) =>
    this.request<SyncResult>('/bench/sync', 'POST', { bench_id: benchId, events });
}
