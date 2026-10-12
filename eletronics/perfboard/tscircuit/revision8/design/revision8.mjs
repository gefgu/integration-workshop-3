// Revision 8 discussion model: compact, grouped contact-board NODE connectors.
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

  const boardPrefix = board.id === 'contact-a' ? 'J_A' : 'J_B';
  // Group each four adjacent NODE signals at the bottom, below its contact
  // columns. The third 4-pin plug uses only three pins.
  const row = board.id === 'contact-a' ? 35 : 33;
  const groupStarts = [13, 41, 65];
  const connectorBySignal = new Map();
  const oldRefs = new Set(oldHeaders.map((p) => p.ref));
  const endpointMap = new Map();
  const movedEndpoints = new Set();
  const template = oldHeaders[0];
  board.parts = board.parts.filter((p) => !oldRefs.has(p.ref));
  for (let group = 0; group < 3; group++) {
    const groupNames = nodeNames.slice(group * 4, group * 4 + 4);
    const connectorRef = `${boardPrefix}_NODE_BUNDLE_${group + 1}`;
    const pins = Array.from({ length: 4 }, (_, i) => ({
      number: i + 1,
      label: groupNames[i] ?? `NC${i + 1}`,
      hole: [groupStarts[group] + i, row],
    }));
    const signals = Object.fromEntries(groupNames.map((name, i) => [String(i + 1), name]));
    for (let i = 0; i < groupNames.length; i++) connectorBySignal.set(groupNames[i], { connectorRef, number: i + 1 });
    const part = {
      ...template,
      ref: connectorRef,
      sourceRef: connectorRef,
      label: `4-pin NODE connector → router/matrix (group ${group + 1})`,
      function: `NODE cable group ${group + 1} to router/matrix`,
      origin: 'J_NODE_BUNDLE',
      sourceBoard: board.id,
      pins,
      signals,
      bounds: { xmin: groupStarts[group] - 1, xmax: groupStarts[group] + 4, ymin: row - 1, ymax: row + 1 },
      phase: oldHeaders[group].phase,
      provisional: true,
      body: 'header',
      mpn: 'unverified 1x4 connector',
    };
    board.parts.push(part);
  }
  for (const header of oldHeaders) {
    for (const [number, name] of Object.entries(header.signals ?? {})) {
      const target = connectorBySignal.get(name);
      if (target) endpointMap.set(`${header.ref}.${number}`, `${target.connectorRef}.${target.number}`);
    }
  }
  // Replace each oversized 2x5 SMART plug with a compact 1x5 signal connector.
  // GND and 3V3 move to one shared two-pin power connector per board; its
  // off-board harness branches to the three smart components.
  const smartStarts = [9, 37, 65];
  const powerRef = `${boardPrefix}_SMART_POWER`;
  const powerRow = 2;
  const powerX = 34;
  const powerPart = {
    ...template,
    ref: powerRef,
    sourceRef: powerRef,
    label: 'Shared smart power → GND / 3V3 fanout',
    function: 'Shared power input for the three smart components',
    origin: 'J_SMART_POWER',
    sourceBoard: board.id,
    pins: [
      { number: 1, label: 'GND', hole: [powerX, powerRow] },
      { number: 2, label: '3V3', hole: [powerX + 1, powerRow] },
    ],
    signals: { 1: 'GND', 2: '3V3_SYS' },
    bounds: { xmin: powerX - 0.5, xmax: powerX + 1.5, ymin: powerRow - 0.5, ymax: powerRow + 0.5 },
    phase: Math.min(...board.parts.filter((p) => p.origin === 'J_SERVICE').map((p) => p.phase)),
    provisional: true,
    body: 'header',
    mpn: 'unverified 1x2 connector',
  };
  board.parts.push(powerPart);
  for (const [index, smart] of board.parts.filter((p) => p.origin === 'J_SMART').entries()) {
    const oldSignals = { ...smart.signals };
    const nodeSignals = Object.entries(oldSignals)
      .filter(([, signal]) => String(signal).startsWith('NODE'))
      .sort((a, b) => Number(String(a[1]).slice(4)) - Number(String(b[1]).slice(4)));
    if (nodeSignals.length !== 3) throw new Error(`${board.id}/${smart.ref}: expected three NODE pins`);
    const targetNodePins = [1, 3, 5];
    const newSignals = new Map();
    const targetForSignal = new Map();
    nodeSignals.forEach(([, signal], i) => targetForSignal.set(String(signal), targetNodePins[i]));
    for (const [number, signalValue] of Object.entries(oldSignals)) {
      const signal = String(signalValue);
      let target;
      if (targetForSignal.has(signal)) target = targetForSignal.get(signal);
      else if (signal.startsWith('SDA_')) target = 4;
      else if (signal.startsWith('SCL_')) target = 2;
      else if (signal === '3V3_SYS') {
        endpointMap.set(`${smart.ref}.${number}`, `${powerRef}.2`);
        continue;
      } else if (signal === 'GND') {
        endpointMap.set(`${smart.ref}.${number}`, `${powerRef}.1`);
        continue;
      } else throw new Error(`${board.id}/${smart.ref}: no pin assignment for ${signal}`);
      newSignals.set(target, signal);
      if (target !== Number(number)) endpointMap.set(`${smart.ref}.${number}`, `${smart.ref}.${target}`);
    }
    smart.signals = Object.fromEntries([...newSignals].sort(([a], [b]) => a - b).map(([number, signal]) => [String(number), signal]));
    smart.pins = Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      label: newSignals.get(i + 1),
      hole: [smartStarts[index] + i, 7],
    }));
    smart.bounds = { xmin: smartStarts[index] - 0.5, xmax: smartStarts[index] + 4.5, ymin: 6.5, ymax: 7.5 };
    for (const pin of smart.pins) movedEndpoints.add(`${smart.ref}.${pin.number}`);
  }
  for (const net of board.nets) {
    net.pins = [...new Set(net.pins.map((endpoint) => endpointMap.get(endpoint) ?? endpoint))];
  }
  board.wires = board.wires.filter((wire) => {
    const from = endpointMap.get(wire.from) ?? wire.from;
    const to = endpointMap.get(wire.to) ?? wire.to;
    if ((wire.net === 'GND' || wire.net === '3V3_SYS') &&
        (wire.from.includes('_SMART.') || wire.to.includes('_SMART.'))) return false;
    // The former repeated SMART power pins collapse onto the shared power
    // header; discard those duplicate connector-to-connector wire segments.
    return from !== to;
  });
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

  // Feed the existing shared service rails at the earliest-installed service connector.
  // The smart-component power fanout itself is an off-board harness branch.
  const service = board.parts.find((part) => part.ref === `${boardPrefix}1_SERVICE`);
  if (!service) throw new Error(`${board.id}: missing first service connector for shared power feed`);
  for (const [signal, powerPin, servicePin] of [['GND', 1, 3], ['3V3_SYS', 2, 4]]) {
    const a = powerPart.pins[powerPin - 1].hole;
    const b = service.pins.find((pin) => pin.number === servicePin).hole;
    board.wires.push({
      id: `W_SMART_POWER_${signal}`,
      uid: `wire:${signal}:${powerRef}.${powerPin}~${service.ref}.${servicePin}`,
      net: signal,
      from: `${powerRef}.${powerPin}`,
      to: `${service.ref}.${servicePin}`,
      path: [a, b], color: signal === 'GND' ? '#202124' : '#e53935',
      side: 'bottom', insulated: true, bar: false, phase: Math.max(powerPart.phase, service.phase),
    });
  }

  // Feed every service-contact 3V3 pad from the shared power connector. This
  // makes the connector the fanout point instead of daisy-chaining the rail
  // through the service contacts.
  const serviceConnectors = board.parts
    .filter((part) => part.origin === 'J_SERVICE')
    .sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
  const service3v3Endpoints = new Set(serviceConnectors.map((part) => `${part.ref}.4`));
  board.wires = board.wires.filter((wire) =>
    !(wire.net === '3V3_SYS' && service3v3Endpoints.has(wire.from) && service3v3Endpoints.has(wire.to)));
  for (const target of serviceConnectors.slice(1)) {
    const endpoint = `${target.ref}.4`;
    board.wires.push({
      id: `W_SMART_POWER_3V3_SYS_${target.ref}`,
      uid: `wire:3V3_SYS:${powerRef}.2~${endpoint}`,
      net: '3V3_SYS',
      from: `${powerRef}.2`,
      to: endpoint,
      path: [powerPart.pins[1].hole, target.pins.find((pin) => pin.number === 4).hole],
      color: '#e53935', side: 'bottom', insulated: true, bar: false,
      phase: Math.max(powerPart.phase, target.phase),
    });
  }

  // Branch each NODE signal from the contact bus at its nearest end: SMART
  // leads leave the top pogo, and the matrix lead leaves the bottom pogo.
  // This avoids routing the SMART branch through the lower NODE connector.
  const partFor = (endpoint) => board.parts.find((part) => part.ref === endpoint.split('.')[0]);
  const pinFor = (endpoint) => {
    const [ref, number] = endpoint.split('.');
    return board.parts.find((part) => part.ref === ref).pins.find((pin) => pin.number === Number(number));
  };
  for (const net of board.nets.filter((item) => /^NODE\d+$/.test(item.name))) {
    const pogo = net.pins.filter((endpoint) => partFor(endpoint)?.body === 'pogo');
    const bundle = net.pins.find((endpoint) => partFor(endpoint)?.origin === 'J_NODE_BUNDLE');
    const smart = net.pins.find((endpoint) => partFor(endpoint)?.origin === 'J_SMART');
    if (pogo.length !== 6 || !bundle) throw new Error(`${board.id}/${net.name}: missing contact bus or NODE connector`);
    const top = pogo.slice().sort((a, b) => pinFor(a).hole[1] - pinFor(b).hole[1])[0];
    const bottom = pogo.slice().sort((a, b) => pinFor(b).hole[1] - pinFor(a).hole[1])[0];
    const external = board.wires.find((wire) => wire.net === net.name && (wire.from === bundle || wire.to === bundle));
    if (!external) throw new Error(`${board.id}/${net.name}: missing NODE connector lead`);
    external.from = bottom;
    external.to = bundle;
    external.uid = `wire:${net.name}:${bottom}~${bundle}`;
    const smartLead = board.wires.find((wire) => wire.net === net.name && (wire.from === smart || wire.to === smart));
    if (smart) {
      if (!smartLead) throw new Error(`${board.id}/${net.name}: missing SMART branch`);
      smartLead.from = top;
      smartLead.to = smart;
      smartLead.uid = `wire:${net.name}:${top}~${smart}`;
    } else if (smartLead) {
      throw new Error(`${board.id}/${net.name}: unexpected SMART branch`);
    }
    for (const wire of [external, ...(smart ? [smartLead] : [])]) {
      const a = pinFor(wire.from).hole;
      const b = pinFor(wire.to).hole;
      wire.path = [a, b];
    }
  }

  for (const wire of board.wires) wire.phase = Math.max(partFor(wire.from).phase, partFor(wire.to).phase);

  // Keep physical wire colors consistent by responsibility across both boards.
  for (const wire of board.wires) {
    if (wire.net === 'GND') wire.color = '#202124';
    else if (wire.net === '3V3_SYS') wire.color = '#e53935';
    else if (wire.net.startsWith('SCL_')) wire.color = '#1976d2';
    else if (wire.net.startsWith('SDA_')) wire.color = '#fbc02d';
    else if (wire.net.startsWith('NODE')) {
      const endpoints = [wire.from, wire.to];
      const smartBranch = endpoints.some((endpoint) => partFor(endpoint)?.origin === 'J_SMART');
      wire.color = smartBranch ? '#8e44ad' : '#388e3c';
    }
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
  // Shift the contact layout down one perfboard row while keeping the shared
  // power input at row 2. Mounting holes are board features and stay fixed.
  for (const part of board.parts) {
    if (part === powerPart) continue;
    part.pins = part.pins.map((pin) => ({ ...pin, hole: [pin.hole[0], pin.hole[1] + 1] }));
    part.bounds = { ...part.bounds, ymin: part.bounds.ymin + 1, ymax: part.bounds.ymax + 1 };
  }
  if (board.id === 'contact-b') {
    // Keep the contact-B drawing mechanically identical to contact-A. The
    // capsule pin labels retain their electrical identity while the row order
    // is laid out in the same top-to-bottom orientation.
    const contactRows = [10, 14, 18, 22, 26, 30];
    for (const part of board.parts) {
      if (part.origin === 'J_SERVICE') {
        part.pins = part.pins.map((pin) => ({ ...pin, hole: [pin.hole[0], 4] }));
        part.bounds = { ...part.bounds, ymin: 3.5, ymax: 4.5 };
      } else if (part.origin === 'J_NODE_BUNDLE') {
        part.pins = part.pins.map((pin) => ({ ...pin, hole: [pin.hole[0], 36] }));
        part.bounds = { ...part.bounds, ymin: 35, ymax: 37 };
      } else if (part.body === 'pogo') {
        part.pins = part.pins.map((pin) => {
          const row = Number(String(pin.label).replace('ROW', ''));
          if (!Number.isInteger(row) || row < 1 || row > 6) throw new Error(`${board.id}/${part.ref}: unexpected pogo row label ${pin.label}`);
          return { ...pin, hole: [pin.hole[0], contactRows[row - 1]] };
        });
        const ys = part.pins.map((pin) => pin.hole[1]);
        part.bounds = { ...part.bounds, ymin: Math.min(...ys) - 0.5, ymax: Math.max(...ys) + 0.5 };
      }
    }
    // Restore the shared branch convention after turning the B contact rows.
    const getPart = (endpoint) => board.parts.find((part) => part.ref === endpoint.split('.')[0]);
    const getPin = (endpoint) => {
      const [ref, number] = endpoint.split('.');
      return board.parts.find((part) => part.ref === ref).pins.find((pin) => pin.number === Number(number));
    };
    for (const net of board.nets.filter((item) => /^NODE\d+$/.test(item.name))) {
      const pogo = net.pins.filter((endpoint) => getPart(endpoint)?.body === 'pogo');
      const bundle = net.pins.find((endpoint) => getPart(endpoint)?.origin === 'J_NODE_BUNDLE');
      const smart = net.pins.find((endpoint) => getPart(endpoint)?.origin === 'J_SMART');
      const top = pogo.slice().sort((a, b) => getPin(a).hole[1] - getPin(b).hole[1])[0];
      const bottom = pogo.slice().sort((a, b) => getPin(b).hole[1] - getPin(a).hole[1])[0];
      const external = board.wires.find((wire) => wire.net === net.name && (wire.from === bundle || wire.to === bundle));
      external.from = bottom;
      external.to = bundle;
      external.uid = `wire:${net.name}:${bottom}~${bundle}`;
      const smartLead = board.wires.find((wire) => wire.net === net.name && (wire.from === smart || wire.to === smart));
      if (smartLead) {
        smartLead.from = top;
        smartLead.to = smart;
        smartLead.uid = `wire:${net.name}:${top}~${smart}`;
      }
    }
  }
  for (const wire of board.wires) {
    const endpointHole = (endpoint) => {
      const [ref, pinNumber] = endpoint.split('.');
      return board.parts.find((part) => part.ref === ref).pins.find((pin) => pin.number === Number(pinNumber)).hole;
    };
    const a = endpointHole(wire.from), b = endpointHole(wire.to), bend = [a[0], b[1]];
    wire.path = [a, ...(bend[0] === a[0] && bend[1] === a[1] ? [] : [bend]), ...(b[0] === bend[0] && b[1] === bend[1] ? [] : [b])];
  }
  board.notes = [...board.notes, 'Revision 8 preview: three 4-pin NODE connectors per contact board, grouped by four adjacent NODE signals (the last uses three pins); each SMART connector is a 1x5 header at row 8 with NODE signals on pins 1/3/5, local SCL on pin 2 and local SDA on pin 4; one shared 1x2 GND/3V3 connector at row 2 feeds the existing service rails, with a separate off-board power fanout harness to all three smart components; contact-B placements and contact-row orientation match contact A; SMART leads branch from the top contact-bus pad and NODE cable leads from the bottom pad; physical fit and cable pinout are unverified.'];
}

export { boards };
