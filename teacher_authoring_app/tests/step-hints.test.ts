import assert from 'node:assert/strict';
import { test } from 'node:test';
import { curriculumLessons } from '../src/curriculum/lessons.ts';
import { jumperEnds } from '../src/curriculum/stepHints.ts';
import { challengeHint, piecesGap } from '../src/player/hints.ts';

const lessons = curriculumLessons();
const find = (suffix: string) => {
  const found = lessons.find((l) => l.id.endsWith(suffix));
  if (!found) throw new Error(`lesson ${suffix} missing`);
  return found;
};
const step = (l: ReturnType<typeof find>, id: string) => {
  const found = l.steps.find((s) => s.id.endsWith(id));
  if (!found) throw new Error(`step ${id} missing`);
  return found;
};

test('lesson 2: each build step says what is not connected, with correct Portuguese', () => {
  const l = find('02-guiada');
  const first = step(l, 'build-1').overrides.open_circuit['*'];
  assert.match(first, /A bateria e o LED ainda não estão conectados/);
  assert.match(first, /o − da bateria com o lado − \(catodo, o da barra\) do LED/);
  const second = step(l, 'build-2').overrides.open_circuit['*'];
  assert.match(second, /o \+ da bateria com o lado \+ \(anodo\) do LED/);
  for (const text of [first, second]) assert.doesNotMatch(text, /\ba o\b|\bde o\b/);
});

test('every build step of the guided curriculum carries specific hints', () => {
  for (const l of lessons.filter((x) => x.kind === 'guided')) {
    for (const s of l.steps.filter((x) => x.action === 'place_component' || x.action === 'place_connection')) {
      assert.ok(Object.keys(s.overrides).length >= 4, `${s.id} has hints`);
      if (s.pieceIds) assert.ok(s.overrides.complete, `${s.id} explains what the student just achieved`);
      for (const text of Object.values(s.overrides).flatMap((per) => Object.values(per)))
        assert.doesNotMatch(text, /\ba o\b|\bde o\b|undefined|\{nome_cap\}/, `${s.id}: ${text}`);
    }
    const connect = l.steps.find((x) => x.action === 'connect_circuit');
    if (connect && l.board.pieces.length > 1)
      assert.ok(connect.overrides.open_circuit, `${l.id} connect step explains an open circuit`);
  }
});

test('jumper ends name what shares the column, only among pieces already placed', () => {
  const l = find('04-guiada');
  const [w2] = l.board.pieces.filter((p) => p.id === 'w2');
  const before = l.board.pieces.filter((p) => p.id !== 'w1' && p.id !== 'w2');
  assert.deepEqual(jumperEnds(w2, before), [['o lado − (catodo, o da barra) do LED'], ['o − da bateria']]);
});

test('challenge ladder: vague first, validator wording, then clue, then near-answer', () => {
  const l = find('02-desafio');
  const bench = l.board.pieces.filter((p) => p.id !== 'w1');
  const hint = (misses: number) => challengeHint(l, bench, misses, 'dica do validador', 'missing_connection');
  assert.match(hint(1), /Siga com o dedo/);
  assert.equal(hint(2), 'dica do validador');
  assert.match(hint(3), /Procure onde falta um jumper/);
  assert.match(hint(4), /anodo/);
  assert.doesNotMatch([1, 2, 3, 4].map(hint).join(' '), /dois jumpers/);
});

test('piecesGap says what is missing or extra, ignoring jumpers', () => {
  const l = find('04-desafio');
  const noLed = l.board.pieces.filter((p) => p.type !== 'led');
  assert.match(piecesGap(l.board.pieces, noLed), /Faltam na bancada: LED/);
  assert.equal(piecesGap(l.board.pieces, l.board.pieces), '');
});
