import { DEFS, KIT_LIMITS, NOMES, countByType } from './sim.ts';
import type { Piece, PieceType } from '../model/types.ts';

/**
 * Two banks of 11 columns × 6 rows (12 rows total) split by a central channel.
 * All sockets of a column are ONE electrical node (across both banks), so a
 * piece only stores its two columns (`a`, `b`) plus a cosmetic `row` 0–11
 * (rows 0–5 = first bank, 6–11 = second bank).
 */
export const COLS = 11;
export const BANK_ROWS = 6;
export const ROWS = BANK_ROWS * 2;
export const COL_SPACING = 40;
export const OX = 40;
export const ROW_SPACING = 40;
export const BANK_TOP_Y = 46;
export const CHANNEL_GAP = 70;
/** Sockets are squares that fill most of each grid cell. */
export const SOCKET = 34;

export function colX(c: number) { return OX + (c - 1) * COL_SPACING; }
export function rowY(r: number) {
  if (r < BANK_ROWS) return BANK_TOP_Y + r * ROW_SPACING;
  return BANK_TOP_Y + (BANK_ROWS - 1) * ROW_SPACING + CHANNEL_GAP + (r - BANK_ROWS) * ROW_SPACING;
}
export const BOARD_W = colX(COLS) + OX;
export const BOARD_H = rowY(ROWS - 1) + BANK_TOP_Y;
export const CHANNEL_TOP = rowY(BANK_ROWS - 1) + 20;
export const CHANNEL_BOTTOM = rowY(BANK_ROWS) - 20;

export function span(p: Piece): [number, number] { return [Math.min(p.a, p.b), Math.max(p.a, p.b)]; }

/** Board-local point → nearest hole, or null when the point is clearly off the board. */
export function nearestHole(x: number, y: number, margin = 28): { col: number; row: number } | null {
  if (x < -margin || y < -margin || x > BOARD_W + margin || y > BOARD_H + margin) return null;
  const col = Math.min(COLS, Math.max(1, Math.round((x - OX) / COL_SPACING) + 1));
  let row = 0, best = Infinity;
  for (let r = 0; r < ROWS; r++) {
    const d = Math.abs(rowY(r) - y);
    if (d < best) { best = d; row = r; }
  }
  return { col, row };
}

/**
 * Builds a piece anchored at `col`, extending right (dir=1) or left (dir=-1).
 * Falls back to the other direction when it would leave the board.
 */
export function buildPiece(type: PieceType, id: string, col: number, row: number, dir = 1): Piece | null {
  const len = DEFS[type].len;
  const fits = (d: number) => col + d * len >= 1 && col + d * len <= COLS;
  const d = fits(dir) ? dir : (fits(-dir) ? -dir : 0);
  if (!d) return null;
  return { id, type, a: col, b: col + d * len, row };
}

/** Returns an error message, or null when `piece` can be placed. */
export function placementError(pieces: Piece[], piece: Piece, ignoreId: string | null = null): string | null {
  if (piece.a < 1 || piece.b < 1 || piece.a > COLS || piece.b > COLS) return 'A peça sai da bancada.';
  const others = pieces.filter(p => p.id !== ignoreId);
  const used = countByType(others)[piece.type] || 0;
  if (used >= KIT_LIMITS[piece.type]) return `O kit só tem ${KIT_LIMITS[piece.type]} × ${NOMES[piece.type]}. Todas já estão na bancada.`;
  const [lo, hi] = span(piece);
  for (const o of others) {
    if (o.row !== piece.row) continue;
    const [olo, ohi] = span(o);
    if (lo <= ohi && olo <= hi) return 'Já existe uma peça nesse lugar da linha. Use outra linha da mesma coluna.';
  }
  return null;
}

/** Same piece, legs swapped (flips polarity / direction). */
export function flip(p: Piece): Piece { return { ...p, a: p.b, b: p.a }; }

export function nextPieceId(pieces: Piece[]): string {
  let n = pieces.length + 1;
  while (pieces.some(p => p.id === 'p' + n)) n++;
  return 'p' + n;
}
