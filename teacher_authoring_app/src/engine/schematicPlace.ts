/**
 * Schematic mode: the teacher wires component terminals together in a drawing, and this module turns those
 * connections into a breadboard layout (and back). Pure, for tests.
 *
 * Terminal 0 of a component is the piece's leg `a` (battery +, LED anode) and terminal 1 its leg `b`. Each
 * group of connected terminals (a net) gets one or more columns of bank A; extra columns of the same net are
 * joined with jumpers. Smart capsules and jumpers are not schematic components: wires replace jumpers, and
 * capsules keep their fixed slots, so lessons with capsules stay in board mode.
 */
import type { Piece, PieceType } from '../model/types.ts';
import { BANK_ROWS, COLS, nextPieceId } from './board.ts';
import { nodeOf } from './nodes.ts';
import { DEFS, isCapsule, KIT_LIMITS } from './sim.ts';

export interface SchComponent {
  id: string;
  type: PieceType;
  value?: number;
}

/** `compId:0` or `compId:1` */
export type TerminalRef = string;
export const term = (id: string, t: 0 | 1): TerminalRef => `${id}:${t}`;

export type Placement =
  | { ok: true; pieces: Piece[]; error?: undefined }
  | { ok: false; error: string; pieces?: undefined };

const JUMPERS: PieceType[] = ['jumper_curto', 'jumper_longo', 'jumper_3', 'jumper_4', 'jumper_5'];
const MAX_JUMP = JUMPERS.length;
const isJumper = (type: PieceType) => DEFS[type] && (type as string).startsWith('jumper');

/** Types the schematic palette offers. */
export const SCHEMATIC_TYPES = (Object.keys(DEFS) as PieceType[]).filter((t) => !isCapsule(t) && !isJumper(t));

/** Groups terminals into nets from wires (pairs of terminals); unwired terminals are nets of their own. */
export function netsFromWires(components: SchComponent[], wires: [TerminalRef, TerminalRef][]): TerminalRef[][] {
  const parent = new Map<TerminalRef, TerminalRef>();
  const find = (t: TerminalRef): TerminalRef => {
    let r = t;
    while (parent.get(r) !== r) r = parent.get(r) as TerminalRef;
    parent.set(t, r);
    return r;
  };
  for (const c of components) for (const t of [term(c.id, 0), term(c.id, 1)]) parent.set(t, t);
  for (const [a, b] of wires) if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b));
  const groups = new Map<TerminalRef, TerminalRef[]>();
  for (const t of parent.keys()) {
    const root = find(t);
    groups.set(root, [...(groups.get(root) ?? []), t]);
  }
  return [...groups.values()];
}

/**
 * Board pieces → schematic components and nets. Jumpers become plain connections. Returns null when the board
 * has smart capsules, which only the board mode can edit.
 */
export function boardToNetlist(pieces: Piece[]): { components: SchComponent[]; nets: TerminalRef[][] } | null {
  if (pieces.some((p) => isCapsule(p.type))) return null;
  const parent = new Map<number, number>();
  const find = (n: number): number => {
    if (!parent.has(n)) parent.set(n, n);
    let r = n;
    while (parent.get(r) !== r) r = parent.get(r) as number;
    parent.set(n, r);
    return r;
  };
  for (const p of pieces) if (isJumper(p.type)) parent.set(find(nodeOf(p.a, p.row)), find(nodeOf(p.b, p.row)));
  const components: SchComponent[] = [];
  const byNode = new Map<number, TerminalRef[]>();
  for (const p of pieces) {
    if (isJumper(p.type)) continue;
    components.push(p.value != null ? { id: p.id, type: p.type, value: p.value } : { id: p.id, type: p.type });
    for (const [t, col] of [
      [0, p.a],
      [1, p.b],
    ] as const) {
      const root = find(nodeOf(col, p.row));
      byNode.set(root, [...(byNode.get(root) ?? []), term(p.id, t)]);
    }
  }
  return { components, nets: [...byNode.values()] };
}

/** The wires a netlist needs on the drawing: each net's terminals chained in order. */
export function wiresForNets(nets: TerminalRef[][]): [TerminalRef, TerminalRef][] {
  return nets.flatMap((net) => net.slice(1).map((t, i) => [net[i], t] as [TerminalRef, TerminalRef]));
}

interface State {
  colNet: number[]; // index = column 1..COLS, -1 = free
  netCols: number[][];
  rows: [number, number][][]; // per row of bank A: occupied spans
  placed: Map<string, { a: number; b: number; row: number }>;
}

function freeRow(rows: [number, number][][], lo: number, hi: number): number {
  for (let r = 0; r < BANK_ROWS; r++) if (rows[r].every(([l, h]) => hi < l || h < lo)) return r;
  return -1;
}

/**
 * Finds a bank-A layout for the netlist: every component's two terminals in columns `len` apart, each column
 * belonging to one net, and jumpers joining the columns of a net. Returns the pieces (component ids kept,
 * jumper ids reused from `oldJumperIds` when possible) or a pt-BR error.
 */
