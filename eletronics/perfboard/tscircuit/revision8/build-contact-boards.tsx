import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { boards } from './design/revision8.mjs';

const out = new URL('./assets/', import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const save = (name: string, value: string) => writeFileSync(new URL(name, out), value);

const pointKey = ([x, y]: number[]) => `${x},${y}`;
const parseKey = (key: string) => key.split(',').map(Number);
const manhattan = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const isSharedPower = (net: string) => net === 'GND' || net === '3V3_SYS';

// Route insulated hand wires through vacant perfboard holes. Existing gold
// NODE bus bars reserve their full straight run. Prefer paths that do not
// reuse holes. Only the shared GND/3V3 routes may cross insulated signal wires;
// those power routes are placed last and the crossover is marked as a bridge.
function routeBoardWires(board: any) {
  const partsByRef = new Map(board.parts.map((part: any) => [part.ref, part]));
  const endpointHole = (endpoint: string) => {
    const [ref, number] = endpoint.split('.');
    const part: any = partsByRef.get(ref);
    const pin = part?.pins.find((item: any) => item.number === Number(number));
    if (!pin) throw new Error(`${board.id}: missing endpoint ${endpoint}`);
    return pin.hole as number[];
  };
  const occupiedPads = new Set<string>();
  for (const part of board.parts) for (const pin of part.pins) occupiedPads.add(pointKey(pin.hole));
  const blocked = new Set<string>(occupiedPads);
  for (const [x, y] of board.mounts) blocked.add(pointKey([x, y]));
  for (const net of board.nets.filter((item: any) => /^NODE\d+$/.test(item.name))) {
    const pogo = net.pins.map(endpointHole).filter((hole: number[], index: number) => {
      const [ref] = net.pins[index].split('.');
      return partsByRef.get(ref)?.body === 'pogo';
    });
    if (!pogo.length) continue;
    const x = pogo[0][0], ys = pogo.map((hole: number[]) => hole[1]);
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++) blocked.add(pointKey([x, y]));
  }

  const rank = (wire: any) => {
    const bundled = wire.from.includes('NODE_BUNDLE') || wire.to.includes('NODE_BUNDLE');
    const smart = wire.from.includes('_SMART.') || wire.to.includes('_SMART.');
    if (wire.net.startsWith('NODE')) return bundled && !smart ? 0 : bundled && smart ? 1 : 2;
    return isSharedPower(wire.net) ? 4 : 3;
  };
  const base = board.wires.filter((wire: any) => !wire.physicalRunId).slice().sort((a: any, b: any) =>
    rank(a) - rank(b) || manhattan(endpointHole(a.from), endpointHole(a.to)) - manhattan(endpointHole(b.from), endpointHole(b.to)),
  );

  const route = (start: number[], goal: number[], net: string, used: Map<string, any>, allowCrossings = false) => {
    const startKey = pointKey(start), goalKey = pointKey(goal);
    const startState = `${startKey}|`;
    const queue = [startState], previous = new Map<string, { cell: string; dir: string; parent: string | null }>([[startState, { cell: startKey, dir: '', parent: null }]]);
    let goalState: string | null = null;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const state = queue[cursor], current = previous.get(state)!;
      if (current.cell === goalKey) { goalState = state; break; }
      const here = parseKey(current.cell);
      const neighbors = [[here[0] - 1, here[1]], [here[0] + 1, here[1]], [here[0], here[1] - 1], [here[0], here[1] + 1]]
        .filter(([x, y]) => x >= 1 && x <= board.cols && y >= 1 && y <= board.rows)
        .sort((a, b) => manhattan(a, goal) - manhattan(b, goal));
      for (const next of neighbors) {
        const key = pointKey(next);
        const dir = next[0] === here[0] ? 'V' : 'H';
        const priorUse = used.get(key);
        if (key !== goalKey && blocked.has(key)) continue;
        if (priorUse && [...priorUse.keys()].some((owner) => owner !== net)) {
          const otherAxes = new Set([...priorUse].filter(([owner]) => owner !== net).flatMap(([, axes]) => [...axes]));
          const enteringCross = otherAxes.size > 1 || !otherAxes.has(dir);
          if (!allowCrossings || !isSharedPower(net) || !enteringCross) continue;
        }
        const nextState = `${key}|${dir}`;
        if (previous.has(nextState)) continue;
        previous.set(nextState, { cell: key, dir, parent: state });
        queue.push(nextState);
      }
    }
    if (!goalState) return null;
    const path: number[][] = [];
    for (let state: string | null = goalState; state;) {
      const current = previous.get(state)!;
      path.push(parseKey(current.cell));
      state = current.parent;
    }
    path.reverse();
    return path;
  };

  const routeWire = (wire: any, used: Map<string, any>, allowCrossings = false) => {
    const start = endpointHole(wire.from), goal = endpointHole(wire.to);
    return route(start, goal, wire.net, used, allowCrossings);
  };

  const reservePath = (path: number[][], net: string, used: Map<string, any>) => {
    for (let i = 1; i < path.length - 1; i++) {
      const key = pointKey(path[i]);
      const axes = path[i - 1][0] === path[i][0] ? ['V'] : ['H'];
      axes.push(path[i + 1][0] === path[i][0] ? 'V' : 'H');
      if (!used.has(key)) used.set(key, new Map());
      const byNet = used.get(key);
      if (!byNet.has(net)) byNet.set(net, new Set());
      for (const axis of axes) byNet.get(net).add(axis);
    }
  };
  const countNewCrossings = (path: number[][], net: string, used: Map<string, any>) => {
    let count = 0;
    for (let i = 1; i < path.length - 1; i++) {
      const priorUse = used.get(pointKey(path[i]));
      if (!priorUse) continue;
      const newAxes = new Set([
        path[i - 1][0] === path[i][0] ? 'V' : 'H',
        path[i + 1][0] === path[i][0] ? 'V' : 'H',
      ]);
      const crosses = [...priorUse].some(([owner, axes]: [string, Set<string>]) => owner !== net &&
        ((newAxes.has('H') && axes.has('V')) || (newAxes.has('V') && axes.has('H'))));
      if (crosses) count++;
    }
    return count;
  };
  const pathLength = (path: number[][]) => path.slice(1).reduce((sum, point, index) => sum + manhattan(path[index], point), 0);

  // Route nearby endpoints first within each priority group, so short local
  // leads claim nearby holes before longer runs. Try deterministic alternate
  // orderings if that greedy pass fences in a later endpoint.
  let best: { ordered: any[]; routed: Map<any, number[][]>; crossings: number; length: number } | null = null;
  for (let attempt = 0; attempt < 96; attempt++) {
    const ordered = base.map((wire: any) => ({ ...wire }));
    if (attempt > 0) {
      let seed = (0x9e3779b9 ^ (attempt * 0x85ebca6b)) >>> 0;
      const random = () => { seed = (Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) + 0x27100001) >>> 0; return seed / 0x100000000; };
      for (let i = ordered.length - 1; i > 0; i--) {
        if (rank(ordered[i]) !== rank(ordered[i - 1])) continue;
        const j = Math.floor(random() * (i + 1));
        if (rank(ordered[j]) === rank(ordered[i])) [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      }
      for (const wire of ordered) if (random() < 0.5) [wire.from, wire.to] = [wire.to, wire.from];
    }
    const used = new Map<string, any>(), routed = new Map<any, number[][]>();
    let complete = true;
    for (const wire of ordered) {
      const path = routeWire(wire, used);
      if (!path) { complete = false; break; }
      reservePath(path, wire.net, used);
      routed.set(wire, path);
    }
    if (complete) return ordered.map((wire: any) => ({ ...wire, path: routed.get(wire) }));
  }
  // If a collision-free layout does not fit, try alternate lead orders while
  // allowing only shared power wires to cross already-routed insulated leads.
  for (let attempt = 0; attempt < 96; attempt++) {
    const ordered = base.map((wire: any) => ({ ...wire }));
    if (attempt > 0) {
      let seed = (0x7f4a7c15 ^ (attempt * 0x9e3779b9)) >>> 0;
      const random = () => { seed = (Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) + 0x27100001) >>> 0; return seed / 0x100000000; };
      for (let i = ordered.length - 1; i > 0; i--) {
        if (rank(ordered[i]) !== rank(ordered[i - 1])) continue;
        const j = Math.floor(random() * (i + 1));
        if (rank(ordered[j]) === rank(ordered[i])) [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      }
      for (const wire of ordered) if (random() < 0.5) [wire.from, wire.to] = [wire.to, wire.from];
    }
    const used = new Map<string, any>(), routed = new Map<any, number[][]>();
    let complete = true;
    let crossings = 0, length = 0;
    for (const wire of ordered) {
      const path = routeWire(wire, used, true);
      if (!path) { complete = false; break; }
      crossings += countNewCrossings(path, wire.net, used);
      length += pathLength(path);
      reservePath(path, wire.net, used);
      routed.set(wire, path);
    }
    if (complete && (!best || crossings < best.crossings || (crossings === best.crossings && length < best.length))) {
      best = { ordered, routed, crossings, length };
    }
  }
  if (best) return best.ordered.map((wire: any) => ({ ...wire, path: best!.routed.get(wire) }));
  throw new Error(`${board.id}: no route found with only shared GND/3V3 crossings allowed`);
}

