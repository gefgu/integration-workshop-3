import React from 'react';
import {Circuit} from '@tscircuit/core';
import {convertCircuitJsonToSchematicSvg} from 'circuit-to-svg';
import {runAllNetlistChecks,runAllPinSpecificationChecks} from '@tscircuit/checks';
import {writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import Interface from './interface.circuit';
import {parts,wiring,connectorMpn} from './design.mjs';
// Same text-only stripping policy as scripts/strip-connector-mpns.mjs.
// Keep this independent build from executing that script's legacy export writes.
const stripConnectorMpns=(svg:string)=>svg.replace(new RegExp(`<text\\b[^>]*>\\s*${connectorMpn}\\s*</text>`,'g'),'');
await import('../scripts/use-line-schematics.mjs');
const dir=new URL('./',import.meta.url);mkdirSync(new URL('assets/',dir),{recursive:true});
const c=new Circuit({platform:{pcbDisabled:true}});c.add(<Interface/>);await c.renderUntilSettled();const json=c.getCircuitJson();
const write=(n:string,s:string)=>writeFileSync(new URL(n,dir),s);
const checks:any={source:json.filter((e:any)=>/^source_.*(error|warning)$/.test(e.type)),pins:await runAllPinSpecificationChecks(json),netlist:await runAllNetlistChecks(json),connectivity:[]};
const parent=new Map();const find=(x:any):any=>{if(!parent.has(x))parent.set(x,x);if(parent.get(x)!==x)parent.set(x,find(parent.get(x)));return parent.get(x);};
for(const t of json.filter((e:any)=>e.type==='source_trace') as any[]){const ids=[...(t.connected_source_port_ids??[]),...(t.connected_source_net_ids??[])];for(const id of ids.slice(1))parent.set(find(id),find(ids[0]));}
const owners=new Map(json.filter((e:any)=>e.type==='source_component').map((e:any)=>[e.source_component_id,e.name]));
const ports=new Map();for(const p of json.filter((e:any)=>e.type==='source_port') as any[]) for(const hint of [p.name,...(p.port_hints??[])])ports.set(`${owners.get(p.source_component_id)}.${hint}`,p.source_port_id);
const expected=parts.flatMap(p=>p.pins.map((q,i)=>({key:`${p.ref}.pin${i+1}`,net:q.net})));
for(const a of expected){if(!ports.has(a.key))checks.connectivity.push({missing:a.key});for(const b of expected){if(a.key>=b.key)continue;const linked=find(ports.get(a.key))===find(ports.get(b.key));if(linked!==Boolean(a.net&&a.net===b.net))checks.connectivity.push({a:a.key,b:b.key,linked,expected:[a.net,b.net]});}}
const status=Object.values(checks).some((v:any)=>v.length)?'fail':'pass';
write('checks.json',JSON.stringify({status,checks,limitations:['Software checks are not measured hardware evidence.','No PCB placement, routed copper, or perfboard layout is supplied.']},null,2)+'\n');
write('schematic.circuit.json',JSON.stringify(json,null,1)+'\n');
let svg=stripConnectorMpns(convertCircuitJsonToSchematicSvg(json,{width:2400,height:1400}));
if(svg.includes(connectorMpn))throw new Error('Connector MPN remains visible');
write('assets/schematic.svg',svg);
const csv=(rows:any[][])=>rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
write('wiring.csv',csv([['Controller','Physical pin','Signal','Destination'],...wiring]));
write('bom.csv',csv([['Item','Quantity','Notes'],['Raspberry Pi 3B',1,'Existing; separate supply'],['Classic ESP32 DevKit',1,'Existing ESP32 #2; confirm header positions'],['KY-023 joystick module',1,'3.3 V; menu navigation'],['RC522 module',1,'3.3 V; verify actual header labels'],['10 kΩ resistor',3,'External button pull-ups'],['Normally open momentary push button',2,'Energize and Back'],['Harness/connectors','As needed','Part numbers and physical arrangement unconfirmed']]));
write('wiring.typ', '#table(columns: (1fr, 1fr, 1.6fr, 3fr), inset: 5pt,\n'+[['Controller','Physical pin','Signal','Destination'],...wiring].map(r=>r.map(v=>'['+String(v).replaceAll('#','\\#')+']').join(', ')).join(',\n')+'\n)\n');
console.log(JSON.stringify({status,checks},null,2));if(status==='fail')process.exit(1);
for(const kind of ['schematic-placement','placement']) {
 const result=spawnSync(process.execPath,[new URL('../node_modules/.bin/tsci',dir).pathname,'check',kind,new URL('schematic.circuit.json',dir).pathname],{encoding:'utf8'});
 const report=(result.stdout??'')+(result.stderr??'');write(`${kind}.txt`,report.trim()?report:'No actionable issues reported.\n');
 if(result.status!==0||/<SchematicPlacementIssues>\s*<[^/]/.test(report))throw new Error(`${kind} failed: ${report}`);
}
const pdf=spawnSync('typst',['compile','--root',new URL('../',dir).pathname,new URL('guide.typ',dir).pathname,new URL('interface.pdf',dir).pathname],{stdio:'inherit'});if(pdf.status!==0)process.exit(pdf.status??1);
