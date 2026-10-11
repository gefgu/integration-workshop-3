import React from 'react';
import {Circuit} from '@tscircuit/core';
import {runAllPinSpecificationChecks,runAllNetlistChecks,runAllSchematicChecks,runAllPlacementChecks} from '@tscircuit/checks';
import {Perfboard} from '../lib/board';
import {makeCatalog} from './catalog.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const c=makeCatalog(),results:any[]=[],seen=new Set();
for(const instance of c.instances)for(const cp of c.checkpoints){
 const b=c.boards.find(b=>b.id===instance.board)!;
 const refs=new Set(c.items.filter(i=>i.instance===instance.id&&i.type==='part'&&i.phase<=cp.phase).map(i=>i.ref));
 if(!refs.size)continue;const key=JSON.stringify([b.id,[...refs].sort()]);if(seen.has(key))continue;seen.add(key);
 const activeWires=new Set(c.items.filter(i=>i.instance===instance.id&&i.type==='wire'&&i.phase<=cp.phase).map(i=>i.uid));
 const wires=b.wires.filter(w=>activeWires.has(w.uid)),endpoints=new Set(wires.flatMap(w=>[w.from,w.to]));
 // Unused signal terminals may remain open until their consumers arrive. Never exempt IC power/ground requirements.
 const parts=b.parts.filter(p=>refs.has(p.ref)).map(p=>({...p,stageOpenPins:p.pins.filter(pin=>!endpoints.has(`${p.ref}.${pin.number}`)&&b.nets.some(n=>n.pins.includes(`${p.ref}.${pin.number}`)&&n.pins.some(ep=>!refs.has(ep.split('.')[0])))).map(pin=>pin.number)}));
 for(const p of parts)if(p.kind!=='header')for(const number of p.stageOpenPins){const pin=p.pins.find(pin=>pin.number===number);if(/^(VCC|VDD|VIN|VS|3V3|GND|VSS|VEE)/.test(pin.label))throw Error(`Unpowered partial IC: ${b.id}/${p.ref}.${pin.label}`);}
 const descriptor={...b,parts,wires};
 const circuit=new Circuit();circuit.add(<Perfboard id={b.id} descriptor={descriptor}/>);await circuit.renderUntilSettled();const j=circuit.getCircuitJson();
 const checks={source:j.filter((x:any)=>/^source_.*(error|warning)$/.test(x.type)),pins:await runAllPinSpecificationChecks(j),netlist:await runAllNetlistChecks(j),schematic:await runAllSchematicChecks(j),placement:await runAllPlacementChecks(j)};
 const status=Object.values(checks).some(issues=>issues.length)?'fail':'pass';results.push({instance:instance.id,checkpoint:cp.id,parts:refs.size,reservedConnectorPins:parts.filter(p=>p.stageOpenPins.length).map(p=>({ref:p.ref,pins:p.stageOpenPins})),status,checks});console.log(`${instance.id}/${cp.id}: ${status}`);
}
mkdirSync('checks',{recursive:true});const report={revision:c.revision,status:results.some(r=>r.status==='fail')?'fail':'pass',scope:'Native tscircuit checks of each distinct cumulative construction state; no bench measurements.',results};writeFileSync('checks/partial.json',JSON.stringify(report,null,2)+'\n');if(report.status!=='pass')process.exit(1);
