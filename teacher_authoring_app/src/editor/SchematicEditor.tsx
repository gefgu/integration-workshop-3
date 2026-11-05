import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ComponentSymbol } from '../components/SchematicPreview.tsx';
import {
  boardToNetlist,
  netsFromWires,
  placeNetlist,
  SCHEMATIC_TYPES,
  type SchComponent,
  type TerminalRef,
  term,
  wiresForNets,
} from '../engine/schematicPlace.ts';
import { KIT_LIMITS, NOMES } from '../engine/sim.ts';
import type { Piece, PieceType } from '../model/types.ts';

export interface SketchComponent extends SchComponent {
  x: number;
  y: number;
  vertical: boolean;
  /** terminals swapped: for the battery and the LED this reverses polarity */
  flip: boolean;
}

/** The drawing behind schematic mode; `forPieces` is the board it last produced, to notice board-mode edits. */
export interface Sketch {
  components: SketchComponent[];
  wires: [TerminalRef, TerminalRef][];
  forPieces: Piece[] | null;
}

const W = 300;
const H = 350;
const SCALE = 1.6;
const GRID = 10;
const NET_COLORS = ['#c67139', '#2f66c9', '#3f9b4f', '#7a3fb0', '#d23a30', '#b08a1d', '#1f8a8a', '#8a4a22'];

const slot = (i: number) => ({ x: 60 + (i % 3) * 90, y: 50 + Math.floor(i / 3) * 80 });

/** Drawing for a board: same components (positions kept by id), wires chaining each net. Null with capsules. */
export function sketchFromBoard(pieces: Piece[], previous: Sketch | null): Sketch | null {
  const netlist = boardToNetlist(pieces);
  if (!netlist) return null;
  const old = new Map((previous?.components ?? []).map((c) => [c.id, c]));
  let free = 0;
  const components = netlist.components.map((c) => {
    const kept = old.get(c.id);
    if (kept && kept.type === c.type) return { ...kept, ...c, flip: false };
    while ([...old.values()].some((o) => o.x === slot(free).x && o.y === slot(free).y)) free++;
    return { ...c, ...slot(free++), vertical: false, flip: false };
  });
  return { components, wires: wiresForNets(netlist.nets), forPieces: pieces };
}

/**
 * Wire route: an L from p to q, or, when a straight run would cross another symbol, a detour 34 units below
 * (or beside, for a vertical run) so wires never draw over components.
 */
function wirePath(
  p: { x: number; y: number },
  q: { x: number; y: number },
  comps: SketchComponent[],
  lane: number
): string {
  // A symbol blocks the run when its centre lies on it, including the wire's own components.
  const shift = 30 + (lane % 4) * 8;
  if (Math.abs(p.y - q.y) < 1) {
    const [lo, hi] = [Math.min(p.x, q.x), Math.max(p.x, q.x)];
    const blocking = comps.filter((c) => c.x > lo && c.x < hi && Math.abs(c.y - p.y) < 25);
    if (blocking.length) {
      const y = Math.max(p.y, ...blocking.map((c) => c.y)) + shift;
      return `M${p.x},${p.y} L${p.x},${y} L${q.x},${y} L${q.x},${q.y}`;
    }
  }
  if (Math.abs(p.x - q.x) < 1) {
    const [lo, hi] = [Math.min(p.y, q.y), Math.max(p.y, q.y)];
    const blocking = comps.filter((c) => c.y > lo && c.y < hi && Math.abs(c.x - p.x) < 25);
    if (blocking.length) {
      const x = Math.max(p.x, ...blocking.map((c) => c.x)) + shift;
      return `M${p.x},${p.y} L${x},${p.y} L${x},${q.y} L${q.x},${q.y}`;
    }
  }
  return `M${p.x},${p.y} L${q.x},${p.y} L${q.x},${q.y}`;
}

function terminalAt(c: SketchComponent, t: 0 | 1) {
  const d = (t === 0) !== c.flip ? -20 : 20;
  return c.vertical ? { x: c.x, y: c.y + d } : { x: c.x + d, y: c.y };
}

