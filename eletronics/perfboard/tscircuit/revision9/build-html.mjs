// Writes the revision 9 tables (CSV) and the single HTML guide: schematic, stripboard drawings, build order, open issues.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parts, cuts, links, rowNets, ROWS, COLS, mpnFor, revision } from './design.mjs';
import { checkDesign } from './stripboard.mjs';

const here = new URL('./', import.meta.url);
const read = (name) => readFileSync(new URL(name, here), 'utf8');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
const hole = ([r, c]) => `row ${r}, col ${c}`;

const check = checkDesign();
const schematicChecks = existsSync(new URL('schematic-checks.json', here)) ? JSON.parse(read('schematic-checks.json')) : { status: 'not built' };
const pinCount = check.pinCount;
const joints = pinCount + links.length * 2;

// --- CSV tables -------------------------------------------------------------------------------
const bomRows = [['ref', 'part', 'value', 'manufacturer part number', 'mounting', 'role']];
for (const p of parts) bomRows.push([p.ref, p.kind, p.value, mpnFor(p) ?? 'not selected', p.mount, p.role]);
writeFileSync(new URL('bom.csv', here), csv(bomRows));
writeFileSync(new URL('cuts.csv', here), csv([['row', 'between columns', 'reason'], ...cuts.map((c) => [c.row, `${c.after} and ${c.after + 1}`, c.why])]));
writeFileSync(new URL('links.csv', here), csv([['id', 'net', 'from', 'to', 'reason'], ...links.map((l) => [l.id, l.net, hole(l.from), hole(l.to), l.why])]));
writeFileSync(new URL('solder-joints.csv', here), csv([['ref', 'pin', 'net', 'row', 'column'], ...parts.flatMap((p) => p.pins.map(([label, net, h]) => [p.ref, label, net, h[0], h[1]]))]));

