import assert from 'node:assert/strict';
import test from 'node:test';
import { placementError } from '../src/engine/board.ts';
import { diagnose } from '../src/engine/diagnose.ts';
import { capDischarge } from '../src/engine/lab.ts';
import { analyze } from '../src/engine/sim.ts';
import {
  circuitL01,
  circuitL02,
  circuitL03,
  circuitL04,
  circuitL05,
  circuitL05Challenge,
  circuitL06,
  circuitL07,
  circuitL08,
  circuitL08Pot,
  circuitL10,
} from '../src/curriculum/circuits.ts';

const all = {
  L01: circuitL01(),
  L02: circuitL02(),
  L03: circuitL03(),
  L04: circuitL04(),
  L05: circuitL05(),
  L05c: circuitL05Challenge(),
  L06: circuitL06(),
  L07: circuitL07(),
  L07x2: circuitL07(2),
  L08: circuitL08(),
  L08p: circuitL08Pot(),
  L10: circuitL10(),
};

test('every curriculum layout can be built piece by piece on the bench', () => {
  for (const [name, pieces] of Object.entries(all)) {
    const placed = [];
    for (const p of pieces) {
      assert.equal(placementError(placed, p), null, `${name}: ${p.id}`);
      placed.push(p);
    }
  }
});

test('closed circuits light their loads; the button circuits wait for the button', () => {
  for (const name of ['L03', 'L04', 'L06', 'L07', 'L07x2', 'L08', 'L08p'] as const)
    assert.equal(analyze(all[name]).code, 'valido', name);
  assert.equal(analyze(all.L02).code, 'sem_resistor');
  assert.equal(analyze(all.L02, { allowNoResistor: true }).code, 'valido');
  const open = new Set<string>();
  assert.equal(analyze(all.L05, { pressed: open }).code, 'botao_aberto');
  assert.equal(analyze(all.L05, { pressed: new Set(['btn']) }).code, 'valido');
  assert.equal(analyze(all.L05c, { pressed: new Set(['btnA']) }).code, 'botao_aberto');
  assert.equal(analyze(all.L05c, { pressed: new Set(['btnA', 'btnB']) }).code, 'valido');
});

test('lesson 10 powers the LED and the buzzer through separate branches', () => {
  const d = diagnose(all.L10, new Set(['btn']));
  assert.equal(d.code, 'valido');
  assert.deepEqual([...d.loadsLit].sort(), ['buzzer', 'led']);
  assert.ok(d.trail?.edgeIds.has('led') && d.trail.edgeIds.has('buz'));
  assert.notEqual(diagnose(all.L10, new Set()).code, 'valido');
});

test('the lesson 7 capacitor empties through the resistor and the LED', () => {
  const d = capDischarge(all.L07);
  assert.ok(d);
  assert.equal(d.ohms, 470);
  assert.equal(d.load, 'led');
  assert.equal(capDischarge(all.L04), null);
});

test('the ammeter in lesson 3 sits in series and adds its 10 Ω shunt', () => {
  const d = diagnose(all.L03);
  assert.ok(d.trail?.edgeIds.has('amp'));
  assert.ok(Math.abs(d.mA - 3000 / 480) < 0.01);
});
