// Revision 8 discussion model: contact-board NODE connectors consolidated.
// Starts from revision 7 descriptors without mutating them.
import { boards as revision7Boards } from '../../design/revision7.mjs';

const boards = structuredClone(revision7Boards.filter((b) => ['contact-a', 'contact-b'].includes(b.id)));

for (const board of boards) {
  const oldHeaders = board.parts.filter((p) => p.origin === 'J_NODE');
  const nodeNames = [...new Set(oldHeaders.flatMap((p) => Object.values(p.signals ?? {})))].sort((a, b) =>
    Number(a.slice(4)) - Number(b.slice(4)),
  );
  if (oldHeaders.length !== 3 || nodeNames.length !== 11) {
    throw new Error(`${board.id}: expected three grouped NODE headers and eleven NODE signals`);
  }

  const connectorRef = board.id === 'contact-a' ? 'J_A_NODE_BUNDLE' : 'J_B_NODE_BUNDLE';
  const row = board.id === 'contact-a' ? 33 : 4;
  const signals = Object.fromEntries(nodeNames.map((name, i) => [String(i + 1), name]));
  const pins = Array.from({ length: 11 }, (_, i) => ({
    number: i + 1,
    label: nodeNames[i],
    hole: [29 + i, row],
  }));
  const bounds = {
    xmin: Math.min(...pins.map((p) => p.hole[0])) - 1,
    xmax: Math.max(...pins.map((p) => p.hole[0])) + 1,
    ymin: row - 1,
    ymax: row + 1,
  };
  const oldRefs = new Set(oldHeaders.map((p) => p.ref));
  const endpointMap = new Map();
  const movedEndpoints = new Set();
  for (const header of oldHeaders) {
    for (const [number, name] of Object.entries(header.signals ?? {})) {
      const target = nodeNames.indexOf(name) + 1;
      endpointMap.set(`${header.ref}.${number}`, `${connectorRef}.${target}`);
    }
  }

  const template = oldHeaders[0];
  board.parts = board.parts.filter((p) => !oldRefs.has(p.ref));
  // Keep each SMART plug beside its capsule's NODE contact group. The NODE
  // bundle remains in the separate edge area for the matrix cable.
  for (const smart of board.parts.filter((p) => p.origin === 'J_SMART')) {
    const dy = board.id === 'contact-a' ? -2 : 3;
    for (const pin of smart.pins) {
      pin.hole = [pin.hole[0], pin.hole[1] + dy];
      movedEndpoints.add(`${smart.ref}.${pin.number}`);
    }
    smart.bounds = { ...smart.bounds, ymin: smart.bounds.ymin + dy, ymax: smart.bounds.ymax + dy };
  }
  board.parts.push({
    ...template,
    ref: connectorRef,
    sourceRef: connectorRef,
    label: '11-pin NODE connector → router/matrix',
    function: 'Consolidated NODE cable to router/matrix',
    origin: 'J_NODE_BUNDLE',
    sourceBoard: board.id,
    pins,
    signals,
    bounds,
    phase: Math.min(...oldHeaders.map((p) => p.phase)),
    provisional: true,
    body: 'header',
    mpn: 'unverified 1x11 connector',
  });

  for (const net of board.nets) {
    net.pins = net.pins.map((endpoint) => endpointMap.get(endpoint) ?? endpoint);
  }
  for (const wire of board.wires) {
    const oldFrom = wire.from;
    const oldTo = wire.to;
    wire.from = endpointMap.get(oldFrom) ?? oldFrom;
    wire.to = endpointMap.get(oldTo) ?? oldTo;
    if (wire.from !== oldFrom || wire.to !== oldTo || movedEndpoints.has(wire.from) || movedEndpoints.has(wire.to)) {
      const hole = (endpoint) => {
        const [ref, pinNumber] = endpoint.split('.');
        return board.parts.find((p) => p.ref === ref).pins.find((p) => p.number === Number(pinNumber)).hole;
      };
      const a = hole(wire.from);
      const b = hole(wire.to);
      const bend = [a[0], b[1]];
      wire.path = [a, ...(bend[0] === a[0] && bend[1] === a[1] ? [] : [bend]), ...(b[0] === bend[0] && b[1] === bend[1] ? [] : [b])];
    }
  }

  // Use the six requested wire colors to make NODE tracks easier to follow
  // in the underside view. Pins 1–11 repeat the six-color sequence; service
  // rails keep their familiar red/black/white/blue colors.
  const wirePalette = ['#e53935', '#202124', '#1976d2', '#ffffff', '#fbc02d', '#388e3c'];
  const bundlePinForNet = new Map(pins.map((pin) => [pin.label, pin.number]));
  for (const wire of board.wires) {
    if (bundlePinForNet.has(wire.net)) {
      wire.color = wirePalette[(bundlePinForNet.get(wire.net) - 1) % wirePalette.length];
    } else if (wire.net === 'GND') wire.color = '#202124';
    else if (wire.net === '3V3_SYS') wire.color = '#e53935';
    else if (wire.net.startsWith('SCL_')) wire.color = '#1976d2';
    else if (wire.net.startsWith('SDA_')) wire.color = '#ffffff';
  }

  // Tag the five logical pin-to-pin links in each node's six-contact chain as one
  // physical continuous soldered conductor for visual wire-run counting.
  for (const net of board.nets.filter((n) => /^NODE\d+$/.test(n.name))) {
    const pogoEndpoints = net.pins.filter((ep) => {
      const [ref] = ep.split('.');
      return board.parts.find((p) => p.ref === ref)?.body === 'pogo';
    });
    if (pogoEndpoints.length !== 6) throw new Error(`${board.id}/${net.name}: expected six pogo contacts`);
    const runId = `${net.name}-contact-bus`;
    board.wires.filter((w) => w.net === net.name && pogoEndpoints.includes(w.from) && pogoEndpoints.includes(w.to))
      .forEach((w) => { w.physicalRunId = runId; });
  }
  board.notes = [...board.notes, 'Revision 8 preview: one 11-position NODE connector per contact board, pins numbered 1–11; physical fit and cable pinout are unverified.'];
}

export { boards };
