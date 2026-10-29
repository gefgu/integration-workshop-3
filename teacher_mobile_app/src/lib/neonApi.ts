/**
 * Same surface as Api, but talks to Neon directly: Neon Auth for the sign-in and the Data API (PostgREST) for
 * reads and RPCs. Row-level security in the database (migration 0003_phone_access) limits every call to the
 * signed-in teacher's rows, so the phone holds no database password and the bench secret never leaves Postgres.
 */
import type { BenchEvent, BenchPackage } from '../../../protocol/bench.ts';
import {
  Api,
  ApiError,
  type ClassDetail,
  type Fetch,
  type KeyValueStore,
  type Module,
  OfflineError,
  type SchoolClass,
  type SyncResult,
  type Teacher,
} from './api.ts';

export interface NeonConfig {
  /** e.g. https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth */
  authUrl: string;
  /** e.g. https://ep-xxx.apirest.<region>.aws.neon.tech/neondb/rest/v1 */
  restUrl: string;
}

const TOKEN_KEY = 'tedtronics.token';
const TEACHER_KEY = 'tedtronics.teacher';
const ORIGIN = 'http://localhost';
const SESSION_COOKIE = /__Secure-neon-auth\.session_token=[^;,\s]+/;
/** The Data API JWT lives ~15 min; renew it a little early. */
const JWT_MARGIN_S = 60;
const TEACHER_RETRIES = 2;

interface PostgrestError {
  code?: string;
  message?: string;
}

const claimExpiry = (jwt: string): number => {
  try {
    const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).exp ?? 0;
  } catch {
    return 0;
  }
};

export class NeonApi extends Api {
  private jwt: { value: string; exp: number } | null = null;
  /** Pause between the retries of the teacher lookup after sign-in (tests set it to 0). */
  retryDelayMs = 1000;

  constructor(
    store: KeyValueStore,
    private config: NeonConfig,
    fetchImpl: Fetch = fetch,
    timeoutMs = 10_000
  ) {
    super(store, fetchImpl, timeoutMs);
    this.server = config.restUrl;
  }

  override async load(): Promise<void> {
    await super.load();
    this.server = this.config.restUrl; // fixed by the build, never typed by the teacher
  }

  override async setServer(): Promise<void> {}

  /** `this.token` holds the Neon Auth session cookie (valid 7 days); the Data API JWT is derived from it. */
  override async login(email: string, password: string): Promise<Teacher> {
    const response = await this.send(`${this.config.authUrl}/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      throw new ApiError(response.status === 401 ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar.', response.status);
    }
    const header = response.headers.get('set-cookie') ?? (response.headers.getSetCookie?.() ?? []).join(', ');
    const cookie = header.match(SESSION_COOKIE)?.[0];
    if (!cookie) throw new ApiError('Resposta de login inesperada.', 502);
    this.token = cookie;
    this.jwt = null;
    // Seen against Neon: the very first read after a sign-in can come back empty before the teacher row is visible.
    let teacher: { id: number; name: string; email: string } | undefined;
    for (let attempt = 0; attempt <= TEACHER_RETRIES && !teacher; attempt += 1) {
      if (attempt) await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      teacher = (await this.rest<{ id: number; name: string; email: string }[]>('/teachers?select=id,name,email'))[0];
    }
    if (!teacher) {
      await this.forget();
      throw new ApiError('Este e-mail não corresponde a um professor cadastrado no site.', 403);
    }
    this.teacher = teacher;
    await this.store.setItem(TOKEN_KEY, cookie);
    await this.store.setItem(TEACHER_KEY, JSON.stringify(teacher));
    return teacher;
  }

  /** Creates the Neon Auth account (no e-mail verification for now) and signs in. The e-mail must match a teacher. */
  async signUp(email: string, password: string, name: string): Promise<Teacher> {
    const response = await this.send(`${this.config.authUrl}/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!response.ok) {
      const { code } = (await response.json().catch(() => ({}))) as { code?: string };
      throw new ApiError(
        code === 'USER_ALREADY_EXISTS' || code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
          ? 'Já existe uma conta com este e-mail. Use "Entrar".'
          : code === 'PASSWORD_TOO_SHORT'
            ? 'A senha é curta demais (mínimo de 8 caracteres).'
            : 'Não foi possível criar a conta.',
        response.status
      );
    }
    return this.login(email, password);
  }

