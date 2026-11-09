import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const D=new URL('./',import.meta.url),root=new URL('../../',D),exe=process.execPath,cli=new URL('node_modules/.bin/tsci',root).pathname;
const read=n=>JSON.parse(readFileSync(new URL(n,D),'utf8'));
function run(command,args,log){const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:10*1024*1024});if(log)writeFileSync(new URL(log,D),r.stdout+r.stderr);if(r.status!==0)throw Error(command+' failed: '+r.stderr+' '+r.stdout);}
run(exe,[new URL('build.tsx',D).pathname],'source-build-check.txt');
run(exe,[new URL('finalize.mjs',D).pathname],'copper-build-check.txt');
const checks=read('copper-checks.json');if(Object.values(checks).some(v=>v.length))throw Error('Copper checks are not clean');
run(exe,[cli,'check','shorts',new URL('copper.circuit.json',D).pathname,'--layer','top','--pixels-per-mm','20'],'shorts-check.txt');
run(exe,[cli,'check','pcb-style',new URL('copper.circuit.json',D).pathname],'pcb-style-check.txt');
run('python3',[new URL('audit-assembly.py',D).pathname],'assembly-audit.txt');
const status=read('candidate-status.json');status.status='SOFTWARE_VERIFIED_SINGLE_COPPER_FACE_WITH_INSULATED_WIRE_BRIDGES';status.independentCopperShortsCheck='PASS; native Gerber copper check at 20 pixels/mm';status.independentPcbStyleCheck='PASS';status.independentGeometryConnectivity=read('assembly-audit.json');status.hardwareAcceptance='PENDING';status.manufacturingRelease=false;
writeFileSync(new URL('candidate-status.json',D),JSON.stringify(status,null,2)+'\n');console.log('PASS: native checks, independent copper shorts, style and assembly geometry. Physical acceptance pending.');
