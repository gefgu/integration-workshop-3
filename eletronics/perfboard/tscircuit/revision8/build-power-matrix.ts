import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const here = new URL('./', import.meta.url);
const assets = new URL('./power-matrix-assets/', import.meta.url);
mkdirSync(assets, { recursive: true });
const design = JSON.parse(readFileSync(new URL('./lower/design.json', import.meta.url), 'utf8'));
const nativeAssets = new URL('./lower/assets/', import.meta.url);
const schematicFiles = readdirSync(nativeAssets).filter(name => /^(power|router-matrix)-Complete-schematic-schematic\.svg$/.test(name));
const boards = design.boards.filter((board: any) => ['power','router-matrix'].includes(board.id));
const escapeXml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[c]!));

const sectionRole = (section: string) => {
  if (section.includes('VoltageGuard')) return 'Voltage guards';
  if (section.includes(': Reference')) return 'Current trip';
  if (section.includes(': Student')) return 'Student rail';
  if (section.includes(': Input')) return 'Power input';
  if (section.includes(': Indicator')) return 'Status lights';
  if (section.includes(': Latch')) return 'Fault latch';
  if (section.includes(': Outputs')) return 'Power links';
  if (section.includes(': Controller')) return 'Router';
  if (section.includes(': Matrix')) return 'Matrix switches';
  if (section.includes(': Pi')) return 'Pi interface';
  if (section.includes(': Control')) return 'Bus control';
  if (section.includes(': Watchdog')) return 'Watchdog';
  if (section.includes(': Tools')) return 'Diagnostics';
  if (section.includes(': Return')) return 'Fault return';
  if (section.includes(': Buttons')) return 'Buttons';
  if (section.includes(': Circuit')) return 'External I/O';
  if (section === 'Test aids') return 'Test aids';
  return '';
};

