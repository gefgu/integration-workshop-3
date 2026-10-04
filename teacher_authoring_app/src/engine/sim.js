/**
 * Circuit model copied from prototipo_design (guided/engine.js).
 *
 * The board is a graph: every column (1..11) is one electrical node and every
 * placed piece is an edge between two columns. `a`/`b` are those columns.
 */
export const DEFS = {
  bateria: { len: 1, color: '#22201f', text: '5 V', ink: '#f5ead8', pinA: '+', pinB: '−' },
  led: { len: 1, color: '#e0453a', text: '▶', ink: '#ffffff', pinA: 'A', pinB: 'K' },
  resistor_220: { len: 1, color: '#2f66c9', text: '220 Ω', ink: '#ffffff' },
  resistor_470: { len: 1, color: '#2f66c9', text: '470 Ω', ink: '#ffffff' },
  resistor_1k: { len: 1, color: '#2f66c9', text: '1 kΩ', ink: '#ffffff' },
  jumper_curto: { len: 1, color: '#8b9096', text: '', ink: '#fff' },
  jumper_longo: { len: 2, color: '#8b9096', text: '', ink: '#fff' }
};

export const NOMES = {
  bateria: 'Bateria 5 V', led: 'LED vermelho', resistor_220: 'Resistor 220 Ω', resistor_470: 'Resistor 470 Ω', resistor_1k: 'Resistor 1 kΩ',
  jumper_curto: 'Jumper curto', jumper_longo: 'Jumper longo'
};

export const TYPES = Object.keys(DEFS);

/** Resistance of each resistor piece; series resistors add up. */
export const RESISTOR_OHMS = { resistor_220: 220, resistor_470: 470, resistor_1k: 1000 };

/** Pieces in the physical kit (requirement MFR8): the most that can be on the board at once. */
export const KIT_LIMITS = { bateria: 1, led: 2, resistor_220: 1, resistor_470: 1, resistor_1k: 1, jumper_curto: 6, jumper_longo: 3 };

export function countByType(pieces) {
  const n = {};
  for (const p of pieces) n[p.type] = (n[p.type] || 0) + 1;
  return n;
}
/** Pieces whose a→b direction matters (polarity). */
export const DIRECTED = new Set(['bateria', 'led']);

export const MSG = {
  sem_bateria: 'O circuito não tem fonte de energia. Pegue a bateria na bandeja.',
  led_invertido: 'O LED só funciona em um sentido. Gire a peça e tente de novo.',
  falta_resistor: 'Sem resistor, nada limita a corrente pelo LED. Ele queimaria. Coloque um resistor antes do LED.',
  aberto: 'Falta um pedaço do caminho. Siga do + até o − da bateria com o dedo e veja onde ele para.',
  curto: 'Você ligou os dois polos da bateria direto um no outro. Isso é um curto. Coloque os componentes no caminho.',
  peca_isolada: 'Esta peça não está ligada ao resto do circuito. Confira se os dois pinos estão em colunas certas.',
  par_duplicado: 'Há duas peças ligando as mesmas colunas. Tire uma delas.',
  sem_led: 'O caminho fecha sem passar pelo LED. Leve a corrente pelo LED.',
  valido: 'Circuito fechado.'
};

export function analyze(pieces) {
  const bat = pieces.find(p => p.type === 'bateria');
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i], b = pieces[j];
      if ((a.a === b.a && a.b === b.b) || (a.a === b.b && a.b === b.a)) return { code: 'par_duplicado', trail: null };
    }
  }
  if (!bat) return { code: 'sem_bateria', trail: null };
  const edges = pieces.filter(p => p.type !== 'bateria');
  const trails = [];
  const trail = [];
  const visited = new Set([bat.a]);
  const walk = (node) => {
    if (node === bat.b) { trails.push(trail.slice()); return; }
    for (const e of edges) {
      if (trail.some(t => t.id === e.id)) continue;
      let other = null, fwd = false;
      if (e.a === node) { other = e.b; fwd = true; }
      else if (e.b === node) { other = e.a; fwd = false; }
      else continue;
      if (visited.has(other) && other !== bat.b) continue;
      visited.add(other);
      trail.push({ id: e.id, type: e.type, from: node, to: other, forward: fwd });
      walk(other);
      trail.pop(); visited.delete(other);
    }
  };
  if (bat.a !== bat.b) walk(bat.a);
  const rank = ['curto', 'valido', 'sem_resistor', 'led_invertido', 'sem_led'];
  let best = null;
  for (const t of trails) {
    const led = t.find(x => x.type === 'led');
    const ohms = t.reduce((sum, x) => sum + (RESISTOR_OHMS[x.type] || 0), 0);
    const hasR = ohms > 0;
    let code;
    if (!led) code = hasR ? 'sem_led' : 'curto';
    else if (!led.forward) code = 'led_invertido';
    else code = hasR ? 'valido' : 'sem_resistor';
    if (!best || rank.indexOf(code) < rank.indexOf(best.code)) best = { code, trail: t, ohms };
  }
  if (best) return best;
  const reach1 = reach(pieces, bat.a, []);
  const reach2 = reach(pieces, bat.b, []);
  const iso = pieces.some(p => p.type !== 'bateria' && !reach1.has(p.a) && !reach1.has(p.b) && !reach2.has(p.a) && !reach2.has(p.b));
  return { code: iso ? 'peca_isolada' : 'aberto', trail: null };
}

export function reach(pieces, start, excludeIds) {
  const seen = new Set([start]);
  const q = [start];
  const edges = pieces.filter(p => p.type !== 'bateria' && excludeIds.indexOf(p.id) < 0);
  while (q.length) {
    const n = q.shift();
    for (const e of edges) {
      const o = e.a === n ? e.b : (e.b === n ? e.a : null);
      if (o != null && !seen.has(o)) { seen.add(o); q.push(o); }
    }
  }
  return seen;
}

/** Current through the LED (mA) for an `analyze` result (5 V source, ~2 V LED drop). */
export function corrente(an) { return an.code === 'valido' ? (5 - 2.0) / an.ohms * 1000 : 0; }
