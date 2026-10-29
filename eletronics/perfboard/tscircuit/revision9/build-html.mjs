// Writes the revision 9 tables (CSV) and the single HTML guide: schematic, stripboard drawings, build order, open issues.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parts, cuts, links, ROWS, COLS, mpnFor, revision, inputJackGuide, busForNet } from './design.mjs';
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
  { title: 'Map the copper with a meter', do: `This portrait drawing follows the supplied board orientation: ${ROWS} holes along its long axis × ${COLS} across. It models longitudinal buses and separate short island banks inferred from the underside photo. No cuts are specified; verify every copper lane with a meter before soldering.`,
    test: 'Use continuity mode to confirm the long buses and the short isolated islands match the drawn underside. If the lane pattern differs, stop and remap before fitting parts.' },
  { title: 'Input stage', do: 'Keep the female barrel socket off-board and secure it mechanically. With the board disconnected, power the adapter and use a meter to verify about +12 V at the center relative to the sleeve; unplug it before wiring. Connect the socket center (+) by an insulated pigtail to J_IN 12V and sleeve (−) to J_IN GND. Solder J_IN, F1 with its 2 A fuse, D1 (band on the 12V_SYS side), C1/C2 and the listed insulated jumpers for the input net.',
    test: 'Use a current-limited 12 V bench supply for first board power-up, limit 200 mA: the D1 cathode / 12V_SYS landing reads about 11.5–11.8 V. The pictured adapter is rated 12 V DC, 3 A; the board input fuse remains 2 A.' },
  { title: 'Buck modules', do: 'The drawing shows three landing holes per converter; mount each module off-board. The blue XL4015 is assigned to 5 V; the red HW-155/LM2596 is assigned to 3.3 V. Before wiring, identify IN+, IN−, OUT+ and OUT− from the board labels, then confirm IN− and OUT− are common with a meter. Set the blue module to 5.00 V and red module to 3.30 V with no load. Run three insulated wires from each module: IN+, common GND, and OUT+.',
    test: 'Measure the 5V_SYS landing at 5.00 V and the 3V3_SYS landing at 3.30 V. The converters have onboard indicators; they are not separate stripboard parts. Never exceed 5.05 V on 5V_SYS.' },
  { title: 'Student-rail switch', do: 'Solder Q1, R_GP, Q2, Q3, R_PD_EN and R_PD_RA; install every jumper listed for these nets.',
    test: 'EDU_PWR_EN and ROUTER_ALIVE open: the 5V_EDU output pad reads 0 V. Tie both input signals to 3V3_SYS with clip leads: the 5V_EDU pad rises to about 5 V. Remove either lead: it falls to 0 V.' },
  { title: 'Current limit and monitor', do: 'Solder R_S, R_DT, R_DB and C_SENSE. Follow the 5V_EDU jumper entries; MF-R050 is omitted.',
    test: 'With the rail ON, put a milliammeter between 5V_EDU and GND: it reads 10–11.5 mA (never above 12 mA). The EDU_SENSE pad reads about half of 5V_EDU.' },
  { title: 'Interface header', do: 'Pull header pins 5, 6 and 8 out of the plastic, then solder J_OUT.',
    test: 'Continuity from each cable pin to its pad; pins 5, 6 and 8 have no pin. No neighbour shorts.' },
];

const strips = [
  ...Object.entries(busForNet).map(([net,col])=>[`Bus column ${col}`,net]),
  ['Bus column 26','GND (linked to bus column 10)'],
  ['Island banks','Short isolated horizontal copper segments; EDU_SW, 3V3_SYS and EDU_SENSE use these.'],
  ['Other pads','Individually isolated holes'],
];

