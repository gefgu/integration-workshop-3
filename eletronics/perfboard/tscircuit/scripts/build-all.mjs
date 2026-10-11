import {run} from './process.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {boards} from '../design/boards.mjs';
const env={...process.env,PATH:`${process.cwd()}/node_modules/.bin:${process.env.PATH}`};
for(const script of ['use-canvas-renderer','use-line-schematics'])await import(`./${script}.mjs`);
mkdirSync('checks/build',{recursive:true});
for(const b of boards) {
 const r=await run('node_modules/.bin/bun',['node_modules/@tscircuit/cli/cli/entrypoint.js','build',`boards/${b.id}.circuit.tsx`,'--svgs','--3d-png','--disable-parts-engine'],{env,timeout:300000});
 writeFileSync(`checks/build/${b.id}.log`,(r.stdout??'')+(r.stderr??''));
 console.log(`${b.id}: build ${r.status===0?'passed':'FAILED'}`);if(r.status!==0||r.error){console.error(r.error??r.stderr);process.exit(r.status||1);}
 if(/Failed to generate|Error:/.test((r.stdout??'')+(r.stderr??'')))throw Error(`${b.id}: an export failed despite the CLI exit status; inspect checks/build/${b.id}.log`);
}
const local=await run('node_modules/.bin/bun',['scripts/build-local.tsx'],{env,timeout:120000});writeFileSync('checks/build/local.log',(local.stdout??'')+(local.stderr??''));if(local.status!==0||local.error)throw Error('Functional schematic build failed; inspect checks/build/local.log');
await import('./strip-connector-mpns.mjs');
await import('./export-assembly.mjs');
