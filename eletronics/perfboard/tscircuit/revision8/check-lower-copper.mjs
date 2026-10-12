// Copper geometry checks cannot verify insulated hand wires.
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=fileURLToPath(new URL('./lower/',import.meta.url));
const run=(board,stage)=>new Promise(resolve=>{
 const child=spawn(`${root}/node_modules/.bin/bun`,[`${root}/node_modules/@tscircuit/cli/cli/entrypoint.js`,'check',stage,`${out}/circuits/${board}-Complete-board.circuit.json`],{cwd:out,env:{...process.env,PATH:`${root}/node_modules/.bin:${process.env.PATH}`},stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 const timeout=setTimeout(()=>child.kill('SIGTERM'),120000);
 child.on('error',e=>log+=e.message);child.on('close',code=>{clearTimeout(timeout);writeFileSync(`${out}/copper-checks/${board}-${stage}.log`,log);resolve({board,stage,exitCode:code,ok:code===0&&log.includes(stage==='shorts'?'No shorts detected':'No PCB style issues detected')});});
});
mkdirSync(`${out}/copper-checks`,{recursive:true});
// CLI diagnostic folders have fixed names: keep calls sequential to preserve each result.
const results=[];for(const board of ['power','router-matrix'])for(const stage of ['shorts','pcb-style']){const r=await run(board,stage);results.push(r);console.log(r);}
const status=results.every(r=>r.ok)?'pass':'fail';
writeFileSync(`${out}/copper-checks.json`,JSON.stringify({status,scope:'Pad/copper geometry only; no routed copper. Hand-wire endpoints, connectivity and sleeves checked independently.',results},null,2)+'\n');
const checks=JSON.parse(readFileSync(`${out}/checks.json`));checks.copper={status,results};if(status==='fail')checks.softwareStatus='fail';writeFileSync(`${out}/checks.json`,JSON.stringify(checks,null,2)+'\n');if(status==='fail')process.exitCode=1;