const bomTable = `<table><thead><tr><th>Ref</th><th>Part</th><th>Value</th><th>Part number</th><th>Mounting</th><th>Role</th></tr></thead><tbody>${parts.map((p) => `<tr><td><b>${esc(p.ref)}</b></td><td>${esc(p.kind)}</td><td>${esc(p.value)}</td><td>${esc(mpnFor(p) ?? '—')}</td><td>${esc(p.mount)}</td><td>${esc(p.role)}</td></tr>`).join('')}</tbody></table>`;
const pinTable = `<table><thead><tr><th>Ref</th><th>Pin</th><th>Net</th><th>Hole</th></tr></thead><tbody>${parts.flatMap((p) => p.pins.map(([l, n, h]) => `<tr><td>${esc(p.ref)}</td><td>${esc(l)}</td><td>${esc(n)}</td><td>row ${h[0]}, col ${h[1]}</td></tr>`)).join('')}</tbody></table>`;
const cutTable = `<table><thead><tr><th>#</th><th>Row</th><th>Cut between columns</th><th>Why</th></tr></thead><tbody>${cuts.map((c, i) => `<tr><td>${i + 1}</td><td>${c.row}</td><td>${c.after} and ${c.after + 1}</td><td>${esc(c.why)}</td></tr>`).join('')}</tbody></table>`;
const linkTable = `<table><thead><tr><th>Link</th><th>Net</th><th>From</th><th>To</th><th>Why</th></tr></thead><tbody>${links.map((l) => `<tr><td><b>${l.id}</b></td><td>${esc(l.net)}</td><td>${hole(l.from)}</td><td>${hole(l.to)}</td><td>${esc(l.why)}</td></tr>`).join('')}</tbody></table>`;
const stripTable = `<table><thead><tr><th>Map</th><th>Copper pattern</th></tr></thead><tbody>${strips.map(([r, t]) => `<tr><td>${r}</td><td>${esc(t)}</td></tr>`).join('')}</tbody></table>`;
const iface = [[1, 'GND', 'ground'], [2, '3V3_SYS', 'out: 3.3 V system rail'], [3, '12V_SYS', 'out: 12 V after fuse and diode'], [4, '5V_SYS', 'out: 5 V system rail'],
  [5, '—', 'pin pulled, not connected (was fault)'], [6, '—', 'pin pulled, not connected (was fault reset)'], [7, 'EDU_PWR_EN', 'in: 3.3 V = enable the student rail'],
  [8, '—', 'pin pulled, not connected (was current sense)'], [9, 'ROUTER_ALIVE', 'in: 3.3 V = router heartbeat is fresh'], [10, 'GND', 'ground'],
  [11, '5V_EDU', 'out: student rail (current limited)'], [12, 'EDU_SENSE', 'out: half of 5V_EDU, to an ESP32 ADC pin']];
const ifaceTable = `<table><thead><tr><th>Pin</th><th>Signal</th><th>Meaning</th></tr></thead><tbody>${iface.map(([n, s, m]) => `<tr><td>${n}</td><td>${s}</td><td>${m}</td></tr>`).join('')}</tbody></table>`;

const num = (v) => (v === undefined ? '—' : v);
const compare = `<table><thead><tr><th></th><th>Revision 8 power board</th><th>Revision 9 stripboard</th></tr></thead><tbody>
<tr><td>Wire runs</td><td>${num(rev8.physicalWireRuns)}</td><td><b>${links.length}</b> insulated links on the underside</td></tr>
<tr><td>Solder joints</td><td>${rev8.wireEndpointSolderJoints ? rev8.wireEndpointSolderJoints + rev8.componentPinJoints : '—'}</td><td><b>${joints}</b> (${pinCount} pin joints + ${links.length * 2} link ends)</td></tr>
<tr><td>Strip cuts</td><td>0</td><td>${cuts.length}</td></tr>
<tr><td>Wire crossings</td><td>${num(rev8.crossings)}</td><td><b>not checked</b></td></tr>
<tr><td>Wire length</td><td>${rev8.lengthMm ? (rev8.lengthMm / 1000).toFixed(1) + ' m' : '—'}</td><td>measure from the printed link table</td></tr>
<tr><td>Parts</td><td>about 60</td><td>${parts.length} (including 2 buck modules)</td></tr></tbody></table>`;

const lost = ['Over-voltage and under-voltage guards (LTC4365): nothing cuts a failed buck, so measure the module before connecting.',
  'Precise 12 mA trip and fault latch: replaced by the 470 Ω series resistor (short-circuit current at most 11.2 mA at 5.25 V). No PTC backup is installed in this version.',
  'Fault output and CURRENT_SENSE: the ESP32 reads EDU_SENSE and switches EDU_PWR_EN off in software.',
  'No hardware ceiling on 5V_SYS: the student rail can only rise to the buck setting. Set it to 5.00 V.'];
