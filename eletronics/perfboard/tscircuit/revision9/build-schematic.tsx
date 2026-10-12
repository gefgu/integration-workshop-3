// Revision 9 schematic (tscircuit). The same parts and nets as design.mjs drive both this drawing and the stripboard layout.
import React from 'react';
import { Circuit } from '@tscircuit/core';
import { convertCircuitJsonToSchematicSvg } from 'circuit-to-svg';
import { runAllNetlistChecks, runAllPinSpecificationChecks } from '@tscircuit/checks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { parts, mpnFor } from './design.mjs';
const pinLabel = (l: string) => 'P_' + l.replace(/\+/g, 'PLUS').replace(/[^A-Za-z0-9]+/g, '_');

await import('../scripts/use-canvas-renderer.mjs');
const out = new URL('./assets/', import.meta.url);
mkdirSync(out, { recursive: true });

// Schematic placement [x, y, rotation]. Series chains are drawn as wires; every other pin ends in a net label.
const place: Record<string, [number, number, number?]> = {
  J_IN: [-9, 3], F1: [-6, 3], D1: [-3, 3], C1: [-1, 1], C2: [1, 1],
  M_BUCK5: [5, 4.5], M_BUCK3: [5, 0.5],
  R_LED5: [9, 4.5], LED5: [11.5, 4.5], R_LED3: [9, 0.5], LED3: [11.5, 0.5],
  R_GP: [14.5, -2.2], Q1: [18, -2.2], Q2: [18, -6.6], Q3: [18, -11],
  R_PD_EN: [14.5, -6.6], R_PD_RA: [14.5, -11], R_S: [22, -2.2], F_EDU: [25.5, -2.2],
  R_DT: [28.5, -3.8, 90], R_DB: [28.5, -7, 90], C_SENSE: [31, -5.4, 90], J_OUT: [37, -5.5],
};
// Direct wires: [from ref.pin, to ref.pin]
const wires: [string, string][] = [
  ['J_IN.12V', 'F1.1'], ['F1.2', 'D1.A'],
  ['R_LED5.2', 'LED5.A'], ['R_LED3.2', 'LED3.A'],
  ['Q3.D', 'Q2.S'], ['R_S.2', 'F_EDU.1'], ['Q1.D', 'R_S.1'], ['R_GP.2', 'Q1.G'], ['Q2.D', 'Q1.G'],
  ['R_DT.2', 'R_DB.1'], ['R_DT.2', 'C_SENSE.1'],
];

const portName = (ref: string, label: string) => {
  const p = parts.find((x) => x.ref === ref)!;
  if (p.kind === 'pmos' || p.kind === 'nmos') return ({ S: 'source', G: 'gate', D: 'drain' } as any)[label];
  if (p.kind === 'diode' || p.kind === 'led') return label === 'A' ? 'pin1' : 'pin2';
  if (p.kind === 'header' || p.kind === 'module') return `pin${p.pins.findIndex((q) => q[0] === label) + 1}`;
  if (p.kind === 'capacitor' && p.polarized) return label === '+' ? 'pin1' : 'pin2';
  return `pin${label}`;
};
const sel = (endpoint: string) => {
  const [ref, label] = endpoint.split('.');
  return `.${ref} > .${portName(ref, label)}`;
};
const netName = (n: string) => (/^\d/.test(n) ? `V_${n}` : n);
const clean = (s: string) => s.replace(/V_([35]V[^<\s]*|12V[^<\s]*)/g, '$1');

