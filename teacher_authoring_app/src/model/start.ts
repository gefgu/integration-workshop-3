import { COLS, ROWS } from '../engine/board.ts';
import { uid } from './ids.ts';
import type { LessonStart, Piece } from './types.ts';

export type Fault = 'reverse_led' | 'remove_jumper' | 'loose' | 'short';

export const FAULTS: { id: Fault; label: string; hint: string }[] = [
  { id: 'reverse_led', label: 'LED invertido', hint: 'O LED começa virado ao contrário e o aluno precisa girá-lo.' },
  {
    id: 'remove_jumper',
    label: 'Um jumper some (sorteado)',
    hint: 'A cada tentativa, um dos jumpers do circuito começa fora da bancada.',
  },
  {
    id: 'loose',
    label: 'Peça mal encaixada',
    hint: 'Uma peça começa “solta” e faz a luz piscar até o aluno encaixá-la clicando.',
  },
  {
    id: 'short',
    label: 'Jumper em curto (+ direto no −)',
    hint: 'Um jumper liga as duas colunas da bateria; a bancada corta a energia ao energizar.',
  },
];

const isJumper = (p: Piece) => p.type.startsWith('jumper');

/** A free row in the battery's bank where a one-column jumper fits across `a`..`b`, or null. */
function freeRow(pieces: Piece[], a: number, b: number, bankStart: number): number | null {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (let row = bankStart; row < bankStart + 6 && row < ROWS; row++) {
    const taken = pieces.some((p) => {
      if (p.row !== row) return false;
      const cols = p.c != null ? [p.a, p.b, p.c] : [p.a, p.b];
      return Math.min(...cols) <= hi && Math.max(...cols) >= lo;
    });
    if (!taken) return row;
  }
  return null;
}

/**
 * Builds a faulty starting bench from the finished circuit. Returns the start (never mutates `pieces`)
 * and the faults that could not be applied (e.g. no LED to reverse).
 */
export function makeStart(pieces: Piece[], faults: Fault[]): { start: LessonStart; skipped: Fault[] } {
  let next = pieces.map((p) => ({ ...p }));
  const skipped: Fault[] = [];
  const removeOneOf: string[] = [];
  for (const fault of faults) {
    if (fault === 'reverse_led') {
      const led = next.find((p) => p.type === 'led');
      if (!led) skipped.push(fault);
      else next = next.map((p) => (p.id === led.id ? { ...p, a: p.b, b: p.a } : p));
    } else if (fault === 'remove_jumper') {
      const jumpers = next.filter(isJumper);
      if (!jumpers.length) skipped.push(fault);
      else removeOneOf.push(...jumpers.map((p) => p.id));
    } else if (fault === 'loose') {
      const target = next.find(isJumper) ?? next.find((p) => p.type !== 'bateria');
      if (!target) skipped.push(fault);
      else next = next.map((p) => (p.id === target.id ? { ...p, loose: true } : p));
    } else {
      const bat = next.find((p) => p.type === 'bateria');
      const row = bat ? freeRow(next, bat.a, bat.b, bat.row >= 6 ? 6 : 0) : null;
      if (!bat || row == null || Math.max(bat.a, bat.b) > COLS) skipped.push(fault);
      else next.push({ id: `curto-${uid('x').slice(-4)}`, type: 'jumper_curto', a: bat.a, b: bat.b, row });
    }
  }
  return { start: { pieces: next, ...(removeOneOf.length ? { removeOneOf } : {}) }, skipped };
}
