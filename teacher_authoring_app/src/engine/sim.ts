/**
 * Circuit model copied from prototipo_design (guided/engine.js).
 *
 * The board is a graph: every column (1..11) is one electrical node and every
 * placed piece is an edge between two columns. `a`/`b` are those columns.
 */
/** Capsule colors from MFR10.1–10.6. */
export const CAPSULE = {
  vermelho: { bg: '#d23a30', ink: '#ffffff' },
  verde: { bg: '#3f9b4f', ink: '#ffffff' },
  azul: { bg: '#2f66c9', ink: '#ffffff' },
  amarelo: { bg: '#e8b923', ink: '#2e2b25' },
  branco: { bg: '#f6f2ea', ink: '#2e2b25' },
  preto: { bg: '#22201f', ink: '#f5ead8' },
};

/**
 * `cor` = capsule color class; `dots` = 1–4 black dots printed on top (MFR11). Only the
 * blue pair (resistors, capacitor) carries dots; LED/buzzer/botão/potenciômetro have none.
 */
export const DEFS = {
  bateria: { len: 1, cor: 'vermelho', text: '5 V', pinA: '+', pinB: '−' },
  led: { len: 1, cor: 'verde', text: '▶', pinA: 'A', pinB: 'K' },
  buzzer: { len: 1, cor: 'verde', text: '♪' },
  resistor_220: { len: 1, cor: 'azul', dots: 1, text: '220 Ω' },
  resistor_470: { len: 1, cor: 'azul', dots: 1, text: '470 Ω' },
  resistor_1k: { len: 1, cor: 'azul', dots: 1, text: '1 kΩ' },
  capacitor: { len: 1, cor: 'azul', dots: 2, text: '1000 µF' },
  botao: { len: 1, cor: 'amarelo', text: '●' },
  potenciometro: { len: 1, cor: 'amarelo', text: '' },
  jumper_curto: { len: 1, cor: 'branco', text: '' },
  jumper_longo: { len: 2, cor: 'branco', text: '' },
};

export const NOMES = {
  bateria: 'Bateria 5 V',
  led: 'LED',
  buzzer: 'Buzzer',
  resistor_220: 'Resistor 220 Ω',
  resistor_470: 'Resistor 470 Ω',
  resistor_1k: 'Resistor 1 kΩ',
  capacitor: 'Capacitor 1000 µF',
  botao: 'Botão',
  potenciometro: 'Potenciômetro',
  jumper_curto: 'Jumper curto',
  jumper_longo: 'Jumper longo',
};

export const TYPES = Object.keys(DEFS) as PieceType[];

/** Resistance of the fixed resistors; series resistors add up. */
export const RESISTOR_OHMS = { resistor_220: 220, resistor_470: 470, resistor_1k: 1000 };

/** Potentiometer wiper settings (Ω), stepped with −/+ on the piece. */
export const POT_VALUES = [100, 220, 470, 1000, 2200, 4700, 10000];
export const POT_DEFAULT = 1000;

export function pieceOhms(p: Piece): number {
  if (p.type === 'potenciometro') return p.value || POT_DEFAULT;
  return RESISTOR_OHMS[p.type] || 0;
}

export function formatOhms(ohms: number) {
  return ohms >= 1000 ? `${(ohms / 1000).toString().replace('.', ',')} kΩ` : `${ohms} Ω`;
}

/** Pieces in the physical kit (requirement MFR8): the most that can be on the board at once. */
export const KIT_LIMITS = {
  bateria: 1,
  led: 2,
  buzzer: 1,
  resistor_220: 1,
  resistor_470: 1,
  resistor_1k: 1,
  capacitor: 2,
  botao: 2,
  potenciometro: 1,
  jumper_curto: 6,
  jumper_longo: 3,
};

export function countByType(pieces: Piece[]): Partial<Record<PieceType, number>> {
  const n: Partial<Record<PieceType, number>> = {};
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
  sem_led: 'O caminho fecha sem passar por um LED ou buzzer. Leve a corrente por uma carga.',
  capacitor: 'O capacitor bloqueia a corrente contínua: depois de carregar, nada passa. Tire-o do caminho.',
  botao_aberto: 'O botão está solto, então o caminho está aberto. Segure o botão para fechar o circuito.',
  valido: 'Circuito fechado.',
};

/**
 * `opts.pressed`: Set of pushbutton ids being held. null/undefined = every button
 * counts as pressed (used when judging the design in the editor).
 */