function drawing(board: any, underside = false) {
  const routedWires = underside ? routeBoardWires(board) : [];
  const scale = 6, x0 = 52, y0 = 40;
  const width = x0 * 2 + (board.cols + 1) * scale;
  const height = y0 * 2 + (board.rows + 1) * scale;
  const pos = ([x, y]: number[]) => [x0 + (underside ? board.cols + 1 - x : x) * scale, y0 + y * scale];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><style>text{font-family:Arial,sans-serif;fill:#203545}.coord{font-size:7px}</style><text x="18" y="22" font-size="15" font-weight="bold">${board.id.toUpperCase()} — ${underside ? 'UNDERSIDE' : 'TOP'}</text><rect x="${x0}" y="${y0}" width="${(board.cols + 1) * scale}" height="${(board.rows + 1) * scale}" rx="8" fill="#e6f0e5" stroke="#60846a" stroke-width="2"/>`;
  for (let y = 1; y <= board.rows; y++) for (let x = 1; x <= board.cols; x++) {
    const [cx, cy] = pos([x, y]); svg += `<circle cx="${cx}" cy="${cy}" r="1.65" fill="#b8c2ac"/>`;
  }
  for (let x = 1; x <= board.cols; x++) {
    const [cx, cy] = pos([x, 1]); svg += `<text class="coord" x="${cx}" y="${cy - (x % 2 ? 16 : 8)}" text-anchor="middle">${x}</text>`;
  }
  for (let y = 1; y <= board.rows; y++) {
    const [, cy] = pos([1, y]); svg += `<text class="coord" x="${x0 - 7}" y="${cy + 2}" text-anchor="end">${y}</text>`;
  }
  for (const [x, y] of board.mounts) { const [cx, cy] = pos([x, y]); svg += `<circle cx="${cx}" cy="${cy}" r="8" fill="white" stroke="#71816d" stroke-width="2"/>`; }

  // Show the six contacts for each NODE as one continuous solder/conductor line.
  // This is a visual wire-run convention, not fabricated perfboard copper.
  for (const net of board.nets.filter((n: any) => /^NODE\d+$/.test(n.name))) {
    const ends = net.pins.filter((ep: string) => {
      const [ref] = ep.split('.'); return board.parts.find((p: any) => p.ref === ref)?.body === 'pogo';
    });
    const holes = ends.map((ep: string) => { const [ref, number] = ep.split('.'); return board.parts.find((p: any) => p.ref === ref).pins.find((p: any) => p.number === Number(number)).hole; }).sort((a: number[], b: number[]) => a[1] - b[1]);
    const points = holes.map(pos).map((p: number[]) => p.join(',')).join(' ');
    svg += `<polyline points="${points}" fill="none" stroke="#bf8747" stroke-width="${underside ? 4 : 2.5}" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
  }
  if (underside) {
    for (const wire of routedWires) {
      const points = wire.path.map(pos).map((p: number[]) => p.join(',')).join(' ');
      const color = wire.insulated ? (wire.color ?? '#426caa') : '#bf8747';
      if (color === '#ffffff') svg += `<polyline points="${points}" fill="none" stroke="#53636c" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>`;
      svg += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${wire.insulated ? 2.4 : 3.4}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    const visits = new Map<string, any[]>();
    routedWires.forEach((wire: any, wireIndex: number) => wire.path.forEach((hole: number[], i: number) => {
      if (i === 0 || i === wire.path.length - 1) return;
      const axes = new Set<string>();
      if (wire.path[i - 1][0] === hole[0]) axes.add('V'); else axes.add('H');
      if (wire.path[i + 1][0] === hole[0]) axes.add('V'); else axes.add('H');
      const key = pointKey(hole);
      if (!visits.has(key)) visits.set(key, []);
      visits.get(key).push({ wire, wireIndex, axes });
    }));
    for (const [key, atHole] of visits) {
      const crossing = atHole.find((a: any, i: number) => atHole.slice(i + 1).some((b: any) =>
        a.wire.net !== b.wire.net && [...a.axes].some((axis: string) => b.axes.has(axis === 'H' ? 'V' : 'H')),
      ));
      if (!crossing) continue;
      const [x, y] = parseKey(key), [cx, cy] = pos([x, y]);
      const upper = atHole.find((visit: any) => isSharedPower(visit.wire.net)) ??
        atHole.filter((visit: any) => visit.wire.net !== crossing.wire.net).at(-1) ?? crossing;
      const axes = upper.axes;
      const color = upper.wire.color ?? '#426caa';
      const horizontal = axes.has('H');
      const bridge = horizontal
        ? `M ${cx - 2.4} ${cy} Q ${cx} ${cy - 2.8} ${cx + 2.4} ${cy}`
        : `M ${cx} ${cy - 2.4} Q ${cx + 2.8} ${cy} ${cx} ${cy + 2.4}`;
      svg += `<circle cx="${cx}" cy="${cy}" r="2.7" fill="#e6f0e5"/><path d="${bridge}" fill="none" stroke="#53636c" stroke-width="3.8" stroke-linecap="round"/><path d="${bridge}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`;
    }
  }
  for (const part of board.parts) {
    const pts = part.pins.map((p: any) => pos(p.hole));
    const xs = pts.map((p: number[]) => p[0]), ys = pts.map((p: number[]) => p[1]);
    if (part.body !== 'pogo') svg += `<rect x="${Math.min(...xs) - 4}" y="${Math.min(...ys) - 4}" width="${Math.max(...xs) - Math.min(...xs) + 8}" height="${Math.max(...ys) - Math.min(...ys) + 8}" rx="3" fill="#dce4e9" fill-opacity=".88" stroke="#526677" stroke-width="1.2"/>`;
    pts.forEach(([cx, cy]: number[], i: number) => { svg += `<circle cx="${cx}" cy="${cy}" r="2.8" fill="${i === 0 ? '#c43e49' : '#31495c'}"/>`; });
    if (part.origin === 'J_NODE_BUNDLE') {
      part.pins.forEach((pin: any) => {
        const [px, py] = pos(pin.hole);
        svg += `<text x="${px}" y="${py - 5}" text-anchor="middle" font-size="6">${pin.number}</text>`;
      });
    }
  }
  svg += '</svg>';
  return svg;
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));
const colorName = (color: string) => ({
  '#e53935': 'Red · power', '#202124': 'Black · ground', '#1976d2': 'Blue · signal',
  '#ffffff': 'White · signal', '#fbc02d': 'Yellow · signal', '#388e3c': 'Green · signal',
  '#bf8747': 'Gold · contact strap',
} as Record<string, string>)[color] ?? color;

