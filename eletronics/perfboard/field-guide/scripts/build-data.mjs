// Builds build/cp00.json and the schematic/3D assets used by cp00.typ.
// Run from eletronics/perfboard/field-guide:  node scripts/build-data.mjs
import fs from 'node:fs';
import { laneOffsets, placeLabels } from './route.mjs';
import { cropSvg } from './crop-svg.mjs';

const TS = '../tscircuit';
const catalog = JSON.parse(fs.readFileSync(`${TS}/assembly/catalog.json`, 'utf8'));
fs.mkdirSync('build', { recursive: true });

const PITCH = 2.54; // mm
const ALLOWANCE = { insulated: 10, bare: 6 }; // mm added to the routed length for stripping and pad entry
const COLOR_NAME = { '#ef8500': 'orange', '#222222': 'black', '#d32f2f': 'red', '#78909c': 'bare', '#1976d2': 'blue', '#888888': 'grey', '#c79500': 'yellow' };

const GROUPS = [
  {
    id: 'g1', board: 'a1', section: 'Nodes', kind: 'perf', phase: 0,
    refs: ['J_NODE00', 'J_NODE01', 'J_NODE02', 'J_NODE03'],
    wireFilter: (w) => w.from.split('.')[0] === w.to.split('.')[0],
  },
  {
    id: 'g2', board: 'a1', section: 'Service', kind: 'perf', phase: 0,
    refs: ['J_NODE'],
    wireFilter: (w) => w.from.split('.')[0] !== w.to.split('.')[0],
    context: ['J_NODE00', 'J_NODE01', 'J_NODE02', 'J_NODE03'],
  },
  {
    id: 'g3', board: 'matrix', section: 'Controller', kind: 'perf', phase: 0,
    refs: ['U_ESP1', 'J_FIXTURE', 'J_PROTOTYPE'],
    wireFilter: () => true,
  },
  {
    id: 'g4', board: 'usb-prototype', section: 'Switch', kind: 'breadboard', phase: 0,
    refs: ['J_CONTROL', 'Q_PASS', 'Q_ENABLE', 'R_GATE_OFF', 'R_ENABLE_OFF', 'R_LIMIT', 'J_OUTPUT', 'C_USB'],
    wireFilter: () => true,
  },
];

// [profile, drawing width mm, label width mm, label height mm]
const PROFILES = {
  perf: [['phone', 82, 6, 3, 9999], ['desk', 149, 8, 3.8, 120]],
  breadboard: [['phone', 82, 5, 2.6, 9999], ['desk', 149, 6.5, 3.2, 120]],
};

