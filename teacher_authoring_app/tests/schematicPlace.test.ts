import assert from 'node:assert/strict';
import test from 'node:test';
import { curriculumLessons } from '../src/curriculum/lessons.ts';
import { placementError } from '../src/engine/board.ts';
import {
  boardToNetlist,
  netsFromWires,
  placeNetlist,
  type SchComponent,
  type TerminalRef,
  term,
  wiresForNets,
} from '../src/engine/schematicPlace.ts';
import { isCapsule } from '../src/engine/sim.ts';
import type { Piece } from '../src/model/types.ts';

/** Nets as a comparable value: sorted terminal lists, sorted. */
const canon = (nets: TerminalRef[][]) =>
  nets
    .map((n) => [...n].sort().join(','))
    .sort()
    .join(' | ');

/** Every piece fits the board rules and stays in bank A. */
function assertValidBoard(pieces: Piece[]) {
  for (let i = 0; i < pieces.length; i++) {
    assert.equal(placementError(pieces.slice(0, i), pieces[i]), null, `peça ${pieces[i].id} não cabe`);
    assert.ok(pieces[i].row < 6, 'tudo no banco A');
  }
}

test('esquema em série (bateria, resistor, LED) vira montagem com o mesmo circuito', () => {
  const components: SchComponent[] = [
    { id: 'bat', type: 'bateria' },
    { id: 'r', type: 'resistor_220' },
    { id: 'led', type: 'led' },
  ];
  const wires: [TerminalRef, TerminalRef][] = [
    [term('bat', 0), term('r', 0)],
    [term('r', 1), term('led', 0)],
    [term('led', 1), term('bat', 1)],
  ];
  const nets = netsFromWires(components, wires);
  assert.equal(nets.length, 3);
  const placed = placeNetlist(components, nets);
  assert.ok(placed.ok, placed.ok ? '' : placed.error);
  if (!placed.ok) return;
  assertValidBoard(placed.pieces);
  // a three-component loop needs at least one jumper on a straight board
  assert.ok(placed.pieces.some((p) => p.type.startsWith('jumper')));
  assert.equal(canon(boardToNetlist(placed.pieces)?.nets ?? []), canon(nets));
  // polarity: battery + and LED anode stay on leg a
  const bat = placed.pieces.find((p) => p.id === 'bat') as Piece;
  const r = placed.pieces.find((p) => p.id === 'r') as Piece;
  assert.deepEqual(
    boardToNetlist(placed.pieces)?.nets.find((n) => n.includes(term('bat', 0))),
    boardToNetlist(placed.pieces)?.nets.find((n) => n.includes(term('r', 0)))
  );
  assert.ok(bat && r);
});

test('toda montagem do currículo sem cápsulas ida e volta pelo esquema mantém o circuito', () => {
  let checked = 0;
  for (const lesson of curriculumLessons()) {
    const pieces = lesson.board.pieces;
    if (!pieces.length || pieces.some((p) => isCapsule(p.type))) continue;
    const netlist = boardToNetlist(pieces);
    assert.ok(netlist, lesson.title);
    if (!netlist) continue;
    const used = netlist.nets.filter((n) => n.length > 1);
    const placed = placeNetlist(netlist.components, netlist.nets);
    assert.ok(placed.ok, `${lesson.title}: ${placed.ok ? '' : placed.error}`);
    if (!placed.ok) continue;
    assertValidBoard(placed.pieces);
    assert.equal(
      canon((boardToNetlist(placed.pieces)?.nets ?? []).filter((n) => n.length > 1)),
      canon(used),
      lesson.title
    );
    checked++;
  }
  assert.ok(checked >= 8, `só ${checked} lições conferidas`);
});

test('fios do desenho a partir das redes e redes a partir dos fios batem', () => {
  const components: SchComponent[] = [
    { id: 'a', type: 'led' },
    { id: 'b', type: 'led' },
    { id: 'c', type: 'bateria' },
  ];
  const nets = [
    [term('a', 0), term('b', 0), term('c', 0)],
    [term('a', 1), term('b', 1), term('c', 1)],
  ];
  assert.equal(canon(netsFromWires(components, wiresForNets(nets))), canon(nets));
});

test('cápsulas ficam no modo tabuleiro e o kit limita as peças', () => {
  assert.equal(boardToNetlist([{ id: 'c', type: 'capsula_pulso', a: 1, b: 2, c: 3, row: 0 }]), null);
  const leds: SchComponent[] = ['x', 'y', 'z'].map((id) => ({ id, type: 'led' }));
  const placed = placeNetlist(leds, netsFromWires(leds, []));
  assert.equal(placed.ok, false);
});
