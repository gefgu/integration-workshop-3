import React from 'react';
import {Circuit} from '@tscircuit/core';
import {runAllNetlistChecks,runAllPinSpecificationChecks,runAllPlacementChecks} from '@tscircuit/checks';
import {convertCircuitJsonToSchematicSvg} from 'circuit-to-svg';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import SmartPerfboard from './controller.circuit';
import {connectorMpn,endpoints} from './design.mjs';
await import('../scripts/use-line-schematics.mjs');
const dir=new URL('./stage1/compact/',import.meta.url);mkdirSync(dir,{recursive:true});
const write=(n:string,v:any)=>writeFileSync(new URL(n,dir),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
const c=new Circuit();c.add(<SmartPerfboard stage1 compact/>);await c.renderUntilSettled();const json=c.getCircuitJson();
const checks={source:json.filter((x:any)=>/^source_.*(error|warning)$/.test(x.type)),pins:await runAllPinSpecificationChecks(json),netlist:await runAllNetlistChecks(json),placement:await runAllPlacementChecks(json)};
if(Object.values(checks).some(x=>x.length))throw Error(JSON.stringify(checks));
// Compare native source connectivity against the unchanged stage-1 pin map.
const owners=new Map(json.filter((x:any)=>x.type==='source_component').map((x:any)=>[x.source_component_id,x.name]));
const ports=json.filter((x:any)=>x.type==='source_port');
const uf=new Map();const find=(id:any):any=>{if(!uf.has(id))uf.set(id,id);if(uf.get(id)!==id)uf.set(id,find(uf.get(id)));return uf.get(id);};
for(const t of json.filter((x:any)=>x.type==='source_trace') as any[]){const ids=[...(t.connected_source_port_ids??[]),...(t.connected_source_net_ids??[])];for(const id of ids.slice(1))uf.set(find(id),find(ids[0]));}
const expected=(p:any)=>{const hint=[p.name,...(p.port_hints??[])].find(h=>/^(pin)?\d+$/.test(h));const ep=endpoints.get(`${owners.get(p.source_component_id)}.${hint?.replace(/^pin/,'')}`);if(!ep)throw Error('Unmapped compact pin');return ep.net&&/^(EXP_|SENSE)/.test(ep.net)?null:ep.net;};
for(let i=0;i<ports.length;i++)for(let j=i+1;j<ports.length;j++){const a:any=ports[i],b:any=ports[j];if((find(a.source_port_id)===find(b.source_port_id))!==Boolean(expected(a)&&expected(a)===expected(b)))throw Error('Compact source graph mismatch');}
if(json.some((x:any)=>x.type==='schematic_net_label'&&!/^(V3V3|GND)/.test(x.text)))throw Error('Unexpected signal port label');
write('controller.circuit.json',json);
for(const kind of ['schematic-placement','placement']){const r=spawnSync(process.execPath,[new URL('../node_modules/.bin/tsci',import.meta.url).pathname,'check',kind,new URL('controller.circuit.json',dir).pathname],{encoding:'utf8'});const report=(r.stdout??'')+(r.stderr??'');write(`${kind}.txt`,report);if(r.status!==0||/<SchematicPlacementIssues>\s*<[^/]/.test(report))throw Error(report);}
let svg=convertCircuitJsonToSchematicSvg(json,{width:2400,height:1800}).replace(new RegExp(`<text\\b[^>]*>\\s*${connectorMpn}\\s*</text>`,'g'),'');if(svg.includes(connectorMpn))throw Error('Connector MPN visible');
// Color only native trace graphics, preserving all geometry and electrical data.
const palette:any={SCL:'#1764b5',SDA:'#16823a',UART_TX:'#bd4900',UART_RX:'#8538ad',JOY_X:'#b12d62',JOY_Y:'#007e88'};
const sourceTraces=new Map(json.filter((x:any)=>x.type==='source_trace').map((x:any)=>[x.source_trace_id,x]));
const traceColors=new Map();
for(const t of json.filter((x:any)=>x.type==='schematic_trace') as any[]){
 const source:any=sourceTraces.get(t.source_trace_id);
 const port:any=ports.find((p:any)=>(source?.connected_source_port_ids??[]).includes(p.source_port_id));
 const net=port?expected(port):null;
 const color=net?.startsWith('SDA_')?palette.SDA:palette[net];
 if(color)traceColors.set(t.schematic_trace_id,color);
}
svg=svg.replace(/<g\b[^>]*data-schematic-trace-id="([^"]+)"[^>]*>[\s\S]*?<\/g>/g,(group,id)=>{
 const color=traceColors.get(id);if(!color)return group;
 return group.replace(/stroke="[^"]*"/g,`stroke="${color}"`).replace(/fill="(?!none")[^"]*"/g,`fill="${color}"`);
});
const legend=[['SCL',palette.SCL],['SDA 0–5',palette.SDA],['TX (ESP → Pi)',palette.UART_TX],['RX (Pi → ESP)',palette.UART_RX],['VRx / X',palette.JOY_X],['VRy / Y',palette.JOY_Y]];
svg=svg.replace('</svg>',`<g font-family="Arial,sans-serif" font-size="25">${legend.map(([label,color],i)=>{const x=150+(i%3)*340,y=1630+Math.floor(i/3)*65;return `<line x1="${x}" y1="${y}" x2="${x+50}" y2="${y}" stroke="${color}" stroke-width="5"/><text x="${x+65}" y="${y+8}" fill="${color}">${label.replaceAll('&','&amp;').replaceAll('<','&lt;')}</text>`;}).join('')}</g></svg>`);
write('schematic-4x3.svg',svg);
write('schematic-4x3.typ','#set page(width:240mm,height:180mm,margin:5mm)\n#set text(font:"DejaVu Sans",size:9pt)\n= ESP32 — etapa 1 / conexões diretas\n#image("schematic-4x3.svg",width:100%,height:152mm,fit:"contain")\n#text(size:7pt)[Alimentação regulada 3,3 V; GND comum. Sem pull-ups externos. Entrada de alimentação/JP_EXT no guia de montagem. Confirmar C_BULK real (foto: possivelmente 100 µF).]\n');
const r=spawnSync('/home/gustavo/.cargo/bin/typst',['compile',new URL('schematic-4x3.typ',dir).pathname,new URL('schematic-4x3.pdf',dir).pathname],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);
write('verification.json',{status:'pass',checks,connectivity:'Equivalent to stage-1 pin map',signalPorts:'None; only power/ground labels',physicalRelease:'Unchanged; physical audit pending'});
console.log('Compact schematic generated.');
