import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SchematicPreview from '../src/components/SchematicPreview.tsx';
import { schematicLayout } from '../src/engine/schematic.ts';
import type { Piece, PieceType } from '../src/model/types.ts';

const piece = (id: string, type: PieceType, a: number, b: number, row = 0, value?: number): Piece => ({
  id,
  type,
  a,
  b,
  row,
  value,
});

test('series path follows the source terminals and keeps jumpers as wires', () => {
  const pieces = [
    piece('bat', 'bateria', 1, 2),
    piece('r', 'resistor_470', 1, 3),
    piece('led', 'led', 4, 3),
    piece('wire', 'jumper_longo', 4, 2),
  ];
  const layout = schematicLayout(pieces);
  assert.equal(layout.kind, 'loop');
  if (layout.kind !== 'loop') return;
  assert.deepEqual(
    layout.path.map(({ piece: item }) => item.id),
    ['r', 'led', 'wire']
  );
  assert.deepEqual(
    layout.path.map(({ forward }) => forward),
    [true, false, true]
  );
});

test('unfinished, branched, and isolated circuits retain every placed edge', () => {
  const unfinished = [piece('bat', 'bateria', 1, 2), piece('r', 'resistor_220', 2, 3)];
  const branched = [...unfinished, piece('led', 'led', 2, 4), piece('wire', 'jumper_curto', 4, 1)];
  const isolated = [...unfinished, piece('cap', 'capacitor', 8, 9)];
  for (const pieces of [unfinished, branched, isolated, [piece('r', 'resistor_1k', 5, 6)]]) {
    const layout = schematicLayout(pieces);
    assert.equal(layout.kind, 'network');
    if (layout.kind !== 'network') continue;
    assert.deepEqual(layout.edges.map((edge) => edge.id).sort(), pieces.map((edge) => edge.id).sort());
    assert.deepEqual(
      layout.nodes,
      [...new Set(pieces.flatMap(({ a, b }) => [a, b]))].sort((a, b) => a - b)
    );
  }
});

test('SVG uses the placed component values, including potentiometer adjustments', () => {
  const pieces = [piece('r', 'resistor_220', 1, 2), piece('pot', 'potenciometro', 3, 4, 1, 4700)];
  const render = () => renderToStaticMarkup(createElement(SchematicPreview, { pieces }));
  assert.match(render(), /220 Ω/);
  assert.match(render(), /4,7 kΩ/);
  pieces[1] = { ...pieces[1], value: 1000 };
  assert.match(render(), /1 kΩ/);
  assert.doesNotMatch(render(), /4,7 kΩ/);
  assert.match(renderToStaticMarkup(createElement(SchematicPreview, { pieces: [] })), /Adicione peças/);
});