const open = ['2N7000 gate threshold (up to 3 V) is close to the 3.3 V enable signal: bench-check that both transistors turn on, or swap in a logic-level n-channel part.',
  'Voltage sag: at 2 mA the student rail drops about 1 V through R_S. Confirm the student circuits can live with that.',
  'Fuse holder: a 5×20 mm holder is about 22.5 mm between pins and the holes give 22.86 mm (9 holes). Check the actual holder.',
  'Each buck uses three board connections: IN+, common GND and OUT+. Use one module negative lead for input and output only after a meter confirms IN− and OUT− are common on that exact module. Verify terminal labels; dimensions and terminal positions are not measured here.',
  'Q1 body diode: a voltage on the student rail above 5V_SYS can feed back through the diode. Do not power student circuits from outside.',
  'C1 (10 mm body) may need to lie flat or sit off the board; check the clearance next to the buck leads.',
  'Joints, cuts and links are counted from the generated model. Build time is an estimate, not a measurement. No bench test has been done.'];

const css = `body{font:15px/1.5 system-ui,sans-serif;max-width:1500px;margin:1.5rem auto;padding:0 1rem;color:#203545;background:#f4f7f5}
h1{margin:.2rem 0}h2{margin-top:2rem;border-bottom:2px solid #cbd5d0;padding-bottom:.2rem}article{background:#fff;border:1px solid #cbd5d0;border-radius:8px;padding:1rem;margin:1rem 0}
table{border-collapse:collapse;width:100%;margin:.6rem 0;font-size:14px}th,td{border:1px solid #d3dcd7;padding:.3rem .5rem;text-align:left;vertical-align:top}th{background:#eaf1ec}
.scroll{overflow-x:auto;background:#fafaf7;border:1px solid #d3dcd7;border-radius:6px}.scroll svg{display:block;max-width:none}
.toolbar{display:flex;gap:.6rem;flex-wrap:wrap;margin:.7rem 0}.toolbar button,.toolbar a{font:inherit;font-weight:650;color:#fff;background:#245b46;border:0;border-radius:6px;padding:.55rem .85rem;text-decoration:none;cursor:pointer}.toolbar button:hover,.toolbar a:hover{background:#174331}.toolbar button:focus-visible,.toolbar a:focus-visible{outline:3px solid #e6c765;outline-offset:2px}
.schematic-view:fullscreen{box-sizing:border-box;width:100vw;height:100vh;padding:20px;border:0;border-radius:0;background:#fff;overflow:auto}.schematic-view:fullscreen svg{margin:auto}
.note{background:#fff7e0;border:1px solid #e6c765;border-radius:6px;padding:.6rem .9rem}.ok{color:#1b6e2d;font-weight:700}ol.steps>li{margin:.7rem 0}code{background:#eef2ef;padding:0 .25rem;border-radius:3px}
.legend span{display:inline-block;margin-right:1rem}.sw{display:inline-block;width:1rem;height:.5rem;border-radius:2px;margin-right:.3rem;vertical-align:middle}`;

const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revision 9 power stripboard</title><style>${css}</style>
<h1>Revision 9 — minimal power board on stripboard</h1>
<p class="note"><b>Candidate, not released.</b> A deliberately simple replacement for the revision 8 power board: one 12 V input, two buck modules and one switched, current-limited student rail. It gives up the voltage guards, the precise 12 mA trip and the fault latch (see below). Generated drawings and checks are not bench evidence. Build status: schematic checks <b>${esc(schematicChecks.status)}</b>, stripboard logic check <b class="ok">${check.issues.length ? 'FAIL' : 'pass'}</b>; copper map estimated from photo, not measured.</p>

<h2>What you get</h2>
<article>${compare}<p>Compared with the earlier all-island revision 9 draft, shared copper buses reduce the jumper count from 37 to ${links.length} and solder joints from 124 to ${joints}.</p><p>Revision 8 figures come from <code>revision8/lower/comparison.csv</code>. Revision 9 figures are counted from the stripboard model (<code>design.mjs</code>).</p></article>

