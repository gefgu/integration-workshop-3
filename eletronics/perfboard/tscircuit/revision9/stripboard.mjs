// Stripboard model for revision 9: connectivity from strips, cuts, links and component pins, plus SVG drawings.
import { ROWS, COLS, rowNets, cuts, parts, links } from './design.mjs';

const key = ([r, c]) => `${r},${c}`;
const NAME = { '12V_IN': '12V_IN', '12V_F': '12V_F', EDU_R: 'EDU_R', LED3_A: 'LED3_A', LED5_A: 'LED5_A' };

// --- connectivity -------------------------------------------------------------------------------
export function connectivity() {
  const parent = new Map();
  const find = (a) => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
  const add = (a) => { if (!parent.has(a)) parent.set(a, a); };
  const union = (a, b) => { add(a); add(b); parent.set(find(a), find(b)); };
  const cutAfter = new Set(cuts.map((c) => `${c.row},${c.after}`));
  for (let r = 1; r <= ROWS; r++) for (let c = 1; c <= COLS; c++) {
    add(`${r},${c}`);
    if (c < COLS && !cutAfter.has(`${r},${c}`)) union(`${r},${c}`, `${r},${c + 1}`);
  }
  for (const l of links) union(key(l.from), key(l.to));
  return { find, key };
}

export function checkDesign() {
  const issues = [];
  const { find, key: k } = connectivity();
  const used = new Map();
  const claim = (hole, what) => {
    if (hole[0] < 1 || hole[0] > ROWS || hole[1] < 1 || hole[1] > COLS) issues.push({ code: 'out-of-board', what, hole });
    if (used.has(k(hole))) issues.push({ code: 'hole-used-twice', what, other: used.get(k(hole)), hole });
    used.set(k(hole), what);
  };
  const pinList = [];
  for (const p of parts) for (const [label, net, hole] of p.pins) { claim(hole, `${p.ref}.${label}`); pinList.push({ ref: p.ref, label, net, hole }); }
  for (const l of links) { claim(l.from, `${l.id}.a`); claim(l.to, `${l.id}.b`); }
  // Group pins by strip component and compare with the intended net names.
  const byStrip = new Map();
  for (const pin of pinList) {
    const root = find(k(pin.hole));
    (byStrip.get(root) ?? byStrip.set(root, []).get(root)).push(pin);
  }
  const stripNets = new Map();
  for (const [root, pins] of byStrip) {
    const names = [...new Set(pins.map((p) => p.net))];
    if (names.length > 1) issues.push({ code: 'short', nets: names, pins: pins.map((p) => `${p.ref}.${p.label}`) });
    stripNets.set(root, names[0]);
  }
  const rootsByNet = new Map();
  for (const [root, name] of stripNets) (rootsByNet.get(name) ?? rootsByNet.set(name, []).get(name)).push(root);
  for (const [name, roots] of rootsByNet) if (roots.length > 1) issues.push({ code: 'open', net: name, segments: roots.length });
  // Unconnected interface pins must not touch any component pin or link.
  for (const p of parts) for (const hole of p.unconnected ?? []) {
    const root = find(k(hole));
    if (byStrip.has(root)) issues.push({ code: 'nc-pin-connected', ref: p.ref, hole, with: byStrip.get(root).map((q) => `${q.ref}.${q.label}`) });
    claim(hole, `${p.ref}.NC`);
  }
  // Every cut must separate two pins/links that would otherwise be joined (otherwise it is not needed).
  for (const cut of cuts) {
    const left = [cut.row, cut.after], right = [cut.row, cut.after + 1];
    if (find(k(left)) === find(k(right))) issues.push({ code: 'cut-ineffective', cut });
  }
  // Strip net names must match the dominant net of the pins on each row segment.
  return { issues, pins: pinList, nets: [...rootsByNet.keys()], pinCount: pinList.length };
}

