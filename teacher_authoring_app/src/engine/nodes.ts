/**
 * Electrical nodes and capsule slots of the connection board (PCB v0.4).
 * A column is one node *within its bank*: the two banks (rows 0–5 and 6–11) are separate nodes.
 */
export const BANK_SIZE = 6;
export const LAST_ROW = BANK_SIZE * 2 - 1;
const BANK_NODE = 100;

export const bankOf = (row: number) => (row >= BANK_SIZE ? 1 : 0);
export const nodeOf = (col: number, row: number) => col + BANK_NODE * bankOf(row);
export const nodeCol = (node: number) => node % BANK_NODE;
export const nodeBank = (node: number) => Math.floor(node / BANK_NODE);

/**
 * Smart capsules sit on six fixed slots: P1/P2/P3 on columns 1–3, 5–7 or 9–11 of the first row of
 * bank A (row 0) or the last row of bank B (row 11). Slots are numbered 1–6 like the PCB positions.
 */
export const SLOT_COLS = [1, 5, 9];
export const SLOT_ROWS = [0, LAST_ROW];
/** The INA219 and shunt are only wired to slot 2 (bank A, columns 5–7). */
export const AMMETER_SLOT = 2;

export function slotOf(p: { a: number; row: number }): number | null {
  const c = SLOT_COLS.indexOf(p.a);
  const r = SLOT_ROWS.indexOf(p.row);
  return c < 0 || r < 0 ? null : r * SLOT_COLS.length + c + 1;
}

/** Slot number → where its P1 sits. */
export function slotAnchor(slot: number): { a: number; row: number } {
  const i = slot - 1;
  return { a: SLOT_COLS[i % SLOT_COLS.length], row: SLOT_ROWS[Math.floor(i / SLOT_COLS.length)] };
}

/** The slot closest to a board hole, within its own bank. */
export function nearestSlot(col: number, row: number): number {
  const rowIdx = bankOf(row);
  let best = 0;
  for (let i = 0; i < SLOT_COLS.length; i++) {
    if (Math.abs(SLOT_COLS[i] + 1 - col) < Math.abs(SLOT_COLS[best] + 1 - col)) best = i;
  }
  return rowIdx * SLOT_COLS.length + best + 1;
}