const children: any[] = [];
for (const p of parts) {
  const [x, y, rot = 0] = place[p.ref] ?? [0, 0];
  const mpn = mpnFor(p);
  const common: any = { name: p.ref, displayName: `${p.ref}`, schX: x, schY: y, schRotation: rot, ...(mpn ? { manufacturerPartNumber: mpn } : {}) };
  if (p.kind === 'resistor') children.push(<resistor {...common} resistance={p.value.replace(' ', '').replace('Ω', '')} />);
  else if (p.kind === 'capacitor') children.push(<capacitor {...common} capacitance={p.value.replace(' ', '').replace('µ', 'u')} polarized={!!p.polarized} />);
  else if (p.kind === 'diode') children.push(<diode {...common} />);
  else if (p.kind === 'led') children.push(<led {...common} color="red" />);
  else if (p.kind === 'fuse' || p.kind === 'ptc') children.push(<fuse {...common} currentRating={p.kind === 'fuse' ? '2A' : '500mA'} voltageRating="30V" />);
  else if (p.kind === 'pmos' || p.kind === 'nmos') children.push(<mosfet {...common} channelType={p.kind === 'pmos' ? 'p' : 'n'} mosfetMode="enhancement" />);
  else {
    const labels = Object.fromEntries(p.pins.map((q, i) => [`pin${i + 1}`, pinLabel(q[0])]));
    const attrs = Object.fromEntries(p.pins.map((q, i) => [`pin${i + 1}`, q[1] === 'GND' ? { requiresGround: true } : /^(12V_SYS|12V_IN)$/.test(q[1]) && /IN|12V/.test(q[0]) ? { requiresPower: true } : { isPassive: true }]));
    const half = Math.ceil(p.pins.length / 2);
    const header = p.kind === 'header';
    children.push(<chip {...common} pinLabels={labels} pinAttributes={attrs} doNotPlace={header} schWidth={header ? .14 * Math.max(...p.pins.map((q) => pinLabel(q[0]).length)) + 1.4 : 1.8} schHeight={Math.max(.8, (header ? p.pins.length : half) * .4 + .3)}
      schPinArrangement={header ? { rightSide: { direction: 'top-to-bottom', pins: p.pins.map((_, i) => i + 1) } }
        : { leftSide: { direction: 'top-to-bottom', pins: p.pins.slice(0, 2).map((_, i) => i + 1) }, rightSide: { direction: 'top-to-bottom', pins: p.pins.slice(2).map((_, i) => i + 3) } }} />);
  }
}
const nets = new Map<string, string[]>();
for (const p of parts) for (const [label, net] of p.pins) {
  const n = net;
  (nets.get(n) ?? nets.set(n, []).get(n)!).push(`${p.ref}.${label}`);
}
const wireNet = new Map<string, string>();
for (const [a, b] of wires) {
  const na = parts.flatMap((p) => p.pins.map((q) => ({ e: `${p.ref}.${q[0]}`, net: q[1] }))).find((x) => x.e === a)!.net;
  wireNet.set(`${a}|${b}`, na);
}
const wired = new Set(wires.flat());
const isPower = (n: string) => /^(GND|3V3_SYS|5V_SYS|12V_SYS|12V_IN|12V_F|5V_EDU)$/.test(n);
for (const n of nets.keys()) children.push(<net name={netName(n)} isGroundNet={n === 'GND'} isPowerNet={isPower(n) && n !== 'GND'} />);
for (const [a, b] of wires) children.push(<trace name={wireNet.get(`${a}|${b}`)} from={sel(a)} to={sel(b)} />);
for (const [n, pins] of nets) {
  for (const e of pins) if (!wired.has(e)) children.push(<trace name={n} from={sel(e)} to={`net.${netName(n)}`} />);
  // A wired group that shares its net with other pins must also reach the net label, or the drawing splits the net.
  const wiredHere = pins.filter((e) => wired.has(e));
  if (wiredHere.length && pins.some((e) => !wired.has(e))) children.push(<trace name={n} from={sel(wiredHere[0])} to={`net.${netName(n)}`} />);
}