const componentRole = (part: any) => {
  const ref = part.ref as string;
  if (part.section === 'Boundary' && part.label?.startsWith('Boundary:')) {
    return String(part.label).replace(/^Boundary:\s*/, '').replaceAll('_', ' ');
  }
  if (ref.startsWith('JP_')) {
    if (ref.includes('ALIVE')) return 'Heartbeat link';
    if (ref.includes('PASS')) return 'Pass link';
    if (ref.includes('ENABLE')) return 'Enable link';
    return 'Consumer link';
  }
  if (part.kind === 'header') {
    if (ref.includes('PROBE')) return 'Probe header';
    if (ref.includes('FIXTURE')) return 'Test header';
    if (ref.includes('PROTOTYPE')) return 'Prototype header';
    if (ref.includes('LIGHT')) return 'Lighting header';
    if (ref.includes('FAN')) return 'Fan header';
    if (ref.includes('SW_MAIN')) return 'Main switch';
    if (ref.includes('SW_')) return 'Button header';
    if (ref.includes('BUCK_5V')) return '5V buck';
    if (ref.includes('BUCK_3V3')) return '3V3 buck';
    if (ref.includes('SW_MAIN')) return 'Main switch';
    if (ref.includes('INPUT')) return '12V input';
    if (ref.includes('MATRIX')) return 'Matrix link';
    if (ref.includes('SMART')) return 'Smart link';
    if (ref.includes('TEST')) return 'Test load';
    if (ref.includes('PI')) return 'Pi interface';
    if (ref.includes('RFID')) return 'RFID reader';
    if (ref.includes('POWER')) return 'Power input';
    if (ref.includes('BUTTON')) return 'Button input';
    return 'Signal header';
  }
  if (part.kind === 'resistor') {
    if (ref.includes('OFF') || ref.endsWith('_PD')) return 'Pull-down';
    if (ref.includes('LED')) return 'LED resistor';
    if (ref.includes('LADDER')) return 'UV/OV divider';
    if (ref.includes('OV_')) return 'Overvoltage divider';
    if (ref.includes('UV_')) return 'Undervoltage divider';
    if (ref.includes('TRIP')) return 'Trip threshold';
    if (ref.includes('EDU_TOP') || ref.includes('EDU_BOTTOM')) return 'Student divider';
    if (ref.includes('EDU_ON')) return 'Rail pull-up';
    if (ref.includes('REF_FEED')) return 'Reference feed';
    if (ref.includes('PRESET')) return 'Trip preset';
    if (ref.includes('SHUNT')) return 'Current shunt';
    if (ref.includes('OFF')) return 'Pull-down';
    if (ref.includes('GATE')) return 'Gate resistor';
    if (ref.includes('DIAG')) return 'Sense divider';
    if (ref.includes('SOURCE')) return 'Test source';
    if (ref.includes('RESET')) return 'Reset resistor';
    return 'Bias resistor';
  }
  if (part.kind === 'capacitor') return ref.includes('WATCH') && !ref.includes('VCC') ? 'Watchdog timing' : ref.endsWith('_DIAG') ? 'Sense filter' : ref.includes('INPUT') || ref.includes('BULK') || ref.endsWith('_OUT') ? 'Supply filter' : 'Bypass capacitor';
  if (part.kind === 'diode') return ref.includes('REVERSE') ? 'Reverse guard' : 'Signal diode';
  if (part.kind === 'fuse') return ref.includes('EDU') ? 'Rail PTC' : 'Input fuse';
  if (part.kind === 'led') return 'Status LED';
  if (ref.startsWith('Q_')) return ref.includes('PASS') ? 'Rail pass switch' : ref.includes('GUARDS') ? 'Guard switch' : 'Switch driver';
  if (part.kind === 'chip') {
    if (ref.includes('OV_')) return 'Voltage guard';
    if (ref.includes('ANALOG_TRIP')) return 'Current comparator';
    if (ref.includes('ANALOG_REF')) return 'Voltage reference';
    if (ref.includes('ANALOG_SENSE')) return 'Current sensor';
    if (ref.includes('INTERLOCK_FAULT')) return 'Fault latch';
    if (ref.includes('INTERLOCK_LOGIC')) return 'Interlock logic';
    if (ref.includes('INTERLOCK_ALLOW')) return 'Enable logic';
    if (ref.includes('INTERLOCK_RESET')) return 'Reset logic';
    if (ref.includes('INTERLOCK_POR')) return 'Reset monitor';
    if (ref.includes('ROUTER_CORE_ESP')) return 'Router controller';
    if (ref.includes('MATRIX_SWITCHES_MT')) return 'Matrix switch';
    if (ref.includes('MATRIX_CONTROL_ADDR')) return 'Address register';
    if (ref.includes('MATRIX_CONTROL_BUFFER')) return 'Strobe buffer';
    if (ref.includes('MATRIX_CONTROL_DIAG')) return 'Diagnostic amplifier';
    if (ref.includes('ROUTER_SAFETY_WATCH')) return 'Watchdog timer';
    if (ref.includes('ROUTER_SAFETY_FAULT')) return 'Fault buffer';
    if (ref.includes('ROUTER_SAFETY_USB_POR')) return 'Reset monitor';
    return sectionRole(part.section) || 'Logic IC';
  }
  if (part.kind === 'mosfet') {
    if (ref.includes('PASS')) return 'Rail pass switch';
    if (ref.includes('ENABLE')) return 'Gate driver';
    if (ref.includes('GUARDS')) return 'Guard switch';
    return 'Switch driver';
  }
  if (part.kind === 'transistor') return 'Signal switch';
  if (part.kind === 'jumper' || ref.startsWith('JP_')) {
    if (ref.includes('ALIVE')) return 'Heartbeat link';
    if (ref.includes('PASS')) return 'Pass link';
    if (ref.includes('ENABLE')) return 'Enable link';
    return 'Consumer link';
  }
  return sectionRole(part.section) || 'Circuit part';
};

