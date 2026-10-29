import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeFrames, FrameAssembler } from '../../protocol/bench.ts';

/** BLE carries at most MTU - 3 bytes per write or notification; the app requests MTU 185. */
const MAX_ATT_PAYLOAD = 185 - 3;

test('frames are ASCII and each fits one BLE write at MTU 185', () => {
  const message = { type: 'LOAD_PACKAGE', id: 'q1', text: 'Lição de ligação em série ✨ 7º A '.repeat(40) };
  const frames = encodeFrames(message, 'f1abcdef123');
  assert.ok(frames.length > 1);
  for (const frame of frames) {
    assert.ok(/^[\x00-\x7f]*$/.test(frame));
    assert.ok(Buffer.byteLength(frame, 'utf8') <= MAX_ATT_PAYLOAD);
  }
  const assembler = new FrameAssembler();
  frames.slice(0, -1).forEach((frame) => assert.equal(assembler.push(frame), null));
  assert.deepEqual(assembler.push(frames.at(-1) as string), message);
});

test('the payload is the same JSON the Python bench sends (ensure_ascii)', () => {
  // json.dumps({"a": "ção ✨"}, ensure_ascii=True, separators=(",", ":"))
  assert.equal(encodeFrames({ a: 'ção ✨' }, 'b1')[0], 'b1|0|1|{"a":"\\u00e7\\u00e3o \\u2728"}');
});
