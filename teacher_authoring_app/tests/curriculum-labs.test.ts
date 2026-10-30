import assert from 'node:assert/strict';
import test from 'node:test';
import { circuitL05Challenge, withPiece, P } from '../src/curriculum/circuits.ts';
import { curriculumLessons } from '../src/curriculum/lessons.ts';
import { diagnose } from '../src/engine/diagnose.ts';
import {
  capDischarge,
  capacitanceUF,
  detectEvents,
  fadeSeconds,
  dischargeTau,
  goalDone,
  labStates,
  matchingPreset,
  type LabSnapshot,
} from '../src/engine/lab.ts';
import { branchCurrent } from '../src/engine/sim.ts';
import type { LabEvent, Lesson, LessonStep, Piece } from '../src/model/types.ts';

const lessons = new Map(curriculumLessons().map((l) => [l.id, l]));
const lab = (id: string, name: string): { lesson: Lesson; step: LessonStep } => {
  const lesson = lessons.get(`curriculo-${id}`);
  const step = lesson.steps.find((s) => s.id.endsWith(`.${name}`));
  assert.ok(step?.experiment, `${id}/${name}`);
  return { lesson, step };
};

interface Frame {
  pieces: Piece[];
  energized?: boolean;
  held?: string[];
  flags?: LabSnapshot['flags'];
}

/** Plays a scripted student through an experiment and returns which missions ended up done. */
function play(id: string, name: string, frames: Frame[], extra: { presetsLit?: Set<number>; presetsFaded?: Set<number>; ccSeen?: Set<number> } = {}) {
  const { lesson, step } = lab(id, name);
  let events = new Set<LabEvent>();
  let states: Record<string, boolean> = {};
  for (const f of frames) {
    const held = new Set(f.held ?? []);
    const snap: LabSnapshot = {
      pieces: f.pieces,
      held,
      energized: !!f.energized,
      diag: diagnose(f.pieces, held, { allowNoResistor: !!lesson.settings?.allowNoResistor }),
      flags: f.flags ?? {},
    };
    events = detectEvents(events, snap);
    states = labStates(snap);
  }
  return step.experiment.goals.map((g) => [g.id, goalDone(g, events, states, extra)] as const);
}
const allDone = (r: ReadonlyArray<readonly [string, boolean]>) => assert.deepEqual(r.filter(([, ok]) => !ok), [], JSON.stringify(r));
const board = (id: string) => lessons.get(`curriculo-${id}`).board.pieces;

test('L1: the status LED goes on when the battery is seated, and not before', () => {
  allDone(play('01-guiada', 'x-status', [{ pieces: board('01-guiada') }]));
  assert.equal(play('01-guiada', 'x-status', [{ pieces: [] }])[0][1], false);
});

test('L2: close the circuit, see it light, then open it and see it dark', () => {
  const b = board('02-guiada');
  allDone(play('02-guiada', 'x-fecha', [{ pieces: b, energized: true }, { pieces: b.filter((p) => p.id !== 'w1'), energized: true }]));
  assert.equal(play('02-guiada', 'x-fecha', [{ pieces: b.filter((p) => p.id !== 'w1'), energized: true }])[0][1], false, 'never lit → not done');
});

test('L3: the ammeter shows mA and the two resistors give different currents', () => {
  const g = board('03-guiada');
  allDone(play('03-guiada', 'x-ma', [{ pieces: g, energized: true }]));
  const { step } = lab('03-desafio', 'x-troca');
  const presets = step.experiment.presets;
  const mA = presets.map((p) => diagnose(p.pieces, null).mA);
  assert.ok(mA[0] > mA[1] * 2, `220 Ω (${mA[0].toFixed(1)} mA) lights much more than 1 kΩ (${mA[1].toFixed(1)} mA)`);
  const lit = new Set(presets.map((p, i) => (matchingPreset(p.pieces, presets) === i && diagnose(p.pieces, null).code === 'valido' ? i : -1)).filter((i) => i >= 0));
  allDone(play('03-desafio', 'x-troca', [{ pieces: presets[0].pieces, energized: true }], { presetsLit: lit }));
});

test('L4: the LED lights one way and stays dark the other way', () => {
  const b = board('04-guiada');
  allDone(play('04-guiada', 'x-gira', [{ pieces: b, energized: true }, { pieces: withPiece(b, 'led', { a: 5, b: 4 }), energized: true }]));
});

test('L5: the button lights the LED only while pressed; two buttons need both', () => {
  const b = board('05-guiada');
  allDone(play('05-guiada', 'x-aperta', [{ pieces: b, energized: true, held: ['btn'] }, { pieces: b, energized: true }]));
  const two = circuitL05Challenge();
  allDone(play('05-desafio', 'x-dois', [{ pieces: two, energized: true, held: ['btnA'] }, { pieces: two, energized: true, held: ['btnA', 'btnB'] }]));
  assert.equal(diagnose(two, new Set(['btnB'])).code, 'botao_aberto');
});

