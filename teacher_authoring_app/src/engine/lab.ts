/**
 * Simulated lab used by `experiment` steps. Everything here is a software model:
 * nothing is measured on the physical bench and nothing is read by the camera.
 */
import type { DiagnoseResult, LabEvent, LabGoal, LabState, Piece } from '../model/types.ts';
import { analyze, BENCH_LIMIT_MA, branchCurrent } from './sim.ts';

// --- resistor color code, drawn from the actual value --------------------------------------------

export const CODE_COLORS = [
  { name: 'preto', hex: '#202020' },
  { name: 'marrom', hex: '#76502d' },
  { name: 'vermelho', hex: '#d72c28' },
  { name: 'laranja', hex: '#ef7d22' },
  { name: 'amarelo', hex: '#e9cb32' },
  { name: 'verde', hex: '#3f9b4f' },
  { name: 'azul', hex: '#2f66c9' },
  { name: 'violeta', hex: '#8c49a1' },
  { name: 'cinza', hex: '#8b9096' },
  { name: 'branco', hex: '#f2f2f2' },
] as const;

export interface BandSet {
  /** First digit, second digit, multiplier. */
  colors: [string, string, string];
  names: [string, string, string];
  digits: [number, number, number];
}

/** Bands (digit, digit, power of ten) for a resistance, or null when two digits cannot express it. */
export function ohmsBands(ohms: number): BandSet | null {
  if (!Number.isFinite(ohms) || ohms < 1) return null;
  let power = 0;
  let mantissa = ohms;
  while (mantissa >= 100 && mantissa % 10 === 0) {
    mantissa /= 10;
    power++;
  }
  // Values below 10 Ω use the gold/silver multipliers, which the kit does not have.
  if (mantissa < 10) {
    mantissa *= 10;
    power--;
    if (power < 0) return null;
  }
  if (mantissa >= 100 || power > 9) return null;
  const d1 = Math.floor(mantissa / 10);
  const d2 = mantissa % 10;
  const pick = (d: number) => CODE_COLORS[d];
  return {
    colors: [pick(d1).hex, pick(d2).hex, pick(power).hex],
    names: [pick(d1).name, pick(d2).name, pick(power).name],
    digits: [d1, d2, power],
  };
}

/** "vermelho · vermelho · marrom" */
export const bandsText = (ohms: number) => ohmsBands(ohms)?.names.join(' · ') ?? '';



// --- other small models --------------------------------------------------------------------------

/** The bench's built-in status LED: on as soon as a battery capsule is seated (simulated). */
export const statusLedOn = (pieces: Piece[]) => pieces.some((p) => p.type === 'bateria' && p.a !== p.b);

/** Farads of capacitors on the board, treated as one bank (they are wired in parallel in the lessons). */
export const capacitanceUF = (pieces: Piece[]) => pieces.filter((p) => p.type === 'capacitor').length * 1000;

export interface Discharge {
  /** Series resistance of the loop the capacitor empties through (Ω). */
  ohms: number;
  load: 'led' | 'buzzer' | null;
  edgeIds: Set<string>;
}

/**
 * When the source is switched off, does a capacitor still have a loop through a load? Treats the
 * capacitor as a 5 V source across its own two columns, with the battery removed.
 */
export function capDischarge(pieces: Piece[]): Discharge | null {
  const cap = pieces.find((p) => p.type === 'capacitor');
  if (!cap) return null;
  const rest = pieces.filter((p) => p.type !== 'bateria' && p.type !== 'capacitor');
  for (const flip of [false, true]) {
    const source: Piece = {
      id: '__cap',
      type: 'bateria',
      a: flip ? cap.b : cap.a,
      b: flip ? cap.a : cap.b,
      row: cap.row,
    };
    const an = analyze([...rest, source]);
    if (an.code === 'valido' && an.trail) {
      const edgeIds = new Set([cap.id, ...an.trail.map((t) => t.id)]);
      return { ohms: an.ohms, load: an.load ?? null, edgeIds };
    }
  }
  return null;
}

/** Time constant (s) of the discharge: τ = R·C. */
export const dischargeTau = (d: Discharge, microFarads: number) => d.ohms * microFarads * 1e-6;

/** LED current (mA) `t` seconds after power-off: starts at the steady current and decays with τ. */
export function dischargeMa(startMa: number, t: number, tau: number): number {
  return tau > 0 ? startMa * Math.exp(-t / tau) : 0;
}

/** Below this current the LED is taken as dark (the fade is over). */
export const DARK_MA = 0.2;

