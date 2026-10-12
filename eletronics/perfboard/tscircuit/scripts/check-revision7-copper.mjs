// Native copper checks are retained, but do not prove insulated wire safety.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {boards,prototype} from '../design/revision7.mjs';
import {run} from './process.mjs';
const prototypeOnly=process.argv.includes('--prototype-only');
const report=prototypeOnly?JSON.parse(readFileSync('revision7/copper-checks.json')):{status:'pass',scope:'Native pad/copper geometry only. No routed copper: hand-wire connectivity is checked separately.',results:[]};
const env={...process.env,PATH:`${process.cwd()}/node_modules/.bin:${process.env.PATH}`};
mkdirSync('revision7/copper-checks',{recursive:true});
const selected=prototypeOnly?(prototype.earlyPlacement?[prototype.earlyPlacement]:[]):[...boards,...(prototype.earlyPlacement?[prototype.earlyPlacement]:[])];
for(const b of selected){
 const results=await Promise.all(['shorts','pcb-style'].map(async stage=>{
  const r=await run('node_modules/.bin/bun',['node_modules/@tscircuit/cli/cli/entrypoint.js','check',stage,`revision7/circuits/${b.id}-Complete-board.circuit.json`],{env,timeout:120000});
  const log=(r.stdout??'')+(r.stderr??'');writeFileSync(`revision7/copper-checks/${b.id}-${stage}.log`,log);
  const ok=r.status===0&&!r.error&&log.includes(stage==='shorts'?'No shorts detected':'No PCB style issues detected');
  if(!ok)report.status='fail';return {stage,ok,exitCode:r.status};
 }));report.results=report.results.filter(r=>r.board!==b.id);report.results.push({board:b.id,results});console.log(`${b.id}: ${results.every(r=>r.ok)?'pad/copper checks pass':'FAILED'}`);
}
writeFileSync('revision7/copper-checks.json',JSON.stringify(report,null,2)+'\n');
const original=JSON.parse(readFileSync('revision7/checks.json'));original.copper=report;
original.softwareStatus=report.status==='pass'&&!original.assemblyIssues.length&&original.native.every(r=>r.status==='pass')?'pass':'fail';
writeFileSync('revision7/checks.json',JSON.stringify(original,null,2)+'\n');
if(report.status!=='pass')process.exitCode=1;
