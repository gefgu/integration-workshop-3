import React from 'react';
import {Circuit} from '@tscircuit/core';
import {runAllNetlistChecks,runAllPinSpecificationChecks,runAllPlacementChecks} from '@tscircuit/checks';
import {convertCircuitJsonToSchematicSvg,convertCircuitJsonToPcbSvg} from 'circuit-to-svg';
import {writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {parts as baseline} from '../design.mjs';
import Completion,{position} from './circuit';
import {parts,wires,endpoints,sections,existing,existingWires} from './design.mjs';
await import('../../scripts/use-line-schematics.mjs');
const dir=new URL('./',import.meta.url);mkdirSync(new URL('assets/',dir),{recursive:true});
const write=(n:string,v:any)=>writeFileSync(new URL(n,dir),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
write('verification.json',{status:'incomplete',physicalRelease:'PENDING'});
const c=new Circuit();c.add(<Completion/>);await c.renderUntilSettled();const json=c.getCircuitJson();write('controller.circuit.json',json);
const checks:any={source:json.filter((x:any)=>/^source_.*(error|warning)$/.test(x.type)),pins:await runAllPinSpecificationChecks(json),netlist:await runAllNetlistChecks(json),placement:await runAllPlacementChecks(json),model:[],nativePads:[],netEquivalence:[]};
for(const p of existing){const old=baseline.find(q=>q.ref===p.ref);if(p.pins.some((q,i)=>q.c!==old.pins[i].c||q.r!==old.pins[i].r))throw Error('Moved soldered part');}
const occupied=new Set();for(const [e,p] of endpoints){const k=`${p.c},${p.r}`;if(occupied.has(k))checks.model.push({duplicate:e});occupied.add(k);}
const owners=new Map(json.filter((x:any)=>x.type==='source_component').map((x:any)=>[x.source_component_id,x.name]));
const uf=new Map();const find=(x:any):any=>{if(!uf.has(x))uf.set(x,x);if(uf.get(x)!==x)uf.set(x,find(uf.get(x)));return uf.get(x);};
for(const t of json.filter((x:any)=>x.type==='source_trace') as any[]){const es=[...(t.connected_source_port_ids??[]),...(t.connected_source_net_ids??[])];for(const x of es.slice(1))uf.set(find(x),find(es[0]));}
const hand=new Map();const hf=(x:any):any=>{if(!hand.has(x))hand.set(x,x);if(hand.get(x)!==x)hand.set(x,hf(hand.get(x)));return hand.get(x);};
for(const w of wires){const a=endpoints.get(w.from),b=endpoints.get(w.to);if(!a||!b||a.net!==w.net||b.net!==w.net)throw Error(`Bad wire ${w.id}`);hand.set(hf(w.from),hf(w.to));}
const all=[...endpoints];for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const[a,p]=all[i],[b,q]=all[j];if((hf(a)===hf(b))!==Boolean(p.net&&p.net===q.net))throw Error(`Hand-wire graph mismatch ${a}/${b}`);}
if(existingWires.length!==39)throw Error('Stage-1 wire count changed');
const nativePorts=json.filter((x:any)=>x.type==='source_port');
const expected=(p:any)=>{const hint=[p.name,...(p.port_hints??[])].find(h=>/^(?:pin)?\d+$/.test(h));const key=`${owners.get(p.source_component_id)}.${hint?.replace(/^pin/,'')}`;const ep=endpoints.get(key);if(!ep)throw Error(`Unknown native port ${key}`);return ep.net;};
for(let i=0;i<nativePorts.length;i++)for(let j=i+1;j<nativePorts.length;j++){const a:any=nativePorts[i],b:any=nativePorts[j];if((find(a.source_port_id)===find(b.source_port_id))!==Boolean(expected(a)&&expected(a)===expected(b)))checks.netEquivalence.push([a.name,b.name]);}
const pcbOwners=new Map(json.filter((x:any)=>x.type==='pcb_component').map((x:any)=>[x.pcb_component_id,owners.get(x.source_component_id)]));const seen=new Set();
for(const h of json.filter((x:any)=>x.type==='pcb_plated_hole') as any[]){const hint=h.port_hints?.find((x:string)=>/^(?:pin)?\d+$/.test(x));const e=`${pcbOwners.get(h.pcb_component_id)}.${hint?.replace(/^pin/,'')}`;const p=endpoints.get(e);if(!p){checks.nativePads.push({unmapped:e});continue;}seen.add(e);const target=position(p.c,p.r);if(Math.abs(h.x-target.x)>.01||Math.abs(h.y-target.y)>.01)checks.nativePads.push({e,target,actual:{x:h.x,y:h.y}});}
for(const e of endpoints.keys())if(!seen.has(e))checks.nativePads.push({missing:e});
write('checks.json',checks);if(Object.values(checks).some((x:any)=>x.length))throw Error(JSON.stringify(checks));
for(const [index,section] of sections.entries()){let svg=convertCircuitJsonToSchematicSvg(json,{width:2400,height:1800,schematicSheetIndex:index}).replace(/<text\b[^>]*>\s*61201021621\s*<\/text>/g,'');if(svg.includes('61201021621'))throw Error('Connector MPN visible');write(`assets/${section}.svg`,svg);}
write('assets/native-pcb.svg',convertCircuitJsonToPcbSvg(json,{width:1000,height:1500}));
const csv=(rows:any[][])=>rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
write('pins.csv',csv([['Endpoint','Label','Net','TOP column','TOP row'],...[...endpoints].map(([e,q])=>[e,q.label,q.net??'NC',q.c,q.r])]));
write('wires.csv',csv([['Wire','Net','From','To'],...wires.map(w=>[w.id,w.net,w.from,w.to])]));
write('bom.csv',csv([['Ref','Value','MPN','Section','Tolerance','Notes'],...parts.map(p=>[p.ref,p.value,p.mpn,p.section,p.tolerance??'',p.note??'Generic body envelope; actual fit pending'])]));
for(const kind of ['schematic-placement','placement']){const r=spawnSync(process.execPath,[new URL('../../node_modules/.bin/tsci',import.meta.url).pathname,'check',kind,new URL('controller.circuit.json',dir).pathname],{encoding:'utf8'});const report=(r.stdout??'')+(r.stderr??'');write(`${kind}.txt`,report);if(r.status!==0||/<SchematicPlacementIssues>\s*<[^/]/.test(report))throw Error(report);}
mkdirSync(new URL('checks/',dir),{recursive:true});
for(const [kind,args,file] of [['shorts',['--mode','pcb','--layer','all'],'shorts.txt'],['pcb-style',['--json','--svg',new URL('checks/pcb-style.svg',dir).pathname],'pcb-style.json']] as any[]){
 const r=spawnSync(process.execPath,[new URL('../../node_modules/.bin/tsci',import.meta.url).pathname,'check',kind,new URL('controller.circuit.json',dir).pathname,...args],{cwd:dir.pathname,encoding:'utf8'});write(file,r.stdout??'');if(r.status!==0)throw Error(`${kind}: ${r.stderr}`);
}
write('verification.json',{status:'pass',parts:parts.length,pins:endpoints.size,wires:wires.length,checks,nativeChecks:['source','pin specification','netlist','schematic placement','PCB placement','pad shorts (PCB mode)','PCB style'],physicalRelease:'PENDING measured fit, continuity, ADC calibration, NFC and external routing interface tests',limitations:['Simple 20k input loading; does not meet original >=1M input requirement.','No local 5V output driver or continuity stimulus; these functions must be implemented externally.','Firmware integration for RC522/ADC/pulse is not part of this wiring guide.']});
console.log('Current simplified smart-board checks passed; physical acceptance pending.');
