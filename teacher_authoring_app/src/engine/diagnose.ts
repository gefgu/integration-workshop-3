import { analyze, corrente, MSG } from './sim.ts';

/**
 * Plain-language read of a circuit, plus the energized path (for glow) when it is valid.
 * `pressed`: Set of held pushbutton ids, or null to treat every button as pressed.
 */
export function diagnose(pieces, pressed = null) {
  if (pieces.length === 0) {
    return {
      code: 'vazio',
      tone: 'info',
      msg: 'Arraste a bateria da bandeja para a bancada e monte o circuito.',
      trail: null,
      mA: 0,
      load: null,
    };
  }
  const an = analyze(pieces, { pressed });
  const mA = corrente(an);
  let trail = null;
  if (an.code === 'valido') {
    const bat = pieces.find((p) => p.type === 'bateria');
    const edgeIds = new Set([bat.id, ...an.trail.map((t) => t.id)]);
    const nodes = new Set([bat.a, bat.b]);
    an.trail.forEach((t) => {
      nodes.add(t.from);
      nodes.add(t.to);
    });
    trail = { edgeIds, nodes };
  }
  const tone = an.code === 'valido' ? 'ok' : an.code === 'sem_bateria' ? 'info' : 'erro';
  const msg =
    an.code === 'valido'
      ? an.load === 'buzzer'
        ? `Circuito fechado. O buzzer toca com ${mA.toFixed(1)} mA.`
        : `Circuito fechado. Passam ${mA.toFixed(1)} mA pelo LED.`
      : MSG[an.code] || '';
  return { code: an.code, tone, msg, trail, mA, load: an.load || null };
}
