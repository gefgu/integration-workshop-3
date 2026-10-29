import React from 'react';
import {Circuit} from '@tscircuit/core';
import {runAllNetlistChecks,runAllPinSpecificationChecks,runAllPlacementChecks} from '@tscircuit/checks';
import {convertCircuitJsonToSchematicSvg,convertCircuitJsonToPcbSvg} from 'circuit-to-svg';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import SmartPerfboard,{holePosition} from './controller.circuit';
import {board,parts,endpoints,wires,connectorMpn,links,pinmap,optional} from './design.mjs';
await import('../scripts/use-line-schematics.mjs');
const dir=new URL('./',import.meta.url);mkdirSync(new URL('assets/',dir),{recursive:true});
const write=(name:string,value:any)=>writeFileSync(new URL(name,dir),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
write('verification.json',{status:'incomplete',physicalRelease:'PENDING'});
const csv=(rows:any[][])=>rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
const c=new Circuit();c.add(<SmartPerfboard/>);await c.renderUntilSettled();const json=c.getCircuitJson();
write('controller.circuit.json',json);
const checks:any={source:json.filter((x:any)=>/^source_.*(error|warning)$/.test(x.type)),pins:await runAllPinSpecificationChecks(json),netlist:await runAllNetlistChecks(json),placement:await runAllPlacementChecks(json),assembly:[],nativePadCoordinates:[],netEquivalence:[]};
const occupied=new Map();for(const [e,p] of endpoints){const key=`${p.c},${p.r}`;if(occupied.has(key))checks.assembly.push({overlap:[e,occupied.get(key)]});occupied.set(key,e);if(p.c<1||p.c>board.columns||p.r<1||p.r>board.rows)checks.assembly.push({outside:e});const z=board.expansion;if(p.c>=z.c1&&p.c<=z.c2&&p.r>=z.r1&&p.r<=z.r2)checks.assembly.push({expansionOccupied:e});}
const makeUF=()=>{const map=new Map();const find=(x:any):any=>{if(!map.has(x))map.set(x,x);if(map.get(x)!==x)map.set(x,find(map.get(x)));return map.get(x);};return {find,join:(a:any,b:any)=>map.set(find(a),find(b))};};
const assembly=makeUF();for(const w of wires){const a=endpoints.get(w.from),b=endpoints.get(w.to);if(!a||!b||a.net!==w.net||b.net!==w.net)checks.assembly.push({badWire:w});assembly.join(w.from,w.to);}
const source=makeUF();for(const t of json.filter((x:any)=>x.type==='source_trace') as any[]){const ids=[...(t.connected_source_port_ids??[]),...(t.connected_source_net_ids??[])];for(const id of ids.slice(1))source.join(ids[0],id);}
const owners=new Map(json.filter((x:any)=>x.type==='source_component').map((x:any)=>[x.source_component_id,x.name]));
const sourcePorts=new Map();for(const p of json.filter((x:any)=>x.type==='source_port') as any[])for(const h of [p.name,...(p.port_hints??[])])sourcePorts.set(`${owners.get(p.source_component_id)}.${h}`,p.source_port_id);
const entries=[...endpoints];for(const [e,p] of entries){const id=sourcePorts.get(e.replace(/\.(\d+)$/,'.pin$1'));if(!id)checks.netEquivalence.push({missingSource:e});for(const [f,q] of entries){if(e>=f)continue;const expected=Boolean(p.net&&p.net===q.net);if((assembly.find(e)===assembly.find(f))!==expected)checks.assembly.push({wrongConnectivity:[e,f],expected});const other=sourcePorts.get(f.replace(/\.(\d+)$/,'.pin$1'));if((source.find(id)===source.find(other))!==expected)checks.netEquivalence.push({wrongConnectivity:[e,f],expected});}}
const seenNative=new Set<string>();
const pcbOwners=new Map(json.filter((x:any)=>x.type==='pcb_component').map((x:any)=>[x.pcb_component_id,owners.get(x.source_component_id)]));
for(const p of json.filter((x:any)=>x.type==='pcb_plated_hole') as any[]){const index=(p.port_hints??[]).find((h:string)=>/^(?:pin)?\d+$/.test(h));const e=index?`${pcbOwners.get(p.pcb_component_id)}.${index.replace(/^pin/,'')}`:null;if(!e||!endpoints.has(e)){checks.nativePadCoordinates.push({unmappedHole:p});continue;}seenNative.add(e);const q=endpoints.get(e)!;const target=holePosition(q.c,q.r);if(Math.abs(p.x-target.x)>.01||Math.abs(p.y-target.y)>.01)checks.nativePadCoordinates.push({pin:e,expected:target,actual:{x:p.x,y:p.y}});}
for(const e of endpoints.keys())if(!seenNative.has(e))checks.nativePadCoordinates.push({missingNativePad:e});
const status=Object.values(checks).some((v:any)=>v.length)?'fail':'pass';write('checks.json',{status,checks,physicalRelease:'PENDING manual measurements and bench audit',copper:'No routed PCB copper; native pads do not verify insulated hand wires'});
// Power-entry hardware remains in the assembly model; the schematic view
// represents the incoming supply with rail symbols at the local capacitors.
const powerEntrySources=new Set(json.filter((x:any)=>x.type==='source_component'&&['J_POWER','JP_EXT'].includes(x.name)).map((x:any)=>x.source_component_id));
const powerEntryComponents=new Set(json.filter((x:any)=>x.type==='schematic_component'&&powerEntrySources.has(x.source_component_id)).map((x:any)=>x.schematic_component_id));
const hiddenPorts=json.filter((x:any)=>x.type==='schematic_port'&&powerEntryComponents.has(x.schematic_component_id));
const powerEntryPorts=new Set(hiddenPorts.map((x:any)=>x.schematic_port_id));
const schematicView=json.filter((x:any)=>{
 if(!x.type.startsWith('schematic_'))return true;
 if(powerEntrySources.has(x.source_component_id)||powerEntryComponents.has(x.schematic_component_id))return false;
 if(x.type==='schematic_net_label'&&hiddenPorts.some((p:any)=>Math.hypot(p.center.x-x.anchor_position.x,p.center.y-x.anchor_position.y)<.001))return false;
 if(x.type==='schematic_trace'&&(x.edges??[]).some((e:any)=>powerEntryPorts.has(e.from?.schematic_port_id)||powerEntryPorts.has(e.to?.schematic_port_id)))return false;
 if(x.type==='schematic_net_label'&&powerEntryPorts.has(x.schematic_port_id))return false;
 return true;
});
let svg=convertCircuitJsonToSchematicSvg(schematicView,{width:2600,height:1700});svg=svg.replace(new RegExp(`<text\\b[^>]*>\\s*${connectorMpn}\\s*</text>`,'g'),'');if(svg.includes(connectorMpn))throw Error('Connector MPN visible');write('assets/schematic.svg',svg);
write('assets/native-pcb.svg',convertCircuitJsonToPcbSvg(json,{width:1000,height:1500}));
write('pins.csv',csv([['Ref','Pin','Label','Net','TOP column','TOP row'],...entries.map(([e,p])=>[p.ref,p.pin,p.label,p.net??'NC',p.c,p.r])]));
write('wires.csv',csv([['Wire','Net','From','From col','From row','To','To col','To row','Construction'],...wires.map(w=>{const a=endpoints.get(w.from)!,b=endpoints.get(w.to)!;return [w.id,w.net,w.from,a.c,a.r,w.to,b.c,b.r,'Insulated underside wire; endpoint guide, physical route audit pending'];})]));
write('gpio.csv',csv([['Signal','ESP32 GPIO','Purpose'],...pinmap]));write('links.csv',csv([['Link','External mode','USB mode','Purpose'],...links.map(l=>[l.ref,l.normal,l.usb,l.purpose])]));
write('bom.csv',csv([['Ref','Part/value','Quantity','Notes'],...parts.map(p=>[p.ref,p.kind==='header'?`${p.pins.length}-pin header/socket`:p.value,1,p.title]),...optional.map(p=>[p.ref,p.value,0,p.note]),['ESP32','Classic 30-pin DevKit',1,'Removable, USB toward row 1; dry-fit dimensions pending']]));
console.log(JSON.stringify({status,counts:{parts:parts.length,pins:endpoints.size,wires:wires.length},checks:Object.fromEntries(Object.entries(checks).map(([k,v]:any)=>[k,{count:v.length,examples:v.slice(0,4)}]))},null,2));
if(status==='fail')process.exit(1);
for(const kind of ['schematic-placement','placement']){const r=spawnSync(process.execPath,[new URL('../node_modules/.bin/tsci',dir).pathname,'check',kind,new URL('controller.circuit.json',dir).pathname],{encoding:'utf8'});const report=(r.stdout??'')+(r.stderr??'');write(`${kind}.txt`,report.trim()?report:'No actionable issues reported.\n');if(r.status!==0||/<SchematicPlacementIssues>\s*<[^/]/.test(report))throw Error(`${kind}: ${report}`);}

// Copper checks cover only native pads: no routed PCB traces are generated.
for(const [kind,args,file] of [
 ['shorts',['--mode','pcb','--layer','all'],'shorts.txt'],
 ['pcb-style',['--json','--svg',new URL('checks/pcb-style.svg',dir).pathname],'pcb-style.json']
] as any[]){
 const r=spawnSync(process.execPath,[new URL('../node_modules/.bin/tsci',dir).pathname,'check',kind,new URL('controller.circuit.json',dir).pathname,...args],{cwd:dir.pathname,encoding:'utf8'});
 write(file,r.stdout||'');if(r.status!==0){write('native-check-failure.txt',(r.stdout??'')+(r.stderr??''));throw Error(`${kind} failed`);}
}
console.log('Native schematic/PCB placement, pad shorts and PCB style checks passed. Hand-wire routing and bench tests require manual audit.');

write('verification.json',{status:'pass',counts:{parts:parts.length,pins:endpoints.size,insulatedWires:wires.length,nativePads:seenNative.size},nativeChecks:['source','pin specification','netlist','schematic placement','complete-board PCB placement','pad shorts (PCB mode)','PCB style'],modelChecks:['occupied holes','expansion area unoccupied by pins','all native pad coordinates and coverage','source-net equivalence','insulated-wire endpoint equivalence'],physicalRelease:'PENDING',audit:'audit.csv',limitations:['Socket/DevKit/connector body fit and board dimensions are not measured.','No routed PCB copper; pad checks do not verify hand wires.','Unbuffered 20k input, no power-off isolation or overvoltage clamps.','No pulse output driver or complete firmware is delivered.']});
