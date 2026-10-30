import type { CapsuleReading, CircuitTrail, Piece } from '../model/types.ts';
import { bankOf, nodeOf } from './nodes.ts';
import { analyze, capsuleConfig, corrente, isCapsule } from './sim.ts';

/**
 * Static DC model of the smart capsules (EFR31/EFR32). The capsules are passive: the base ESP32
 * senses P1/P2 and drives P3. Here that is a voltage per column from the battery loop, logic
 * levels with the firmware thresholds (low ≤ 1.0 V, high ≥ 2.0 V) and, for the pulse source, a
 * square wave from the clock `t` (ms). Time-stepped behaviour is out of scope.
 */
const HIGH_V = 2.0;
const LOW_V = 1.0;
const SUPPLY_V = 5;
const LED_DROP_V = 2.0;
const BUZZER_OHMS = 250;
/** The ammeter capsule trips above this current (firmware). */
const TRIP_MA = 15;

export interface MemoryState {
  q: boolean;
  clk: boolean;
}
export type CapsuleMemory = Record<string, MemoryState>;

export interface CapsuleSim {
  readings: Record<string, CapsuleReading>;
  /** Energized path of loads driven by a capsule's P3 (null when no capsule drives one). */
  driven: CircuitTrail | null;
  /** Current (mA) through the loads driven by a capsule. */
  drivenMa: number;
  /** Memory after this evaluation; feed it back in as `memory` on the next one. */
  memory: CapsuleMemory;
}

const num = (n: number) => n.toFixed(2).replace('.', ',');
const bit = (b: boolean) => (b ? '1' : '0');

/** Nodes tied together by jumpers share one voltage. */
function wireClasses(pieces: Piece[]) {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r) as number;
    parent.set(x, r);
    return r;
  };
  for (const p of pieces)
    if (p.type.startsWith('jumper')) parent.set(find(nodeOf(p.a, p.row)), find(nodeOf(p.b, p.row)));
  return find;
}

/** Voltage of every node (column of a bank) the battery loop reaches; unreached ones are absent (floating). */
export function columnVoltages(pieces: Piece[], pressed: Set<string> | null = null): Map<number, number> {
  const volts = new Map<number, number>();
  const bat = pieces.find((p) => p.type === 'bateria');
  if (!bat) return volts;
  const find = wireClasses(pieces);
  const byClass = new Map<number, number>();
  const set = (node: number, v: number) => byClass.set(find(node), v);
  set(nodeOf(bat.b, bat.row), 0);
  set(nodeOf(bat.a, bat.row), SUPPLY_V);
  const an = analyze(pieces, { pressed });
  if ((an.code === 'valido' || an.code === 'sem_led') && an.trail) {
    // A closed resistor-only loop still has measurable node voltages even though it is
    // incomplete as an LED/buzzer lesson circuit.
    const amps = an.code === 'sem_led' ? SUPPLY_V / an.ohms : corrente(an) / 1000;
    let v = SUPPLY_V;
    for (const step of an.trail) {
      const drop =
        step.type === 'led' ? LED_DROP_V : step.type === 'buzzer' ? amps * BUZZER_OHMS : amps * (step.ohms || 0);
      v -= drop;
      set(step.to, Math.max(0, v));
    }
  }
  for (const p of pieces) {
    for (const col of [p.a, p.b, p.c]) {
      if (col == null) continue;
      const n = nodeOf(col, p.row);
      if (byClass.has(find(n))) volts.set(n, byClass.get(find(n)) as number);
    }
  }
  return volts;
}

const level = (v: number | undefined, prev = false): boolean =>
  v == null ? false : v >= HIGH_V ? true : v <= LOW_V ? false : prev;

function gate(op: string, a: boolean, b: boolean): boolean {
  switch (op) {
    case 'or':
      return a || b;
    case 'nand':
      return !(a && b);
    case 'nor':
      return !(a || b);
    case 'xor':
      return a !== b;
    case 'not':
      return !a;
    default:
      return a && b;
  }
}

