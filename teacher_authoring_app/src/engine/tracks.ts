/**
 * Lit tracks: which board tracks (one column of one bank = one node) hold a piece leg, so the board can show
 * that a leg connects the whole track and which pieces meet on it. Pure, for tests.
 */
import type { FlowStep, Piece } from '../model/types.ts';
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

/** A stretch of one track that current really crosses: from the leg it enters by to the leg it leaves by. */
export interface FlowSegment {
  node: number;
  col: number;
  fromRow: number;
  toRow: number;
}

/** Row of `p`'s leg on track `node`, or null when the piece has no leg there. */
function legRow(p: Piece, node: number): number | null {
  return legColumns(p).some((col) => nodeOf(col, p.row) === node) ? p.row : null;
}

/**
 * Where the current runs along each energized track: only between the leg of a piece that brings it in and
 * the leg of a piece that takes it out, never over the empty holes past them. A track feeding two branches
 * gets one segment per branch.
 */
export function flowSegments(pieces: Piece[], flow: FlowStep[]): FlowSegment[] {
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const segments: FlowSegment[] = [];
  for (const into of flow) {
    if (into.to < 0) continue;
    const node = into.to;
    const inPiece = byId.get(into.id);
    const fromRow = inPiece ? legRow(inPiece, node) : null;
    if (fromRow == null) continue;
    for (const out of flow) {
      if (out.from !== node || out.id === into.id) continue;
      const outPiece = byId.get(out.id);
      const toRow = outPiece ? legRow(outPiece, node) : null;
      if (toRow == null || toRow === fromRow) continue;
      if (segments.some((s) => s.node === node && s.fromRow === fromRow && s.toRow === toRow)) continue;
      const col = legColumns(inPiece as Piece).find((c) => nodeOf(c, fromRow) === node) as number;
      segments.push({ node, col, fromRow, toRow });
    }
  }
  return segments;
}
