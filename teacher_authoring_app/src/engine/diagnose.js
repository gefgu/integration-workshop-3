import { analyze, corrente, MSG } from './sim.js';

/** Plain-language read of a circuit, plus the energized path (for glow) when it is valid. */
export function diagnose(pieces) {
  if (pieces.length === 0) {
    return { code: 'vazio', tone: 'info', msg: 'Arraste a bateria da bandeja para a bancada e monte o circuito.', trail: null, mA: 0 };
  }
  const an = analyze(pieces);
  const mA = corrente(an);
  let trail = null;
  if (an.code === 'valido') {
    const bat = pieces.find(p => p.type === 'bateria');
    const edgeIds = new Set([bat.id, ...an.trail.map(t => t.id)]);
    const nodes = new Set([bat.a, bat.b]);
    an.trail.forEach(t => { nodes.add(t.from); nodes.add(t.to); });
    trail = { edgeIds, nodes };
  }
  const tone = an.code === 'valido' ? 'ok' : (an.code === 'sem_bateria' ? 'info' : 'erro');
  const msg = an.code === 'valido' ? `Circuito fechado. Passam ${mA.toFixed(1)} mA pelo LED.` : (MSG[an.code] || '');
  return { code: an.code, tone, msg, trail, mA };
}
