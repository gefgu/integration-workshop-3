import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { boards } from './design/revision8.mjs';

const out = new URL('./assets/', import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const save = (name: string, value: string) => writeFileSync(new URL(name, out), value);
const esc = (s: string) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function drawing(board: any, underside = false) {
  const scale = 6, x0 = 52, y0 = 40;
  const width = x0 * 2 + (board.cols + 1) * scale;
  const height = y0 * 2 + (board.rows + 1) * scale;
  const pos = ([x, y]: number[]) => [x0 + (underside ? board.cols + 1 - x : x) * scale, y0 + y * scale];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><style>text{font-family:Arial,sans-serif;fill:#203545}.coord{font-size:7px}</style><text x="18" y="22" font-size="15" font-weight="bold">${board.id.toUpperCase()} — ${underside ? 'UNDERSIDE' : 'TOP'}</text><rect x="${x0}" y="${y0}" width="${(board.cols + 1) * scale}" height="${(board.rows + 1) * scale}" rx="8" fill="#e6f0e5" stroke="#60846a" stroke-width="2"/>`;
  for (let y = 1; y <= board.rows; y++) for (let x = 1; x <= board.cols; x++) {
    const [cx, cy] = pos([x, y]); svg += `<circle cx="${cx}" cy="${cy}" r="1.65" fill="#b8c2ac"/>`;
  }
  for (let x = 1; x <= board.cols; x++) {
    const [cx, cy] = pos([x, 1]); svg += `<text class="coord" x="${cx}" y="${cy - (x % 2 ? 10 : 2)}" text-anchor="middle">${x}</text>`;
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
    for (const wire of board.wires.filter((w: any) => !w.physicalRunId)) {
      const points = wire.path.map(pos).map((p: number[]) => p.join(',')).join(' ');
      const color = wire.insulated ? (wire.color ?? '#426caa') : '#bf8747';
      if (color === '#ffffff') svg += `<polyline points="${points}" fill="none" stroke="#53636c" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>`;
      svg += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="${wire.insulated ? 2.4 : 3.4}" stroke-linecap="round" stroke-linejoin="round"/>`;
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

let page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Revision 8 contact boards</title><style>body{font:15px system-ui;max-width:1450px;margin:1.5rem auto;padding:0 1rem;color:#203545;background:#f4f7f5}article{background:white;padding:1rem;margin:1rem 0;border:1px solid #cbd5d0;border-radius:8px}object{display:block;width:100%;max-height:80vh;object-fit:contain;margin:.5rem 0}section{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}.legend{display:flex;flex-wrap:wrap;gap:.7rem 1.1rem;margin:.7rem 0}.key{display:inline-flex;align-items:center;gap:.35rem}.swatch{width:1.2rem;height:.35rem;border:1px solid #53636c;border-radius:2px}</style><h1>Revision 8 contact boards</h1><p>Gold: contact solder runs. Colored: underside wires. Underside view is mirrored. NODE connector pins 1–11 use the six-color sequence repeatedly.</p><div class="legend"><span class="key"><i class="swatch" style="background:#e53935"></i>Red</span><span class="key"><i class="swatch" style="background:#202124"></i>Black</span><span class="key"><i class="swatch" style="background:#1976d2"></i>Blue</span><span class="key"><i class="swatch" style="background:white"></i>White</span><span class="key"><i class="swatch" style="background:#fbc02d"></i>Yellow</span><span class="key"><i class="swatch" style="background:#388e3c"></i>Green</span></div>`;

for (const board of boards) {
  save(`${board.id}-top.svg`, drawing(board));
  save(`${board.id}-underside.svg`, drawing(board, true));
  const connector = board.parts.find((p: any) => p.origin === 'J_NODE_BUNDLE');
  page += `<article><h2>${board.id.toUpperCase()}</h2><section><div><object aria-label="${board.id} top view" data="assets/${board.id}-top.svg" type="image/svg+xml"></object></div><div><object aria-label="${board.id} mirrored underside" data="assets/${board.id}-underside.svg" type="image/svg+xml"></object></div></section></article>`;
}
page += '</html>';
writeFileSync(new URL('./contact-boards.html', import.meta.url), page);
console.log('Generated revision8 contact board top/bottom views.');