test('L6: the potentiometer changes the current continuously between its extremes', () => {
  const b = board('06-guiada');
  const at = (value: number) => b.map((p) => (p.id === 'pot' ? { ...p, value } : p));
  allDone(play('06-guiada', 'x-gira', [{ pieces: at(1000), energized: true }, { pieces: at(220) }, { pieces: at(10000) }]));
  const currents = [220, 500, 1000, 3000, 10000].map((v) => diagnose(at(v), null).mA);
  assert.ok(currents.every((c, i) => i === 0 || c < currents[i - 1]), `monotonic: ${currents.map((c) => c.toFixed(2)).join(' > ')}`);
});

test('L7: the capacitor empties through the LED; two capacitors take twice as long', () => {
  const one = board('07-guiada');
  allDone(play('07-guiada', 'x-descarga', [{ pieces: one, energized: true }, { pieces: one, flags: { fadeDone: true } }]));
  const { step } = lab('07-desafio', 'x-compara');
  const [p1, p2] = step.experiment.presets;
  const seconds = [p1, p2].map((p) => {
    const d = capDischarge(p.pieces);
    assert.ok(d && d.load === 'led');
    const tau = dischargeTau(d, capacitanceUF(p.pieces));
    return fadeSeconds(branchCurrent({ ohms: d.ohms, load: 'led' }).mA, tau);
  });
  assert.ok(seconds[0] > 0.8 && seconds[0] < 3, `1000 µF fades in ${seconds[0].toFixed(2)} s: visible, not instant`);
  assert.ok(Math.abs(seconds[1] / seconds[0] - 2) < 0.01, 'doubling the capacitance doubles the time');
  allDone(play('07-desafio', 'x-compara', [{ pieces: p1.pieces, energized: true }, { pieces: p1.pieces, flags: { fadeDone: true } }], { presetsLit: new Set([0, 1]), presetsFaded: new Set([0, 1]) }));
});

test('L8: the buzzer works with each resistor and the pot sweeps; the clips are distinguishable', () => {
  const presets = lab('08-guiada', 'x-troca').step.experiment.presets;
  const mA = presets.map((p) => diagnose(p.pieces, null).mA);
  assert.ok(mA[0] > mA[1] && mA[1] > mA[2], 'a bigger resistor gives the buzzer less current');
  allDone(play('08-guiada', 'x-troca', [{ pieces: presets[0].pieces, energized: true }], { presetsLit: new Set([0, 1, 2]) }));
  const pot = board('08-potenciometro');
  const at = (value: number) => pot.map((p) => (p.id === 'pot' ? { ...p, value } : p));
  allDone(play('08-potenciometro', 'x-pot', [{ pieces: at(1000), energized: true }, { pieces: at(220) }, { pieces: at(10000) }]));
  const clips = lab('08-desafio', 'x-clipes').step.experiment.clips;
  allDone(play('08-desafio', 'x-clipes', [{ pieces: [], flags: { heard: new Set(['a', 'b']) } }]));
  assert.ok(clips.a > clips.b, 'clip A is the larger resistor, as the question says');
});

test('L9: a loose jumper flickers and is cured by re-seating; a short cuts the power', () => {
  const g = lab('09-guiada', 'x-contato').step.experiment.board;
  assert.ok(g.some((p) => p.loose));
  const seated = g.map((p) => ({ ...p, loose: false }));
  allDone(play('09-guiada', 'x-contato', [{ pieces: g, energized: true, flags: { flickering: true } }, { pieces: seated, flags: { reseated: true } }, { pieces: seated, energized: true }]));
  const ok = lab('09-guiada', 'x-curto').step.experiment.board;
  const shorted = [...ok, P('x', 'jumper_curto', 1, 2, 0)];
  assert.equal(diagnose(shorted, null).code, 'curto');
  allDone(play('09-guiada', 'x-curto', [{ pieces: shorted, flags: { shortCut: true } }, { pieces: ok, energized: true }]));
  const challenge = lessons.get('curriculo-09-desafio');
  assert.ok(challenge.start.pieces.some((p) => p.loose) && challenge.start.pieces.some((p) => p.id === 'curto'));
});

test('L10: the alarm lights the LED and the buzzer together, and stops on release', () => {
  const b = board('10-guiada');
  allDone(play('10-guiada', 'x-alarme', [{ pieces: b, energized: true, held: ['btn'] }, { pieces: b, energized: true }]));
});

