import type { DiagnoseResult, Piece } from '../model/types.ts';
import { nodeOf } from './nodes.ts';
import { analyze, BENCH_LIMIT_MA, branchCurrent, MSG } from './sim.ts';

/**
 * Plain-language read of a circuit, plus the energized path (for glow) when it is valid.
 * `pressed`: Set of held pushbutton ids, or null to treat every button as pressed.
 * `opts.allowNoResistor`: lesson 2's teaching simplification (an LED with no resistor lights at the bench ceiling).
 */
export function diagnose(
  pieces: Piece[],
  pressed: Set<string> | null = null,
  opts: { allowNoResistor?: boolean } = {}
): DiagnoseResult {
  if (pieces.length === 0) {
    return {
      code: 'vazio',
      tone: 'info',
      msg: 'Arraste a bateria da bandeja para a bancada e monte o circuito.',
      trail: null,
      mA: 0,
      load: null,
      limited: false,
      loadsLit: [],
      looseIds: [],
    };
  }
  const an = analyze(pieces, { pressed, allowNoResistor: opts.allowNoResistor });
  const branches = an.code === 'valido' ? an.branches || [{ trail: an.trail, ohms: an.ohms, load: an.load }] : [];
  let mA = 0;
  let limited = false;
  for (const b of branches) {
    const c = branchCurrent(b);
    mA = Math.max(mA, c.mA);
    limited = limited || c.limited;
  }
  let trail = null;
  const loadsLit = [...new Set(branches.map((b) => b.load).filter((l) => l != null))] as ('led' | 'buzzer')[];
  const looseIds: string[] = [];
  if (an.code === 'valido') {
    const bat = pieces.find((p) => p.type === 'bateria');
    const edgeIds = new Set<string>([bat.id]);
    const nodes = new Set<number>([nodeOf(bat.a, bat.row), nodeOf(bat.b, bat.row)]);
    for (const b of branches)
      for (const t of b.trail) {
        edgeIds.add(t.id);
        nodes.add(t.from);
        nodes.add(t.to);
      }
    trail = { edgeIds, nodes };
    for (const p of pieces) if (p.loose && edgeIds.has(p.id)) looseIds.push(p.id);
  }
  const tone = an.code === 'valido' ? 'ok' : an.code === 'sem_bateria' ? 'info' : 'erro';
  const both = loadsLit.length > 1;
  const msg =
    an.code === 'valido'
      ? both
        ? `Circuito fechado. A corrente se divide: o LED e o buzzer funcionam ao mesmo tempo (até ${mA.toFixed(1)} mA em cada ramo).`
        : an.load === 'buzzer'
          ? `Circuito fechado. O buzzer toca com ${mA.toFixed(1)} mA.`
          : `Circuito fechado. Passam ${mA.toFixed(1)} mA pelo LED.`
      : MSG[an.code] || '';
  return {
    code: an.code,
    tone,
    msg: limited ? `${msg} A bancada limita a corrente a ${BENCH_LIMIT_MA} mA.` : msg,
    trail,
    mA,
    load: an.load || null,
    limited,
    loadsLit,
    looseIds,
  };
}