/** One step of the 1-bit memory: D flip-flop (P1 = D, P2 = clock) or SR latch (P1 = S, P2 = R). */
export function stepMemory(prev: MemoryState, mem: 'd' | 'sr', p1: boolean, p2: boolean): MemoryState {
  if (mem === 'd') return { q: p2 && !prev.clk ? p1 : prev.q, clk: p2 };
  if (p1 && !p2) return { q: true, clk: p2 };
  if (p2 && !p1) return { q: false, clk: p2 };
  return { q: prev.q, clk: p2 };
}

export function simulateCapsules(
  pieces: Piece[],
  opts: { pressed?: Set<string> | null; memory?: CapsuleMemory; t?: number } = {}
): CapsuleSim {
  const caps = pieces.filter((p) => isCapsule(p.type));
  const readings: Record<string, CapsuleReading> = {};
  const memory: CapsuleMemory = {};
  if (!caps.length) return { readings, driven: null, drivenMa: 0, memory };
  const volts = columnVoltages(pieces, opts.pressed ?? null);
  const an = analyze(pieces, { pressed: opts.pressed ?? null });
  const outs: Piece[] = [];

  for (const p of caps) {
    const cfg = capsuleConfig(p);
    const v1 = volts.get(nodeOf(p.a, p.row));
    const v2 = volts.get(nodeOf(p.b, p.row));
    const in1 = level(v1);
    const in2 = level(v2);
    let reading: CapsuleReading;
    if (p.type === 'capsula_pulso') {
      const period = 1000 / (cfg.hz as number);
      const high = (opts.t ?? 0) % period < period * ((cfg.duty as number) / 100);
      reading = {
        lines: [`PULSO ${String(cfg.hz).replace('.', ',')} Hz`, `${cfg.duty}%  P3 ${high ? 'ALTO' : 'BAIXO'}`],
        out: high ? 'alto' : 'baixo',
      };
    } else if (p.type === 'capsula_voltimetro') {
      reading = {
        lines: ['VOLTÍMETRO', v1 == null || v2 == null ? 'sem sinal' : `${num(v1 - v2)} V`],
        out: 'z',
      };
    } else if (p.type === 'capsula_amperimetro') {
      const inLoop = an.code === 'valido' && an.trail?.some((s) => s.id === p.id);
      const mA = inLoop ? corrente(an) : 0;
      const fault = mA > TRIP_MA;
      reading = {
        lines: ['AMPERÍMETRO', fault ? 'DISPAROU' : inLoop ? `${num(mA)} mA` : 'sem corrente'],
        out: 'z',
        fault,
      };
    } else if (p.type === 'capsula_porta') {
      const op = cfg.op as string;
      const out = gate(op, in1, in2);
      reading = {
        lines: [op.toUpperCase(), op === 'not' ? `${bit(in1)} → ${bit(out)}` : `${bit(in1)} ${bit(in2)} → ${bit(out)}`],
        out: out ? 'alto' : 'baixo',
      };
    } else {
      const kind = cfg.mem as 'd' | 'sr';
      const prev = opts.memory?.[p.id] ?? { q: false, clk: false };
      const next = stepMemory(prev, kind, in1, in2);
      memory[p.id] = next;
      reading = {
        lines: [kind === 'd' ? 'MEMÓRIA D' : 'MEMÓRIA SR', `Q = ${bit(next.q)}`],
        out: next.q ? 'alto' : 'baixo',
      };
    }
    readings[p.id] = reading;
    if (reading.out === 'alto') outs.push(p);
  }

  // A capsule whose P3 is high is a 5 V source from that column back to the battery's − column.
  const bat = pieces.find((p) => p.type === 'bateria');
  const edgeIds = new Set<string>();
  const nodes = new Set<number>();
  let drivenMa = 0;
  if (bat) {
    // Return path is the battery's − node, which only exists in the bank the battery sits in.
    const base = pieces.filter((p) => p.type !== 'bateria' && (!isCapsule(p.type) || p.type === 'capsula_amperimetro'));
    for (const p of outs.filter((o) => bankOf(o.row) === bankOf(bat.row))) {
      const source: Piece = { id: `p3_${p.id}`, type: 'bateria', a: p.c as number, b: bat.b, row: p.row };
      const r = analyze([...base, source], { pressed: opts.pressed ?? null });
      if (r.code !== 'valido' || !r.trail) continue;
      edgeIds.add(p.id);
      for (const s of r.trail) {
        edgeIds.add(s.id);
        nodes.add(s.from);
        nodes.add(s.to);
      }
      drivenMa = Math.max(drivenMa, corrente(r));
    }
  }
  return { readings, driven: edgeIds.size ? { edgeIds, nodes } : null, drivenMa, memory };
}

