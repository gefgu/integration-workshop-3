import React from 'react';
import {Circuit} from '@tscircuit/core';
import {convertCircuitJsonToSchematicSvg} from 'circuit-to-svg';
import {runAllPinSpecificationChecks,runAllNetlistChecks,runAllSchematicChecks,runAllPlacementChecks} from '@tscircuit/checks';
import {Component} from '../lib/board';
import {boards} from '../design/boards.mjs';
import {makeCatalog} from './catalog.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
function selector(b:any,ep:string){const [ref,num]=ep.split('.'),p=b.parts.find((p:any)=>p.ref===ref),pin=p.pins.find((pin:any)=>pin.number===Number(num));return `.${ref} > .${ref.startsWith('Q_')?({S:'source',G:'gate',D:'drain'} as any)[pin.label]:`pin${num}`}`;}
const results:any[]=[];
const symbolHeight=(p:any)=>p.body==='pogo'?Math.max(1,p.pins.length*.3+.3):p.kind==='resistor'||p.kind==='capacitor'||p.kind==='diode'||p.ref.startsWith('Q_')?1:Math.max(.6,Math.ceil(p.pins.length/2)*.2+.2);
const compact=(list:any[])=>{const sorted=[...list].sort((a,c)=>symbolHeight(c)-symbolHeight(a));let y=.4;const out:any[]=[];for(let k=0;k<sorted.length;k+=2){const row=sorted.slice(k,k+2),height=Math.max(...row.map(symbolHeight));row.forEach((p,i)=>out.push({...p,sch:[i*8.5,-y-height/2]}));y+=height+(row.some((p:any)=>p.body==='pogo')?.8:row.some((p:any)=>p.ref.startsWith('Q_'))?1.5:.7);}return out;};
const variants=(b:any,section:any)=>{const all=b.parts.filter((p:any)=>p.section===section.name),phases=[...new Set(all.map((p:any)=>p.phase))];return [{key:section.name,parts:all},...(phases.length>1?phases.map((ph:any)=>({key:`${section.name}@${ph}`,parts:compact(all.filter((p:any)=>p.phase===ph))})):[])];};
for(const b of boards){const assets:any={};for(const section of b.sections)for(const variant of variants(b,section)){
 const parts=variant.parts,refs=new Set(parts.map(p=>p.ref)),nets=b.nets.map(n=>({...n,local:n.pins.filter(ep=>refs.has(ep.split('.')[0])),external:n.pins.filter(ep=>!refs.has(ep.split('.')[0]))})).filter(n=>n.local.length);
 const circuit=new Circuit();const children=[...parts.map(p=><Component board={b} p={p}/>),...nets.map(n=><net name={/^\d/.test(n.name)?`V_${n.name}`:n.name} isGroundNet={n.name==='GND'} isPowerNet={/^(?:USB_|SAFE_|BUCK_|[35]V|12V|PI_3V3)/.test(n.name)}/>),...nets.flatMap(n=>{const supply=n.name==='GND'||/^(?:USB_|SAFE_|BUCK_|[35]V|12V|PI_3V3)/.test(n.name);
  const node=n.name.startsWith('NODE')&&n.local.length>1&&n.local.every(ep=>ep.split('.')[0]===n.local[0].split('.')[0]);
  const lines:any[]=node?n.local.slice(1).map((ep,i)=><trace name={n.name} from={selector(b,n.local[i])} to={selector(b,ep)}/>):[];
  if(node&&n.external.length){const p=parts.find(p=>p.ref===n.local[0].split('.')[0]);lines.push(<netlabel net={n.name} connection={selector(b,n.local[0])} schX={p.sch[0]+2.7} schY={p.sch[1]+.65} anchorSide="left"/>);}
  else if(!node&&(supply||n.external.length||n.local.length>1))for(const ep of n.local)lines.push(<trace name={n.name} from={selector(b,ep)} to={`net.${/^\d/.test(n.name)?`V_${n.name}`:n.name}`}/>);
  return lines;
 })];circuit.add(React.createElement('board',{width:b.width,height:b.height,routingDisabled:true,schRelative:true,schTraceAutoLabelEnabled:false,schMaxTraceDistance:10000},React.createElement('schematicsheet',{name:'Circuit',displayName:`${b.title} / ${section.label}`},React.createElement('group',{name:'Function',schRelative:true},...children))));await circuit.renderUntilSettled();const j=circuit.getCircuitJson(),checks={source:j.filter((e:any)=>/^source_.*(error|warning)$/.test(e.type)),pins:await runAllPinSpecificationChecks(j),netlist:await runAllNetlistChecks(j),schematic:await runAllSchematicChecks(j),placement:await runAllPlacementChecks(j)};
 const status=Object.values(checks).some(a=>a.length)?'fail':'pass';assets[variant.key]=convertCircuitJsonToSchematicSvg(j.filter((e:any)=>e.type!=='schematic_sheet'),{width:1000,height:750}).replace(/V_([35]V[^<\s]*|12V[^<\s]*)/g,'$1');const ports=nets.filter(n=>n.external.length).map(n=>({net:n.name,local:n.local,destinations:n.external}));results.push({board:b.id,section:variant.key,status,ports,checks});console.log(`${b.id}/${variant.key}: ${status}`);
 }mkdirSync(`dist/boards/${b.id}`,{recursive:true});writeFileSync(`dist/boards/${b.id}/local.json`,JSON.stringify(assets));}
mkdirSync('checks',{recursive:true});const report={revision:makeCatalog().revision,status:results.some(r=>r.status!=='pass')?'fail':'pass',scope:'Sheet frames omitted only from teaching SVGs to fit the local function; original native sheets remain checked. Native functional schematics derived from original pin/net membership; explicit ports preserve every external net.',results};writeFileSync('checks/local.json',JSON.stringify(report,null,2)+'\n');if(report.status!=='pass')process.exit(1);

await import('./strip-connector-mpns.mjs');
