/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, type KeyValueStore, OfflineError } from '../src/lib/api.ts';
import { NeonApi } from '../src/lib/neonApi.ts';

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  async getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  async removeItem(key: string) {
    this.data.delete(key);
  }
}

const config = { authUrl: 'https://auth.test/neondb/auth', restUrl: 'https://rest.test/neondb/rest/v1' };
const COOKIE = '__Secure-neon-auth.session_token=abc.def%3D';
const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const jwtExpiring = (inSeconds: number) => `h.${b64url({ exp: Math.floor(Date.now() / 1000) + inSeconds })}.s`;

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Neon Auth + Data API stand-in; `routes` maps "METHOD path-after-rest" to a handler result. */
function fakeNeon(routes: Record<string, (body: any) => { status?: number; json: unknown }> = {}) {
  const calls: Call[] = [];
  let online = true;
  let tokenStatus = 200;
  let tokens = 0;
  const reply = (status: number, data: unknown, headers: Record<string, string> = {}) =>
    ({
      ok: status < 400,
      status,
      headers: { get: (name: string) => headers[name.toLowerCase()] ?? null, getSetCookie: () => [] },
      json: async () => data,
    }) as unknown as Response;
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    if (!online) throw new TypeError('Network request failed');
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method: init.method ?? 'GET', headers: (init.headers ?? {}) as Record<string, string>, body });
    if (url.endsWith('/sign-in/email')) {
      return body.password === 'good'
        ? reply(200, {}, { 'set-cookie': `${COOKIE}; Max-Age=604800; Path=/; HttpOnly; Secure` })
        : reply(401, { code: 'INVALID_EMAIL_OR_PASSWORD' });
    }
    if (url.endsWith('/sign-up/email')) {
      if (!(init.headers as Record<string, string>)?.Origin) return reply(400, { code: 'MISSING_ORIGIN' });
      return body.email === 'dup@escola.br' ? reply(422, { code: 'USER_ALREADY_EXISTS' }) : reply(200, { token: 't' });
    }
    if (url.endsWith('/sign-out')) return reply(200, {});
    if (url.endsWith('/token')) {
      tokens += 1;
      return tokenStatus === 200 ? reply(200, { token: jwtExpiring(900) }) : reply(tokenStatus, {});
    }
    const key = `${init.method ?? 'GET'} ${url.slice(config.restUrl.length)}`;
    const route = routes[key];
    if (!route) return reply(404, { message: `sem rota ${key}` });
    const { status = 200, json } = route(body);
    return reply(status, json);
  }) as unknown as typeof fetch;
  return {
    calls,
    fetchImpl,
    setOnline: (v: boolean) => (online = v),
    setTokenStatus: (s: number) => (tokenStatus = s),
    get tokens() {
      return tokens;
    },
  };
}

const TEACHER = { id: 1, name: 'Professor', email: 'p@escola.br' };
const teacherRoute = { 'GET /teachers?select=id,name,email': () => ({ json: [TEACHER] }) };

test('login guarda o cookie de sessão e o professor; a senha errada vira mensagem clara', async () => {
  const neon = fakeNeon(teacherRoute);
  const store = new MemoryStore();
  const api = new NeonApi(store, config, neon.fetchImpl);

  await assert.rejects(api.login('p@escola.br', 'bad'), (e: ApiError) => e.status === 401 && /incorretos/.test(e.message));
  assert.equal(api.token, null);

  assert.deepEqual(await api.login('p@escola.br', 'good'), TEACHER);
  assert.equal(api.token, COOKIE);
  assert.equal(store.data.get('tedtronics.token'), COOKIE);
  assert.equal(JSON.parse(store.data.get('tedtronics.teacher')!).id, 1);

  const reloaded = new NeonApi(store, config, neon.fetchImpl);
  await reloaded.load();
  assert.equal(reloaded.token, COOKIE);
  assert.equal(reloaded.teacher?.name, 'Professor');
  assert.equal(reloaded.server, config.restUrl);
});

