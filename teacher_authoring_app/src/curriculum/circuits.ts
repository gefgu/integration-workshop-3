/**
 * The circuits of the guided lessons, rebuilt for the 5 V bench from the schematics that Notion
 * references (docs/modules_plan/images/esquematico_modulo_NN.png, recovered from git history).
 *
 * Layout rules: every circuit sits in the first bank (rows 0–5) because the two banks are separate
 * nodes; components that share a column on different rows are wired together, jumpers bridge the rest.
 * Node numbering in the comments follows the original schematics.
 */
import type { Piece, PieceType } from '../model/types.ts';

export const P = (
  id: string,
  type: PieceType,
  a: number,
  b: number,
  row: number,
  extra: Partial<Piece> = {}
): Piece => ({ id, type, a, b, row, ...extra });

const battery = () => P('bat', 'bateria', 1, 2, 1); // + on column 1, − on column 2

/** Lesson 1: only the battery capsule. */
export const circuitL01 = (): Piece[] => [battery()];

/** Lesson 2 (schematic _02): battery → node 1 → LED → node 2 → back. No resistor yet. */
export const circuitL02 = (): Piece[] => [
  battery(),
  P('led', 'led', 3, 4, 2),
  P('w1', 'jumper_longo', 1, 3, 3), // + → LED anode
  P('w2', 'jumper_longo', 4, 2, 4), // LED cathode → −
];

/** Lesson 3 (schematic _03): resistor limits the current; the ammeter capsule (slot E2) shows it in mA. */
export const circuitL03 = (resistor: PieceType = 'resistor_470'): Piece[] => [
  battery(),
  P('res', resistor, 3, 4, 2),
  P('led', 'led', 4, 5, 3),
  P('amp', 'capsula_amperimetro', 5, 6, 0, { c: 7 }),
  P('w1', 'jumper_longo', 1, 3, 4),
  P('w2', 'jumper_4', 6, 2, 5),
];

/** Lessons 4, 9 and the base of 5/7: battery, 470 Ω, LED, two jumpers (schematic _04). */
export const circuitL04 = (): Piece[] => [
  battery(),
  P('res', 'resistor_470', 3, 4, 2),
  P('led', 'led', 4, 5, 3),
  P('w1', 'jumper_longo', 1, 3, 4),
  P('w2', 'jumper_3', 5, 2, 5),
];

/** Lesson 5 (schematic _05): the pushbutton sits in the return path and closes the loop only while held. */
export const circuitL05 = (): Piece[] => [
  battery(),
  P('res', 'resistor_470', 3, 4, 2),
  P('led', 'led', 4, 5, 3),
  P('btn', 'botao', 5, 6, 4),
  P('w1', 'jumper_longo', 1, 3, 5),
  P('w2', 'jumper_4', 6, 2, 0),
];

/** Lesson 5 challenge (schematic _05_desafio): two buttons in series, both must be held. */
export const circuitL05Challenge = (): Piece[] => [
  battery(),
  P('res', 'resistor_470', 3, 4, 2),
  P('led', 'led', 4, 5, 3),
  P('btnA', 'botao', 5, 6, 4),
  P('btnB', 'botao', 6, 7, 5),
  P('w1', 'jumper_longo', 1, 3, 3),
  P('w2', 'jumper_5', 7, 2, 0),
];

/** Lesson 6 (schematic _06): the potentiometer is a resistor you can turn. */
export const circuitL06 = (value = 1000): Piece[] => [
  battery(),
  P('pot', 'potenciometro', 3, 5, 2, { value }),
  P('led', 'led', 5, 6, 3),
  P('w1', 'jumper_longo', 1, 3, 4),
  P('w2', 'jumper_4', 6, 2, 5),
];

/**
 * Lesson 7 (schematic _07, reconstructed): the capacitor sits across the supply columns (+ on column 3,
 * − on column 2), so it empties through the resistor and the LED when the source is switched off. In the
 * original drawing it is across the LED alone, which would only give a flash of a few milliseconds.
 */
export const circuitL07 = (capacitors = 1): Piece[] => [
  ...circuitL04(),
  P('cap1', 'capacitor', 3, 2, 0),
  ...(capacitors > 1 ? [P('cap2', 'capacitor', 3, 2, 3)] : []),
];

/** Lesson 8 (schematic _08): the resistor in front of the buzzer sets how hard it is driven. */
export const circuitL08 = (resistor: PieceType = 'resistor_470'): Piece[] => [
  battery(),
  P('res', resistor, 3, 4, 2),
  P('buz', 'buzzer', 4, 5, 3),
  P('w1', 'jumper_longo', 1, 3, 4),
  P('w2', 'jumper_3', 5, 2, 5),
];

/** Lesson 8, potentiometer version (schematic _08_potenciometro). */
export const circuitL08Pot = (value = 1000): Piece[] => [
  battery(),
  P('pot', 'potenciometro', 3, 5, 2, { value }),
  P('buz', 'buzzer', 5, 6, 3),
  P('w1', 'jumper_longo', 1, 3, 4),
  P('w2', 'jumper_4', 6, 2, 5),
];

/** Lesson 10 (schematic _10): the button feeds two parallel branches, LED+resistor and buzzer+resistor. */
export const circuitL10 = (): Piece[] => [
  battery(),
  P('w1', 'jumper_longo', 1, 3, 5), // + → button
  P('btn', 'botao', 3, 4, 2),
  P('res1', 'resistor_470', 4, 5, 3), // node 2 → LED branch
  P('led', 'led', 5, 6, 4),
  P('w3', 'jumper_3', 4, 7, 5), // node 2 → buzzer branch
  P('res2', 'resistor_220', 7, 8, 2),
  P('buz', 'buzzer', 8, 9, 3),
  P('w4', 'jumper_3', 6, 9, 1), // buzzer return joins node 3
  P('w2', 'jumper_4', 6, 2, 0), // node 3 → battery −
];


/** The same board with one piece changed, keeping everything else (used for presets and faults). */
export const withPiece = (pieces: Piece[], id: string, patch: Partial<Piece>): Piece[] =>
  pieces.map((p) => (p.id === id ? { ...p, ...patch } : p));