// What each component physically is. Pogo pin identity is a reference only (purchased pin not yet identified).
const POGO = { type: 'Pogo pin (spring-loaded contact)', detail: '6 single pins, one column, 4 holes (10.16 mm) apart. The purchased pin is not identified yet. Measure it before you solder.' };
const PART_TYPES = {
  J_NODE00: POGO, J_NODE01: POGO, J_NODE02: POGO, J_NODE03: POGO,
  J_NODE: { type: 'IDC box header, 2 × 5, 2.54 mm', detail: 'Bottom side. Odd pins on row 33, even pins on row 34. Only pins 1, 3, 5, 7 carry signals; pins 2, 4, 6, 8, 9, 10 stay unconnected. Guidelines: drill keyed IDC positions to 1.2 mm first.' },
  J_FIXTURE: { type: 'Straight pin header, 1 × 5, 2.54 mm', detail: 'Single row, top side. Pin 1 at the left.' },
  J_PROTOTYPE: { type: 'Straight pin header, 1 × 4, 2.54 mm', detail: 'Single row, top side. Pin 1 at the left.' },
  U_ESP1: { type: 'ESP32 DevKitC V4 board, 2 × 19 pins', detail: 'Two pin rows, 10 holes (25.4 mm) apart. Module ESP32-WROOM-32E. Check your pinout against the labels before you solder.' },
  J_CONTROL: { type: 'Male flying jumper leads, 4 pcs, 24 AWG', detail: 'Individual leads, not a rigid plug. Purchased set not identified yet.' },
  J_OUTPUT: { type: 'Male flying jumper leads, 2 pcs, 24 AWG', detail: 'Individual leads, not a rigid plug. Purchased set not identified yet.' },
  Q_PASS: { type: 'P-channel MOSFET', detail: 'Pins: gate, drain, source.' },
  Q_ENABLE: { type: 'N-channel MOSFET', detail: 'Pins: source, gate, drain.' },
  R_GATE_OFF: { type: 'Axial resistor, 1/4 W, 1 %', detail: '' },
  R_ENABLE_OFF: { type: 'Axial resistor, 1/4 W, 1 %', detail: '' },
  R_LIMIT: { type: 'Axial resistor, 1/4 W, 1 %', detail: 'Crosses the breadboard center channel.' },
  C_USB: { type: 'Ceramic capacitor', detail: '' },
};
const layoutOf = (p) => {
  const cols = new Set(p.pins.map((q) => q.hole[0])).size, rows = new Set(p.pins.map((q) => q.hole[1])).size;
  return `${cols} column${cols > 1 ? 's' : ''} × ${rows} row${rows > 1 ? 's' : ''} of holes`;
};

const pathLen =(p) => p.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - p[i][0], q[1] - p[i][1]), 0);
const padKey = (_side, [x, y]) => `${x}:${y}`; // one pad = one hole; all joints are soldered on the bottom