// --- comparison with revision 8 (read from its generated table) ---------------------------------
let rev8 = {};
const cmp = new URL('../revision8/lower/comparison.csv', here);
if (existsSync(cmp)) for (const line of readFileSync(cmp, 'utf8').trim().split('\n').slice(1)) {
  const [board, metric, , r8] = line.split(',').map((x) => x.replace(/"/g, ''));
  if (board === 'power') rev8[metric] = Number(r8);
}

const steps = [
  { title: 'Cut the strips first', do: `Cut the 7 strips listed below with a 3 mm drill bit (a few turns by hand). Clear the copper dust and look through each cut against light.`,
    test: 'Continuity: every cut must read open (no beep) between the two neighbouring holes. Check the 3 cuts next to J_OUT twice.' },
  { title: 'Input stage', do: 'Solder J_IN, fuse holder F1 (fuse not fitted yet), D1 (band toward row 15), C2, C1 (+ toward row 3) and link L3.',
    test: 'Fit the fuse. Bench supply at 12 V, limit 200 mA: row 3 (12V_SYS) reads about 11.5–11.8 V. Reverse the supply: no current flows.' },
  { title: 'Buck modules', do: 'Before connecting, set the 5 V module to 5.00 V and the 3.3 V module to 3.30 V with no load. Check each module for a 0 Ω connection between IN- and OUT-, then solder its three leads (rows and columns in the pin table). Add R_LED5, LED5, R_LED3, LED3.',
    test: 'Row 4 (5V_SYS) reads 5.00 V and row 2 (3V3_SYS) 3.30 V. Both LEDs light. Never exceed 5.05 V on row 4.' },
  { title: 'Student-rail switch', do: 'Solder Q1, R_GP, Q2, Q3, R_PD_EN, R_PD_RA and links L1 and L2.',
    test: 'EDU_PWR_EN and ROUTER_ALIVE open: row 11 (5V_EDU) reads 0 V. Tie both rows to 3V3_SYS with a clip lead: row 11 rises to about 5 V. Remove either lead: it falls to 0 V.' },
  { title: 'Current limit and monitor', do: 'Solder R_S, F_EDU, R_DT, R_DB and C_SENSE.',
    test: 'With the rail ON, put a milliammeter between row 11 and ground: it reads 10–11.5 mA (never above 12 mA). The monitor row 12 reads half of row 11.' },
  { title: 'Interface header', do: 'Pull header pins 5, 6 and 8 out of the plastic, then solder J_OUT.',
    test: 'Continuity from each cable pin to its strip; pins 5, 6 and 8 have no pin. No neighbour shorts.' },
];

const strips = [];
for (let r = 1; r <= ROWS; r++) {
  const segs = [];
  let start = 1;
  const after = new Set(cuts.filter((c) => c.row === r).map((c) => c.after));
  for (let c = 1; c <= COLS; c++) if (c === COLS || after.has(c)) { segs.push([start, c]); start = c + 1; }
  const names = segs.map(([a, b]) => {
    const pin = parts.flatMap((p) => p.pins).find((q) => q[2][0] === r && q[2][1] >= a && q[2][1] <= b);
    return `${pin ? pin[1] : '—'} (cols ${a}–${b})`;
  });
  strips.push([r, ...[names.join('  |  ')]]);
}

const bomTable = `<table><thead><tr><th>Ref</th><th>Part</th><th>Value</th><th>Part number</th><th>Mounting</th><th>Role</th></tr></thead><tbody>${parts.map((p) => `<tr><td><b>${esc(p.ref)}</b></td><td>${esc(p.kind)}</td><td>${esc(p.value)}</td><td>${esc(mpnFor(p) ?? '—')}</td><td>${esc(p.mount)}</td><td>${esc(p.role)}</td></tr>`).join('')}</tbody></table>`;
const pinTable = `<table><thead><tr><th>Ref</th><th>Pin</th><th>Net</th><th>Hole</th></tr></thead><tbody>${parts.flatMap((p) => p.pins.map(([l, n, h]) => `<tr><td>${esc(p.ref)}</td><td>${esc(l)}</td><td>${esc(n)}</td><td>row ${h[0]}, col ${h[1]}</td></tr>`)).join('')}</tbody></table>`;
const cutTable = `<table><thead><tr><th>#</th><th>Row</th><th>Cut between columns</th><th>Why</th></tr></thead><tbody>${cuts.map((c, i) => `<tr><td>${i + 1}</td><td>${c.row}</td><td>${c.after} and ${c.after + 1}</td><td>${esc(c.why)}</td></tr>`).join('')}</tbody></table>`;
const linkTable = `<table><thead><tr><th>Link</th><th>Net</th><th>From</th><th>To</th><th>Why</th></tr></thead><tbody>${links.map((l) => `<tr><td><b>${l.id}</b></td><td>${esc(l.net)}</td><td>${hole(l.from)}</td><td>${hole(l.to)}</td><td>${esc(l.why)}</td></tr>`).join('')}</tbody></table>`;
const stripTable = `<table><thead><tr><th>Row</th><th>Strip net</th></tr></thead><tbody>${strips.map(([r, t]) => `<tr><td>${r}</td><td>${esc(t)}</td></tr>`).join('')}</tbody></table>`;
const iface = [[1, 'GND', 'ground'], [2, '3V3_SYS', 'out: 3.3 V system rail'], [3, '12V_SYS', 'out: 12 V after fuse and diode'], [4, '5V_SYS', 'out: 5 V system rail'],
  [5, '—', 'pin pulled, not connected (was fault)'], [6, '—', 'pin pulled, not connected (was fault reset)'], [7, 'EDU_PWR_EN', 'in: 3.3 V = enable the student rail'],
  [8, '—', 'pin pulled, not connected (was current sense)'], [9, 'ROUTER_ALIVE', 'in: 3.3 V = router heartbeat is fresh'], [10, 'GND', 'ground'],
  [11, '5V_EDU', 'out: student rail (current limited)'], [12, 'EDU_SENSE', 'out: half of 5V_EDU, to an ESP32 ADC pin']];
const ifaceTable = `<table><thead><tr><th>Pin</th><th>Signal</th><th>Meaning</th></tr></thead><tbody>${iface.map(([n, s, m]) => `<tr><td>${n}</td><td>${s}</td><td>${m}</td></tr>`).join('')}</tbody></table>`;

const num = (v) => (v === undefined ? '—' : v);
const compare = `<table><thead><tr><th></th><th>Revision 8 power board</th><th>Revision 9 stripboard</th></tr></thead><tbody>
<tr><td>Wire runs</td><td>${num(rev8.physicalWireRuns)}</td><td><b>${links.length}</b> short top-side links</td></tr>
<tr><td>Solder joints</td><td>${rev8.wireEndpointSolderJoints ? rev8.wireEndpointSolderJoints + rev8.componentPinJoints : '—'}</td><td><b>${joints}</b> (${pinCount} pin joints + ${links.length * 2} link ends)</td></tr>
<tr><td>Strip cuts</td><td>0</td><td>${cuts.length}</td></tr>
<tr><td>Wire crossings</td><td>${num(rev8.crossings)}</td><td><b>0</b> (the copper strips do the routing)</td></tr>
<tr><td>Wire length</td><td>${rev8.lengthMm ? (rev8.lengthMm / 1000).toFixed(1) + ' m' : '—'}</td><td>about 6 cm</td></tr>
<tr><td>Parts</td><td>about 60</td><td>${parts.length} (including 2 buck modules)</td></tr></tbody></table>`;

const lost = ['Over-voltage and under-voltage guards (LTC4365): nothing cuts a failed buck, so measure the module before connecting.',
  'Precise 12 mA trip and fault latch: replaced by the 470 Ω series resistor (short-circuit current at most 11.2 mA at 5.25 V) with the PTC as backup.',
  'Fault output and CURRENT_SENSE: the ESP32 reads EDU_SENSE and switches EDU_PWR_EN off in software.',
  'No hardware ceiling on 5V_SYS: the student rail can only rise to the buck setting. Set it to 5.00 V.'];
const open = ['2N7000 gate threshold (up to 3 V) is close to the 3.3 V enable signal: bench-check that both transistors turn on, or swap in a logic-level n-channel part.',
  'Voltage sag: at 2 mA the student rail drops about 1 V through R_S. Confirm the student circuits can live with that.',
  'Fuse holder: a 5×20 mm holder is about 22.5 mm between pins and the holes give 22.86 mm (9 holes). Check the actual holder.',
  'Buck modules must have a common negative (IN- joined to OUT-). Measure it. A module with isolated outputs needs a fourth lead.',
  'Q1 body diode: a voltage on the student rail above 5V_SYS can feed back through the diode. Do not power student circuits from outside.',
  'C1 (10 mm body) may need to lie flat or sit off the board; check the clearance next to the buck leads.',
  'Joints, cuts and links are counted from the generated model. Build time is an estimate, not a measurement. No bench test has been done.'];

const css = `body{font:15px/1.5 system-ui,sans-serif;max-width:1500px;margin:1.5rem auto;padding:0 1rem;color:#203545;background:#f4f7f5}
h1{margin:.2rem 0}h2{margin-top:2rem;border-bottom:2px solid #cbd5d0;padding-bottom:.2rem}article{background:#fff;border:1px solid #cbd5d0;border-radius:8px;padding:1rem;margin:1rem 0}
table{border-collapse:collapse;width:100%;margin:.6rem 0;font-size:14px}th,td{border:1px solid #d3dcd7;padding:.3rem .5rem;text-align:left;vertical-align:top}th{background:#eaf1ec}
.scroll{overflow-x:auto;background:#fafaf7;border:1px solid #d3dcd7;border-radius:6px}.scroll svg{display:block;max-width:none}
.note{background:#fff7e0;border:1px solid #e6c765;border-radius:6px;padding:.6rem .9rem}.ok{color:#1b6e2d;font-weight:700}ol.steps>li{margin:.7rem 0}code{background:#eef2ef;padding:0 .25rem;border-radius:3px}
.legend span{display:inline-block;margin-right:1rem}.sw{display:inline-block;width:1rem;height:.5rem;border-radius:2px;margin-right:.3rem;vertical-align:middle}`;

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revision 9 power stripboard</title><style>${css}</style>
<h1>Revision 9 — minimal power board on stripboard</h1>
<p class="note"><b>Candidate, not released.</b> A deliberately simple replacement for the revision 8 power board: one 12 V input, two buck modules and one switched, current-limited student rail. It gives up the voltage guards, the precise 12 mA trip and the fault latch (see below). Generated drawings and checks are not bench evidence. Build status: schematic checks <b>${esc(schematicChecks.status)}</b>, stripboard connectivity <b class="ok">${check.issues.length ? 'FAIL' : 'pass'}</b>.</p>

<h2>What you get</h2>
<article>${compare}<p>Revision 8 figures come from <code>revision8/lower/comparison.csv</code>. Revision 9 figures are counted from the stripboard model (<code>design.mjs</code>).</p></article>

<h2>Schematic</h2>
<article><p>Drawn with tscircuit from the same part list as the stripboard layout; a script checks that every net matches the layout, pin by pin. Series connections are wires; other pins end in a net label.</p>
<div class="scroll">${existsSync(new URL('assets/schematic.svg', here)) ? read('assets/schematic.svg') : '<p>Run the schematic build first.</p>'}</div>
<h3>How it works</h3><ul>
<li><code>12V_IN → F1 → D1 → 12V_SYS</code> feeds two buck modules (5 V and 3.3 V). Each rail has a status LED.</li>
<li><code>Q1</code> (P-channel) switches <code>5V_SYS</code> to the student rail. <code>R_GP</code> pulls its gate high, so the rail is <b>off</b> by default and with no power on the router.</li>
<li><code>Q2</code> and <code>Q3</code> are in series: both need a high signal (<code>EDU_PWR_EN</code> and <code>ROUTER_ALIVE</code>) to pull the gate low. Pull-downs keep both off if a wire is lost.</li>
<li><code>R_S</code> (470 Ω) limits a short on the student rail to at most 11.2 mA at 5.25 V. <code>F_EDU</code> is the backup. <code>R_DT/R_DB/C_SENSE</code> give the ESP32 half the rail voltage to measure.</li></ul></article>

<h2>Stripboard</h2>
<article><p>${COLS} columns × ${ROWS} rows (about ${(COLS * 2.54 - 2.54).toFixed(0)} × ${(ROWS * 2.54 - 2.54).toFixed(0)} mm of holes; use a board a little larger). Strips run along the rows. Hole positions are written as <b>row, column</b> counted from the top-left of the top view. Red crosses are strip cuts. Coloured lines (L1–L3) are insulated link wires on the top; their ends are soldered under the board. Dashed red rings on J_OUT are pulled pins.</p>
<div class="legend"><span><i class="sw" style="background:#202124"></i>GND</span><span><i class="sw" style="background:#e53935"></i>12 V / 5 V / 3.3 V</span><span><i class="sw" style="background:#fb8c00"></i>student rail</span><span><i class="sw" style="background:#1976d2"></i>gate and MID</span><span><i class="sw" style="background:#388e3c"></i>enable and heartbeat</span><span><i class="sw" style="background:#8e44ad"></i>monitor</span></div>
<h3>Top (component side)</h3><div class="scroll">${read('assets/stripboard-top.svg')}</div>
<h3>Underside (mirrored: copper side as you see it when you flip the board left to right)</h3><div class="scroll">${read('assets/stripboard-underside.svg')}</div></article>

<h2>Build order and checks</h2>
<article><ol class="steps">${steps.map((s) => `<li><b>${esc(s.title)}.</b> ${esc(s.do)}<br><i>Check:</i> ${esc(s.test)}</li>`).join('')}</ol>
<h3>Strip cuts (${cuts.length})</h3>${cutTable}<h3>Link wires (${links.length})</h3>${linkTable}</article>

<h2>Interface header J_OUT</h2><article>${ifaceTable}<p>The pin map is new for revision 9 and is <b>not</b> compatible with the revision 8 ten-pin cable. The matrix and router boards need a matching receiver.</p></article>

<h2>What you give up</h2><article><ul>${lost.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></article>

<h2>Open issues</h2><article><ul>${open.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></article>

<h2>Tables</h2>
<article><h3>Parts</h3>${bomTable}<h3>Strip map</h3>${stripTable}<h3>Solder joints</h3><details><summary>Show all ${pinCount} pin joints</summary>${pinTable}</details>
<p>The same data is in <code>bom.csv</code>, <code>cuts.csv</code>, <code>links.csv</code> and <code>solder-joints.csv</code>. Revision: ${esc(revision)}.</p></article>
</html>
`;
writeFileSync(new URL('simple-power.html', here), html);
console.log(`revision9 html written: ${parts.length} parts, ${joints} joints, ${cuts.length} cuts, ${links.length} links`);