function explanationView(board: any) {
  const netByEndpoint = new Map<string, string>();
  for (const net of board.nets) for (const endpoint of net.pins) netByEndpoint.set(endpoint, net.name);
  const coordinates = (part: any) => {
    const xs = part.pins.map((pin: any) => pin.hole[0]);
    const ys = part.pins.map((pin: any) => pin.hole[1]);
    return `C${Math.min(...xs)}–${Math.max(...xs)}, R${Math.min(...ys)}–${Math.max(...ys)}`;
  };
  const pinMap = (part: any) => {
    if (part.body === 'pogo') {
      const net = netByEndpoint.get(`${part.ref}.${part.pins[0].number}`);
      return `Six pogo pads on ${net} contact column`;
    }
    return part.pins.map((pin: any) => {
      const net = part.signals?.[String(pin.number)] ?? netByEndpoint.get(`${part.ref}.${pin.number}`) ?? pin.label;
      return `${pin.number}:${net}`;
    }).join(' · ');
  };
  const role = (part: any) => {
    if (part.origin === 'J_NODE_BUNDLE') return 'Four-pin NODE cable to router/matrix';
    if (part.origin === 'J_SMART') return 'Five-pin smart-component signal connector';
    if (part.origin === 'J_SMART_POWER') return 'Shared GND/3V3 input; power fans out off-board';
    if (part.origin === 'J_SERVICE') return 'Position service connector';
    if (part.body === 'pogo') return 'Capsule contact column';
    return part.function ?? part.label ?? part.origin;
  };
  const endpointDescription = (endpoint: string) => {
    const [ref, number] = endpoint.split('.');
    const part = board.parts.find((item: any) => item.ref === ref);
    const pin = part?.pins.find((item: any) => item.number === Number(number));
    const net = netByEndpoint.get(endpoint);
    return `${part?.ref ?? ref} pin ${number}${pin?.label ? ` (${pin.label})` : ''}${net ? ` · ${net}` : ''}`;
  };
  const componentRows = board.parts.map((part: any) => `<tr><td>${escapeHtml(part.ref)}</td><td>${escapeHtml(role(part))}</td><td>${escapeHtml(coordinates(part))}</td><td>${escapeHtml(pinMap(part))}</td></tr>`).join('');
  const physicalRuns = new Map<string, any[]>();
  for (const wire of board.wires) if (wire.physicalRunId) {
    if (!physicalRuns.has(wire.physicalRunId)) physicalRuns.set(wire.physicalRunId, []);
    physicalRuns.get(wire.physicalRunId)!.push(wire);
  }
  const seenPhysicalRuns = new Set<string>();
  const wireRows = board.wires.flatMap((wire: any) => {
    if (wire.physicalRunId) {
      if (seenPhysicalRuns.has(wire.physicalRunId)) return [];
      seenPhysicalRuns.add(wire.physicalRunId);
      const group = physicalRuns.get(wire.physicalRunId)!;
      const net = wire.net;
      return [`<tr><td>${group.map((item: any) => escapeHtml(item.id)).join(', ')}</td><td>Gold · continuous contact strap</td><td>${escapeHtml(net)}</td><td>Six pogo pads in one contact column</td><td>One continuous strap; ${group.length} modeled links</td></tr>`];
    }
    const fromPart = board.parts.find((part: any) => part.ref === wire.from.split('.')[0]);
    const toPart = board.parts.find((part: any) => part.ref === wire.to.split('.')[0]);
    let purpose = 'Connects the listed pins on the same net';
    if (/^NODE\d+$/.test(wire.net) && toPart?.origin === 'J_NODE_BUNDLE') purpose = 'Contact-column lead to router/matrix connector';
    else if (/^NODE\d+$/.test(wire.net) && toPart?.origin === 'J_SMART') purpose = 'Top contact-column branch to smart signal connector';
    else if (/^SCL_|^SDA_/.test(wire.net)) purpose = 'Position-specific service signal to smart signal connector';
    else if (wire.net === 'GND' || wire.net === '3V3_SYS') purpose = fromPart?.origin === 'J_SMART_POWER' ? 'Shared power input to the service rail' : 'Link in the shared service power rail';
    const color = wire.physicalRunId ? '#bf8747' : wire.color ?? '#1976d2';
    return [`<tr><td>${escapeHtml(wire.id)}</td><td><span class="swatch" style="background:${color}"></span> ${escapeHtml(colorName(color))}</td><td>${escapeHtml(wire.net)}</td><td>${escapeHtml(endpointDescription(wire.from))} → ${escapeHtml(endpointDescription(wire.to))}</td><td>${escapeHtml(purpose)}</td></tr>`];
  }).join('');
  return `<article class="explanation"><h3>Wire and component guide</h3><p>Coordinates use top-side column and row numbers, including for the mirrored underside. Each contact-column gold strap is listed once as a continuous physical run; its individual pad links are summarized.</p><h4>Components</h4><div class="table-wrap"><table><thead><tr><th>Reference</th><th>Purpose</th><th>Grid location</th><th>Pins / net assignment</th></tr></thead><tbody>${componentRows}</tbody></table></div><h4>Wire runs</h4><div class="table-wrap"><table><thead><tr><th>Wire ID</th><th>Color</th><th>Net</th><th>Endpoints</th><th>Purpose</th></tr></thead><tbody>${wireRows}</tbody></table></div></article>`;
}

