/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeFrames, FrameAssembler } from '../../protocol/bench.ts';
import { BenchClient, BenchError, type BenchTransport } from '../src/lib/benchClient.ts';

/** A slow BLE link: every write takes `writeMs`; the bench answers once the whole message has arrived. */
class SlowTransport implements BenchTransport {
  label = 'lenta';
  frames: string[] = [];
  private listener: (frame: string) => void = () => undefined;
  private assembler = new FrameAssembler<{ id: string }>();
  constructor(
    private writeMs: number,
    readonly maxFrameBytes?: number,
    private failAt = -1
  ) {}
  async connect() {}
  async send(frame: string) {
    if (this.frames.length === this.failAt) throw new Error('Operation timed out');
    await new Promise((resolve) => setTimeout(resolve, this.writeMs));
    this.frames.push(frame);
    const message = this.assembler.push(frame);
    if (message) for (const reply of encodeFrames({ type: 'PACKAGE_OK', re: message.id, version_id: 'v1' }, 'r')) this.listener(reply);
  }
  onFrame(listener: (frame: string) => void) {
    this.listener = listener;
  }
  onClose() {}
  async close() {}
}

const bigPackage = { type: 'LOAD_PACKAGE', package: { text: 'lição '.repeat(400) } } as never;

test('the reply deadline starts after the last frame, so a long send over BLE does not time out', async () => {
  const transport = new SlowTransport(2);
  const client = new BenchClient(transport, 20);
  const reply = await client.request<'PACKAGE_OK'>(bigPackage);
  assert.equal(reply.version_id, 'v1');
  assert.ok(transport.frames.length * 2 > 20, 'sending took longer than the reply timeout');
});

test('frames grow to the negotiated BLE write size', async () => {
  const small = new SlowTransport(0);
  const large = new SlowTransport(0, 514);
  await new BenchClient(small).request(bigPackage);
  await new BenchClient(large).request(bigPackage);
  assert.ok(large.frames.length * 3 <= small.frames.length);
  assert.ok(large.frames.every((frame) => frame.length <= 514));
});

test('progress reports every written frame, ending at the total', async () => {
  const transport = new SlowTransport(0);
  const seen: [number, number][] = [];
  await new BenchClient(transport).request(bigPackage, (sent, total) => seen.push([sent, total]));
  assert.equal(seen.length, transport.frames.length);
  assert.deepEqual(seen.at(-1), [transport.frames.length, transport.frames.length]);
  assert.ok(seen.every(([sent], i) => sent === i + 1));
});

test('a BLE write timeout becomes a clear message in Portuguese', async () => {
  const client = new BenchClient(new SlowTransport(0, undefined, 3));
  await assert.rejects(client.request(bigPackage), (error: BenchError) => {
    assert.equal(error.code, 'send');
    assert.match(error.message, /parou de confirmar o envio pelo Bluetooth/);
    return true;
  });
});