/** Seconds until the LED is dark after power-off (didactic). */
export const fadeSeconds = (startMa: number, tau: number) =>
  startMa > DARK_MA ? tau * Math.log(startMa / DARK_MA) : 0;

/**
 * Didactic buzzer model: a current of `mA` gives a loudness (0–1) and a pitch (Hz). A real buzzer's
 * response is unmeasured here; the lesson text says so.
 */
export function buzzerSound(mA: number): { volume: number; hz: number } {
  const volume = Math.max(0, Math.min(1, mA / BENCH_LIMIT_MA));
  return { volume, hz: Math.round(450 + 60 * mA) };
}

/** Buzzer branch current for a series resistance, capped at the bench ceiling. */
export const buzzerMa = (ohms: number) => branchCurrent({ ohms, load: 'buzzer' }).mA;

// --- events and goals ----------------------------------------------------------------------------

export interface LabSnapshot {
  pieces: Piece[];
  held: Set<string>;
  energized: boolean;
  diag: DiagnoseResult;
  /** Player-observed facts the pure model cannot see. */
  flags: { shortCut?: boolean; flickering?: boolean; reseated?: boolean; fadeDone?: boolean; heard?: Set<'a' | 'b'> };
}

const buttonIds = (pieces: Piece[]) => pieces.filter((p) => p.type === 'botao').map((p) => p.id);

export function labStates(snap: LabSnapshot): Record<string, boolean> {
  const { pieces, diag, energized } = snap;
  const lit = energized && diag.code === 'valido';
  const both = lit && diag.loadsLit.length > 1;
  const out: Record<string, boolean> = {
    status_led: statusLedOn(pieces),
    lit,
    dark: !lit,
    closed: diag.code === 'valido',
    no_short: diag.code !== 'curto',
    no_loose: !pieces.some((p) => p.loose),
    all_lit: both,
  };
  return out;
}

/** New set of latched events after `snap`; events never un-happen. */
export function detectEvents(prev: Set<LabEvent>, snap: LabSnapshot): Set<LabEvent> {
  const next = new Set(prev);
  const { pieces, held, energized, diag, flags } = snap;
  const lit = energized && diag.code === 'valido';
  const buttons = buttonIds(pieces);
  if (energized) next.add('energized');
  if (lit) next.add('lit');
  if (flags.shortCut) next.add('short_cut');
  if (flags.flickering) next.add('flicker');
  if (flags.reseated) next.add('seated');
  if (flags.fadeDone) next.add('faded');
  if (energized && diag.code === 'led_invertido') next.add('reversed_dark');
  if (lit && buttons.length && held.size > 0) next.add('pressed_lit');
  if (energized && next.has('pressed_lit') && buttons.length && held.size === 0 && !lit) next.add('released_dark');
  if (energized && buttons.length > 1 && held.size > 0 && held.size < buttons.length && !lit) next.add('partial_dark');
  if (lit && diag.loadsLit.includes('buzzer')) next.add('buzzed');
  if (lit && diag.loadsLit.includes('buzzer') && diag.loadsLit.includes('led')) next.add('both_on');
  const pot = pieces.find((p) => p.type === 'potenciometro');
  if (pot && (pot.value ?? 1000) <= 300) next.add('pot_low');
  if (pot && (pot.value ?? 1000) >= 8000) next.add('pot_high');
  if (flags.heard?.has('a')) next.add('heard_a');
  if (flags.heard?.has('b')) next.add('heard_b');
  return next;
}

export function goalDone(
  goal: LabGoal,
  events: Set<LabEvent>,
  states: Record<string, boolean>,
  extra: { presetsLit?: Set<number>; presetsFaded?: Set<number> } = {}
): boolean {
  if (goal.seen?.some((e) => !events.has(e))) return false;
  if (goal.now?.some((s: LabState) => !states[s])) return false;
  if (goal.presetsLit && (extra.presetsLit?.size ?? 0) < goal.presetsLit) return false;
  if (goal.presetsFaded && (extra.presetsFaded?.size ?? 0) < goal.presetsFaded) return false;
  return true;
}

/** Which preset (index) the board currently matches, or -1: same piece types, columns, rows and values. */
export function matchingPreset(pieces: Piece[], presets: { pieces: Piece[] }[]): number {
  const key = (ps: Piece[]) =>
    ps
      .map((p) => `${p.type}:${p.a}:${p.b}:${p.row}:${p.value ?? ''}`)
      .sort()
      .join('|');
  const have = key(pieces);
  return presets.findIndex((p) => key(p.pieces) === have);
}
