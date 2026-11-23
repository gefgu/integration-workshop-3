/** Deterministic ideal DC solve for the potentiometer's loaded three-terminal network.
 * Resistors are linear, jumpers are ideal wires and forward LEDs have a 2 V drop.
 * This is an educational model, not measured hardware or a protection guarantee.
 */
export interface DcElement {
  key: string;
  a: number;
  b: number;
  ohms?: number;
  led?: boolean;
}
export interface DcSolution {
  volts: Map<number, number>;
  currents: Map<string, number>;
}

function linear(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const scale = m[col][col];
    for (let j = col; j <= n; j++) m[col][j] /= scale;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let j = col; j <= n; j++) m[row][j] -= factor * m[col][j];
    }
  }
  return m.map((row) => row[n]);
}

export function solveDc(elements: DcElement[], source: { a: number; b: number; volts: number }): DcSolution | null {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    if (!parent.has(x)) parent.set(x, x);
    const p = parent.get(x) as number;
    if (p !== x) parent.set(x, find(p));
    return parent.get(x) as number;
  };
  for (const e of elements) if (!e.led && e.ohms === 0) parent.set(find(e.a), find(e.b));
  const plus = find(source.a),
    minus = find(source.b);
  if (plus === minus) return null;
  const edges = elements.map((e) => ({ ...e, a: find(e.a), b: find(e.b) }));
  const resistors = edges.filter((e) => !e.led && (e.ohms ?? 0) > 0);
  const leds = edges.filter((e) => e.led);
  if (leds.length > 8) return null;
  // Enumerate the small kit's diode states rather than using timing-sensitive iterations.
  for (let state = 0; state < 2 ** leds.length; state++) {
    const active = leds.filter((_, i) => state & (1 << i));
    const reachable = new Set([plus, minus]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of [...resistors, ...active]) {
        if (!reachable.has(e.a) && !reachable.has(e.b)) continue;
        for (const node of [e.a, e.b])
          if (!reachable.has(node)) {
            reachable.add(node);
            changed = true;
          }
      }
    }
    const nodes = [...reachable].filter((n) => n !== plus && n !== minus).sort((a, b) => a - b);
    const index = new Map(nodes.map((n, i) => [n, i]));
    const sources = active.filter((e) => reachable.has(e.a));
    const size = nodes.length + sources.length;
    const matrix = Array.from({ length: size }, () => Array(size).fill(0));
    const rhs = Array(size).fill(0);
    const fixed = (n: number) => (n === plus ? source.volts : 0);
    for (const e of resistors) {
      if (!reachable.has(e.a)) continue;
      const conductance = 1 / (e.ohms as number);
      for (const [node, other] of [
        [e.a, e.b],
        [e.b, e.a],
      ]) {
        const i = index.get(node);
        if (i == null) continue;
        matrix[i][i] += conductance;
        const j = index.get(other);
        if (j == null) rhs[i] += conductance * fixed(other);
        else matrix[i][j] -= conductance;
      }
    }
    for (const [k, e] of sources.entries()) {
      const row = nodes.length + k;
      rhs[row] = 2;
      for (const [node, sign] of [
        [e.a, 1],
        [e.b, -1],
      ]) {
        const i = index.get(node);
        if (i == null) rhs[row] -= sign * fixed(node);
        else {
          matrix[i][row] += sign;
          matrix[row][i] += sign;
        }
      }
    }
    const answer = linear(matrix, rhs);
    if (!answer || answer.some((n) => !Number.isFinite(n))) continue;
    const byNet = new Map<number, number>([
      [plus, source.volts],
      [minus, 0],
      ...nodes.map((n, i) => [n, answer[i]] as [number, number]),
    ]);
    const currents = new Map<string, number>();
    let valid = true;
    for (const [i, led] of leds.entries()) {
      const activeIndex = sources.findIndex((e) => e.key === led.key);
      const current = activeIndex < 0 ? 0 : answer[nodes.length + activeIndex];
      currents.set(led.key, Math.max(0, current));
      if (state & (1 << i)) {
        if (current < -1e-9) valid = false;
      } else if (
        byNet.has(led.a) &&
        byNet.has(led.b) &&
        (byNet.get(led.a) as number) - (byNet.get(led.b) as number) > 2 + 1e-8
      )
        valid = false;
    }
    if (!valid) continue;
    for (const e of resistors)
      if (byNet.has(e.a) && byNet.has(e.b))
        currents.set(e.key, ((byNet.get(e.a) as number) - (byNet.get(e.b) as number)) / (e.ohms as number));
    const volts = new Map<number, number>();
    for (const node of new Set([source.a, source.b, ...elements.flatMap((e) => [e.a, e.b])])) {
      const value = byNet.get(find(node));
      if (value != null) volts.set(node, value);
    }
    return { volts, currents };
  }
  return null;
}
