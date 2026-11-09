/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeFrames, FrameAssembler } from '../../protocol/bench.ts';
import { WriteTimeout, writeWithResume } from '../src/lib/resume.ts';

const fast = { writeTimeoutMs: 20, attempts: 3 };

test('a stalled write is cancelled, the link reconnected and the same frame written again', async () => {
  let calls = 0;
  let cancelled = 0;
  let reconnects = 0;
  const retries: number[] = [];
  await writeWithResume(
    async (onTimeout) => {
      calls += 1;
      if (calls === 1) {
        onTimeout(() => (cancelled += 1));
        await new Promise(() => undefined); // never acknowledged
      }
    },
    async () => {
      reconnects += 1;
    },
    { ...fast, onRetry: (n) => retries.push(n) }
  );
  assert.deepEqual([calls, cancelled, reconnects, retries], [2, 1, 1, [1]]);
});

test('gives up after the allowed attempts with the last error', async () => {
  let reconnects = 0;
  await assert.rejects(
    writeWithResume(
      () => new Promise(() => undefined),
      async () => {
        reconnects += 1;
      },
      fast
    ),
    WriteTimeout
  );
  assert.equal(reconnects, 3);
});

test('a failed reconnection uses the next attempt instead of ending the send', async () => {
  let calls = 0;
  await writeWithResume(
    async () => {
      calls += 1;
      if (calls < 3) throw new Error('Bancada desconectada.');
    },
    async () => {
      throw new Error('connect failed');
    },
    fast
  );
  assert.equal(calls, 3);
});

test('frames written again after a reconnection still assemble the message once (bench side)', () => {
  const message = { type: 'LOAD_PACKAGE', id: 'q1', package: { text: 'x'.repeat(1000) } };
  const frames = encodeFrames(message, 'f1', 150);
  const bench = new FrameAssembler<typeof message>();
  const results = [];
  for (const [i, frame] of frames.entries()) {
    results.push(bench.push(frame));
    if (i === 3) results.push(bench.push(frame)); // the stalled frame, written again
  }
  assert.deepEqual(results.filter(Boolean), [message]);
});
