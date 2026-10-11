import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {boards,byId,instances} from '../design/boards.mjs';
import {cables} from '../design/cables.mjs';
import {coordinate,pinAt,MT_X_ADDRESS} from '../design/model.mjs';
const same=(a,b)=>Math.abs(a-b)<1e-5;
export function validateBoard(b,j) {
 const refs=new Set(),holes=new Map(),ownership=new Map(),ports=new Map();
 for(const n of b.nets)for(const ep of n.pins){assert(!ownership.has(ep),`${b.id}: ${ep} belongs to multiple nets`);ownership.set(ep,n.name);}
 for(const p of b.parts) {
  assert(!refs.has(p.ref),`Duplicate ref ${p.ref}`);refs.add(p.ref);assert(p.mpn,`${p.ref}: missing selected part`);
  const sc=j.find(x=>x.type==='source_component'&&x.name===p.ref);assert(sc,`Missing compiled ${p.ref}`);
  for(const pin of p.pins) {
   const [i,r]=pin.hole;assert(Number.isInteger(i)&&Number.isInteger(r)&&i>=1&&i<=b.cols&&r>=1&&r<=b.rows,`${p.ref}: off-grid pin`);
   assert(!holes.has(pin.hole.join(',')),`${b.id}: occupied hole ${pin.hole}`);holes.set(pin.hole.join(','),`${p.ref}.${pin.number}`);
   const role=p.ref.startsWith('Q_')?{S:'source',G:'gate',D:'drain'}[pin.label]:null;
   const sp=j.find(x=>x.type==='source_port'&&x.source_component_id===sc.source_component_id&&(role?(x.name===role||x.port_hints?.includes(role)):x.pin_number===pin.number));
   assert(sp,`${p.ref}.${pin.number}: missing compiled port`);ports.set(`${p.ref}.${pin.number}`,sp.source_port_id);
   const pp=j.find(x=>x.type==='pcb_port'&&x.source_port_id===sp.source_port_id);assert(pp,`${p.ref}.${pin.number}: missing pad port`);
   const xy=coordinate(b,pin.hole);assert(same(pp.x,xy[0])&&same(pp.y,xy[1]),`${p.ref}.${pin.number}: mirrored/transformed pad mismatch`);
  }
 }
 const graph=new Map();const join=(a,c)=>{if(!graph.has(a))graph.set(a,new Set());graph.get(a).add(c);};
 for(const t of j.filter(x=>x.type==='source_trace'))for(const a of t.connected_source_port_ids)for(const c of t.connected_source_port_ids)join(a,c);
 const visit=start=>{const found=new Set([start]),queue=[start];for(const p of queue)for(const n of graph.get(p)??[])if(!found.has(n)){found.add(n);queue.push(n);}return found;};
 for(const n of b.nets) {
  const expected=new Set(n.pins.map(p=>ports.get(p)));const actual=visit([...expected][0]);
  assert.deepEqual(actual,expected,`${b.id}: missing/extra compiled connection on ${n.name}`);
 }
 for(const p of b.parts)for(const pin of p.pins)if(/^NC/.test(pin.label))assert(!ownership.has(`${p.ref}.${pin.number}`),`${p.ref}: NC connected`);
 assert.equal(j.filter(x=>x.type==='schematic_net_label').length,0,`${b.id}: internal connection replaced with label`);
 assert.equal(j.filter(x=>x.type==='pcb_trace').length,0,`${b.id}: unexpected fabricated copper`);
 assert.equal(j.filter(x=>/warning|error/.test(x.type)).length,0,`${b.id}: unresolved Circuit JSON diagnostics`);
 for(const w of b.wires) {
  assert.deepEqual(w.path[0],pinAt(b,w.from).pin.hole);assert.deepEqual(w.path.at(-1),pinAt(b,w.to).pin.hole);
  assert.equal(ownership.get(w.from),w.net);assert.equal(ownership.get(w.to),w.net);
  for(let k=1;k<w.path.length;k++) {
   const a=w.path[k-1],c=w.path[k];assert(a[0]===c[0]||a[1]===c[1],`${w.id}: nonorthogonal hand wire`);
   if(!w.insulated)for(const [h,ep]of holes){const [x,y]=h.split(',').map(Number);const on=a[0]===c[0]?x===a[0]&&y>=Math.min(a[1],c[1])&&y<=Math.max(a[1],c[1]):y===a[1]&&x>=Math.min(a[0],c[0])&&x<=Math.max(a[0],c[0]);if(on)assert.equal(ownership.get(ep),w.net,`${w.id}: bare strap shorts ${ep}`);}
  }
 }
 return {board:b.id,parts:b.parts.length,nets:b.nets.length,wires:b.wires.length,status:'pass'};
}
export function validateCables() {
 for(const c of cables) {
  const a=byId[c.from.split(':')[0]].parts.find(p=>p.ref===c.fromRef),z=byId[c.to.split(':')[0]].parts.find(p=>p.ref===c.toRef);
  assert.equal(a.pins.length,z.pins.length);
  for(const pair of c.pins){const ap=a.pins.find(p=>p.number===pair.fromPin),zp=z.pins.find(p=>p.number===pair.toPin);const an=a.signals?.[ap.number]??a.signals?.[ap.label],zn=z.signals?.[zp.number]??z.signals?.[zp.label];assert.equal(an,c.aliases[zn]??zn,`${c.id} pin ${pair.fromPin}: ${an}/${zn}`);}
 }
}
export function runAssemblyChecks() {
 mkdirSync('checks',{recursive:true});const results=boards.map(b=>validateBoard(b,JSON.parse(readFileSync(`dist/boards/${b.id}/circuit.json`))));validateCables();
 assert.equal(instances.reduce((n,x)=>n+x.quantity,0),18);assert.equal(new Set(MT_X_ADDRESS).size,16);
 const p3max=5.25*(1000*1.01)/(49900*.99+1000*1.01)/(10*.99)+10e-6/(10*.99);
 assert(p3max<.012,'P3 static corner exceeds 12mA');
 const leakage=5.25/(2e6*.99)+1e-6;assert(leakage<10e-6);
 const ovMax=.5075*(1+92800*1.001/(10000*.999))+.001;assert(ovMax<5.25);
 // Negative controls: prove duplicate physical pads and corrupted cables fail.
 const a=structuredClone(byId.a1);a.parts[1].pins[0].hole=[...a.parts[0].pins[0].hole];assert.throws(()=>validateBoard(a,JSON.parse(readFileSync('dist/boards/a1/circuit.json'))));
 const cable=cables[0];const saved=cable.pins[0].toPin;cable.pins[0].toPin=3;assert.throws(validateCables);cable.pins[0].toPin=saved;
 const report={results,cables:cables.length,negativeControls:2,staticCalculations:{p3CurrentMax_mA:p3max*1000,p1p2OffLeakageMax_uA:leakage*1e6,overvoltageTripMax_V:ovMax},scope:'Compiled connectivity/pad transforms and prescribed insulated hand wiring; no physical bench measurements.'};
 writeFileSync('checks/assembly.json',JSON.stringify(report,null,2)+'\n');return report;
}

if(process.argv[1]?.endsWith('check-assembly.mjs'))console.log(JSON.stringify(runAssemblyChecks(),null,2));
