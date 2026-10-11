// Project rule: schematics never show connector/header/pogo part numbers (purchased parts are not identified yet).
// The MPN stays in the circuit data (tscircuit checks require one); only the drawn text is removed.
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {boards} from '../design/boards.mjs';

const connectors=boards.flatMap(b=>b.parts).filter(p=>p.ref.startsWith('J_')||p.kind==='header'||p.body==='pogo'||p.body==='idc');
const mpns=[...new Set(connectors.map(p=>p.mpn).filter(Boolean))];
const esc=(s)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/&/g,'&amp;?');
const textRe=new RegExp(`<text[^>]*>\\s*(?:${mpns.map(esc).join('|')})\\s*</text>`,'g');

export const stripConnectorMpns=(svg)=>svg.replace(textRe,'');

const patch=(file,fn)=>{const before=readFileSync(file,'utf8'),after=fn(before);if(after!==before){writeFileSync(file,after);return 1;}return 0;};
let changed=0;
for(const dir of existsSync('dist/boards')?readdirSync('dist/boards'):[]){
 const svg=`dist/boards/${dir}/schematic.svg`,local=`dist/boards/${dir}/local.json`;
 if(existsSync(svg))changed+=patch(svg,stripConnectorMpns);
 if(existsSync(local))changed+=patch(local,(t)=>JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(t)).map(([k,v])=>[k,stripConnectorMpns(v)]))));
}
for(const f of existsSync('assembly')?readdirSync('assembly').filter(f=>f.endsWith('-schematic.svg')):[])changed+=patch(`assembly/${f}`,stripConnectorMpns);
console.log(`connector part numbers stripped from ${changed} schematic file(s); ${mpns.length} part numbers hidden`);