export function analyze(pieces: Piece[], opts: { pressed?: Set<string> | null } = {}): CircuitAnalysis {
  const bat = pieces.find((p) => p.type === 'bateria');
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i],
        b = pieces[j];
      if ((a.a === b.a && a.b === b.b) || (a.a === b.b && a.b === b.a)) return { code: 'par_duplicado', trail: null };
    }
  }
  if (!bat) return { code: 'sem_bateria', trail: null };

  const pressed = opts.pressed;
  const isOpenButton = (p) => p.type === 'botao' && pressed && !pressed.has(p.id);
  const base = pieces.filter((p) => p.type !== 'bateria');

  function findTrails(edges) {
    const trails = [];
    const trail = [];
    const visited = new Set([bat.a]);
    const walk = (node) => {
      if (node === bat.b) {
        trails.push(trail.slice());
        return;
      }
      for (const e of edges) {
        if (trail.some((t) => t.id === e.id)) continue;
        let other = null,
          fwd = false;
        if (e.a === node) {
          other = e.b;
          fwd = true;
        } else if (e.b === node) {
          other = e.a;
          fwd = false;
        } else continue;
        if (visited.has(other) && other !== bat.b) continue;
        visited.add(other);
        trail.push({ id: e.id, type: e.type, from: node, to: other, forward: fwd, ohms: pieceOhms(e) });
        walk(other);
        trail.pop();
        visited.delete(other);
      }
    };
    if (bat.a !== bat.b) walk(bat.a);
    return trails;
  }

  // Capacitors block DC and released buttons are open: neither carries current.
  const conducting = base.filter((p) => p.type !== 'capacitor' && !isOpenButton(p));
  const trails = findTrails(conducting);

  const rank = ['curto', 'valido', 'sem_resistor', 'led_invertido', 'sem_led'];
  let best = null;
  for (const t of trails) {
    const led = t.find((x) => x.type === 'led');
    const buzzer = t.some((x) => x.type === 'buzzer');
    const ohms = t.reduce((sum, x) => sum + x.ohms, 0);
    let code: string;
    let load: 'led' | 'buzzer' | null = null;
    if (led) {
      load = 'led';
      code = !led.forward ? 'led_invertido' : ohms > 0 ? 'valido' : 'sem_resistor';
    } else if (buzzer) {
      load = 'buzzer';
      code = 'valido';
    } else {
      code = ohms > 0 ? 'sem_led' : 'curto';
    }
    if (!best || rank.indexOf(code) < rank.indexOf(best.code)) best = { code, trail: t, ohms, load };
  }
  if (best) return best;

  // No conducting path: explain *why* when a capacitor or a released button is the cause.
  if (base.some((p) => p.type === 'botao') && pressed) {
    const withButtons = base.filter((p) => p.type !== 'capacitor');
    if (findTrails(withButtons).length) return { code: 'botao_aberto', trail: null };
  }
  if (base.some((p) => p.type === 'capacitor') && findTrails(base.filter((p) => !isOpenButton(p))).length) {
    return { code: 'capacitor', trail: null };
  }
  const reach1 = reach(pieces, bat.a, []);
  const reach2 = reach(pieces, bat.b, []);
  const iso = pieces.some(
    (p) => p.type !== 'bateria' && !reach1.has(p.a) && !reach1.has(p.b) && !reach2.has(p.a) && !reach2.has(p.b)
  );
  return { code: iso ? 'peca_isolada' : 'aberto', trail: null };
}

export function reach(pieces: Piece[], start: number, excludeIds: string[]): Set<number> {
  const seen = new Set([start]);
  const q = [start];
  const edges = pieces.filter((p) => p.type !== 'bateria' && excludeIds.indexOf(p.id) < 0);
  while (q.length) {
    const n = q.shift();
    for (const e of edges) {
      const o = e.a === n ? e.b : e.b === n ? e.a : null;
      if (o != null && !seen.has(o)) {
        seen.add(o);
        q.push(o);
      }
    }
  }
  return seen;
}

/** Current (mA) through the load for an `analyze` result: 5 V source, ~2 V LED drop, buzzer ≈ 250 Ω. */
export function corrente(an: CircuitAnalysis): number {
  if (an.code !== 'valido') return 0;
  return an.load === 'buzzer' ? (5 / (an.ohms + 250)) * 1000 : ((5 - 2.0) / an.ohms) * 1000;
}

import type { CircuitAnalysis, Piece, PieceType } from '../model/types.ts';
