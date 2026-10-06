import type { Piece } from '../model/types.ts';
import { nodeOf } from './nodes.ts';
import { isCapsule } from './sim.ts';

export interface OrientedPiece {
  piece: Piece;
  forward: boolean;
}

export type SchematicLayout =
  | { kind: 'empty' }
  | { kind: 'loop'; battery: Piece; path: OrientedPiece[] }
  | { kind: 'network'; nodes: number[]; edges: Piece[] };

/** Build a stable view of every placed edge, independent of circuit validity. */
/** Capsules that only sense or drive (everything but the ammeter, which sits in series). */
export const sensingCapsules = (pieces: Piece[]) =>
  pieces.filter((piece) => isCapsule(piece.type) && piece.type !== 'capsula_amperimetro');

export function schematicLayout(all: Piece[]): SchematicLayout {
  // `a`/`b` become node ids: a column is one node per bank, and the banks never connect.
  const pieces = all
    .filter((piece) => !sensingCapsules([piece]).length)
    .map((piece) => ({ ...piece, a: nodeOf(piece.a, piece.row), b: nodeOf(piece.b, piece.row) }));
  if (pieces.length === 0) return { kind: 'empty' };

  const batteries = pieces.filter((piece) => piece.type === 'bateria');
  if (batteries.length === 1) {
    const battery = batteries[0];
    const others = pieces.filter((piece) => piece.id !== battery.id);
    const used = new Set<string>();
    const path: OrientedPiece[] = [];
    let node = battery.a;

    while (node !== battery.b && used.size < others.length) {
      const next = others.filter((piece) => !used.has(piece.id) && (piece.a === node || piece.b === node));
      if (next.length !== 1) break;
      const piece = next[0];
      path.push({ piece, forward: piece.a === node });
      used.add(piece.id);
      node = piece.a === node ? piece.b : piece.a;
    }

    if (others.length > 0 && node === battery.b && used.size === others.length) {
      return { kind: 'loop', battery, path };
    }
  }

  return {
    kind: 'network',
    nodes: [...new Set(pieces.flatMap((piece) => [piece.a, piece.b]))].sort((a, b) => a - b),
    edges: [...pieces].sort((a, b) => a.row - b.row || a.id.localeCompare(b.id)),
  };
}
