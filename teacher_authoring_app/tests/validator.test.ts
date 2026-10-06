import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStep, lintLesson, feedbackCatalog } from '../src/api/validator.ts';
import { newLesson } from '../src/model/lesson.ts';
import { autoSplit } from '../src/model/steps.ts';

const P = (id, type, a, b, row = 0) => ({ id, type, a, b, row });
const lesson = () => {
  const l = newLesson();
  l.board.pieces = [P('bat', 'bateria', 1, 2, 0), P('led', 'led', 3, 4, 1)];
  l.steps = autoSplit(l.board.pieces);
  return l;
};
const reply = (status, body) => async () => ({ status, ok: status < 400, json: async () => body });

test('validateStep envia lição, bancada e hash anterior e traduz a resposta', async () => {
  let sent;
  const f = async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return reply(200, { approved: false, category: 'missing_component', message: 'Falta uma peça.', hint: 'Falta uma peça.', awaiting_answer: false, graph_hash: 'h1', issues: [] })(); };
  const r = await validateStep({ lesson: lesson(), pieces: [P('bat', 'bateria', 1, 2, 0)], stepIdx: 1, previousHash: 'h0' }, f);
  assert.equal(sent.url, '/api/validate/step');
  assert.equal(sent.body.step_idx, 1);
  assert.equal(sent.body.previous_graph_hash, 'h0');
  assert.equal(sent.body.lesson.steps.length, 2);
  assert.deepEqual(sent.body.board.pieces, [P('bat', 'bateria', 1, 2, 0)]);
  assert.equal(r.ok, true);
  assert.equal(r.result.graphHash, 'h1');
  assert.equal(r.result.hint, 'Falta uma peça.');
});

test('falha de rede e 5xx viram offline', async () => {
  const down = async () => { throw new TypeError('fetch failed'); };
  assert.equal((await validateStep({ lesson: lesson(), pieces: [], stepIdx: 0 }, down)).offline, true);
  assert.equal((await lintLesson(lesson(), reply(502, null))).offline, true);
});

test('invalid_board vira erro legível com a lista de problemas', async () => {
  const r = await validateStep({ lesson: lesson(), pieces: [], stepIdx: 0 }, reply(422, { detail: { error: 'invalid_board', problems: ['x'] } }));
  assert.equal(r.ok, false);
  assert.equal(r.offline, undefined);
  assert.deepEqual(r.problems, ['x']);
});

test('lintLesson e feedbackCatalog', async () => {
  const lint = await lintLesson(lesson(), reply(200, { problems: [], byStep: [] }));
  assert.deepEqual([lint.ok, lint.problems], [true, []]);
  let method = 'x';
  const cat = await feedbackCatalog(async (url, init) => { method = init ? init.method : 'GET'; return reply(200, { categories: [{ category: 'complete', defaultMessage: 'ok' }], families: [] })(); });
  assert.equal(method, 'GET');
  assert.equal(cat.categories[0].category, 'complete');
});