const actualComponent = (part: any) => {
  const label = String(part.label ?? '');
  if (part.kind === 'resistor' || part.kind === 'capacitor') {
    return part.value || label.match(/[0-9]+(?:\.[0-9]+)?\s*(?:k|M|R|Ω|ohm|uF|nF|pF|mA|A)?/i)?.[0]?.trim() || part.kind;
  }
  if (part.kind === 'chip') {
    return label.match(/^(?:LTC4365|LM393P?|TL431[A-Z]*|INA180[A-Z0-9]*|SN74[A-Z0-9]+|MCP1[23]0-[A-Z0-9/]+|ESP32 DevKitC(?:-38)?|MT8816AE1|OPA2333[A-Z0-9]*|AQY212EH)/i)?.[0] || label || 'IC';
  }
  if (part.kind === 'mosfet' || part.kind === 'transistor' || part.kind === 'diode') {
    return label.replace(/TRPBF|#TRMPBF/g, '').trim() || part.kind;
  }
  if (part.kind === 'header') {
    if (/manual continuity fixture/i.test(label)) return 'Continuity fixture';
    if (/breadboard prototype/i.test(label)) return 'USB fixture';
    if (/white lighting/i.test(label)) return 'Lighting';
    if (/fan/i.test(label)) return '12V fan';
    if (/dry-contact button/i.test(label)) return 'Button';
    if (/XL4015/i.test(label)) return 'XL4015 module';
    if (/LM2596/i.test(label)) return 'LM2596 module';
    if (/barrel pigtail/i.test(label)) return 'Barrel input';
    if (/POWER_MATRIX/i.test(label)) return 'POWER_MATRIX v2';
    if (/POWER_SMART/i.test(label)) return 'POWER_SMART v2';
    if (/Pi physical/i.test(label)) return 'Pi header';
    if (/RC522/i.test(label)) return 'RC522 carrier';
    if (/fixed battery/i.test(label)) return 'Battery lead';
    if (/probe header/i.test(label)) return '1×8 header';
    if (/button/i.test(label)) return 'Button';
    if (/latching switch/i.test(label)) return '3A switch';
    if (/scope/i.test(label)) return 'Test header';
    if (part.section === 'Boundary') return 'Terminal post';
  }
  if (part.kind === 'fuse') return label.includes('MF-R') ? 'MF-R050' : '2 A fuse';
  if (part.kind === 'led') return 'LED';
  if (part.kind === 'jumper' || part.ref.startsWith('JP_')) return 'Jumper';
  return label || part.kind || 'Part';
};

const guideViews: string[] = [];
for (const board of boards) {
  const width = 40 + (board.cols + 1) * 6 + 40;
  const componentItems = board.parts.map((part: any, index: number) => ({ number: index + 1, role: componentRole(part), part }))
    .filter(({ part }: any) => !part.virtual && !part.testpoint);
  const rowsPerColumn = Math.ceil(componentItems.length / 2);
  const componentHeight = Math.max(318, 48 + rowsPerColumn * 11);
  const viewWidth = width + 420;
  const componentLegend = componentItems.map(({ number, role }: any, index: number) => {
    const column = Math.floor(index / rowsPerColumn), row = index % rowsPerColumn;
    const item = componentItems[index];
    const x = width + 12 + column * 198, y = 43 + row * 11;
    return `<text x="${x}" y="${y}" font-size="6.5" font-weight="bold">${number}</text><text x="${x + 19}" y="${y}" font-size="7">${escapeXml(role)} (${escapeXml(actualComponent(item.part))})</text>`;
  }).join('');
  let componentSvg = readFileSync(new URL(`lower/assets/${board.id}-top.svg`, import.meta.url), 'utf8');
  componentSvg = componentSvg.replace(/viewBox="0 0 \d+ (\d+)"/, `viewBox="0 0 ${viewWidth} ${componentHeight}"`)
    .replace('TOP coordinates. Crossings are not joints. See numbered table.', 'TOP coordinates. Match each number to its role and component in parentheses.')
    .replace('</svg>', `<rect x="${width + 4}" y="24" width=".8" height="${componentHeight - 42}" fill="#d4ddd8"/><text x="${width + 12}" y="16" font-size="9" font-weight="bold">COMPONENT LABELS · NUMBERED KEY</text><rect x="${width + 12}" y="23" width="6" height="6" rx="1" fill="#ed5b35" stroke="#8796a5" stroke-width=".5"/><text x="${width + 21}" y="29" font-size="6.5">LED</text><rect x="${width + 56}" y="23" width="6" height="6" rx="1" fill="#74a9d8" stroke="#8796a5" stroke-width=".5"/><text x="${width + 65}" y="29" font-size="6.5">IC</text><rect x="${width + 91}" y="23" width="6" height="6" rx="1" fill="#55b8a8" stroke="#8796a5" stroke-width=".5"/><text x="${width + 100}" y="29" font-size="6.5">Connector</text><rect x="${width + 157}" y="23" width="6" height="6" rx="1" fill="#f2c477" stroke="#8796a5" stroke-width=".5"/><text x="${width + 166}" y="29" font-size="6.5">Resistor</text><rect x="${width + 224}" y="23" width="6" height="6" rx="1" fill="#b9a8e8" stroke="#8796a5" stroke-width=".5"/><text x="${width + 233}" y="29" font-size="6.5">Capacitor</text>${componentLegend}</svg>`);
  writeFileSync(new URL(`${board.id}-components.svg`, assets), componentSvg);

  const netNames = [...new Set(board.wires.map((wire: any) => wire.net))] as string[];
  const perColumn = Math.ceil(netNames.length / 2);
  const netFile = (name: string) => `${board.id}-net-${name.replace(/[^a-zA-Z0-9]+/g,'-')}.svg`;
  const shortNet = (name: string) => name.replace(/^(power|router_matrix)__/, '').replace(/__B$/, ' load').replace(/^(5V|3V3|12V)_/, '$1 ');
  const wireLegend = netNames.map((name, i) => {
    const y = 43 + (i % perColumn) * 11, x = width + 13 + Math.floor(i / perColumn) * 198;
    const wire = board.wires.find((w: any) => w.net === name), color = wire.color;
    const outline = color === '#ffffff' ? `<line x1="${x}" y1="${y-2}" x2="${x+16}" y2="${y-2}" stroke="#53636c" stroke-width="4"/>` : '';
    return `<a href="../lower/assets/${netFile(name)}" target="_blank">${outline}<line x1="${x}" y1="${y-2}" x2="${x+16}" y2="${y-2}" stroke="${color}" stroke-width="2.5"/><text x="${x+22}" y="${y+1}" font-size="6.5">${escapeXml(shortNet(name))}</text><title>Open this net's wires</title></a>`;
  }).join('');
  let wireSvg = readFileSync(new URL(`lower/assets/${board.id}-underside.svg`, import.meta.url), 'utf8');
  const wireHeight = Math.max(318, 60 + perColumn * 11);
  wireSvg = wireSvg.replace(/viewBox="0 0 \d+ (\d+)"/, `viewBox="0 0 ${viewWidth} ${wireHeight}"`)
    .replace('</svg>', `<rect x="${width+4}" y="24" width=".8" height="${wireHeight-42}" fill="#d4ddd8"/><text x="${width+13}" y="16" font-size="9" font-weight="bold">WIRES · CLICK A NET</text>${wireLegend}</svg>`);
  writeFileSync(new URL(`${board.id}-wire-guide.svg`, assets), wireSvg);
  const netOptions = `<option value="power-matrix-assets/${board.id}-wire-guide.svg">All wires</option>` + netNames.map(name => `<option value="lower/assets/${netFile(name)}">${escapeXml(shortNet(name))}</option>`).join('');

  const schematics = schematicFiles.filter((name) => name.startsWith(`${board.id}-`)).sort();
  const schematicSection = schematics.map((name) => {
    const title = name.replace(`${board.id}-`, '').replace(/-schematic\.svg$/, '').replaceAll('-', ' ');
    const source = `lower/assets/${name}`;
    const isWide = name.endsWith('-Complete-schematic-schematic.svg');
    return `<div class="schematic-sheet${isWide ? ' wide' : ''}"><h4>${escapeXml(title)}</h4><object aria-label="${escapeXml(board.id)} ${escapeXml(title)} electrical schematic" data="${source}" type="image/svg+xml"></object><a href="${source}" target="_blank" rel="noopener">Open schematic SVG ↗</a></div>`;
  }).join('');
  const boardViews = `<section><div><object aria-label="${board.id} top view" data="lower/assets/${board.id}-top.svg" type="image/svg+xml"></object><a href="lower/assets/${board.id}-top.svg" target="_blank" rel="noopener">Open top SVG ↗</a></div><div><object aria-label="${board.id} mirrored underside" data="lower/assets/${board.id}-underside.svg" type="image/svg+xml"></object><a href="lower/assets/${board.id}-underside.svg" target="_blank" rel="noopener">Open underside SVG ↗</a></div></section>`;
  guideViews.push(`<article><h2>${escapeXml(board.title)}</h2>${boardViews}<h3>Component guide</h3><section><div><object class="component-guide" aria-label="${board.id} component guide" data="power-matrix-assets/${board.id}-components.svg" type="image/svg+xml"></object><a href="power-matrix-assets/${board.id}-components.svg" target="_blank" rel="noopener">Open component guide SVG ↗</a></div><div><h3>Wire guide</h3><label>Wire <select data-wire-board="${board.id}">${netOptions}</select></label><object id="wires-${board.id}" aria-label="${board.id} wire guide" data="power-matrix-assets/${board.id}-wire-guide.svg" type="image/svg+xml"></object><a id="open-wires-${board.id}" href="power-matrix-assets/${board.id}-wire-guide.svg" target="_blank" rel="noopener">Open wire guide SVG ↗</a></div></section><h3>Electrical schematics</h3><p>Schematic symbols include component reference designators and pin numbers.</p><div class="schematic-grid">${schematicSection}</div></article>`);
}

const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Power and matrix boards</title><style>body{font:15px system-ui;max-width:1500px;margin:1.5rem auto;padding:0 1rem;color:#203545;background:#f4f7f5}article{background:white;padding:1rem;margin:1rem 0;border:1px solid #cbd5d0;border-radius:8px}object{display:block;width:100%;height:390px;object-fit:contain;margin:.4rem 0}.component-guide{height:650px}section{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}.schematic-grid{display:grid;grid-template-columns:1fr;gap:1rem}.schematic-sheet{padding:.8rem;border:1px solid #d7e0dc;border-radius:6px;background:#fbfcfb}.schematic-sheet h4{margin:.2rem 0}.schematic-sheet object{height:auto;max-height:75vh;aspect-ratio:1400/950;object-fit:contain;background:white}.schematic-sheet.wide{overflow-x:auto}.schematic-sheet.wide object{width:4600px;height:480px;max-height:none;aspect-ratio:auto;object-fit:contain}.schematic-sheet a{display:inline-block;margin-bottom:.2rem}h3{margin:.9rem 0 .2rem}a{color:#203545}@media(max-width:850px){section{grid-template-columns:1fr}}</style><h1>Power and matrix boards</h1><p>Simplified power and matrix wiring. Underside views are mirrored and retain top-side coordinates. Physical fit and bench qualification remain pending.</p>${guideViews.join('')}<script>document.querySelectorAll('[data-wire-board]').forEach(select=>select.addEventListener('change',()=>{document.getElementById('wires-'+select.dataset.wireBoard).data=select.value;document.getElementById('open-wires-'+select.dataset.wireBoard).href=select.value;}));</script></html>`;
writeFileSync(new URL('power-matrix.html', here), page);
console.log('Generated power and matrix board guide.');

const completeSource='lower/assets/power-Complete-schematic-schematic.svg';
writeFileSync(new URL('./power-schematic.html', here), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Power board schematic</title><style>body{font:16px system-ui;margin:1rem;color:#203545;overflow-x:auto}object{display:block;width:4600px;height:480px}a{color:inherit}</style><h1>Power board — complete electrical schematic</h1><p>Read the power path from left to right: input → voltage guards → student rail → protected outputs. Control and test circuitry share the same continuous schematic area. Related pins are wired together; named markers identify connections that leave the board. Component labels are shortened for readability; full references and manufacturer part numbers remain in the circuit data. Red: power; black: ground; green: analog sensing; yellow: control signals. Crossings join only at junction dots.</p><p><a href="http://127.0.0.1:5501/">Open visual layout editor ↗</a> · <a href="${completeSource}" target="_blank" rel="noopener">Open full SVG in a new tab ↗</a></p><object data="${completeSource}" type="image/svg+xml"></object></html>`);
