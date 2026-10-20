// Proves the actual isolated-island stripboard model detects wiring faults.
import { links, parts } from './design.mjs';
import { checkDesign } from './stripboard.mjs';
const expect=(name,mutate,code)=>{const undo=mutate();const codes=checkDesign().issues.map(i=>i.code);undo();const ok=codes.includes(code);console.log(`${ok?'ok  ':'FAIL'} ${name} -> ${codes.join(',')||'nothing reported'}`);if(!ok)process.exitCode=1;};
expect('remove an inter-island link',()=>{const i=links.findIndex(l=>l.net==='GND');const [l]=links.splice(i,1);return()=>links.splice(i,0,l);},'open');
expect('move a pin onto a different net pad',()=>{const q=parts.find(p=>p.ref==='Q1'),pin=q.pins[0],old=pin[2];pin[2]=[1,29];return()=>{pin[2]=old};},'short');
expect('move a connector NC into a live pad',()=>{const p=parts.find(p=>p.ref==='J_OUT'),old=p.unconnected[0];p.unconnected[0]=[1,29];return()=>{p.unconnected[0]=old};},'nc-pin-connected');
expect('move a component pin outside the board',()=>{const p=parts.find(p=>p.ref==='D1'),old=p.pins[0][2];p.pins[0][2]=[37,1];return()=>{p.pins[0][2]=old};},'out-of-board');
expect('place two component leads in one hole',()=>{const p=parts.find(p=>p.ref==='Q2'),old=p.pins[0][2];p.pins[0][2]=parts.find(q=>q.ref==='Q3').pins[0][2];return()=>{p.pins[0][2]=old};},'hole-used-twice');
