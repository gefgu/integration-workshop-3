// Native copper checks are retained, but do not prove insulated wire safety.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {boards} from '../design/revision5.mjs';
import {run} from './process.mjs';
const report={status:'pass',scope:'Native pad/copper geometry only. No routed copper: hand-wire connectivity is checked separately.',results:[]};
const env={...process.env,PATH:`${process.cwd()}/node_modules/.bin:${process.env.PATH}`};
mkdirSync('revision5/copper-checks',{recursive:true});
for(const b of boards){
 const results=await Promise.all(['shorts','pcb-style'].map(async stage=>{
  const r=await run('node_modules/.bin/bun',['node_modules/@tscircuit/cli/cli/entrypoint.js','check',stage,`revision5/circuits/${b.id}-Complete-board.circuit.json`],{env,timeout:120000});
  const log=(r.stdout??'')+(r.stderr??'');writeFileSync(`revision5/copper-checks/${b.id}-${stage}.log`,log);
  const ok=r.status===0&&!r.error&&log.includes(stage==='shorts'?'No shorts detected':'No PCB style issues detected');
  if(!ok)report.status='fail';return {stage,ok,exitCode:r.status};
 }));report.results.push({board:b.id,results});console.log(`${b.id}: ${results.every(r=>r.ok)?'pad/copper checks pass':'FAILED'}`);
}
writeFileSync('revision5/copper-checks.json',JSON.stringify(report,null,2)+'\n');
const original=JSON.parse(readFileSync('revision5/checks.json'));original.copper=report;
original.softwareStatus=report.status==='pass'&&!original.assemblyIssues.length&&original.native.every(r=>r.status==='pass')?'pass':'fail';
writeFileSync('revision5/checks.json',JSON.stringify(original,null,2)+'\n');
if(report.status!=='pass')process.exitCode=1;