<h2>Schematic</h2>
<article><p>Drawn with tscircuit from the same part list as the stripboard layout; a script checks that every net matches the layout, pin by pin. Series connections are wires; other pins end in a net label.</p>
<div class="toolbar"><button id="schematic-fullscreen" type="button">View schematic full screen</button><button id="schematic-exit-fullscreen" type="button" hidden>Exit full screen</button><a href="assets/schematic.svg" target="_blank" rel="noopener">Open schematic in new tab</a></div>
<div id="schematic-view" class="scroll schematic-view">${existsSync(new URL('assets/schematic.svg', here)) ? read('assets/schematic.svg') : '<p>Run the schematic build first.</p>'}</div>
<script>
const schematicView=document.getElementById('schematic-view');
const enterSchematicFullscreen=document.getElementById('schematic-fullscreen');
const exitSchematicFullscreen=document.getElementById('schematic-exit-fullscreen');
enterSchematicFullscreen.addEventListener('click',async()=>{if(schematicView.requestFullscreen){await schematicView.requestFullscreen();}else{window.open('assets/schematic.svg','_blank','noopener');}});
exitSchematicFullscreen.addEventListener('click',()=>{if(document.fullscreenElement){document.exitFullscreen();}});
document.addEventListener('fullscreenchange',()=>{const active=document.fullscreenElement===schematicView;enterSchematicFullscreen.hidden=active;exitSchematicFullscreen.hidden=!active;});
</script>
<h3>How it works</h3><ul>
<li><code>12V_IN → F1 → D1 → 12V_SYS</code> feeds the blue XL4015 for 5 V and the red HW-155/LM2596 for 3.3 V. Each converter uses one common-negative pigtail to GND, after confirming IN− and OUT− continuity on that exact module. The converters’ onboard indicators remain on their modules; no extra rail LEDs are fitted on the stripboard. Verify the voltage and current capability of the exact modules before attaching loads.</li>
<li><code>Q1</code> (P-channel) switches <code>5V_SYS</code> to the student rail. <code>R_GP</code> pulls its gate high, so the rail is <b>off</b> by default and with no power on the router.</li>
<li><code>Q2</code> and <code>Q3</code> are in series: both need a high signal (<code>EDU_PWR_EN</code> and <code>ROUTER_ALIVE</code>) to pull the gate low. Pull-downs keep both off if a wire is lost.</li>
<li><code>R_S</code> (470 Ω) limits a short on the student rail to at most 11.2 mA at 5.25 V. The MF-R050 PTC is omitted for now. <code>R_DT/R_DB/C_SENSE</code> give the ESP32 half the rail voltage to measure.</li></ul></article>

<h2>Stripboard</h2>
<article><p>${ROWS} holes long × ${COLS} holes wide (about ${(COLS * 2.54 - 2.54).toFixed(0)} × ${(ROWS * 2.54 - 2.54).toFixed(0)} mm of holes; use a board a little larger). The 36-hole direction follows the portrait long axis, matching the supplied photo. Hole positions are written as <b>row, column</b> counted from the top-left of the top view. There are no planned cuts. Coloured lines are insulated underside links; the continuous copper buses carry shared nets directly. Dashed red rings on J_OUT are pulled pins. Buck modules remain off-board and use three pigtails each (IN+, common GND, OUT+), after confirming common negative on each exact module. Verify terminal markings and placement.</p>
<p class="note"><b>Physical copper pattern:</b> the connectivity model uses the photographed long buses and short isolated island banks. Lane positions were estimated from the photo, not measured. Confirm the copper groups with a meter before soldering. Bus lanes replace repeated point-to-point connections for shared nets; the GND bars on columns 10 and 26 are joined by a link.</p>
<p><b>Input jack guide:</b> ${esc(inputJackGuide.value)} is shown below the board at the input corner. It is an off-board pigtail socket, not a board footprint. Connect its center-positive lead to J_IN 12V (row ${inputJackGuide.positiveLanding[0]}, col ${inputJackGuide.positiveLanding[1]}) and sleeve/negative lead to J_IN GND (row ${inputJackGuide.groundLanding[0]}, col ${inputJackGuide.groundLanding[1]}). Tie down the socket body/cable independently; do not rely on stripboard pads for plug insertion force. Verify the socket lead polarity with a meter before connecting the adapter.</p>
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