const circuit = new Circuit();
circuit.add(<board width="60mm" height="40mm" routingDisabled>{children.map((c, i) => React.cloneElement(c, { key: i }))}</board>);
await circuit.renderUntilSettled();
const json = circuit.getCircuitJson();
const checks = { source: json.filter((e: any) => /^source_.*(error|warning)$/.test(e.type)), pins: await runAllPinSpecificationChecks(json), netlist: await runAllNetlistChecks(json) };
const keep = (e: any) => !/refdes_convention|underspecified|no_power_pin|no_ground_pin/.test(e.type ?? e.warning_type ?? '') && !/J_|M_BUCK/.test(e.message ?? '');
for (const k of Object.keys(checks) as (keyof typeof checks)[]) (checks as any)[k] = (checks as any)[k].filter(keep);
// The drawn schematic must carry exactly the nets that the stripboard layout implements.
const parent = new Map<string, string>();
const find = (a: string): string => { if (!parent.has(a)) parent.set(a, a); while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a)!)!); a = parent.get(a)!; } return a; };
const join = (a: string, b: string) => parent.set(find(a), find(b));
for (const t of json.filter((e: any) => e.type === 'source_trace')) {
  const ids = [...(t.connected_source_port_ids ?? []), ...(t.connected_source_net_ids ?? [])];
  ids.slice(1).forEach((id: string) => join(ids[0], id));
}
const compName = new Map(json.filter((e: any) => e.type === 'source_component').map((e: any) => [e.source_component_id, e.name]));
const portId = new Map<string, string>();
for (const e of json.filter((x: any) => x.type === 'source_port')) {
  const owner = compName.get(e.source_component_id);
  for (const hint of [e.name, ...(e.port_hints ?? [])]) portId.set(`${owner}.${hint}`, e.source_port_id);
}
const designPins = parts.flatMap((p) => p.pins.map((q) => ({ key: `${p.ref}.${portName(p.ref, q[0])}`, net: q[1] })));
const mismatches: any[] = [];
for (const a of designPins) {
  const ida = portId.get(a.key);
  if (!ida) { mismatches.push({ code: 'port-missing', pin: a.key }); continue; }
  for (const b of designPins) {
    if (a.key >= b.key) continue;
    const idb = portId.get(b.key);
    if (!idb) continue;
    const same = find(ida) === find(idb);
    if (same !== (a.net === b.net)) mismatches.push({ code: same ? 'schematic-joins-different-nets' : 'schematic-splits-net', a: a.key, b: b.key, netA: a.net, netB: b.net });
  }
}
(checks as any).designMatch = mismatches;
const status = Object.values(checks).some((a: any) => a.length) ? 'fail' : 'pass';
writeFileSync(new URL('schematic-checks.json', import.meta.url), JSON.stringify({ status, checks }, null, 2) + '\n');
writeFileSync(new URL('schematic.circuit.json', import.meta.url), JSON.stringify(json, null, 1) + '\n');
let svg = clean(convertCircuitJsonToSchematicSvg(json.filter((e: any) => e.type !== 'schematic_sheet'), { width: 2200, height: 1100 }));
// Crop the drawing to its content so the page does not show a large blank canvas.
const m = svg.match(/data-real-to-screen-transform="matrix\(([-0-9.e]+),0,0,([-0-9.e]+),([-0-9.e]+),([-0-9.e]+)\)"/);
if (m) {
  const [a, d, e, g] = m.slice(1).map(Number);
  const xs: number[] = [], ys: number[] = [];
  const pt = (x: number, y: number) => { xs.push(a * x + e); ys.push(d * y + g); };
  for (const el of json as any[]) {
    if (el.type === 'schematic_component') { pt(el.center.x - el.size.width / 2, el.center.y - el.size.height / 2); pt(el.center.x + el.size.width / 2, el.center.y + el.size.height / 2); }
    else if (el.type === 'schematic_trace') for (const edge of el.edges) { pt(edge.from.x, edge.from.y); pt(edge.to.x, edge.to.y); }
    else if (el.type === 'schematic_net_label' && el.anchor_position) { pt(el.anchor_position.x - 1.2, el.anchor_position.y - .4); pt(el.anchor_position.x + 1.2, el.anchor_position.y + .4); }
  }
  const pad = 50, x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - Math.min(...xs) + 2 * pad, h = Math.max(...ys) - Math.min(...ys) + 2 * pad;
  svg = svg.replace('width="2200" height="1100"', `width="${Math.round(w)}" height="${Math.round(h)}" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}"`);
}
writeFileSync(new URL('schematic.svg', out), svg);
console.log(`revision9 schematic: ${status}`);
if (status === 'fail') console.log(JSON.stringify(checks, null, 1).slice(0, 3000));