  override async logout(): Promise<void> {
    if (this.token) {
      // Best effort: the phone may be offline.
      await this.send(`${this.config.authUrl}/sign-out`, {
        method: 'POST',
        headers: { Cookie: this.token, 'Content-Type': 'application/json' },
        body: '{}',
      }).catch(() => undefined);
    }
    this.jwt = null;
    await this.forget();
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.timeoutMs);
    try {
      // Neon Auth rejects calls without an Origin (MISSING_ORIGIN on sign-up; 403 when the client sends Fetch Metadata).
      // A native app has none, and localhost is always allowed.
      const headers = url.startsWith(this.config.authUrl) ? { Origin: ORIGIN, ...init.headers } : init.headers;
      return await this.fetchImpl(url, { credentials: 'omit', ...init, headers, signal: abort.signal });
    } catch (cause) {
      const why = abort.signal.aborted ? 'sem resposta em 10 s' : String((cause as Error)?.message ?? cause);
      throw new OfflineError(`Sem conexão com a nuvem (${why}). Confira a internet do celular.`);
    } finally {
      clearTimeout(timer);
    }
  }

  private async bearer(): Promise<string> {
    const now = Date.now() / 1000;
    if (this.jwt && this.jwt.exp - JWT_MARGIN_S > now) return this.jwt.value;
    if (!this.token) throw new ApiError('Faça login para continuar.', 401);
    const response = await this.send(`${this.config.authUrl}/token`, { headers: { Cookie: this.token } });
    if (response.status === 401) {
      await this.forget();
      throw new ApiError('Sua sessão expirou. Faça login novamente.', 401);
    }
    if (!response.ok) throw new ApiError('Não foi possível renovar a sessão.', response.status);
    const { token } = (await response.json()) as { token: string };
    this.jwt = { value: token, exp: claimExpiry(token) };
    return token;
  }

  private async rest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await this.send(`${this.config.restUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await this.bearer()}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T;
    const error = (await response.json().catch(() => ({}))) as PostgrestError;
    if (response.status === 401) await this.forget();
    // Database functions raise readable messages (ERRCODE P0002 / 22023); permission errors are 42501.
    const status = error.code === 'P0002' ? 404 : error.code === '22023' ? 422 : error.code === '42501' ? 403 : response.status;
    const message =
      status >= 500 ? 'Servidor indisponível.' : (error.message ?? 'Não foi possível concluir a operação.');
    throw new ApiError(message, status);
  }

  private rpc = <T>(name: string, args: unknown) => this.rest<T>(`/rpc/${name}`, 'POST', args);

  override classes = async (): Promise<SchoolClass[]> => {
    const rows = await this.rest<(SchoolClass & { students: { count: number }[] })[]>(
      '/school_classes?select=id,name,description,students(count)&order=name'
    );
    return rows.map(({ students, ...rest }) => ({ ...rest, student_count: students[0]?.count ?? 0 }));
  };

  override classDetail = async (id: number): Promise<ClassDetail> => {
    const [classes, students, lessons, modules] = await Promise.all([
      this.rest<SchoolClass[]>(`/school_classes?id=eq.${id}&select=id,name,description`),
      this.rest<ClassDetail['students']>(`/students?class_id=eq.${id}&select=id,class_id,name,nickname,nfc_code,active&order=name`),
      this.rest<{ lesson_id: string }[]>(`/class_lessons?class_id=eq.${id}&select=lesson_id&order=position`),
      this.rest<{ module_id: number }[]>(`/class_modules?class_id=eq.${id}&select=module_id&order=position`),
    ]);
    if (!classes[0]) throw new ApiError('Turma não encontrada.', 404);
    return {
      ...classes[0],
      students,
      lesson_ids: lessons.map((row) => row.lesson_id),
      module_ids: modules.map((row) => row.module_id),
    };
  };

  override modules = async (): Promise<Module[]> => {
    const rows = await this.rest<
      (Omit<Module, 'lesson_ids' | 'class_ids'> & {
        module_lessons: { lesson_id: string; position: number }[];
        class_modules: { class_id: number }[];
      })[]
    >('/modules?select=id,title,description,updated_at,module_lessons(lesson_id,position),class_modules(class_id)&order=title');
    return rows.map(({ module_lessons, class_modules, ...rest }) => ({
      ...rest,
      lesson_ids: [...module_lessons].sort((a, b) => a.position - b.position).map((row) => row.lesson_id),
      class_ids: class_modules.map((row) => row.class_id),
    }));
  };

  override benchSession = () => this.rpc<{ token: string; expires_at: number }>('bench_session', {});

  override benchPackage = (moduleId: number, classId: number) =>
    this.rpc<BenchPackage>('bench_package', { p_module_id: moduleId, p_class_id: classId });

  override sync = (benchId: string, events: BenchEvent[]) =>
    this.rpc<SyncResult>('sync_bench_events', { bench_id: benchId, events });
}
