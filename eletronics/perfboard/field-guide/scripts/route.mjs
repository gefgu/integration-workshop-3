// Visual routing for the field guide drawings.
//  1. laneOffsets: wires that share a corridor are drawn side by side, never on top of each other.
//  2. placeLabels: each wire label sits next to its own wire and touches no line, pin or other label.
// Units are hole pitches unless a name ends in Mm.

const LANE = 0.2;
const EPS = 1e-6;

const segOf = (a, b) => ({ a, b, h: Math.abs(a[1] - b[1]) < EPS, v: Math.abs(a[0] - b[0]) < EPS });

// ---------- 1. lane offsets (axis-aligned perfboard paths) ----------
export function laneOffsets(wires) {
  const items = [];
  wires.forEach((w, wi) => {
    for (let i = 0; i < w.path.length - 1; i++) {
      const s = segOf(w.path[i], w.path[i + 1]);
      const orient = s.h ? 'H' : 'V';
      const coord = s.h ? s.a[1] : s.a[0];
      const lo = s.h ? Math.min(s.a[0], s.b[0]) : Math.min(s.a[1], s.b[1]);
      const hi = s.h ? Math.max(s.a[0], s.b[0]) : Math.max(s.a[1], s.b[1]);
      items.push({ wi, i, orient, coord, lo, hi, shift: 0 });
    }
  });
  const keys = new Map();
  for (const it of items) { const k = `${it.orient}${it.coord}`; (keys.get(k) ?? keys.set(k, []).get(k)).push(it); }
  for (const list of keys.values()) {
    list.sort((p, q) => p.lo - q.lo);
    // clusters of overlapping intervals
    let cluster = [], end = -Infinity;
    const flush = () => {
      if (!cluster.length) return;
      const lanes = []; // lane -> end of last interval
      for (const it of cluster) {
        let k = lanes.findIndex((e) => e <= it.lo + EPS);
        if (k < 0) { k = lanes.length; lanes.push(0); }
        lanes[k] = it.hi;
        it.lane = k;
      }
      const n = lanes.length;
      for (const it of cluster) it.shift = (it.lane - (n - 1) / 2) * LANE;
      cluster = [];
    };
    for (const it of list) {
      if (it.lo >= end - EPS) { flush(); end = it.hi; } else end = Math.max(end, it.hi);
      cluster.push(it);
    }
    flush();
  }
  return wires.map((w, wi) => {
    const segs = items.filter((it) => it.wi === wi).sort((p, q) => p.i - q.i);
    const pts = [w.path[0]];
    for (let i = 1; i < w.path.length - 1; i++) {
      const prev = segs[i - 1], next = segs[i], p = w.path[i];
      let x = p[0], y = p[1];
      for (const s of [prev, next]) { if (s.orient === 'V') x = p[0] + s.shift; else y = p[1] + s.shift; }
      pts.push([x, y]);
    }
    pts.push(w.path.at(-1));
    return pts;
  });
}

// ---------- 2. label placement ----------
const sample = (a, b, step = 0.08) => {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  return Array.from({ length: n + 1 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
};
const inside = (r, [x, y], pad) => x > r.x0 - pad && x < r.x1 + pad && y > r.y0 - pad && y < r.y1 + pad;
const rectsOverlap = (p, q, pad) => p.x0 < q.x1 + pad && p.x1 > q.x0 - pad && p.y0 < q.y1 + pad && p.y1 > q.y0 - pad;

// lines: [{wi, pts}], obstacles: [{x0,y0,x1,y1}], view: {x0,x1,y0,y1}
export function placeLabels(lines, obstacles, view, lw, lh) {
  const placed = [];
  const out = {};
  const order = lines.map((_, i) => i);
  for (const wi of order) {
    const { pts } = lines[wi];
    let best = null;
    const segs = pts.slice(1).map((p, i) => ({ a: pts[i], b: p, len: Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]) })).sort((p, q) => q.len - p.len);
    for (const s of segs) {
      if (s.len < 0.01) continue;
      const nx = -(s.b[1] - s.a[1]) / s.len, ny = (s.b[0] - s.a[0]) / s.len;
      const ext = (Math.abs(nx) * lw) / 2 + (Math.abs(ny) * lh) / 2;
      for (const t of [0.5, 0.35, 0.65, 0.2, 0.8, 0.12, 0.88]) {
        const cx0 = s.a[0] + (s.b[0] - s.a[0]) * t, cy0 = s.a[1] + (s.b[1] - s.a[1]) * t;
        for (let j = 0; j < 5; j++) for (const sign of [1, -1]) {
          const d = (ext + 0.22 + j * 0.3) * sign;
          const cx = cx0 + nx * d, cy = cy0 + ny * d;
          const r = { x0: cx - lw / 2, x1: cx + lw / 2, y0: cy - lh / 2, y1: cy + lh / 2 };
          let score = 0;
          if (r.x0 < view.x0 - 0.5 || r.x1 > view.x1 + 0.5 || r.y0 < view.y0 - 0.5 || r.y1 > view.y1 + 0.5) score += 50;
          for (const l of lines) for (let i = 1; i < l.pts.length; i++) {
            for (const pt of sample(l.pts[i - 1], l.pts[i])) if (inside(r, pt, 0.1)) { score += 1; break; }
          }
          // The leader (anchor on own wire -> label) must not cross another wire.
          for (const [li, l] of lines.entries()) { if (li === wi) continue;
            for (let i = 1; i < l.pts.length; i++) { let hit = false;
              for (const pt of sample(l.pts[i - 1], l.pts[i])) for (const lp of sample([cx0, cy0], [cx, cy], 0.1)) if (Math.hypot(pt[0] - lp[0], pt[1] - lp[1]) < 0.12) { hit = true; break; }
              if (hit) { score += 1; break; } } }
          for (const o of obstacles) if (rectsOverlap(r, o, 0.05)) score += 1;
          for (const q of placed) if (rectsOverlap(r, q, 0.1)) score += 3;
          score += (j * 0.01) + Math.abs(t - 0.5) * 0.02; // prefer close and central
          if (!best || score < best.score) best = { score, cx, cy, r, ax: cx0, ay: cy0 };
          if (score < 0.1) break;
        }
        if (best && best.score < 0.1) break;
      }
      if (best && best.score < 0.1) break;
    }
    placed.push(best.r);
    out[wi] = { x: +best.cx.toFixed(3), y: +best.cy.toFixed(3), ax: +best.ax.toFixed(3), ay: +best.ay.toFixed(3), clean: best.score < 1 };
  }
  return out;
}
