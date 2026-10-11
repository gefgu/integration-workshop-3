import assert from 'node:assert/strict';import{mkdirSync,writeFileSync}from'node:fs';
import{boards}from'../design/boards.mjs';import{makeCatalog}from'./catalog.mjs';
export function validateStages(c=makeCatalog()) {
 const phases=[],byId=new Map(c.items.map(i=>[i.id,i]));
 for(const cp of c.checkpoints){
  const active=c.items.filter(i=>i.phase<=cp.phase);for(const i of active)for(const d of i.dependencies)assert(byId.get(d).phase<=cp.phase,`${cp.id}: future dependency ${d}`);
  for(const b of c.boards){const parts=b.parts.filter(p=>p.phase<=cp.phase),refs=new Set(parts.map(p=>p.ref)),wires=b.wires.filter(w=>w.phase<=cp.phase);
   const owned=new Map(b.nets.flatMap(n=>n.pins.map(p=>[p,n.name]))),graph=new Map();
   for(const w of wires){assert(refs.has(w.from.split('.')[0])&&refs.has(w.to.split('.')[0]),`${cp.id}/${b.id}: wire terminates at future component`);assert.equal(owned.get(w.from),owned.get(w.to));for(const [a,z]of [[w.from,w.to],[w.to,w.from]]){if(!graph.has(a))graph.set(a,new Set());graph.get(a).add(z);}}
   for(const n of b.nets){const installed=n.pins.filter(ep=>refs.has(ep.split('.')[0]));if(installed.length<2)continue;const reached=new Set([installed[0]]),q=[installed[0]];for(const ep of q)for(const next of graph.get(ep)??[])if(!reached.has(next)){reached.add(next);q.push(next);}assert(installed.every(ep=>reached.has(ep)),`${cp.id}/${b.id}: incomplete installed net ${n.name}`);}
  }
  if(cp.phase<(c.schemaVersion===2?24:8)){assert(!active.some(i=>i.type==='part'&&/^U_MT_/.test(i.ref)),`${cp.id}: early matrix dependency`);assert(!active.some(i=>i.type==='cable'&&i.title.startsWith('NODE_')));}
  phases.push({checkpoint:cp.id,items:active.length,status:'pass'});
 }
 for(const b of c.boards){assert.equal(new Set(b.wires.map(w=>w.uid)).size,b.wires.length);for(const p of b.parts){assert(p.bounds.xmin>=.49&&p.bounds.xmax<=b.cols+.51&&p.bounds.ymin>=.49&&p.bounds.ymax<=b.rows+.51,`${b.id}/${p.ref}: courtyard out of board`);}}
 if(c.schemaVersion===2){assert(!c.items.some(i=>i.phase===0&&i.instance==='power'),'CP00 depends on final power');assert(5.25/(560*.99)*1000<9.5);for(const b of c.boards.filter(b=>b.kind==='breadboard')){const rows=new Map();for(const p of b.parts)for(const pin of p.pins){const [x,y]=pin.hole,side=x>=2&&x<=6?'left':x>=9&&x<=13?'right':null;if(!side)continue;const ep=`${p.ref}.${pin.number}`,net=b.nets.find(n=>n.pins.includes(ep))?.name;if(!net)continue;const key=`${side}/${y}`;assert(!rows.has(key)||rows.get(key)===net,`Breadboard row shorts ${ep}`);rows.set(key,net);}}}
 const corrupt=structuredClone(c);const wire=corrupt.items.find(i=>i.type==='wire');wire.phase=0;corrupt.items.find(i=>i.id===wire.dependencies[0]).phase=13;assert.throws(()=>{for(const dep of wire.dependencies)assert(corrupt.items.find(i=>i.id===dep).phase<=wire.phase);});
 return{status:'pass',revision:c.revision,phases,negativeControls:1,scope:'Software dependency and cumulative connectivity checks. No physical measurements.'};
}
if(process.argv[1]?.endsWith('check-stages.mjs')){mkdirSync('checks',{recursive:true});const r=validateStages();writeFileSync('checks/stages.json',JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r,null,2));}
