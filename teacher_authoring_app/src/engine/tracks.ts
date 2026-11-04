/**
 * Lit tracks: which board tracks (one column of one bank = one node) hold a piece leg, so the board can show
 * that a leg connects the whole track and which pieces meet on it. Pure, for tests.
 */
import type { Piece } from '../model/types.ts';
import { nodeOf } from './nodes.ts';

export interface TrackLight {
  node: number;
  col: number;
  /** rows of the legs on this track */
  rows: number[];
  /** ids of the pieces with a leg here; two or more = the track joins them */
  pieces: string[];
}

/** Columns where a piece has an electrical leg (a long jumper skips its middle socket). */
export function legColumns(p: Piece): number[] {
  return p.c != null ? [p.a, p.b, p.c] : [p.a, p.b];
}

export function trackLights(pieces: Piece[]): Map<number, TrackLight> {
  const lights = new Map<number, TrackLight>();
  for (const p of pieces) {
    for (const col of legColumns(p)) {
      const node = nodeOf(col, p.row);
      const light = lights.get(node) ?? { node, col, rows: [], pieces: [] };
      light.rows.push(p.row);
      if (!light.pieces.includes(p.id)) light.pieces.push(p.id);
      lights.set(node, light);
    }
  }
  return lights;
}