// --- drawings ----------------------------------------------------------------------------------
const P = 30, M = 60, BOARD_W = (COLS - 1) * P, BOARD_H = (ROWS - 1) * P;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLORS = { GND: '#202124', '3V3_SYS': '#e53935', '5V_SYS': '#e53935', '12V_SYS': '#e53935', '12V_IN': '#e53935', '12V_F': '#e53935', '5V_EDU': '#fb8c00',
  EDU_SW: '#fb8c00', EDU_R: '#fb8c00', GATE: '#1976d2', MID: '#1976d2', EDU_PWR_EN: '#388e3c', ROUTER_ALIVE: '#388e3c', EDU_SENSE: '#8e44ad' };
const colorOf = (n) => COLORS[n] ?? '#546e7a';
const PART_FILL = { resistor: '#ffe0a3', ptc: '#ffe0a3', capacitor: '#ddc7f5', led: '#ffb3b3', diode: '#cfd8dc', fuse: '#fff3b0', header: '#eeeeee', module: '#c8e6c9', pmos: '#cfd8dc', nmos: '#cfd8dc' };

const xy = (hole, mirror) => {
  const [r, c] = hole;
  return [M + ((mirror ? COLS - c : c - 1)) * P, M + (r - 1) * P];
};

function rowLabelNets() {
  // Net name per row for the left/right margin labels, derived from the pins on the row.
  const { find, key: k } = connectivity();
  const names = new Map();
  for (const p of parts) for (const [, net, hole] of p.pins) names.set(find(k(hole)), net);
  const out = [];
  for (let r = 1; r <= ROWS; r++) {
    const segs = [];
    let start = 1;
    const cutAfter = new Set(cuts.filter((c) => c.row === r).map((c) => c.after));
    for (let c = 1; c <= COLS; c++) if (c === COLS || cutAfter.has(c)) { segs.push([start, c]); start = c + 1; }
    out.push({ row: r, segs: segs.map(([a, b]) => ({ a, b, net: names.get(find(k([r, a]))) ?? '' })) });
  }
  return out;
}

