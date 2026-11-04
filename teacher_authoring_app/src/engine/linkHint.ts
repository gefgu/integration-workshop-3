/**
 * "Where should this component be connected?": compares the student's bench with the lesson's target and finds
 * a connection the student has not made, so the board can draw a green dotted line to the right column.
 *
 * Works on nets (a column of one bank is one node, jumpers join nodes), not on positions, so a circuit built a few
 * columns away still gets a correct hint. Parts are matched by type; when the pieces themselves are wrong
 * (missing, extra, other value) there is no hint, because the problem is not a connection.
 */
import type { Piece } from '../model/types.ts';
import { BANK_ROWS } from './board.ts';

export interface Hole {
  col: number;
  row: number;
}

export interface LinkHint {
  /** The pin of the component that sits in the bigger subcircuit. */
  from: Hole;
  /** The hole whose column it must be connected to. */
  to: Hole;
  fromId: string;
  toId: string;
}

interface Part {
  piece: Piece;
  holes: Hole[];
  nets: number[];
  ordered: boolean;
}

const isJumper = (p: Piece) => p.type.startsWith('jumper');
const isOrdered = (type: string) => type === 'bateria' || type === 'led' || type.startsWith('capsula_');
const bank = (row: number) => (row >= BANK_ROWS ? 1 : 0);

/** Parts (jumpers excluded) with the net of each pin; a jumper just joins the two nets it touches. */
function analyse(pieces: Piece[]): Part[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    parent.set(x, root);
    return root;
  };
  const key = (h: Hole) => `${bank(h.row)}:${h.col}`;
  const holesOf = (p: Piece): Hole[] =>
    (p.c != null ? [p.a, p.b, p.c] : [p.a, p.b]).map((col) => ({ col, row: p.row }));
  for (const p of pieces) {
    const holes = holesOf(p);
    for (const h of holes) find(key(h));
    if (isJumper(p)) parent.set(find(key(holes[0])), find(key(holes[1])));
  }
  const ids = new Map<string, number>();
  const net = (h: Hole) => {
    const root = find(key(h));
    if (!ids.has(root)) ids.set(root, ids.size);
    return ids.get(root) as number;
  };
  return pieces
    .filter((p) => !isJumper(p))
    .map((piece) => {
      const holes = holesOf(piece);
      return { piece, holes, nets: holes.map(net), ordered: isOrdered(piece.type) };
    });
}

interface Pair {
  p: number;
  q: number;
  /** pin index for ordered parts; null = either pin */
  tp: number | null;
  tq: number | null;
}

/** Every pair of pins that share a net in the target, as "these two parts must touch". */
function expectedPairs(target: Part[]): Pair[] {
  const byNet = new Map<number, [number, number][]>();
  target.forEach((part, p) => {
    part.nets.forEach((n, t) => {
      if (!byNet.has(n)) byNet.set(n, []);
      (byNet.get(n) as [number, number][]).push([p, t]);
    });
  });
  const seen = new Set<string>();
  const out: Pair[] = [];
  for (const members of byNet.values()) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const [p, tp] = members[i];
        const [q, tq] = members[j];
        if (p === q) continue;
        const pair = {
          p,
          q,
          tp: target[p].ordered ? tp : null,
          tq: target[q].ordered ? tq : null,
        };
        const id = `${p}.${pair.tp}-${q}.${pair.tq}`;
        if (!seen.has(id)) {
          seen.add(id);
          out.push(pair);
        }
      }
    }
  }
  return out;
}

const pins = (part: Part, wanted: number | null) => (wanted != null ? [wanted] : part.nets.map((_, i) => i));

/** Student pins of the two mapped parts that already touch (any pin for an orderless part). */
function touching(a: Part, ta: number | null, b: Part, tb: number | null): boolean {
  return pins(a, ta).some((i) => pins(b, tb).some((j) => a.nets[i] === b.nets[j]));
}

