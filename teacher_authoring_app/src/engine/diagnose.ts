import type { DiagnoseResult, FlowStep, Piece } from '../model/types.ts';
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
  const currents: Partial<Record<'led' | 'buzzer', number>> = {};
  for (const b of branches) {
    const c = branchCurrent(b);
    mA = Math.max(mA, c.mA);
    limited = limited || c.limited;
    if (b.load) currents[b.load] = (currents[b.load] ?? 0) + c.mA;
    if (b.load === 'led' && b.trail.some((edge) => edge.type === 'buzzer'))
      currents.buzzer = (currents.buzzer ?? 0) + c.mA;
  }
  let trail = null;
  const loadsLit = [...new Set(branches.flatMap((b) => [b.load, ...(b.load === 'led' && b.trail.some((edge) => edge.type === 'buzzer') ? ['buzzer'] : [])]).filter((l) => l != null))] as ('led' | 'buzzer')[];
  const looseIds: string[] = [];
  if (an.code === 'valido') {
    const bat = pieces.find((p) => p.type === 'bateria');
    const edgeIds = new Set<string>([bat.id]);
    const nodes = new Set<number>([nodeOf(bat.a, bat.row), nodeOf(bat.b, bat.row)]);
    // Inside the battery the current goes from − (b) back to + (a); outside it follows each branch.
    const flow: FlowStep[] = [{ id: bat.id, from: nodeOf(bat.b, bat.row), to: nodeOf(bat.a, bat.row) }];
    for (const b of branches)
      for (const t of b.trail) {
        edgeIds.add(t.id);
        nodes.add(t.from);
        nodes.add(t.to);
        if (!flow.some((f) => f.id === t.id && f.from === t.from && f.to === t.to))
          flow.push({ id: t.id, from: t.from, to: t.to });
      }
    trail = { edgeIds, nodes, flow };
    for (const p of pieces) if (p.loose && edgeIds.has(p.id)) looseIds.push(p.id);
  }
  const tone = an.code === 'valido' ? 'ok' : an.code === 'sem_bateria' ? 'info' : 'erro';
  const both = loadsLit.length > 1;
  const sharedBranch = branches.some((b) => b.trail.some((edge) => edge.type === 'led') && b.trail.some((edge) => edge.type === 'buzzer'));
  const msg =
    an.code === 'valido'
      ? both
        ? sharedBranch
          ? `Circuito fechado. A mesma corrente passa pelo LED e pelo buzzer: ${mA.toFixed(1)} mA.`
          : `Circuito fechado. LED: ${currents.led.toFixed(1)} mA; buzzer: ${currents.buzzer.toFixed(1)} mA. A corrente se divide entre os ramos.`
        : an.load === 'buzzer'
          ? `Circuito fechado. O buzzer toca com ${mA.toFixed(1)} mA.`
          : `Circuito fechado. Passam ${mA.toFixed(1)} mA pelo LED.`
      : MSG[an.code] || '';
  return {
    code: an.code,
    tone,
    msg: limited ? `${msg} O modelo simulado limita a corrente a ${BENCH_LIMIT_MA} mA.` : msg,
    currents,
    trail,
    mA,
    load: an.load || null,
    limited,
    loadsLit,
    looseIds,
  };
}