test('login recusa e-mail sem professor correspondente (RLS devolve zero linhas)', async () => {
  const neon = fakeNeon({ 'GET /teachers?select=id,name,email': () => ({ json: [] }) });
  const api = new NeonApi(new MemoryStore(), config, neon.fetchImpl);
  await assert.rejects(api.login('x@y.z', 'good'), (e: ApiError) => e.status === 403);
  assert.equal(api.token, null);
});

test('o JWT é reaproveitado entre chamadas e enviado como Bearer', async () => {
  const neon = fakeNeon({ ...teacherRoute, 'GET /modules?select=id,title,description,updated_at,module_lessons(lesson_id,position),class_modules(class_id)&order=title': () => ({ json: [] }) });
  const api = new NeonApi(new MemoryStore(), config, neon.fetchImpl);
  await api.login('p@escola.br', 'good');
  await api.modules();
  await api.modules();
  assert.equal(neon.tokens, 1);
  const read = neon.calls.filter((c) => c.url.startsWith(config.restUrl)).at(-1)!;
  assert.match(read.headers.Authorization, /^Bearer h\./);
  assert.equal(neon.calls.find((c) => c.url.endsWith('/token'))!.headers.Cookie, COOKIE);
});

test('turmas e módulos têm o mesmo formato do servidor', async () => {
  const neon = fakeNeon({
    ...teacherRoute,
    'GET /school_classes?select=id,name,description,students(count)&order=name': () => ({
      json: [{ id: 5, name: '7A', description: '', students: [{ count: 3 }] }],
    }),
    'GET /modules?select=id,title,description,updated_at,module_lessons(lesson_id,position),class_modules(class_id)&order=title': () => ({
      json: [
        {
          id: 2,
          title: 'Mod',
          description: 'd',
          updated_at: '2026-10-29T00:00:00',
          module_lessons: [{ lesson_id: 'b', position: 1 }, { lesson_id: 'a', position: 0 }],
          class_modules: [{ class_id: 5 }],
        },
      ],
    }),
    'GET /school_classes?id=eq.5&select=id,name,description': () => ({ json: [{ id: 5, name: '7A', description: '' }] }),
    'GET /students?class_id=eq.5&select=id,class_id,name,nickname,nfc_code,active&order=name': () => ({
      json: [{ id: 1, class_id: 5, name: 'Ana', nickname: 'ana', nfc_code: 'T1', active: true }],
    }),
    'GET /class_lessons?class_id=eq.5&select=lesson_id&order=position': () => ({ json: [{ lesson_id: 'a' }] }),
    'GET /class_modules?class_id=eq.5&select=module_id&order=position': () => ({ json: [{ module_id: 2 }] }),
  });
  const api = new NeonApi(new MemoryStore(), config, neon.fetchImpl);
  await api.login('p@escola.br', 'good');

  assert.deepEqual(await api.classes(), [{ id: 5, name: '7A', description: '', student_count: 3 }]);
  const [module] = await api.modules();
  assert.deepEqual(module.lesson_ids, ['a', 'b']);
  assert.deepEqual(module.class_ids, [5]);
  const detail = await api.classDetail(5);
  assert.equal(detail.students[0].nfc_code, 'T1');
  assert.deepEqual(detail.lesson_ids, ['a']);
  assert.deepEqual(detail.module_ids, [2]);
});