/**
 * Schematic mode of the lesson editor: place components, wire terminal to terminal, and the board layout follows
 * (engine/schematicPlace.ts). The board only changes when the drawing fits a bank; otherwise the error shows here.
 */
export default function SchematicEditor({
  pieces,
  onChange,
  sketch,
  setSketch,
  header,
}: {
  header?: ReactNode;
  pieces: Piece[];
  onChange: (pieces: Piece[]) => void;
  sketch: Sketch;
  setSketch: (sketch: Sketch) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<{ kind: 'comp' | 'wire'; key: string } | null>(null);
  const [pending, setPending] = useState<TerminalRef | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string }>({
    ok: true,
    text: 'Clique numa bolinha (terminal) e depois em outra para ligar. Arraste os símbolos para organizar.',
  });

  const nets = netsFromWires(sketch.components, sketch.wires);
  const netIndex = new Map<TerminalRef, number>();
  nets
    .filter((n) => n.length > 1)
    .forEach((n, i) => {
      for (const t of n) netIndex.set(t, i);
    });
  // Board column of each terminal, from the layout this drawing produced.
  const boardCol = new Map<TerminalRef, string>();
  if (sketch.forPieces === pieces) {
    for (const p of pieces) {
      boardCol.set(term(p.id, 0), `A${p.a}`);
      boardCol.set(term(p.id, 1), `A${p.b}`);
    }
  }

  /** Updates the drawing; when the circuit changed, re-places it on the board. */
  function commit(next: Omit<Sketch, 'forPieces'>, circuitChanged: boolean) {
    if (!circuitChanged) {
      setSketch({ ...next, forPieces: sketch.forPieces });
      return;
    }
    const jumperIds = pieces.filter((p) => p.type.startsWith('jumper')).map((p) => p.id);
    const placed = placeNetlist(next.components, netsFromWires(next.components, next.wires), jumperIds);
    if (placed.ok) {
      onChange(placed.pieces);
      setSketch({ ...next, forPieces: placed.pieces });
      const jumpers = placed.pieces.filter((p) => p.type.startsWith('jumper')).length;
      setStatus({
        ok: true,
        text: `Montagem atualizada na bancada: ${next.components.length} componente(s)${jumpers ? ` e ${jumpers} jumper(s)` : ''}.`,
      });
    } else {
      setSketch({ ...next, forPieces: sketch.forPieces });
      setStatus({ ok: false, text: placed.error });
    }
  }

  function add(type: PieceType) {
    const taken = new Set(sketch.components.map((c) => c.id));
    let n = sketch.components.length + 1;
    while (taken.has(`p${n}`) || pieces.some((p) => p.id === `p${n}`)) n++;
    let i = 0;
    while (sketch.components.some((c) => Math.abs(c.x - slot(i).x) < 40 && Math.abs(c.y - slot(i).y) < 40)) i++;
    const at = i < 12 ? slot(i) : { x: W / 2, y: H / 2 };
    commit(
      {
        components: [...sketch.components, { id: `p${n}`, type, ...at, vertical: false, flip: false }],
        wires: sketch.wires,
      },
      true
    );
    setSelected({ kind: 'comp', key: `p${n}` });
  }

  function removeSelected() {
    if (!selected) return;
    if (selected.kind === 'comp') {
      const id = selected.key;
      commit(
        {
          components: sketch.components.filter((c) => c.id !== id),
          wires: sketch.wires.filter(([a, b]) => !a.startsWith(`${id}:`) && !b.startsWith(`${id}:`)),
        },
        true
      );
    } else {
      commit({ components: sketch.components, wires: sketch.wires.filter((w) => w.join('~') !== selected.key) }, true);
    }
    setSelected(null);
  }

  function patchSelected(patch: Partial<SketchComponent>, circuitChanged: boolean) {
    if (selected?.kind !== 'comp') return;
    commit(
      {
        components: sketch.components.map((c) => (c.id === selected.key ? { ...c, ...patch } : c)),
        wires: sketch.wires,
      },
      circuitChanged
    );
  }

  function clickTerminal(t: TerminalRef) {
    if (!pending) {
      setPending(t);
      return;
    }
    // A component's own two terminals may be wired together: it shorts that part, as on the board.
    if (pending !== t) {
      const exists = sketch.wires.some(([a, b]) => (a === pending && b === t) || (a === t && b === pending));
      if (!exists) commit({ components: sketch.components, wires: [...sketch.wires, [pending, t]] }, true);
    }
    setPending(null);
  }

  /** Reverses polarity: the symbol mirrors and its two terminals trade wires, so the drawing stays put. */
  function flipSelected() {
    if (selected?.kind !== 'comp') return;
    const id = selected.key;
    const swap = (t: TerminalRef) => (t === term(id, 0) ? term(id, 1) : t === term(id, 1) ? term(id, 0) : t);
    commit(
      {
        components: sketch.components.map((c) => (c.id === id ? { ...c, flip: !c.flip } : c)),
        wires: sketch.wires.map(([a, b]) => [swap(a), swap(b)] as [TerminalRef, TerminalRef]),
      },
      true
    );
  }

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x / SCALE, y: p.y / SCALE };
  };

  useEffect(() => {
    if (!drag) return undefined;
    const move = (e: PointerEvent) => {
      const at = toLocal(e);
      const x = Math.min(W - 25, Math.max(25, Math.round((at.x - drag.dx) / GRID) * GRID));
      const y = Math.min(H - 25, Math.max(25, Math.round((at.y - drag.dy) / GRID) * GRID));
      setSketch({
        ...sketch,
        components: sketch.components.map((c) => (c.id === drag.id ? { ...c, x, y } : c)),
      });
    };
    const up = () => setDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  });

  const counts = new Map<PieceType, number>();
  for (const c of sketch.components) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  const sel = selected?.kind === 'comp' ? sketch.components.find((c) => c.id === selected.key) : null;
  const pendingAt = pending
    ? terminalAt(
        sketch.components.find((c) => c.id === pending.split(':')[0]) as SketchComponent,
        Number(pending.split(':')[1]) as 0 | 1
      )
    : null;

  return (
    <div className="sketch-editor">
      {header}
      <div className="sketch-palette" role="toolbar" aria-label="Componentes">
        {SCHEMATIC_TYPES.map((type) => {
          const left = KIT_LIMITS[type] - (counts.get(type) ?? 0);
          return (
            <button key={type} type="button" className="btn-outline" disabled={left <= 0} onClick={() => add(type)}>
              + {NOMES[type]} <small>({left})</small>
            </button>
          );
        })}
      </div>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard shortcuts for the drawing (Delete, Esc) */}
      <div
        className="sketch-canvas"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setPending(null);
          if (e.key === 'Delete' || e.key === 'Backspace') removeSelected();
        }}
      >
        <svg
          ref={svg}
          width={W * SCALE}
          height={H * SCALE}
          viewBox={`0 0 ${W * SCALE} ${H * SCALE}`}
          role="img"
          aria-label="Esquema do circuito"
          onPointerMove={(e) => pending && setCursor(toLocal(e))}
          onPointerDown={(e) => {
            if (e.target === svg.current) {
              setSelected(null);
              setPending(null);
            }
          }}
        >
          <defs>
            <pattern id="sketch-dots" width={GRID * SCALE} height={GRID * SCALE} patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="var(--color-neutral-400)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sketch-dots)" pointerEvents="none" />
          <g transform={`scale(${SCALE})`}>
            {sketch.wires.map(([a, b], wireIndex) => {
              const ca = sketch.components.find((c) => c.id === a.split(':')[0]);
              const cb = sketch.components.find((c) => c.id === b.split(':')[0]);
              if (!ca || !cb) return null;
              const p = terminalAt(ca, Number(a.split(':')[1]) as 0 | 1);
              const q = terminalAt(cb, Number(b.split(':')[1]) as 0 | 1);
              const key = [a, b].join('~');
              const color = NET_COLORS[(netIndex.get(a) ?? 0) % NET_COLORS.length];
              const on = selected?.kind === 'wire' && selected.key === key;
              const d = wirePath(p, q, sketch.components, wireIndex);
              return (
                <g key={key}>
                  <path d={d} fill="none" stroke={color} strokeWidth={on ? 3.5 : 2.2} strokeLinejoin="round" />
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: wide invisible hit area to select the wire */}
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={10}
                    style={{ cursor: 'pointer' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelected({ kind: 'wire', key });
                    }}
                  />
                </g>
              );
            })}
            {pendingAt && cursor && (
              <line
                x1={pendingAt.x}
                y1={pendingAt.y}
                x2={cursor.x}
                y2={cursor.y}
                stroke="var(--color-accent)"
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            )}
            {sketch.components.map((c) => {
              const on = sel?.id === c.id;
              return (
                <g key={c.id}>
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: drag handle of the symbol */}
                  <rect
                    x={c.vertical ? c.x - 18 : c.x - 22}
                    y={c.vertical ? c.y - 22 : c.y - 18}
                    width={c.vertical ? 36 : 44}
                    height={c.vertical ? 44 : 36}
                    rx={6}
                    fill={on ? 'rgba(198,113,57,.14)' : 'transparent'}
                    stroke={on ? 'var(--color-accent)' : 'none'}
                    strokeDasharray="3 2"
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const at = toLocal(e);
                      setSelected({ kind: 'comp', key: c.id });
                      setDrag({ id: c.id, dx: at.x - c.x, dy: at.y - c.y });
                    }}
                  />
                  <g pointerEvents="none">
                    <ComponentSymbol
                      piece={{ id: c.id, type: c.type, a: 1, b: 2, row: 0, value: c.value }}
                      x={c.x}
                      y={c.y}
                      vertical={c.vertical}
                      forward={!c.flip}
                    />
                  </g>
                  {([0, 1] as const).map((t) => {
                    const ref = term(c.id, t);
                    const at = terminalAt(c, t);
                    const net = netIndex.get(ref);
                    const label = boardCol.get(ref);
                    const out = { x: at.x - c.x, y: at.y - c.y };
                    return (
                      <g key={t}>
                        {/* biome-ignore lint/a11y/noStaticElementInteractions: terminal to start or end a wire */}
                        <circle
                          cx={at.x}
                          cy={at.y}
                          r={pending === ref ? 6 : 4.5}
                          fill={net != null ? NET_COLORS[net % NET_COLORS.length] : '#fff'}
                          stroke={pending === ref ? 'var(--color-accent)' : 'var(--color-neutral-700)'}
                          strokeWidth={pending === ref ? 2.5 : 1.5}
                          style={{ cursor: 'crosshair' }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            clickTerminal(ref);
                          }}
                        >
                          <title>
                            {label ? `Terminal na coluna ${label} da bancada` : 'Terminal: clique para ligar'}
                          </title>
                        </circle>
                        {label && (
                          <text
                            x={at.x + Math.sign(out.x) * 9}
                            y={at.y + Math.sign(out.y) * 11 + (out.y === 0 ? -6 : 3)}
                            textAnchor={out.x < 0 ? 'end' : out.x > 0 ? 'start' : 'middle'}
                            className="sketch-col"
                          >
                            {label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div className="sketch-actions">
        {sel ? (
          <>
            <span className="muted-line">{NOMES[sel.type]}</span>
            <button
              type="button"
              className="btn-outline"
              onClick={() => patchSelected({ vertical: !sel.vertical }, false)}
            >
              Girar
            </button>
            {(sel.type === 'bateria' || sel.type === 'led') && (
              <button type="button" className="btn-outline" onClick={flipSelected}>
                Inverter polaridade
              </button>
            )}
            <button type="button" className="btn-outline" onClick={removeSelected}>
              Apagar
            </button>
          </>
        ) : selected?.kind === 'wire' ? (
          <button type="button" className="btn-outline" onClick={removeSelected}>
            Apagar fio
          </button>
        ) : null}
      </div>
      <p className={status.ok ? 'sketch-status' : 'sketch-status error'} role="status">
        {status.text}
      </p>
    </div>
  );
}