/** Matches student parts to target parts of the same type, keeping the assignment with the fewest broken pairs. */
function bestMapping(student: Part[], target: Part[], pairs: Pair[]): { map: number[]; missing: Pair[] } | null {
  const sorted = (parts: Part[]) =>
    parts
      .map((x) => x.piece.type)
      .sort()
      .join(',');
  if (student.length !== target.length || sorted(student) !== sorted(target)) return null;
  const map = new Array<number>(target.length).fill(-1);
  const used = new Set<number>();
  let best: { map: number[]; missing: Pair[] } | null = null;
  let steps = 0;
  const walk = (k: number) => {
    if (++steps > 20000) return;
    if (k === target.length) {
      const missing = pairs.filter((pr) => !touching(student[map[pr.p]], pr.tp, student[map[pr.q]], pr.tq));
      if (!best || missing.length < best.missing.length) best = { map: [...map], missing };
      return;
    }
    student.forEach((s, i) => {
      if (used.has(i) || s.piece.type !== target[k].piece.type) return;
      used.add(i);
      map[k] = i;
      walk(k + 1);
      used.delete(i);
    });
  };
  walk(0);
  return best;
}

/**
 * The connection to draw, or null when every connection is right or the pieces themselves are wrong.
 * The line starts at a pin of the component that belongs to the bigger subcircuit and ends at the column where it
 * has to be connected.
 */
export function missingLink(studentPieces: Piece[], targetPieces: Piece[]): LinkHint | null {
  const student = analyse(studentPieces);
  const target = analyse(targetPieces);
  if (target.length < 2) return null;
  const found = bestMapping(student, target, expectedPairs(target));
  if (!found || found.missing.length === 0) return null;

  // Size of the subcircuit around a net: parts that touch it directly or through other non-battery parts.
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as number;
    parent.set(x, root);
    return root;
  };
  for (const part of student) {
    for (const n of part.nets) find(n);
    if (part.piece.type !== 'bateria') for (const n of part.nets) parent.set(find(n), find(part.nets[0]));
  }
  const size = new Map<number, number>();
  for (const part of student) {
    if (part.piece.type === 'bateria') continue;
    size.set(find(part.nets[0]), (size.get(find(part.nets[0])) ?? 0) + 1);
  }
  const sizeOfNet = (n: number) => size.get(find(n)) ?? 0;
  const members = (n: number) => student.reduce((sum, part) => sum + part.nets.filter((x) => x === n).length, 0);

  // For an orderless part, use the pin that is the loosest end (fewest things attached).
  const pinFor = (part: Part, wanted: number | null) =>
    pins(part, wanted).reduce((bestPin, i) => (members(part.nets[i]) < members(part.nets[bestPin]) ? i : bestPin));

  const candidates = found.missing.map((pr) => {
    const a = student[found.map[pr.p]];
    const b = student[found.map[pr.q]];
    const ia = pinFor(a, pr.tp);
    const ib = pinFor(b, pr.tq);
    const sa = sizeOfNet(a.nets[ia]);
    const sb = sizeOfNet(b.nets[ib]);
    // Source = the end in the bigger subcircuit; a tie keeps the battery as the destination.
    const aIsSource = sa !== sb ? sa > sb : a.piece.type !== 'bateria' || b.piece.type === 'bateria';
    const [src, srcPin, dst, dstPin] = aIsSource ? [a, ia, b, ib] : [b, ib, a, ia];
    return { src, srcPin, dst, dstPin, dstSize: Math.min(sa, sb), srcSize: Math.max(sa, sb) };
  });
  // Most isolated destination first; among those, the one that hangs off the biggest circuit.
  candidates.sort((x, y) => x.dstSize - y.dstSize || y.srcSize - x.srcSize);
  const c = candidates[0];
  return {
    from: c.src.holes[c.srcPin],
    to: c.dst.holes[c.dstPin],
    fromId: c.src.piece.id,
    toId: c.dst.piece.id,
  };
}