let page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Revision 8 contact boards</title><style>body{font:15px system-ui;max-width:1450px;margin:1.5rem auto;padding:0 1rem;color:#203545;background:#f4f7f5}article{background:white;padding:1rem;margin:1rem 0;border:1px solid #cbd5d0;border-radius:8px}.explanation{margin-top:1.2rem;background:#f9fbfa}object{display:block;width:100%;max-height:80vh;object-fit:contain;margin:.5rem 0}.open-svg{display:inline-block;margin:.1rem 0 .8rem;padding:.4rem .7rem;border:1px solid #82938b;border-radius:5px;color:#203545;text-decoration:none;background:#f4f7f5}.open-svg:hover{background:#e6f0e5}section{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}.legend{display:flex;flex-wrap:wrap;gap:.7rem 1.1rem;margin:.7rem 0}.key{display:inline-flex;align-items:center;gap:.35rem}.swatch{display:inline-block;width:1.2rem;height:.35rem;border:1px solid #53636c;border-radius:2px;vertical-align:middle}.table-wrap{overflow-x:auto;margin:.5rem 0 1.2rem}table{width:100%;border-collapse:collapse;font-size:.86rem}th,td{text-align:left;vertical-align:top;padding:.42rem .5rem;border-bottom:1px solid #dce4df}th{background:#edf2ef;position:sticky;top:0}h4{margin:.8rem 0 .3rem}@media(max-width:850px){section{grid-template-columns:1fr}}</style><h1>Revision 8 contact boards</h1><p>Gold: contact solder runs. Colored: underside wires snapped to free holes. Underside view is mirrored. Bridge marks: insulated crossovers, no electrical connection; only GND/3V3 may cross other nets. Red is power; black is ground; blue, white, yellow and green are signals. SMART branches leave the top of each NODE contact bus; NODE cable leads leave the bottom.</p><div class="legend"><span class="key"><i class="swatch" style="background:#e53935"></i>Red</span><span class="key"><i class="swatch" style="background:#202124"></i>Black</span><span class="key"><i class="swatch" style="background:#1976d2"></i>Blue</span><span class="key"><i class="swatch" style="background:white"></i>White</span><span class="key"><i class="swatch" style="background:#fbc02d"></i>Yellow</span><span class="key"><i class="swatch" style="background:#388e3c"></i>Green</span></div>`;

for (const board of boards) {
  save(`${board.id}-top.svg`, drawing(board));
  save(`${board.id}-underside.svg`, drawing(board, true));
  page += `<article><h2>${board.id.toUpperCase()}</h2><section><div><object aria-label="${board.id} top view" data="assets/${board.id}-top.svg" type="image/svg+xml"></object><a class="open-svg" href="assets/${board.id}-top.svg" target="_blank" rel="noopener">Open top SVG ↗</a></div><div><object aria-label="${board.id} mirrored underside" data="assets/${board.id}-underside.svg" type="image/svg+xml"></object><a class="open-svg" href="assets/${board.id}-underside.svg" target="_blank" rel="noopener">Open underside SVG ↗</a></div></section>${explanationView(board)}</article>`;
}
page += '</html>';
writeFileSync(new URL('./contact-boards.html', import.meta.url), page);
console.log('Generated revision8 contact board top/bottom views.');
