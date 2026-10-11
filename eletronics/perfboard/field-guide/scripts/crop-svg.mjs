// Crop a tscircuit schematic SVG to its drawn content so it fills the page.
export function cropSvg(svg) {
  const body = svg.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<rect class="boundary"[^>]*\/>/, '');
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y, pad = 0) => { if (!Number.isFinite(pad)) pad = 0; if (Number.isFinite(x) && Number.isFinite(y)) { x0 = Math.min(x0, x - pad); x1 = Math.max(x1, x + pad); y0 = Math.min(y0, y - pad); y1 = Math.max(y1, y + pad); } };
  for (const m of body.matchAll(/ d="([^"]+)"/g)) { const n = m[1].match(/-?\d+\.?\d*(?:e-?\d+)?/g)?.map(Number) ?? []; for (let i = 0; i + 1 < n.length; i += 2) add(n[i], n[i + 1]); }
  for (const m of body.matchAll(/<rect[^>]*>/g)) { const g = (k) => Number((m[0].match(new RegExp(` ${k}="(-?[\\d.]+(?:e-?\\d+)?)"`)) ?? [])[1]); add(g('x'), g('y')); add(g('x') + g('width'), g('y') + g('height')); }
  for (const m of body.matchAll(/<circle[^>]*>/g)) { const g = (k) => Number((m[0].match(new RegExp(` ${k}="(-?[\\d.]+(?:e-?\\d+)?)"`)) ?? [])[1]); add(g('cx'), g('cy'), g('r')); }
  for (const m of body.matchAll(/<text[^>]*x="(-?[\d.]+)" y="(-?[\d.]+)"[^>]*>([^<]*)</g)) add(Number(m[1]) + m[3].length * 6.2, Number(m[2]), 8), add(Number(m[1]), Number(m[2]), 8);
  const pad = 14;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const w = x1 - x0, h = y1 - y0;
  return svg
    .replace(/(<svg[^>]*?) width="[^"]*" height="[^"]*"/, `$1 width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}"`)
    .replace(/background-color: rgb\(245, 241, 237\)/, 'background-color: #ffffff');
}