test('pacote, sessão da bancada e sincronização chamam as funções do banco', async () => {
  const neon = fakeNeon({
    ...teacherRoute,
    'POST /rpc/bench_session': () => ({ json: { token: 'p.s', expires_at: 1 } }),
    'POST /rpc/bench_package': (b) => ({ json: { format: 1, version_id: 'v', ids: [b.p_module_id, b.p_class_id] } }),
    'POST /rpc/sync_bench_events': (b) => ({
      json: { acked: b.events.map((e: { event_id: string }) => e.event_id), rejected: [], inserted: b.events.length },
    }),
  });
  const api = new NeonApi(new MemoryStore(), config, neon.fetchImpl);
  await api.login('p@escola.br', 'good');

  assert.equal((await api.benchSession()).token, 'p.s');
  assert.deepEqual(((await api.benchPackage(2, 5)) as any).ids, [2, 5]);
  const events = [{ event_id: 'evt-00001', student_id: 1, nfc_code: 'T1', kind: 'step_done', seq: 1, at: '2026-10-29T10:00:00Z' }] as any;
  const result = await api.sync('bench-1', events);
  assert.deepEqual(result.acked, ['evt-00001']);
  assert.deepEqual(neon.calls.at(-1)!.body, { bench_id: 'bench-1', events });
});

test('erros do banco viram ApiError legível; sessão expirada desloga', async () => {
  const neon = fakeNeon({
    ...teacherRoute,
    'POST /rpc/bench_package': () => ({ status: 500, json: { code: 'P0002', message: 'Turma não encontrada.' } }),
  });
  const store = new MemoryStore();
  const api = new NeonApi(store, config, neon.fetchImpl);
  await api.login('p@escola.br', 'good');

  await assert.rejects(api.benchPackage(2, 9), (e: ApiError) => e.status === 404 && e.message === 'Turma não encontrada.');

  // JWT cache cleared by a fresh instance sharing the stored session; the auth server now refuses the cookie.
  const later = new NeonApi(store, config, neon.fetchImpl);
  await later.load();
  neon.setTokenStatus(401);
  await assert.rejects(later.classes(), (e: ApiError) => e.status === 401);
  assert.equal(later.token, null);
  assert.equal(store.data.has('tedtronics.token'), false);
});

test('sem internet: OfflineError, para a fila do celular guardar os eventos (SFR45)', async () => {
  const neon = fakeNeon(teacherRoute);
  const api = new NeonApi(new MemoryStore(), config, neon.fetchImpl);
  await api.login('p@escola.br', 'good');
  neon.setOnline(false);
  await assert.rejects(api.sync('bench-1', []), OfflineError);
});

test('logout limpa a sessão mesmo sem conexão', async () => {
  const neon = fakeNeon(teacherRoute);
  const store = new MemoryStore();
  const api = new NeonApi(store, config, neon.fetchImpl);
  await api.login('p@escola.br', 'good');
  neon.setOnline(false);
  await api.logout();
  assert.equal(api.token, null);
  assert.equal(store.data.size, 0);
});

test('criar conta: cadastra no Neon Auth e já entra; e-mail repetido tem mensagem própria', async () => {
  const neon = fakeNeon(teacherRoute);
  const api = new NeonApi(new MemoryStore(), config, neon.fetchImpl);

  await assert.rejects(api.signUp('dup@escola.br', 'good', 'Dup'), (e: ApiError) => e.status === 422 && /Já existe/.test(e.message));

  assert.deepEqual(await api.signUp('p@escola.br', 'good', 'Professor'), TEACHER);
  const signUp = neon.calls.filter((c) => c.url.endsWith('/sign-up/email')).at(-1)!;
  assert.deepEqual(signUp.body, { email: 'p@escola.br', password: 'good', name: 'Professor' });
  assert.equal(api.token, COOKIE);
});

test('login repete a leitura do professor quando a primeira volta vazia', async () => {
  let reads = 0;
  const neon = fakeNeon({ 'GET /teachers?select=id,name,email': () => ({ json: ++reads < 2 ? [] : [TEACHER] }) });
  const api = new NeonApi(new MemoryStore(), config, neon.fetchImpl);
  api.retryDelayMs = 0;
  assert.deepEqual(await api.login('p@escola.br', 'good'), TEACHER);
  assert.equal(reads, 2);
});