function frame(inner, mirror, title) {
  const W = M * 2 + BOARD_W + 120, H = M * 2 + BOARD_H + 56;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="DejaVu Sans, Arial, sans-serif">
<rect width="${W}" height="${H}" fill="#fafaf7"/>
<text x="${M - 30}" y="16" font-size="15" font-weight="700" fill="#203545">${esc(title)}</text>
<rect x="${M - 22}" y="${M - 22}" width="${BOARD_W + 44}" height="${BOARD_H + 44}" rx="6" fill="${mirror ? '#f0d9a0' : '#e8efe2'}" stroke="#5b6b5f"/>
${inner}
</svg>`;
}

const colTicks = (mirror) => {
  let s = '';
  for (let c = 1; c <= COLS; c++) if (c === 1 || c % 5 === 0 || c === COLS) {
    const [x] = xy([1, c], mirror);
    s += `<text x="${x}" y="${M - 28}" font-size="9" text-anchor="middle" fill="#5b6b5f">${c}</text>`;
  }
  return s;
};

function strips(mirror) {
  const rl = rowLabelNets();
  let s = '';
  for (const { row, segs } of rl) {
    const [, y] = xy([row, 1], mirror);
    for (const seg of segs) {
      const [x1] = xy([row, seg.a], mirror), [x2] = xy([row, seg.b], mirror);
      const left = Math.min(x1, x2) - 10, w = Math.abs(x2 - x1) + 20;
      s += mirror
        ? `<rect x="${left}" y="${y - 7}" width="${w}" height="14" rx="3" fill="#d9a441" stroke="#a87820" stroke-width=".8"><title>row ${row}: ${esc(seg.net)}</title></rect>`
        : `<rect x="${left}" y="${y - 7}" width="${w}" height="14" rx="3" fill="#cfd8cd" opacity=".55"/>`;
    }
    const label = `R${row}`;
    s += `<text x="${mirror ? M + BOARD_W + 36 : M - 40}" y="${y + 3}" font-size="9" fill="#37474f" text-anchor="${mirror ? 'start' : 'end'}">${label}</text>`;
  }
  return s;
}

function holes(mirror) {
  let s = '';
  for (let r = 1; r <= ROWS; r++) for (let c = 1; c <= COLS; c++) {
    const [x, y] = xy([r, c], mirror);
    s += `<circle cx="${x}" cy="${y}" r="2.1" fill="#fafaf7" stroke="#8d8d80" stroke-width=".6"/>`;
  }
  return s;
}

function cutMarks(mirror) {
  let s = '';
  for (const c of cuts) {
    const [x1, y] = xy([c.row, c.after], mirror), [x2] = xy([c.row, c.after + 1], mirror);
    const x = (x1 + x2) / 2;
    s += `<g><title>cut row ${c.row} between columns ${c.after} and ${c.after + 1}: ${esc(c.why)}</title><rect x="${x - 4}" y="${y - 9}" width="8" height="18" fill="#fafaf7" stroke="#d32f2f" stroke-width="1.4"/><path d="M${x - 6} ${y - 7}L${x + 6} ${y + 7}M${x + 6} ${y - 7}L${x - 6} ${y + 7}" stroke="#d32f2f" stroke-width="1.8"/></g>`;
  }
  return s;
}

function linkWires(mirror) {
  return links.map((l) => {
    const [x1, y1] = xy(l.from, mirror), [x2, y2] = xy(l.to, mirror);
    const col = colorOf(l.net);
    const bx = x1 + 16;
    return `<g><title>${l.id} (${l.net}): ${esc(l.why)}</title><path d="M${x1} ${y1}H${bx}V${y2}H${x2}" fill="none" stroke="${col}" stroke-width="3" stroke-linejoin="round" ${mirror ? 'stroke-dasharray="1 0"' : ''}/><circle cx="${x1}" cy="${y1}" r="4" fill="${col}"/><circle cx="${x2}" cy="${y2}" r="4" fill="${col}"/><text x="${bx + 4}" y="${(y1 + y2) / 2}" font-size="10" font-weight="700" fill="${col}">${l.id}</text></g>`;
  }).join('');
}

function partBody(p, mirror) {
  const pts = p.pins.map((q) => xy(q[2], mirror));
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const fill = PART_FILL[p.kind] ?? '#eeeeee';
  const vertical = x1 - x0 < 1, horizontal = y1 - y0 < 1;
  let s = '';
  if (p.kind === 'header' || p.kind === 'module') {
    const [pc] = [p.pins.map((q) => q[2])];
    const allRows = pc.map((h) => h[0]), r0 = Math.min(...allRows, ...(p.unconnected ?? []).map((h) => h[0])), r1 = Math.max(...allRows, ...(p.unconnected ?? []).map((h) => h[0]));
    const [hx, hy0] = xy([r0, pc[0][1]], mirror), [, hy1] = xy([r1, pc[0][1]], mirror);
    s += `<rect x="${hx - 9}" y="${hy0 - 9}" width="18" height="${hy1 - hy0 + 18}" rx="3" fill="${fill}" stroke="#455a64" stroke-width="1.2"/>`;
  } else if (p.kind === 'pmos' || p.kind === 'nmos') {
    s += `<rect x="${x0 - 8}" y="${y0 - 9}" width="16" height="${y1 - y0 + 18}" rx="4" fill="${fill}" stroke="#37474f" stroke-width="1.2"/>`;
  } else if (vertical) {
    s += `<rect x="${x0 - 5}" y="${y0 + 4}" width="10" height="${Math.max(10, y1 - y0 - 8)}" rx="4" fill="${fill}" stroke="#6d6d60" stroke-width="1"/>`;
  } else if (horizontal) {
    s += `<rect x="${x0 + 4}" y="${y0 - 6}" width="${Math.max(10, x1 - x0 - 8)}" height="12" rx="5" fill="${fill}" stroke="#6d6d60" stroke-width="1"/>`;
  } else {
    s += `<rect x="${x0 - 6}" y="${y0 - 6}" width="${x1 - x0 + 12}" height="${y1 - y0 + 12}" rx="4" fill="${fill}" stroke="#6d6d60"/>`;
  }
  return s;
}

function partLabel(p, mirror) {
  const pts = p.pins.map((q) => xy(q[2], mirror));
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const horizontal = y1 - y0 < 1;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let [tx, ty, anchor] = horizontal ? [cx, cy - 11, 'middle'] : [x1 + 12, cy + 3, 'start'];
  if (p.kind === 'header' && p.ref === 'J_OUT') [tx, ty, anchor] = [x0 - 14, cy, 'end'];
  if (p.ref === 'J_IN') [tx, ty, anchor] = [x0 - 14, cy + 3, 'end'];
  if (p.kind === 'module') [tx, ty, anchor] = [x0, y0 - 14, 'middle'];
  // Hand-placed labels where neighbouring parts would collide with the default spot.
  const nudge = { R_LED3: [0, 28, 'middle'], R_LED5: [0, 28, 'middle'], LED3: [-12, 4, 'end'], LED5: [14, 20, 'start'],
    R_PD_RA: [-12, 3, 'end'], R_DT: [12, 3, 'start'], R_DB: [12, 3, 'start'], R_GP: [12, 3, 'start'] }[p.ref];
  if (nudge) [tx, ty, anchor] = [nudge[2] === 'middle' ? cx : (nudge[2] === 'end' ? x0 : x1) + nudge[0], (nudge[2] === 'middle' ? cy : cy) + nudge[1] - (nudge[2] === 'middle' ? 0 : 0), nudge[2]];
  return `<text x="${tx}" y="${ty}" font-size="9.5" font-weight="700" fill="#102027" text-anchor="${anchor}">${esc(p.ref)}</text>`;
}

export function topSvg() {
  const inner = colTicks(false) + strips(false) + holes(false) + cutMarks(false) + linkWires(false) +
    parts.map((p) => partBody(p, false)).join('') +
    parts.flatMap((p) => p.pins.map(([, net, hole]) => { const [x, y] = xy(hole, false); return `<circle cx="${x}" cy="${y}" r="3.6" fill="${colorOf(net)}" stroke="#fff" stroke-width=".8"/>`; })).join('') +
    parts.flatMap((p) => (p.unconnected ?? []).map((hole) => { const [x, y] = xy(hole, false); return `<circle cx="${x}" cy="${y}" r="3.6" fill="none" stroke="#b71c1c" stroke-width="1.2" stroke-dasharray="2 1"/>`; })).join('') +
    parts.map((p) => partLabel(p, false)).join('');
  return frame(inner, false, 'Revision 9 power stripboard — TOP (component side)');
}

export function undersideSvg() {
  const m = true;
  let pad = '';
  const { find, key: k } = connectivity();
  void find; void k;
  for (const p of parts) for (const [label, net, hole] of p.pins) {
    const [x, y] = xy(hole, m);
    pad += `<g><title>${esc(p.ref)}.${esc(label)} → ${esc(net)}</title><circle cx="${x}" cy="${y}" r="5.2" fill="#c0c0c0" stroke="#555" stroke-width=".8"/><circle cx="${x}" cy="${y}" r="2" fill="#555"/></g>`;
  }
  const refs = parts.map((p) => {
    const pts = p.pins.map((q) => xy(q[2], m));
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    return `<text x="${(Math.min(...xs) + Math.max(...xs)) / 2}" y="${Math.min(...ys) - 11}" font-size="8.5" font-weight="700" fill="#4e342e" text-anchor="middle">${esc(p.ref)}</text>`;
  }).join('');
  const inner = colTicks(m).replace(/>(\d+)</g, (_, c) => `>${c}<`) + strips(m) + holes(m) + cutMarks(m) + linkWires(m) + pad + refs;
  return frame(inner, true, 'Revision 9 power stripboard — UNDERSIDE (mirrored; copper strips, cuts and solder points)');
}
