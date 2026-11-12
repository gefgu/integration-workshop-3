/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeFrames, FrameAssembler } from '../../protocol/bench.ts';
import { BenchClient, BenchError, type BenchTransport } from '../src/lib/benchClient.ts';
import { sendModule } from '../src/lib/sync.ts';

const pkg = { version_id: 'v2', lessons: [{ id: 'l1' }] };
const api = { benchPackage: async () => pkg } as never;

/** A bench that loads the package but whose PACKAGE_OK notification is lost; STATUS may be lost too until reconnect. */
class LossyBench implements BenchTransport {
  label = 'lossy';
  loaded: string | null = null;
  reconnects = 0;
  private listener: (frame: string) => void = () => undefined;
  private assembler = new FrameAssembler<{ id: string; type: string; package?: { version_id: string } }>();
  constructor(
    private loads: boolean,
    private statusLostUntilReconnect = false
  ) {}
  async connect() {}
  async reconnect() {
    this.reconnects += 1;
    this.statusLostUntilReconnect = false;
  }
  async send(frame: string) {
    const message = this.assembler.push(frame);
    if (!message) return;
    if (message.type === 'LOAD_PACKAGE') {
      if (this.loads) this.loaded = message.package!.version_id;
      return; // PACKAGE_OK lost on the way back
    }
    if (message.type === 'STATUS' && !this.statusLostUntilReconnect) {
      const status = { bench_id: 'b', unlocked: true, teacher: null, pending_events: 0,
        package: this.loaded ? { version_id: this.loaded, module_title: 'M', class_name: 'T' } : null };
      for (const reply of encodeFrames({ type: 'STATUS', re: message.id, ...status }, 'r')) this.listener(reply);
    }
  }
  onFrame(listener: (frame: string) => void) {
    this.listener = listener;
  }
  onClose() {}
  async close() {}
}

test('a lost PACKAGE_OK is confirmed by STATUS showing the new version', async () => {
  const bench = new LossyBench(true);
  const sent = await sendModule(new BenchClient(bench, 20), api, 1, 1, 1);
  assert.equal(sent.version_id, 'v2');
});

test('a silent link is reconnected once before asking STATUS again', async () => {
  const bench = new LossyBench(true, true);
  await sendModule(new BenchClient(bench, 20), api, 1, 1, 1);
  assert.equal(bench.reconnects, 1);
});

test('a package the bench did not load is reported, not taken as sent', async () => {
  await assert.rejects(sendModule(new BenchClient(new LossyBench(false), 20), api, 1, 1, 1), (error: BenchError) => {
    assert.equal(error.code, 'not_loaded');
    return true;
  });
});
