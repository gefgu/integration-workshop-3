/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { type BenchEvent, encodeFrames, FrameAssembler } from '../../protocol/bench.ts';
import { Api, type KeyValueStore } from '../src/lib/api.ts';
import { base64ToUtf8, utf8ToBase64 } from '../src/lib/base64.ts';
import { BenchClient, BenchError, type BenchTransport } from '../src/lib/benchClient.ts';
import { SyncQueue, sendModule, syncBench } from '../src/lib/sync.ts';

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

const event = (seq: number): BenchEvent => ({
  event_id: `evt-${seq}`,
  student_id: 1,
  nfc_code: 'TAG-1',
  kind: 'step_done',
  seq,
  at: '2026-10-20T10:00:00Z',
  lesson_id: 'l1',
  step_idx: seq,
});

/** In-memory bench speaking the frame protocol, like bench/service/protocol.py. */
class FakeBench implements BenchTransport {
  label = 'fake';
  events = [event(1), event(2), event(3)];
  unlocked = false;
  loaded: string | null = null;
  private assembler = new FrameAssembler<any>();
  private frameListeners: ((f: string) => void)[] = [];
  private n = 0;

  async connect() {}
  async close() {}
  onClose() {}
  onFrame(listener: (f: string) => void) {
    this.frameListeners.push(listener);
  }
  async send(frame: string) {
    const msg = this.assembler.push(frame);
    if (!msg) return;
    const reply = this.handle(msg);
    for (const f of encodeFrames(reply, `b${++this.n}`, 40)) for (const l of this.frameListeners) l(f);
  }
  private status() {
    return {
      bench_id: 'b1',
      unlocked: this.unlocked,
      teacher: null,
      package: this.loaded ? { version_id: this.loaded, module_title: 'M', class_name: '7A' } : null,
      pending_events: this.events.length,
    };
  }
  private handle(msg: any) {
    if (msg.type === 'HELLO') {
      if (msg.token !== 'ok') return { type: 'ERROR', re: msg.id, code: 'bad_token', message: 'Token inválido' };
      this.unlocked = true;
      return { type: 'WELCOME', re: msg.id, ...this.status() };
    }
    if (!this.unlocked) return { type: 'ERROR', re: msg.id, code: 'locked', message: 'Bloqueada' };
    if (msg.type === 'STATUS') return { type: 'STATUS', re: msg.id, ...this.status() };
    if (msg.type === 'PULL_EVENTS') {
      const rest = this.events.filter((e) => e.seq > (msg.after_seq ?? 0));
      return { type: 'EVENTS', re: msg.id, events: rest.slice(0, msg.max), remaining: Math.max(0, rest.length - msg.max) };
    }
    if (msg.type === 'ACK_EVENTS') {
      const before = this.events.length;
      this.events = this.events.filter((e) => !msg.event_ids.includes(e.event_id));
      return { type: 'ACKED', re: msg.id, deleted: before - this.events.length, pending_events: this.events.length };
    }
    if (msg.type === 'LOAD_PACKAGE') {
      this.loaded = msg.package.version_id;
      return { type: 'PACKAGE_OK', re: msg.id, version_id: this.loaded };
    }
    return { type: 'ERROR', re: msg.id, code: 'bad_message', message: '?' };
  }
}

function fakeServer() {
  const stored = new Set<string>();
  let online = true;
  const fetchImpl = async (url: string, init: RequestInit) => {
    if (!online) throw new TypeError('Network request failed');
    const body = init.body ? JSON.parse(String(init.body)) : null;
    const json = (status: number, data: unknown) =>
      ({ ok: status < 400, status, json: async () => data }) as Response;
    if (url.endsWith('/bench/sync')) {
      for (const e of body.events) stored.add(e.event_id);
      return json(200, { acked: body.events.map((e: BenchEvent) => e.event_id), rejected: [], inserted: 0 });
    }
    if (url.includes('/bench/package/2?class_id=5')) return json(200, { version_id: 'v42', lessons: [{}] });
    return json(404, { detail: 'Não encontrado.' });
  };
  return { stored, setOnline: (v: boolean) => (online = v), fetchImpl: fetchImpl as typeof fetch };
}

test('base64 UTF-8 ida e volta (quadros BLE com acentos)', () => {
  for (const text of ['', 'a', 'ab', 'abc', 'q1|0|1|{"type":"HELLO","nome":"João Ção"}']) {
    assert.equal(base64ToUtf8(utf8ToBase64(text)), text);
  }
  assert.equal(utf8ToBase64('Man'), 'TWFu');
});

test('HELLO inválido vira BenchError e a bancada continua bloqueada', async () => {
  const client = new BenchClient(new FakeBench());
  await assert.rejects(client.hello('errado'), (e: BenchError) => e.code === 'bad_token');
  await assert.rejects(client.refresh(), (e: BenchError) => e.code === 'locked');
});

test('sincronização: pagina eventos, envia ao servidor e só então apaga da bancada', async () => {
  const bench = new FakeBench();
  const client = new BenchClient(bench);
  await client.hello('ok');
  const server = fakeServer();
  const api = new Api(new MemoryStore(), server.fetchImpl);
  await api.setServer('http://server/');
  const queue = new SyncQueue(new MemoryStore());

  const report = await syncBench(client, queue, api, 2);
  assert.deepEqual(report, { pulled: 3, uploaded: true, benchDeleted: 3 });
  assert.equal(server.stored.size, 3);
  assert.equal(bench.events.length, 0);
  assert.equal(queue.pendingCount, 0);
});

test('sem internet: eventos ficam no celular, a bancada não apaga nada, e sobem depois (SFR45)', async () => {
  const bench = new FakeBench();
  const client = new BenchClient(bench);
  await client.hello('ok');
  const server = fakeServer();
  const api = new Api(new MemoryStore(), server.fetchImpl);
  await api.setServer('http://server');
  const store = new MemoryStore();
  const queue = new SyncQueue(store);

  server.setOnline(false);
  const offline = await syncBench(client, queue, api);
  assert.equal(offline.uploaded, false);
  assert.equal(bench.events.length, 3);
  assert.equal(queue.pendingCount, 3);
  assert.match(queue.state.lastError ?? '', /Sem internet/);

  // the app restarts: the queue comes back from storage
  const reloaded = new SyncQueue(store);
  await reloaded.load();
  assert.equal(reloaded.pendingCount, 3);

  server.setOnline(true);
  assert.equal(await reloaded.flush(api), true);
  assert.equal(server.stored.size, 3);
  // next time the phone meets the bench, the bench deletes what the server already has
  const later = await syncBench(client, reloaded, api);
  assert.equal(later.benchDeleted, 3);
  assert.equal(bench.events.length, 0);
});

test('enviar módulo baixa o pacote do servidor e carrega na bancada', async () => {
  const bench = new FakeBench();
  const client = new BenchClient(bench);
  await client.hello('ok');
  const api = new Api(new MemoryStore(), fakeServer().fetchImpl);
  await api.setServer('http://server');
  const pkg = await sendModule(client, api, 2, 5);
  assert.equal(pkg.version_id, 'v42');
  assert.equal(client.status?.package?.version_id, 'v42');
});
