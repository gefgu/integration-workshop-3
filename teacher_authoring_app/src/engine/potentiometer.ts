import type { Piece } from '../model/types.ts';

/** Existing teaching range; the camera does not measure the physical track rating or knob setting. */
export const POT_VALUES = [100, 220, 470, 1000, 2200, 4700, 10000];
export const POT_DEFAULT = 1000;
export const POT_TOTAL = 10000;

export function stepPotValue(value: number | undefined, direction: number): number {
  const current = value ?? POT_DEFAULT;
  const values = direction > 0 ? POT_VALUES : [...POT_VALUES].reverse();
  return values.find((v) => (direction > 0 ? v > current : v < current)) ?? current;
}

/** a/b remain the outer ends, preserving saved geometry; c is the middle wiper W. */
export function potWiper(p: Pick<Piece, 'a' | 'b' | 'c'>): number {
  return p.c ?? (p.a + p.b) / 2;
}

export function potResistances(p: Pick<Piece, 'value'>): { aw: number; wb: number; total: number } {
  const setting = Number.isFinite(p.value) ? (p.value as number) : POT_DEFAULT;
  const aw = Math.max(0, Math.min(POT_TOTAL, setting));
  return { aw, wb: POT_TOTAL - aw, total: POT_TOTAL };
}

export type ElectricalPiece = Piece & { _segment?: 'AW' | 'WB'; _ohms?: number };

/** A real three-terminal track, with one physical id for highlighting and two electrical edges. */
export function expandPotentiometers(pieces: ElectricalPiece[]): ElectricalPiece[] {
  return pieces.flatMap((p) => {
    if (p.type !== 'potenciometro' || p._segment) return [p];
    const w = potWiper(p);
    const r = potResistances(p);
    return [
      { ...p, a: p.a, b: w, _segment: 'AW' as const, _ohms: r.aw },
      { ...p, a: w, b: p.b, _segment: 'WB' as const, _ohms: r.wb },
    ];
  });
}
