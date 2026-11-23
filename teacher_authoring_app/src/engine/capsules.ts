import type { CapsuleReading, CircuitTrail, FlowStep, Piece } from '../model/types.ts';
import { nodeOf } from './nodes.ts';
import { analyze, capsuleConfig, corrente, isCapsule, solvePotCircuit } from './sim.ts';

/**
 * Static DC model of the two smart capsules (EFR31/EFR32): the pulse source and the voltmeter. The
 * capsules are passive: the base ESP32 senses P1/P2 and drives P3. The pulse is the lesson's power
 * source (a lesson with it has no battery): while P3 is high it is 5 V from P3 back to the capsule's
 * own P1 (GND); a square wave from the clock `t` (ms). The voltmeter shows V(P1) − V(P2).
 * Time-stepped behaviour is out of scope.
 */
const SUPPLY_V = 5;
const LED_DROP_V = 2.0;
const BUZZER_OHMS = 250;

export interface CapsuleSim {
  readings: Record<string, CapsuleReading>;
  /** Energized path of loads the pulse drives (null when no pulse drives one). */
  driven: CircuitTrail | null;
  /** Current (mA) through the loads the pulse drives. */
  drivenMa: number;
}

const num = (n: number) => n.toFixed(2).replace('.', ',');

/** The pulse capsule seen as a 5 V source: + on P3, − on P1. */
export const pulseSource = (p: Piece): Piece => ({ id: `p3_${p.id}`, type: 'bateria', a: p.c as number, b: p.a, row: p.row });

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
  const exact = solvePotCircuit(pieces, pressed);
  if (exact) return exact.volts;
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

const pulseHigh = (p: Piece, t: number) => {
  const cfg = capsuleConfig(p);
  const period = 1000 / (cfg.hz as number);
  return t % period < period * ((cfg.duty as number) / 100);
};

export function simulateCapsules(pieces: Piece[], opts: { pressed?: Set<string> | null; t?: number } = {}): CapsuleSim {
  const caps = pieces.filter((p) => isCapsule(p.type));
  const readings: Record<string, CapsuleReading> = {};
  if (!caps.length) return { readings, driven: null, drivenMa: 0 };
  const pressed = opts.pressed ?? null;
  const t = opts.t ?? 0;
  const pulses = caps.filter((p) => p.type === 'capsula_pulso');
  const high = pulses.filter((p) => pulseHigh(p, t));
  // Passive circuit around the sources: no battery and no capsule conducts.
  const base = pieces.filter((p) => p.type !== 'bateria' && !isCapsule(p.type));

  // Node voltages: from the battery, or from the pulse while its P3 is high (0 V while it is low).
  let volts: Map<number, number>;
  if (pieces.some((p) => p.type === 'bateria')) volts = columnVoltages(pieces, pressed);
  else if (pulses.length) {
    const sourced = columnVoltages([...pieces, pulseSource(pulses[0])], pressed);
    volts = high.includes(pulses[0]) ? sourced : new Map([...sourced.keys()].map((n) => [n, 0]));
  } else volts = new Map();

  for (const p of caps) {
    const cfg = capsuleConfig(p);
    if (p.type === 'capsula_pulso') {
      const on = high.includes(p);
      readings[p.id] = {
        lines: [`PULSO ${String(cfg.hz).replace('.', ',')} Hz`, `${cfg.duty}%  P3 ${on ? 'ALTO' : 'BAIXO'}`],
        out: on ? 'alto' : 'baixo',
      };
    } else {
      const v1 = volts.get(nodeOf(p.a, p.row));
      const v2 = volts.get(nodeOf(p.b, p.row));
      readings[p.id] = { lines: ['VOLTÍMETRO', v1 == null || v2 == null ? 'sem sinal' : `${num(v1 - v2)} V`], out: 'z' };
    }
  }

  // While P3 is high the pulse is a 5 V source from P3 back to its own P1.
  const edgeIds = new Set<string>();
  const nodes = new Set<number>();
  const flow: FlowStep[] = [];
  const addFlow = (f: FlowStep) => {
    if (!flow.some((g) => g.id === f.id && g.from === f.from && f.to === g.to)) flow.push(f);
  };
  let drivenMa = 0;
  for (const p of high) {
    const r = analyze([...base, pulseSource(p)], { pressed });
    if (r.code !== 'valido' || !r.trail) continue;
    edgeIds.add(p.id);
    // The current leaves the capsule by P3 and comes back into it by P1.
    addFlow({ id: p.id, from: -1, to: nodeOf(p.c as number, p.row) });
    for (const s of r.trail) {
      edgeIds.add(s.id);
      nodes.add(s.from);
      nodes.add(s.to);
      addFlow({ id: s.id, from: s.from, to: s.to });
    }
    addFlow({ id: p.id, from: nodeOf(p.a, p.row), to: -1 });
    drivenMa = Math.max(drivenMa, corrente(r));
  }
  return { readings, driven: edgeIds.size ? { edgeIds, nodes, flow } : null, drivenMa };
}

/** The energized path of the battery loop together with loads a capsule drives. */
export function mergeTrails(a: CircuitTrail | null, b: CircuitTrail | null): CircuitTrail | null {
  if (!a || !b) return a || b;
  const flow = a.flow || b.flow ? [...(a.flow ?? []), ...(b.flow ?? [])] : undefined;
  return { edgeIds: new Set([...a.edgeIds, ...b.edgeIds]), nodes: new Set([...a.nodes, ...b.nodes]), flow };
}

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
          'O número é quanto a tensão em P1 passa a de P2. Perto de 5 V, P1 está ligado ao + da fonte (bateria ou pulso) e P2 ao −; 0 V, os dois pontos estão no mesmo nó.',
          '“sem sinal” quer dizer que P1 ou P2 não está ligado à fonte por nenhum caminho.',
        ],
      };
    default:
      return {
        title: `Pulso — tela: “${shown}”`,
        lines: [
          `Hz = ciclos por segundo: ${String(cfg.hz).replace('.', ',')} Hz liga e desliga ${String(cfg.hz).replace('.', ',')} vez(es) por segundo.`,
          `${cfg.duty}% = a parte de cada ciclo em que a saída fica ligada.`,
          'P3 ALTO = saída ligada (5 V entre P3 e P1, o GND da cápsula) agora; BAIXO = desligada (0 V). A tela muda sozinha com o relógio.',
          'O pulso é a fonte de energia da aula: ele substitui a bateria, que não entra junto com ele.',
        ],
      };
  }
}