/** The energized path of the battery loop together with loads a capsule drives. */
export function mergeTrails(a: CircuitTrail | null, b: CircuitTrail | null): CircuitTrail | null {
  if (!a || !b) return a || b;
  return { edgeIds: new Set([...a.edgeIds, ...b.edgeIds]), nodes: new Set([...a.nodes, ...b.nodes]) };
}

const GATE_TEXT: Record<string, string> = {
  and: 'AND (E): a saída só vale 1 quando as duas entradas valem 1.',
  or: 'OR (OU): a saída vale 1 quando pelo menos uma entrada vale 1.',
  nand: 'NAND: o contrário do AND — só vale 0 quando as duas entradas valem 1.',
  nor: 'NOR: o contrário do OR — só vale 1 quando as duas entradas valem 0.',
  xor: 'XOR (OU exclusivo): a saída vale 1 quando as entradas são diferentes.',
  not: 'NOT (NÃO): inverte a entrada P1 — 0 vira 1 e 1 vira 0.',
};

/**
 * What a capsule's screen means, in plain Portuguese, for the reading it shows right now.
 * `title` names the capsule; `lines` explain each value on its screen. Simulated values only.
 */
export function explainReading(piece: Piece, reading: CapsuleReading | undefined): { title: string; lines: string[] } {
  const cfg = capsuleConfig(piece);
  const shown = reading?.lines.join(' · ') ?? '';
  switch (piece.type) {
    case 'capsula_voltimetro':
      return {
        title: `Voltímetro — tela: “${shown}”`,
        lines: [
          'V = volts, a unidade de tensão: a “força” que empurra a corrente.',
          'O número é quanto a tensão em P1 passa a de P2. Perto de 5 V, P1 está ligado ao + da bateria e P2 ao −; 0 V, os dois pontos estão no mesmo nó.',
          '“sem sinal” quer dizer que P1 ou P2 não está ligado à bateria por nenhum caminho.',
        ],
      };
    case 'capsula_amperimetro':
      return {
        title: `Amperímetro — tela: “${shown}”`,
        lines: [
          'mA = miliampère, um milésimo de ampère (1 mA = 0,001 A): mede quanta corrente passa pelo caminho.',
          'Ele fica NO caminho, em série: toda a corrente do circuito atravessa as portas P1 e P2.',
          '“sem corrente” = não há caminho fechado. “DISPAROU” = passou de 15 mA, o limite seguro da bancada.',
        ],
      };
    case 'capsula_pulso':
      return {
        title: `Pulso — tela: “${shown}”`,
        lines: [
          `Hz = ciclos por segundo: ${String(cfg.hz).replace('.', ',')} Hz liga e desliga ${String(cfg.hz).replace('.', ',')} vez(es) por segundo.`,
          `${cfg.duty}% = a parte de cada ciclo em que a saída fica ligada.`,
          'P3 ALTO = saída ligada (5 V) agora; BAIXO = desligada (0 V). A tela muda sozinha com o relógio.',
        ],
      };
    case 'capsula_porta':
      return {
        title: `Porta lógica — tela: “${shown}”`,
        lines: [
          '0 = nível baixo (perto de 0 V); 1 = nível alto (perto de 5 V). A tela mostra as entradas P1 P2 → a saída P3.',
          GATE_TEXT[cfg.op as string] ?? '',
        ],
      };
    default:
      return {
        title: `Memória de 1 bit — tela: “${shown}”`,
        lines: [
          'Q é o bit guardado: 0 ou 1. Ele continua igual mesmo depois que a entrada muda.',
          cfg.mem === 'sr'
            ? 'Tipo SR: um pulso em P1 coloca Q em 1 (set); um pulso em P2 volta Q a 0 (reset).'
            : 'Tipo D: quando P2 (relógio) sobe de 0 para 1, Q copia o valor de P1.',
        ],
      };
  }
}
