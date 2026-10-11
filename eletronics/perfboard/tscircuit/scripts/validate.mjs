import {makeCatalog} from './catalog.mjs';
const makeCatalogRevision=()=>makeCatalog().revision;
import {validateStages} from './check-stages.mjs';
import {createHash} from 'node:crypto';
import {run} from './process.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {boards} from '../design/boards.mjs';
import {runAllPinSpecificationChecks,runAllNetlistChecks,runAllSchematicChecks,runAllPlacementChecks} from '@tscircuit/checks';
import {validateBoard,validateCables,runAssemblyChecks} from './check-assembly.mjs';
const env={...process.env,PATH:`${process.cwd()}/node_modules/.bin:${process.env.PATH}`};mkdirSync('checks',{recursive:true});let failed=false;const results=[];
for(const b of boards) {
 const j=JSON.parse(readFileSync(`dist/boards/${b.id}/circuit.json`));const stages={source:j.filter(x=>/^source_.*(error|warning)$/.test(x.type)),pin_specification:await runAllPinSpecificationChecks(j),netlist:await runAllNetlistChecks(j),schematic_placement:await runAllSchematicChecks(j),placement:await runAllPlacementChecks(j)};
 try{stages.assembly=validateBoard(b,j);}catch(e){stages.assembly={status:'fail',message:e.message};failed=true;}
 for(const [stage,issues] of Object.entries(stages))if(Array.isArray(issues)&&issues.length)failed=true;
 await Promise.all(['shorts','pcb-style'].map(async stage=> {
  const r=await run('node_modules/.bin/bun',['node_modules/@tscircuit/cli/cli/entrypoint.js','check',stage,`dist/boards/${b.id}/circuit.json`],{env,timeout:120000});
  const output=(r.stdout??'')+(r.stderr??'');writeFileSync(`checks/${b.id}-${stage}.log`,output);
  stages[stage]={exitCode:r.status,signal:r.signal,error:r.error?.message,output:output.trim()};if(r.status!==0||r.error||!output.includes(stage==='shorts'?'No shorts detected':'No PCB style issues detected')||/\b(error|warning|failed)\b/i.test(output.replace(/(?:Errors:\s*0|Warnings:\s*0|0 errors|0 warnings|no shorts)/gi,'')))failed=true;
 }));
 results.push({board:b.id,compiledSha256:createHash('sha256').update(readFileSync(`dist/boards/${b.id}/circuit.json`)).digest('hex'),stages});console.log(`${b.id}: ${Object.values(stages).some(x=>Array.isArray(x)&&x.length)||stages.assembly.status==='fail'?'FAIL':'checked'}`);
}
try{validateCables();}catch(e){failed=true;results.push({cables:'fail',message:e.message});}
let assembly;try{assembly=runAssemblyChecks();}catch(e){failed=true;assembly={status:'fail',message:e.message};}
let construction;try{construction=validateStages();writeFileSync('checks/stages.json',JSON.stringify(construction,null,2)+'\n');}catch(e){failed=true;construction={status:'fail',message:e.message};}
let partial;try{partial=JSON.parse(readFileSync('checks/partial.json'));if(partial.status!=='pass'||partial.revision!==makeCatalogRevision())failed=true;}catch(e){failed=true;partial={status:'fail',message:'Run verify:partial before verification'};}
let local;try{local=JSON.parse(readFileSync('checks/local.json'));if(local.status!=='pass'||local.revision!==makeCatalogRevision())failed=true;}catch(e){failed=true;local={status:'fail',message:'Run build:local first'};}
const report={local,partial,construction,status:failed?'fail':'pass',scope:'Software checks of compiled design and manual wiring instructions. Bench measurements and physical fit are pending.',results,assembly};writeFileSync('checks/report.json',JSON.stringify(report,null,2)+'\n');console.log(`Verification ${report.status}. See checks/report.json`);process.exit(failed?1:0);