function groupData(g) {
  const board = catalog.boards.find((b) => b.id === g.board);
  const parts = board.parts.filter((p) => g.refs.includes(p.ref));
  const context = board.parts.filter((p) => (g.context ?? []).includes(p.ref));
  const wires = board.wires.filter((w) => w.phase === g.phase && g.wireFilter(w));

  const pads = new Set();
  const partPads = (p) => p.pins.map((pin) => padKey(p.side, pin.hole));
  for (const p of parts) for (const k of partPads(p)) pads.add(k);
  // A wire end soldered into a pad that already holds a pin shares that pad's joint only when sides match.
  for (const w of wires) {
    if (g.kind === 'breadboard') continue; // breadboard jumpers are not soldered
    pads.add(padKey('bottom', w.path[0]));
    pads.add(padKey('bottom', w.path.at(-1)));
  }

  const outWires = wires.map((w) => {
    const bare = !w.insulated;
    const routed = pathLen(w.path) * PITCH;
    const cut = Math.ceil(routed + ALLOWANCE[bare ? 'bare' : 'insulated']);
    return {
      id: w.id, net: w.net, from: w.from, to: w.to, path: w.path, color: w.color,
      colorName: COLOR_NAME[w.color] ?? w.color, bare, cut, tie: !!w.breadboardTie,
      a: w.path[0], b: w.path.at(-1),
    };
  });
  const real = outWires.filter((w) => !w.tie);
  const cutMap = new Map();
  for (const w of real) {
    const k = `${w.bare ? 'bare' : 'ins'}|${w.colorName}|${w.cut}`;
    cutMap.set(k, { bare: w.bare, colorName: w.colorName, color: w.color, cut: w.cut, qty: (cutMap.get(k)?.qty ?? 0) + 1 });
  }

  const xs = [], ys = [];
  for (const p of [...parts, ...context]) { xs.push(p.bounds.xmin, p.bounds.xmax); ys.push(p.bounds.ymin, p.bounds.ymax); }
  for (const w of wires) for (const [x, y] of w.path) { xs.push(x); ys.push(y); }
  const m = g.kind === 'breadboard' ? 1.2 : 1.8;
  const view = {
    x0: Math.max(1, Math.floor(Math.min(...xs) - m)), x1: Math.min(board.cols, Math.ceil(Math.max(...xs) + m)),
    y0: Math.max(1, Math.floor(Math.min(...ys) - m)), y1: Math.min(board.rows, Math.ceil(Math.max(...ys) + m)),
  };

  // Visual routing: side-by-side lanes for shared corridors, then non-overlapping labels per drawing size.
  const drawn = outWires.filter((w) => !w.tie);
  if (g.kind === 'perf') {
    const pts = laneOffsets(drawn);
    drawn.forEach((w, i) => { w.pts = pts[i]; });
  } else drawn.forEach((w) => { w.pts = [w.a, w.b]; });
  const nx = view.x1 - view.x0 + 1;
  const obstacles = parts.flatMap((p) => p.pins.map(({ hole: [x, y] }) => ({ x0: x - 0.4, x1: x + 0.4, y0: y - 0.4, y1: y + 0.4 })));
  const labelled = drawn.filter((w) => !w.bare);
  for (const [profile, width, lwMm, lhMm, maxH] of PROFILES[g.kind]) {
    const cellMm = Math.min((width - 5.5) / (g.kind === 'breadboard' ? 14 : nx), (maxH - 5.5) / (view.y1 - view.y0 + 1));
    const res = placeLabels(labelled.map((w) => ({ pts: w.pts })).concat(drawn.filter((w) => w.bare).map((w) => ({ pts: w.pts }))), obstacles, view, lwMm / cellMm, lhMm / cellMm);
    labelled.forEach((w, i) => { (w.lab ??= {})[profile] = [res[i].x, res[i].y, res[i].ax, res[i].ay]; });
  }

  const section = catalog.groups.find((x) => x.id === `${g.board}/${g.section}/${g.phase}`);
  return {
    id: g.id, board: g.board, kind: g.kind, section: g.section, title: section.title,
    cols: board.cols, rows: board.rows, view,
    parts: parts.map((p) => ({
      ref: p.ref, label: p.label, body: p.body, kind: p.kind, side: p.side, value: p.value ?? '', mpn: /^J_/.test(p.ref) ? '' : (p.mpn ?? ''), // connector part numbers are never shown
      ...PART_TYPES[p.ref], layout: layoutOf(p), bounds: p.bounds, pins: p.pins.map((pin) => ({ n: pin.number, label: pin.label, hole: pin.hole })),
    })),
    context: context.map((p) => ({ ref: p.ref, bounds: p.bounds, pins: p.pins.map((pin) => ({ n: pin.number, hole: pin.hole })) })),
    wires: outWires,
    cutlist: [...cutMap.values()].sort((a, b) => Number(a.bare) - Number(b.bare) || a.cut - b.cut),
    counts: {
      parts: parts.length,
      pins: parts.reduce((s, p) => s + p.pins.length, 0),
      wires: real.length,
      ties: outWires.length - real.length,
      insulated: real.filter((w) => !w.bare).length,
      bare: real.filter((w) => w.bare).length,
      wireMm: real.reduce((s, w) => s + w.cut, 0),
      pads: g.kind === 'breadboard' ? 0 : pads.size,
    },
  };
}

const groups = GROUPS.map(groupData);

// Schematics from tscircuit's local per-section SVGs.
for (const g of GROUPS) {
  const local = JSON.parse(fs.readFileSync(`${TS}/dist/boards/${g.board}/local.json`, 'utf8'));
  fs.writeFileSync(`build/${g.id}-schematic.svg`, cropSvg(local[`${g.section}@${g.phase}`] ?? local[g.section]));
}

const cp = catalog.checkpoints.find((c) => c.id === 'CP00');
fs.writeFileSync('build/cp00.json', JSON.stringify({ win: cp.win, equipment: cp.equipment, groups }, null, 1));
for (const g of groups) console.log(g.id, JSON.stringify(g.counts), g.cutlist.map((c) => `${c.qty}×${c.colorName} ${c.cut}mm`).join(', '), JSON.stringify(g.view));