export function placeNetlist(
  components: SchComponent[],
  nets: TerminalRef[][],
  oldJumperIds: string[] = [],
  budget = 60000
): Placement {
  if (components.length === 0) return { ok: true, pieces: [] };
  const counts = new Map<PieceType, number>();
  for (const c of components) {
    if (!SCHEMATIC_TYPES.includes(c.type))
      return { ok: false, error: 'Esse componente só pode ser montado no modo protoboard.' };
    counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
    if ((counts.get(c.type) ?? 0) > KIT_LIMITS[c.type])
      return { ok: false, error: `O kit só tem ${KIT_LIMITS[c.type]} dessa peça.` };
  }
  const netOf = new Map<TerminalRef, number>();
  nets.forEach((net, i) => {
    for (const t of net) netOf.set(t, i);
  });
  const terminalsNet = (c: SchComponent): [number, number] => [
    netOf.get(term(c.id, 0)) as number,
    netOf.get(term(c.id, 1)) as number,
  ];
  if (nets.filter((n) => n.length > 0).length > COLS)
    return { ok: false, error: `O circuito tem mais ligações do que as ${COLS} colunas de um banco.` };

  // Battery first, then breadth-first along shared nets, so the layout grows from one place.
  const order: SchComponent[] = [];
  const pending = [...components].sort((x, y) => Number(y.type === 'bateria') - Number(x.type === 'bateria'));
  while (pending.length) {
    const reached = new Set(order.flatMap(terminalsNet));
    const i = Math.max(
      0,
      pending.findIndex((c) => terminalsNet(c).some((n) => reached.has(n)))
    );
    order.push(pending.splice(i, 1)[0]);
  }

  const state: State = {
    colNet: Array(COLS + 1).fill(-1),
    netCols: nets.map(() => []),
    rows: Array.from({ length: BANK_ROWS }, () => []),
    placed: new Map(),
  };
  let steps = 0;

  const gapsOk = (cols: number[]) => {
    const s = [...cols].sort((a, b) => a - b);
    return s.every((c, i) => i === 0 || c - s[i - 1] <= MAX_JUMP);
  };

  function route(): Piece[] | null {
    const rows = state.rows.map((r) => [...r]);
    const used = new Map<PieceType, number>();
    const jumpers: Piece[] = [];
    const taken = new Set(components.map((c) => c.id));
    for (const cols of state.netCols) {
      const s = [...cols].sort((a, b) => a - b);
      for (let i = 1; i < s.length; i++) {
        const d = s[i] - s[i - 1];
        const type = JUMPERS[d - 1];
        if (!type) return null;
        used.set(type, (used.get(type) ?? 0) + 1);
        if ((used.get(type) ?? 0) > KIT_LIMITS[type]) return null;
        const row = freeRow(rows, s[i - 1], s[i]);
        if (row < 0) return null;
        rows[row].push([s[i - 1], s[i]]);
        const id =
          oldJumperIds.find((j) => !taken.has(j)) ??
          nextPieceId([...jumpers, ...[...taken].map((t) => ({ id: t }) as Piece)]);
        taken.add(id);
        jumpers.push({ id, type, a: s[i - 1], b: s[i], row });
      }
    }
    return jumpers;
  }

  function assign(col: number, net: number) {
    if (state.colNet[col] === net) return false;
    state.colNet[col] = net;
    state.netCols[net].push(col);
    return true;
  }
  function unassign(col: number, net: number) {
    state.colNet[col] = -1;
    state.netCols[net].splice(state.netCols[net].indexOf(col), 1);
  }

  function dfs(i: number): Piece[] | null {
    if (++steps > budget) return null;
    if (i === order.length) return route();
    const comp = order[i];
    const len = DEFS[comp.type].len;
    const [n0, n1] = terminalsNet(comp);
    const usedCols = state.colNet.map((n, c) => (n >= 0 ? c : -1)).filter((c) => c > 0);
    const centre = usedCols.length ? usedCols.reduce((a, b) => a + b, 0) / usedCols.length : (COLS + 1) / 2;
    const cost = (col: number, net: number) => {
      if (state.colNet[col] === net) return 0;
      const own = state.netCols[net];
      if (!own.length) return 1 + Math.abs(col - centre) * 0.01;
      return 3 + Math.min(...own.map((c) => Math.abs(c - col))) * 0.1;
    };
    const candidates: [number, number, number][] = [];
    for (let c0 = 1; c0 <= COLS; c0++) {
      for (const c1 of [c0 + len, c0 - len]) {
        if (c1 < 1 || c1 > COLS) continue;
        const ok0 = state.colNet[c0] === -1 || state.colNet[c0] === n0;
        const ok1 = state.colNet[c1] === -1 || state.colNet[c1] === n1;
        if (!ok0 || !ok1) continue;
        candidates.push([c0, c1, cost(c0, n0) + cost(c1, n1)]);
      }
    }
    candidates.sort((x, y) => x[2] - y[2]);
    for (const [c0, c1] of candidates) {
      const lo = Math.min(c0, c1);
      const hi = Math.max(c0, c1);
      const row = freeRow(state.rows, lo, hi);
      if (row < 0) continue;
      const new0 = assign(c0, n0);
      const new1 = assign(c1, n1);
      if (gapsOk(state.netCols[n0]) && gapsOk(state.netCols[n1])) {
        state.rows[row].push([lo, hi]);
        state.placed.set(comp.id, { a: c0, b: c1, row });
        const done = dfs(i + 1);
        if (done) return done;
        state.placed.delete(comp.id);
        state.rows[row].pop();
      }
      if (new1) unassign(c1, n1);
      if (new0) unassign(c0, n0);
      if (steps > budget) return null;
    }
    return null;
  }

  const jumpers = dfs(0);
  if (!jumpers)
    return {
      ok: false,
      error:
        'Não consegui encaixar esse circuito num banco da bancada. Simplifique as ligações ou monte no modo protoboard.',
    };
  const pieces: Piece[] = components.map((c) => {
    const at = state.placed.get(c.id) as { a: number; b: number; row: number };
    return { id: c.id, type: c.type, ...at, ...(c.value != null ? { value: c.value } : {}) };
  });
  return { ok: true, pieces: [...pieces, ...jumpers] };
}
