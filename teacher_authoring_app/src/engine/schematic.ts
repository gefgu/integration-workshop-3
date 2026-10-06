import type { Piece } from '../model/types.ts';

export interface OrientedPiece {
  piece: Piece;
  forward: boolean;
}

export type SchematicLayout =
  | { kind: 'empty' }
  | { kind: 'loop'; battery: Piece; path: OrientedPiece[] }
  | { kind: 'network'; nodes: number[]; edges: Piece[] };

/** Build a stable view of every placed edge, independent of circuit validity. */
export function schematicLayout(pieces: Piece[]): SchematicLayout {
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
