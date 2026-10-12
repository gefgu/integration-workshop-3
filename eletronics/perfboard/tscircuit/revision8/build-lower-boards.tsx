import React from 'react';
import {Circuit} from '@tscircuit/core';
import {convertCircuitJsonToSchematicSvg} from 'circuit-to-svg';
import {symbols} from 'schematic-symbols';
import {runAllPinSpecificationChecks,runAllNetlistChecks,runAllSchematicChecks,runAllPlacementChecks} from '@tscircuit/checks';
import {Component} from '../lib/board';
import {boards as allBoards,lowerBoards as boards,cables,checkpoints,revision,stock,release,baseline,colorFor8} from './design/power-matrix.mjs';
import {pinAt} from '../design/model7.mjs';
import {MAX_ATTACH} from '../design/model7.mjs';
import {netDescription,partDescription} from '../design/descriptions.mjs';
import {mkdirSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';

await import('../scripts/use-canvas-renderer.mjs');
await import('../scripts/use-line-schematics.mjs');
const out='revision8/lower';mkdirSync(`${out}/assets`,{recursive:true});mkdirSync(`${out}/circuits`,{recursive:true});
const xml=(s:any)=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const csv=(rows:any[])=>rows.map(r=>r.map((v:any)=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n')+'\n';
const save=(name:string,text:string)=>writeFileSync(`${out}/${name}`,text);
const sourceDigest=createHash('sha256').update(JSON.stringify({boards,cables,checkpoints})).digest('hex');

const issues:any[]=[];const assert=(ok:any,code:string,context:any)=>{if(!ok)issues.push({code,...context});};
const endpoints=new Map<string,string>();
for(const b of boards){
 const used=new Map(), refs=new Set();
 for(const p of b.parts){
  assert(!refs.has(p.ref),'duplicate-reference',{board:b.id,ref:p.ref});refs.add(p.ref);
  for(const pin of p.pins){
   const key=pin.hole.join(',');assert(!used.has(key),'occupied-hole',{board:b.id,ref:p.ref,hole:key,other:used.get(key)});used.set(key,p.ref);
   assert(pin.hole[0]>=1&&pin.hole[0]<=b.cols&&pin.hole[1]>=1&&pin.hole[1]<=b.rows,'out-of-grid',{board:b.id,ref:p.ref,hole:key});
  }
 }
 for(const n of b.nets)for(const ep of n.pins){
  const key=`${b.id}/${ep}`;assert(!endpoints.has(key),'pin-on-two-nets',{board:b.id,endpoint:ep,net:n.name});endpoints.set(key,n.name);pinAt(b,ep);
 }
 const pairs=new Set();
 for(const w of b.wires){
  assert(endpoints.get(`${b.id}/${w.from}`)===w.net&&endpoints.get(`${b.id}/${w.to}`)===w.net,'wire-net-mismatch',{board:b.id,wire:w.id});
  assert(w.phase>=pinAt(b,w.from).part.phase&&w.phase>=pinAt(b,w.to).part.phase,'premature-wire',{board:b.id,wire:w.id});
  const pair=[w.from,w.to].sort().join('~');assert(!pairs.has(pair),'duplicate-wire',{board:b.id,wire:w.id});pairs.add(pair);
 }
 // Partial-state connectivity is checked after every checkpoint. Net members
 // added later never provide the only bridge between earlier installed members.
 for(let phase=0;phase<=36;phase++)for(const n of b.nets){
  const members=n.pins.filter(ep=>pinAt(b,ep).part.phase<=phase);if(members.length<2)continue;
  const reached=new Set([members[0]]);let changed=true;
  while(changed){changed=false;for(const w of b.wires.filter(w=>w.net===n.name&&w.phase<=phase))if(reached.has(w.from)||reached.has(w.to)){for(const ep of [w.from,w.to])if(!reached.has(ep)){reached.add(ep);changed=true;}}}
  assert(members.every(ep=>reached.has(ep)),'partial-net-disconnected',{board:b.id,phase,net:n.name});
 }
 // Reject analogue feedback, decoupling and watchdog RC split across stock.
 for(const n of b.nets.filter(n=>/DIV|GATE_DRIVE|WATCH_(CX|RX)|BUFFER|BUF$/.test(n.name))){
  assert(!cables.some(c=>c.net===n.name),'sensitive-loop-crosses-board',{board:b.id,net:n.name});
 }
}
for(const b of boards){
 const maxAttach=MAX_ATTACH;const count:any={},onBar=new Set<string>();
 b.wires.forEach(w=>[w.from,w.to].forEach(ep=>{if(w.bar)onBar.add(ep);else count[ep]=(count[ep]??0)+1;}));onBar.forEach(ep=>count[ep]=(count[ep]??0)+1);
 for(const [ep,k] of Object.entries(count))assert((k as number)<=maxAttach+(onBar.has(ep)?2:0)||b.id.startsWith('contact'),'attachment-limit',{board:b.id,endpoint:ep,wires:k,limit:maxAttach});
 // Bars: only horizontal, only on free rows, never within one row of a bar of another net.
 const bars=b.parts.filter((p:any)=>p.virtual);
 for(const p of bars){
  const y=p.pins[0].hole[1];assert(p.pins.every((q:any)=>q.hole[1]===y),'bus-bar-not-straight',{board:b.id,ref:p.ref});
  const x0=p.pins[0].hole[0],x1=p.pins.at(-1).hole[0];
  for(const q of b.parts.filter((q:any)=>!q.virtual))for(const pin of q.pins)assert(!(pin.hole[1]===y&&pin.hole[0]>=x0&&pin.hole[0]<=x1),'bus-bar-over-foreign-pin',{board:b.id,bar:p.ref,part:q.ref,hole:pin.hole.join(',')});
  for(const o of bars)if(o!==p&&o.signals[1]!==p.signals[1]){const oy=o.pins[0].hole[1],ox0=o.pins[0].hole[0],ox1=o.pins.at(-1).hole[0];assert(!(Math.abs(oy-y)<2&&ox0<=x1+1&&ox1>=x0-1),'bus-bar-short',{board:b.id,bar:p.ref,other:o.ref});}
 }
 // Every wire crossing a bar is flagged, so the drawings and the CSV tell the builder where to put a sleeve.
 for(const w of b.wires)if(w.insulated&&w.sleeves)assert(w.sleeves.every((id:string)=>b.wires.find(x=>x.id===id&&!x.insulated)),'sleeve-target-missing',{board:b.id,wire:w.id});
}
for(const b of boards.filter(b=>['power','router-matrix'].includes(b.id))){
 const tps=(b as any).testPoints??[];
 assert(tps.filter((p:any)=>p.net==='GND').length>=2,'testpoint-missing',{board:b.id,need:'two GND test pads'});
 if(b.id==='router-matrix')assert(b.parts.some((p:any)=>p.probe&&p.pins.length===8),'testpoint-missing',{board:b.id,need:'J_PROBE'});
 for(const rail of ['5V_SYS','12V_SYS'])if(b.nets.some(n=>n.name===rail))assert(tps.some((p:any)=>p.net===rail),'testpoint-missing',{board:b.id,need:rail});
 for(const p of tps)assert(!/DIV|BUF|ADC|SENSE|REF|GATE|SHUNT|WATCH_(CX|RX)/.test(p.net),'testpoint-on-sensitive-net',{board:b.id,ref:p.ref});
}
for(const b of boards)for(const p of b.parts.filter((p:any)=>p.link)){
 assert(Boolean(p.link.failSafe),'link-without-failsafe',{board:b.id,ref:p.ref});
 assert(!/DIV|BUF|ADC|SENSE|REF|GATE_DRIVE|SHUNT|WATCH_(CX|RX)/.test(p.link.net),'link-on-sensitive-net',{board:b.id,ref:p.ref,net:p.link.net});
 const far=b.nets.find(n=>n.name===p.link.farNet),near=b.nets.find(n=>n.name===p.link.net);
 assert(Boolean(far&&near),'link-net-missing',{board:b.id,ref:p.ref});
 // The loaded side of an open link must be held OFF by a resistor to ground on this board, unless the pull-down is on the other board.
 if(p.link.pulldown&&p.link.pulldown!=='external'){
  const side=p.link.loadSide==='far'?far:near,res=b.parts.find((q:any)=>q.ref===p.link.pulldown);
  const ok=Boolean(res&&res.kind==='resistor'&&res.pins.some((q:any)=>side?.pins.includes(`${res.ref}.${q.number}`))&&res.pins.some((q:any)=>b.nets.find(n=>n.name==='GND')?.pins.includes(`${res.ref}.${q.number}`)));
  assert(ok,'link-pulldown-missing',{board:b.id,ref:p.ref,pulldown:p.link.pulldown});
 }
}
for(const h of cables){
 const endpointNet=(id:string,ep:string)=>allBoards.find(b=>b.id===id)?.nets.find(n=>n.pins.includes(ep))?.name;
 assert(endpointNet(h.from,h.fromPin)===h.net&&endpointNet(h.to,h.toPin)===h.net,'harness-net-mismatch',{harness:h.id});
 const a=allBoards.find(b=>b.id===h.from)!,b=allBoards.find(b=>b.id===h.to)!;
 assert(h.phase>=pinAt(a,h.fromPin).part.phase&&h.phase>=pinAt(b,h.toPin).part.phase,'premature-harness',{harness:h.id});
}
const labelHeight=(p:any)=>p.body==='pogo'?Math.max(1,p.pins.length*.3+.3):['resistor','capacitor','diode','led'].includes(p.kind)||p.ref.startsWith('Q_')||p.ref.startsWith('F_')?1:Math.max(.6,Math.ceil(p.pins.length/2)*.2+.2);
const shortSchematicRef=(p:any)=>{
 const overrides:Record<string,string>={
  J_POWER_INPUT_INPUT:'J_INPUT',F_POWER_INPUT_INPUT:'FUSE',J_POWER_INPUT_SW_MAIN:'MAIN SWITCH',
  D_POWER_INPUT_REVERSE:'REV',C_POWER_INPUT_INPUT:'BULK',C_POWER_INPUT_INPUT_HF:'HF',C_POWER_GUARDS_OV_5V_OUT:'5V OUT',
  J_POWER_INPUT_BUCK_5V:'5V BUCK',J_POWER_INPUT_BUCK_3V3:'3V3 BUCK',
 };
 if(overrides[p.ref])return overrides[p.ref];
 const tokens=p.ref.split('_');
 const prefix=tokens.shift()??'';
 while(['POWER','ROUTER','MATRIX','R7'].includes(tokens[0]))tokens.shift();
 if(['INPUT','GUARDS','ANALOG','INTERLOCK'].includes(tokens[0]))tokens.shift();
 return [prefix,...tokens].filter(Boolean).join('_');
};
const compact=(parts:any[])=>{let y=.5;return [...parts].sort((a,b)=>labelHeight(b)-labelHeight(a)).map((p,i,list)=>{
 if(i%2===0&&i)y+=Math.max(labelHeight(list[i-2]),labelHeight(list[i-1]))+1.2;
 return {...p,schematicLabel:shortSchematicRef(p),sch:[(i%2)*8.5,-y-labelHeight(p)/2]};
});};
const fullSchematicLayout=(b:any,parts:any[])=>{
 const order=['power-input: Input','power-input: Circuit','power-guards: VoltageGuard','power-analog: Student','power-analog: Reference','power-interlock: Outputs','power-interlock: Latch','power-interlock: Indicator','Test aids'];
 const rank=(p:any)=>{const i=order.indexOf(p.function??p.section);return i<0?order.length:i;};
 const isInline=(p:any)=>['resistor','capacitor','led'].includes(p.kind)&&p.pins.length===2;
 const gridParts=parts.filter(p=>!isInline(p)),inlineParts=parts.filter(isInline);
 const byRef=new Map(gridParts.map((p:any)=>[p.ref,p]));
 const netByPin=new Map<string,any>(),membersByNet=new Map<string,string[]>();
 for(const net of b.nets)for(const ep of net.pins){netByPin.set(ep,net);const members=membersByNet.get(net.name)??[];members.push(ep);membersByNet.set(net.name,members);}
 const adjacency=new Map<string,Map<string,number>>(gridParts.map((p:any)=>[p.ref,new Map()]));
 for(const net of b.nets){
  const refs=[...new Set(net.pins.map((ep:string)=>ep.split('.')[0]).filter((ref:string)=>byRef.has(ref)))];
  if(refs.length<2)continue;
  const common=net.name==='GND'||/^(?:12V|5V|3V3|SAFE_|BUCK_|USB_|PI_3V3)/.test(net.name);
  const weight=(common?0.08:1)/Math.sqrt(refs.length-1);
  for(let i=0;i<refs.length;i++)for(let k=i+1;k<refs.length;k++){
   adjacency.get(refs[i])!.set(refs[k],(adjacency.get(refs[i])!.get(refs[k])??0)+weight);
   adjacency.get(refs[k])!.set(refs[i],(adjacency.get(refs[k])!.get(refs[i])??0)+weight);
  }
 }
 const fixedInput=['J_POWER_INPUT_INPUT','F_POWER_INPUT_INPUT','J_POWER_INPUT_SW_MAIN','D_POWER_INPUT_REVERSE'];
 const ordered=fixedInput.map(ref=>byRef.get(ref)).filter(Boolean) as any[];
 const added=new Set(ordered.map(p=>p.ref)),remaining=gridParts.filter(p=>!added.has(p.ref));
 while(remaining.length){
  let bestIndex=0,bestScore=-Infinity;
  for(let i=0;i<remaining.length;i++){
   const candidate=remaining[i],neighbors=adjacency.get(candidate.ref)!;
   let score=0;
   for(let k=Math.max(0,ordered.length-16);k<ordered.length;k++){
    const proximity=1/(1+(ordered.length-1-k)*.18);
    score+=(neighbors.get(ordered[k].ref)??0)*proximity;
   }
   score+=.001*(order.length-rank(candidate));
   if(score>bestScore||(score===bestScore&&candidate.ref<remaining[bestIndex].ref)){bestIndex=i;bestScore=score;}
  }
  const [next]=remaining.splice(bestIndex,1);ordered.push(next);added.add(next.ref);
 }
 const columns=5,gapX=12,gapY=12;let y=10.5;
 for(let start=0;start<ordered.length;start+=columns){
  const row=ordered.slice(start,start+columns),height=Math.max(...row.map(labelHeight));
  row.forEach((p,i)=>{p.schematicLabel=shortSchematicRef(p);p.sch=[24+i*gapX,-y-height/2];});
  y+=height+gapY;
 }
 const inputLayout:Record<string,[number,number]>={J_POWER_INPUT_INPUT:[0,-2.5],F_POWER_INPUT_INPUT:[1.91,-2.54],J_POWER_INPUT_SW_MAIN:[4.92,-2.5],D_POWER_INPUT_REVERSE:[7.385,-2.5],J_POWER_INPUT_BUCK_5V:[15,1.5],J_POWER_INPUT_BUCK_3V3:[15,-6.5]};
 for(const p of ordered)if(['power-input: Input','power-input: Circuit'].includes(p.function)&&inputLayout[p.ref]){
  p.sch=inputLayout[p.ref];p.schematicLabel=shortSchematicRef(p);
  if(p.ref==='J_POWER_INPUT_INPUT')p.schPinArrangement={leftSide:{direction:'top-to-bottom',pins:[2]},rightSide:{direction:'top-to-bottom',pins:[1]}};
 }
 const indexByHost=new Map<string,number>();
 const peers=(p:any,pin:any)=>{
  const net=netByPin.get(`${p.ref}.${pin.number}`);
  return (membersByNet.get(net?.name)??[]).map(ep=>byRef.get(ep.split('.')[0])).filter(Boolean);
 };
 const pickPeer=(p:any,pin:any)=>{
  const candidates=peers(p,pin).filter((q:any)=>q.ref!==p.ref);
  const affinity=(q:any)=>{const tokens=(s:string)=>new Set(s.toUpperCase().split('_').filter(t=>t.length>1&&!['POWER','ROUTER','MATRIX','INTERLOCK','ANALOG','GUARDS','TOP','BOTTOM','MID','OFF','ON','R','C','U','Q','LED','JP'].includes(t)));const a=tokens(p.ref),b=tokens(q.ref);let shared=0;for(const t of a)if(b.has(t))shared++;return shared/Math.max(1,new Set([...a,...b]).size);};
  candidates.sort((a:any,b:any)=>Number(b.function===p.function)-Number(a.function===p.function)||affinity(b)-affinity(a)||rank(a)-rank(b)||a.ref.localeCompare(b.ref));
  return candidates[0];
 };
 const placeBeside=(p:any,host:any)=>{
  if(!host){p.sch=[0,-y-2];return;}
  const slot=indexByHost.get(host.ref)??0;indexByHost.set(host.ref,slot+1);
  const dx=host.sch[0]>=(columns-1)*gapX-1?-3.8:3.8;
  const xOffsets=[0,1.4,-1.4,2.8,-2.8],yOffset=4.8+Math.floor(slot/xOffsets.length)*2.4;
  p.sch=[host.sch[0]+(dx<0?-1:1)*Math.abs(dx)+xOffsets[slot%xOffsets.length],host.sch[1]+yOffset];
 };
 const orderedInline=[...inlineParts].sort((a,b)=>({resistor:0,capacitor:1,led:2}[a.kind]-{resistor:0,capacitor:1,led:2}[b.kind]));
 const occupied=ordered.map((p:any)=>({x:p.sch[0],y:p.sch[1],w:['ic','connector'].includes(p.kind)?7:5.5,h:Math.max(4,labelHeight(p))}));
 for(const p of orderedInline){
  p.schematicLabel=shortSchematicRef(p);
  if(['C_POWER_INPUT_INPUT','C_POWER_INPUT_INPUT_HF','C_POWER_GUARDS_OV_5V_OUT'].includes(p.ref))p.schRotation=90;
  const n1=netByPin.get(`${p.ref}.${p.pins[0].number}`),n2=netByPin.get(`${p.ref}.${p.pins[1].number}`);
  if(p.kind==='led'){
   const series=inlineParts.find((q:any)=>q.kind==='resistor'&&q.pins.some((pin:any)=>netByPin.get(`${q.ref}.${pin.number}`)?.name===n1?.name));
   if(series?.sch)p.sch=[series.sch[0]+2.8,series.sch[1]];
   else placeBeside(p,pickPeer(p,p.pins[0])??pickPeer(p,p.pins[1]));
  }else{
   const p1=pickPeer(p,p.pins[0]),p2=pickPeer(p,p.pins[1]);
   const globalNet=(n:any)=>!n||n.name==='GND'||/^(?:12V|5V|3V3|SAFE_|BUCK_|USB_|PI_3V3)/.test(n.name);
   const capacitorOwner=p.kind==='capacitor'&&b.schematicCapacitorOwners?.[p.ref];
   if(capacitorOwner&&byRef.has(capacitorOwner))placeBeside(p,byRef.get(capacitorOwner));
   else if(p.kind==='resistor'&&p1&&p2&&p1.ref!==p2.ref&&!globalNet(n1)&&!globalNet(n2)){
    p.sch=[(p1.sch[0]+p2.sch[0])/2,(p1.sch[1]+p2.sch[1])/2];
   }else{
    const host=(!globalNet(n1)&&p1)||(!globalNet(n2)&&p2)||p1||p2;
    placeBeside(p,host);
   }
  }
  // Keep the three input/output decouplers from the overview together as one
  // short row beside the power path. The GND-side pin is rotated upward below.
  const capRow:Record<string,[number,number]>={
   C_POWER_INPUT_INPUT:[8.9,-2.2],
   C_POWER_INPUT_INPUT_HF:[10,-2.2],
  };
  if(p.kind==='capacitor'&&capRow[p.ref])p.sch=capRow[p.ref];
  const target=p.sch;
  const clear=(x:number,yy:number)=>occupied.every((o:any)=>Math.abs(x-o.x)>=(o.w+5.5)/2+0.8||Math.abs(yy-o.y)>=(o.h+4)/2+0.65);
  if(!clear(target[0],target[1])){
   let found:number[]|undefined;
   // Keep inline parts beside their electrical host. A long collision-search
   // spiral makes grounded passives visually look disconnected, so resolve
   // only nearby conflicts and preserve the host-relative placement otherwise.
   for(let ring=1;ring<=1&&!found;ring++){
    const candidates:number[][]=[];
    for(let dx=-ring;dx<=ring;dx++)for(let dy=-ring;dy<=ring;dy++)if(Math.max(Math.abs(dx),Math.abs(dy))===ring)candidates.push([target[0]+dx*3,target[1]+dy*2.5]);
    candidates.sort((a,b)=>Math.abs(a[0]-target[0])+Math.abs(a[1]-target[1])-Math.abs(b[0]-target[0])-Math.abs(b[1]-target[1]));
    found=candidates.find(([x,yy])=>clear(x,yy));
   }
   if(found)p.sch=found;
  }
  occupied.push({x:p.sch[0],y:p.sch[1],w:5.5,h:4});
 }
 // Keep the two input capacitors side by side on the post-diode 12 V rail.
 // Their positive pins align with the input path, with GND above the symbols.
 for(const p of orderedInline){
  const capRow:Record<string,[number,number]>={
   C_POWER_INPUT_INPUT:[8.9,-2.2],
   C_POWER_INPUT_INPUT_HF:[10,-2.2],
  };
  if(capRow[p.ref])p.sch=capRow[p.ref];
  if(p.ref==='C_POWER_GUARDS_OV_5V_OUT'){
   const host=byRef.get('Q_POWER_GUARDS_OV_5V_OUT');
   if(host)p.sch=[host.sch[0],host.sch[1]+4.8];
  }
 }
 // Keep each complete voltage guard immediately to the right of its buck
 // interface, with matching horizontal rows for the 5 V and 3.3 V circuits.
 const protectionPositions:Record<string,[number,number]>={
  C_POWER_GUARDS_OV_5V_IN:[22,1.5],Q_POWER_GUARDS_OV_5V_IN:[27.5,1.5],Q_POWER_GUARDS_OV_5V_OUT:[33,1.5],
  U_POWER_GUARDS_OV_5V:[38.5,1.5],R_POWER_GUARDS_LADDER_5V_TOP:[44,1.5],R_POWER_GUARDS_LADDER_5V_MID:[49.5,1.5],
  R_POWER_GUARDS_LADDER_5V_BOTTOM:[55,1.5],C_POWER_GUARDS_OV_5V_OUT:[60.5,1.5],
  C_POWER_GUARDS_OV_3V3_IN:[22,-6.5],Q_POWER_GUARDS_OV_3V3_IN:[27.5,-6.5],Q_POWER_GUARDS_OV_3V3_OUT:[33,-6.5],
  U_POWER_GUARDS_OV_3V3:[38.5,-6.5],R_POWER_GUARDS_LADDER_3V3_TOP:[44,-6.5],R_POWER_GUARDS_LADDER_3V3_MID:[49.5,-6.5],
  R_POWER_GUARDS_LADDER_3V3_BOTTOM:[55,-6.5],C_POWER_GUARDS_OV_3V3_OUT:[60.5,-6.5],
 };
 for(const p of [...ordered,...orderedInline])if(protectionPositions[p.ref])p.sch=protectionPositions[p.ref];
 // Put every direct 5V_SYS / 3V3_SYS consumer on a clean horizontal row to
 // the right of its guard output. Keep the guard circuitry itself together
 // at the left; this makes the protected rail and its loads easy to follow.
 if(b.id==='power'||b.id==='router-matrix'){
  const outputRefs=new Set([
   'U_POWER_GUARDS_OV_5V','Q_POWER_GUARDS_OV_5V_OUT','C_POWER_GUARDS_OV_5V_OUT',
   'U_POWER_GUARDS_OV_3V3','Q_POWER_GUARDS_OV_3V3_OUT','C_POWER_GUARDS_OV_3V3_OUT',
  ]);
  const rowStart=b.id==='power'?69:67;
  const multiRailFeedRefs=b.id==='router-matrix'?new Set(['J_ROUTER_POWER_CONTROL','J_PROBE']):new Set<string>();
  for(const [netName,rowY] of [['5V_SYS',1.5],['3V3_SYS',-6.5]] as const){
   const rail=b.nets.find((n:any)=>n.name===netName);
   const refs=[...new Set((rail?.pins??[]).map((ep:string)=>ep.split('.')[0]))]
    .filter((ref:string)=>byRef.has(ref)&&!outputRefs.has(ref)&&!multiRailFeedRefs.has(ref))
    .sort((a:string,c:string)=>a.localeCompare(c));
   refs.forEach((ref:string,index:number)=>{
    const p=byRef.get(ref)??orderedInline.find((part:any)=>part.ref===ref);
    if(p){p.sch=[rowStart+index*7.5,rowY];p.schematicLabel=shortSchematicRef(p);}
   });
  }
  if(b.id==='router-matrix'){
   // The incoming harness and multi-rail probe serve both protected rails;
   // keep them centered between the two consumer rows.
   for(const ref of multiRailFeedRefs){const p=byRef.get(ref);if(p)p.sch=[60,-2.5];}
  }
 }
 ordered.push(...orderedInline);
 return ordered;
};
const selector=(b:any,ep:string)=>{const {part:p,pin}=pinAt(b,ep);return `.${p.ref} > .${p.ref.startsWith('Q_')?({S:'source',G:'gate',D:'drain'} as any)[pin.label]:`pin${pin.number}`}`;};
function strip(svg:string,parts:any[]){
 const mpns=parts.map(p=>p.mpn).filter(Boolean).map((mpn:string)=>xml(mpn));
 for(const mpn of mpns)svg=svg.replace(new RegExp(`<text[^>]*>\\s*${mpn.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*</text>`,'g'),'');
 for(const mpn of mpns)assert(!svg.includes(`>${mpn}<`),'part-mpn-visible',{mpn});return svg;
}
function repairSymbolPorts(j:any[]){
 for(const component of j.filter(e=>e.type==='schematic_component'&&['led_right','diode_right'].includes(e.symbol_name))){
  if(j.some(e=>e.type==='schematic_port'&&e.schematic_component_id===component.schematic_component_id))continue;
  const ports=j.filter(e=>e.type==='source_port'&&e.source_component_id===component.source_component_id).sort((a,b)=>Number(a.name.replace('pin',''))-Number(b.name.replace('pin','')));
  const symbol:any=symbols[component.symbol_name as keyof typeof symbols];
  const anchors=[...symbol.ports].sort((a:any,b:any)=>a.x-b.x);
  ports.forEach((port,i)=>j.push({type:'schematic_port',schematic_port_id:`r8_${component.schematic_component_id}_${i}`,schematic_component_id:component.schematic_component_id,center:{x:component.center.x+anchors[i].x-symbol.center.x,y:component.center.y+anchors[i].y-symbol.center.y},source_port_id:port.source_port_id,facing_direction:i?'right':'left',distance_from_component_edge:.4,side_of_component:i?'right':'left',pin_number:i+1,true_ccw_index:i,display_pin_label:String(i+1),is_connected:j.some(e=>e.type==='source_trace'&&e.connected_source_port_ids?.includes(port.source_port_id)),schematic_sheet_id:component.schematic_sheet_id}));
 }
 // The renderer omits schematic traces that touch diode symbols because it
 // emits their schematic ports only after routing. Restore those visible edges
 // using the already-connected source-trace endpoints and repaired port centers.
 const routed=new Set(j.filter(e=>e.type==='schematic_trace').map(e=>e.source_trace_id));
 let nextId=j.filter(e=>e.type==='schematic_trace').length;
 for(const trace of j.filter(e=>e.type==='source_trace'&&!routed.has(e.source_trace_id))){
  const endpoints=trace.connected_source_port_ids.map((id:string)=>j.find(e=>e.type==='schematic_port'&&e.source_port_id===id)).filter(Boolean);
  if(!endpoints.some((port:any)=>j.find(e=>e.type==='schematic_component'&&e.schematic_component_id===port.schematic_component_id)?.symbol_name==='diode_right'))continue;
  let a:any,b:any;
  if(endpoints.length===2)[a,b]=endpoints.map((port:any)=>port.center);
  else if(endpoints.length===1&&trace.connected_source_net_ids?.length){
   a=endpoints[0].center;
   const label=j.filter(e=>e.type==='schematic_net_label'&&trace.connected_source_net_ids.includes(e.source_net_id)).sort((left,right)=>{
    const distance=(item:any)=>Math.abs(item.anchor_position.x-a.x)+Math.abs(item.anchor_position.y-a.y);
    return distance(left)-distance(right);
   })[0];
   if(!label)continue;
   b=label.anchor_position;
  }else continue;
  const start={route_type:'wire',x:a.x,y:a.y,width:.1,layer:'top'};
  const end={route_type:'wire',x:b.x,y:b.y,width:.1,layer:'top'};
  const edges:any[]=[];
  if(a.x!==b.x&&a.y!==b.y){const corner={route_type:'wire',x:b.x,y:a.y,width:.1,layer:'top'};edges.push({from:start,to:corner},{from:corner,to:end});}
  else edges.push({from:start,to:end});
  j.push({type:'schematic_trace',schematic_trace_id:`r8_schematic_trace_${nextId++}`,source_trace_id:trace.source_trace_id,edges,junctions:[],subcircuit_connectivity_map_key:trace.subcircuit_connectivity_map_key,schematic_sheet_id:endpoints[0].schematic_sheet_id});
 }
}
const native:any[]=[];const drawings:any[]=[];
async function render(b:any,parts:any[],key:string,publish=true){
 let positioned=compact(parts);const refs=new Set(parts.map(p=>p.ref));
 if(key==='Complete schematic'){
  positioned=fullSchematicLayout(b,parts);
 }else for(const p of positioned)p.schRotation=undefined;
 if(publish&&key==='Limits'&&parts.some(p=>p.origin==='U_LIMIT')){
  const layout:any={U_LIMIT:[0,0],R_SOURCE_SENSE:[-4.5,2.8],R_SINK_SENSE:[4.5,-2.8],
   R_HI_GATE:[-3,.4],R_LO_GATE:[3,-.8],C_HI_COMP:[-3,1.8],C_LO_COMP:[3,1.8],
   Q_HIGH:[-5,.4],Q_LOW:[5,-.8],C_LIMIT:[0,3.7]};
  for(const p of positioned){if(layout[p.origin])p.sch=layout[p.origin];}
 }
 const nets=b.nets.map(n=>({...n,local:n.pins.filter(ep=>refs.has(ep.split('.')[0])),external:n.pins.filter(ep=>!refs.has(ep.split('.')[0]))})).filter(n=>n.local.length);
 const power=(name:string)=>name==='GND'||/^(USB_|SAFE_|BUCK_|[35]V|12V|PI_3V3)/.test(name);
 const netName=(name:string)=>/^\d/.test(name)?`V_${name}`:name;
 const circuit=new Circuit();
 const children=[...positioned.map(p=><Component board={b} p={p}/>),...nets.map(n=><net name={netName(n.name)} isGroundNet={n.name==='GND'} isPowerNet={power(n.name)&&n.name!=='GND'}/>),
 ...nets.flatMap(n=>{
  const lines:any[]=[];
  if(key==='Complete schematic'){
   if(n.name==='GND')return n.local.map(ep=><trace name={n.name} from={selector(b,ep)} to={`net.${netName(n.name)}`}/>);
   const connected=[n.local[0]],remaining=n.local.slice(1);
   while(remaining.length){
    let best={from:connected[0],index:0,distance:Infinity};
    for(const from of connected)for(let index=0;index<remaining.length;index++){
     const a=positioned.find(p=>p.ref===from.split('.')[0])!.sch,c=positioned.find(p=>p.ref===remaining[index].split('.')[0])!.sch;
     const distance=Math.abs(a[0]-c[0])+Math.abs(a[1]-c[1]);
     if(distance<best.distance)best={from,index,distance};
    }
    const to=remaining.splice(best.index,1)[0];connected.push(to);
    lines.push(<trace name={n.name} schStroke={colorFor8(n.name)} from={selector(b,best.from)} to={selector(b,to)}/>);
   }
   const offBoard=cables.some(c=>c.net===n.name&&(c.from===b.id||c.to===b.id));
   if(n.external.length||offBoard)
    lines.push(<trace name={n.name} from={selector(b,n.local[0])} to={`net.${netName(n.name)}`}/>);
   return lines;
  }
  const labelPower=power(n.name);
  if(labelPower||!publish)return n.local.map(ep=><trace name={n.name} from={selector(b,ep)} to={`net.${netName(n.name)}`}/>);
  // Continuous lines inside the functional block; one named boundary per net.
  for(let k=1;k<n.local.length;k++)lines.push(<trace name={n.name} from={selector(b,n.local[k-1])} to={selector(b,n.local[k])}/>);
  if(b.kind==='temporary'||n.external.length||cables.some(c=>c.net===n.name&&(c.from===b.id||c.to===b.id))){
   const port=key==='Limits'&&/_SOURCE_OUT$/.test(n.name)?n.local.find(ep=>{const {part,pin}=pinAt(b,ep);return part.origin==='Q_HIGH'&&pin.label==='S';})??n.local[0]:n.local[0];
   lines.push(<trace name={n.name} from={selector(b,port)} to={`net.${netName(n.name)}`}/>);}
  return lines;
 })];
 circuit.add(<board width={b.width} height={b.height} routingDisabled schRelative schTraceAutoLabelEnabled={false} schMaxTraceDistance={10000}><schematicsheet name="Circuit" displayName={`${b.title}: ${key}`}>{children.map((child,index)=>React.cloneElement(child,{key:index}))}</schematicsheet></board>);
 await circuit.renderUntilSettled();const j=circuit.getCircuitJson();repairSymbolPorts(j);
 const schematicWarnings=await runAllSchematicChecks(j);
 const intendedGroundUp=new Set(['C_POWER_INPUT_INPUT','C_POWER_INPUT_INPUT_HF','C_POWER_GUARDS_OV_5V_OUT']);
 const sourceName=new Map(j.filter((e:any)=>e.type==='source_component').map((e:any)=>[e.source_component_id,e.name]));
 const schematic=schematicWarnings.filter((warning:any)=>!(warning.styling_issue_type==='inverted_rails'&&intendedGroundUp.has(sourceName.get(warning.source_component_id))));
 const checks={source:j.filter((e:any)=>/^source_.*(error|warning)$/.test(e.type)),pins:await runAllPinSpecificationChecks(j),netlist:await runAllNetlistChecks(j),schematic,placement:await runAllPlacementChecks(j)};
 const status=Object.values(checks).some(a=>a.length)?'fail':'pass';native.push({board:b.id,section:key,status,checks});
 const name=`${b.id}-${key.replace(/[^a-zA-Z0-9]+/g,'-')}`;
 save(`circuits/${name}.circuit.json`,JSON.stringify(j,null,2)+'\n');
 const stale=`${out}/circuits/${name}.json`;if(existsSync(stale))unlinkSync(stale);
 if(!publish){console.log(`${b.id}/${key}: ${status}`);return;}
 let svg=strip(convertCircuitJsonToSchematicSvg(j.filter((e:any)=>e.type!=='schematic_sheet'),{width:key==='Complete schematic'?3600:1400,height:key==='Complete schematic'?2200:950}).replace(/V_([35]V[^<\s]*|12V[^<\s]*)/g,'$1'),parts);
 if(key==='Complete schematic'){
  const traces=new Map(j.filter(e=>e.type==='source_trace').map(e=>[e.source_trace_id,e.name]));
  const colors=new Map(j.filter(e=>e.type==='schematic_trace').map(e=>[e.schematic_trace_id,traces.get(e.source_trace_id)]));
  svg=svg.replace(/<g\b([^>]*data-schematic-trace-id="([^"]+)"[^>]*)>([\s\S]*?)<\/g>/g,(_,attributes,id,body)=>{
   const net=colors.get(id)??'Signal',color=colorFor8(net)==='#ffca28'?'#a87900':colorFor8(net);
   return `<g${attributes}><title>${xml(net)}</title>${body.replace(/stroke="[^"]*"/g,`stroke="${color}"`).replace(/stroke-width="([0-9.]+)px"/g,(_,width)=>`stroke-width="${Math.max(1.5,Number(width))}px"`).replace(/(<circle[^>]*?)fill="[^"]*"/g,`$1fill="${color}"`)}</g>`;
  });
 }
 save(`assets/${name}-schematic.svg`,svg);drawings.push({board:b.id,section:key,file:`assets/${name}-schematic.svg`,parts:parts.map(p=>p.ref),ports:nets.filter(n=>n.external.length).map(n=>({net:n.name,local:n.local,destinations:n.external}))});
 console.log(`${b.id}/${key}: ${status}`);
}
for(const b of boards){
 await render(b,b.parts.filter(p=>!p.virtual),'Complete board',false);
 if(b.id==='power')await render(b,b.parts.filter(p=>!p.virtual),'Complete schematic',true);
 const groups=new Map<string,any[]>();
 for(const p of b.parts){
  if(p.body==='terminal'||p.virtual)continue;
  let name=p.function??p.section;
  if(name==='Circuit'&&b.id.startsWith('measurement')){
   name=/_(MUX|SEL_|ADC_MODULE)/.test(p.ref)?'Buffered selector and ADC':/BUFFERS/.test(p.ref)?'Voltage buffers':/^R_P|^C_P|PRECISION/.test(p.ref)?'Voltage inputs':'Support';
  }
  const list=groups.get(name)??[];list.push(p);groups.set(name,list);
 }
 for(const [name,parts] of groups){
  // Small native sheets preserve readable pin text; boundary lists retain all
  // connections when a large functional block needs a second sheet.
  for(let k=0;k<parts.length;k+=12)await render(b,parts.slice(k,k+12),parts.length>12?`${name} ${k/12+1}`:name);
 }
}

function drawing(b:any,bottom=false,wires:any[]=[]){
 const scale=6,x0=40,y0=28,w=b.cols*scale+95,h=b.rows*scale+90;
 const pos=([x,y]:number[])=>[x0+(bottom?b.cols+1-x:x)*scale,y0+y*scale];
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="white"/><style>text{font-family:DejaVu Sans,sans-serif;font-size:8px;fill:#243746}.coordinate{font-size:5px}.wire{fill:none;stroke-width:1.2}.body{fill:#e9eef3;stroke:#8796a5;stroke-width:.7}</style><text x="12" y="10" style="font-size:9px;font-weight:bold">${xml(b.id)} — ${bottom?'MIRRORED UNDERSIDE':'TOP'}</text><rect x="${x0}" y="${y0}" width="${(b.cols+1)*scale}" height="${(b.rows+1)*scale}" rx="3" fill="#e2f1e5" stroke="#5c896a"/>`;
 for(let y=1;y<=b.rows;y++)for(let x=1;x<=b.cols;x++){const [px,py]=pos([x,y]);s+=`<circle cx="${px}" cy="${py}" r="1.05" fill="#b8c2ac"/>`;}
 for(let x=1;x<=b.cols;x++){const [px]=pos([x,1]);s+=`<text class="coordinate" x="${px}" y="${x%2?y0-9:y0-2}" text-anchor="middle">${x}</text>`;}
 for(let y=1;y<=b.rows;y++){const [,py]=pos([1,y]);s+=`<text class="coordinate" x="${x0-5}" y="${py+2}" text-anchor="end">${y}</text>`;}
 for(const mount of b.mounts){const [x,y]=pos(mount);s+=`<circle cx="${x}" cy="${y}" r="4" fill="white" stroke="#697b65"/>`;}

 for(const p of b.parts){
  if(p.body==='terminal'||p.virtual)continue;
  const points=p.pins.map(pin=>pos(pin.hole)),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const fill=p.kind==='led'?'#ed5b35':p.kind==='chip'?'#74a9d8':p.kind==='header'?'#55b8a8':p.kind==='resistor'?'#f2c477':p.kind==='capacitor'?'#b9a8e8':'#e9eef3';
  if(p.body!=='pogo')s+=`<rect class="body" style="fill:${fill}" x="${Math.min(...xs)-3}" y="${Math.min(...ys)-3}" width="${Math.max(...xs)-Math.min(...xs)+6}" height="${Math.max(...ys)-Math.min(...ys)+6}" rx="2"/>`;
 }
 const segments:any[]=[];
 for(const wire of wires){
  const points=wire.path.map(pos).map(p=>p.join(',')).join(' ');
  const title=xml(`${wire.net}: ${wire.from} → ${wire.to}`);
  if(wire.color==='#ffffff')s+=`<polyline points="${points}" fill="none" stroke="#53636c" stroke-width="2"/>`;
  s+=`<polyline class="wire" data-net="${xml(wire.net)}" points="${points}" stroke="${wire.color}" style="stroke-width:${wire.insulated?1.2:2.6}"><title>${title}</title></polyline>`;
  const bridges=new Set<string>();
  for(let i=1;i<wire.path.length;i++){
   const a=wire.path[i-1],c=wire.path[i];
   for(const prev of segments){if(prev.net===wire.net)continue;
    const cross=(p:any,q:any,r:any)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
    if(cross(a,c,prev.a)*cross(a,c,prev.c)>=0||cross(prev.a,prev.c,a)*cross(prev.a,prev.c,c)>=0)continue;
    const xy=a[1]===c[1]?[prev.a[0],a[1]]:[a[0],prev.a[1]],key=xy.join(',');if(bridges.has(key))continue;bridges.add(key);
    const [x,y]=pos(xy),r=1.2;
    const d=a[1]===c[1]?`M${x-r},${y}C${x-r},${y-r*1.6} ${x+r},${y-r*1.6} ${x+r},${y}`:`M${x},${y-r}C${x+r*1.6},${y-r} ${x+r*1.6},${y+r} ${x},${y+r}`;
    s+=`<path d="${d}" fill="none" stroke="white" stroke-width="2.5"/><path data-net="${xml(wire.net)}" d="${d}" fill="none" stroke="${wire.color}" stroke-width="1.2"><title>Insulated crossing; no junction</title></path>`;
   }
   segments.push({a,c,net:wire.net});
  }
 }

 const active=new Set(wires.length<=10?wires.flatMap(w=>[w.from,w.to]):[]);
 for(const p of b.parts)for(const pin of p.pins){const [x,y]=pos(pin.hole);s+=`<circle cx="${x}" cy="${y}" r="${active.has(`${p.ref}.${pin.number}`)?2.8:2}" fill="${active.has(`${p.ref}.${pin.number}`)?'#f4a340':pin.number===1?'#bf3943':'#33495b'}"/>`;}
 // Reference badges sit above wires, with evenly spaced legend rows. No text is
 // written on tiny bodies or on every wire crossing.
 const badges:any[]=[];let badgeLeaders="",badgeText="";
 b.parts.forEach((p,i)=>{
  if(p.virtual||p.testpoint)return;
  const [x,y]=pos(p.pins[0].hole),n=i+1,bw=n>9?12:8;
  const candidates=p.body==='terminal'?[[x>x0+(b.cols+1)/2*scale?x+5:x0-30,y-5]]:
    [[x+2,y-8],[x+2,y+2],[x-bw-2,y-8],[x-bw-2,y+2],[x+8,y-12],[x-bw-8,y+6]];
  const overlap=(r:any)=>badges.some(o=>r.x<o.x+o.w+1&&r.x+r.w+1>o.x&&r.y<o.y+o.h+1&&r.y+r.h+1>o.y);
  let r=candidates.map(([bx,by])=>({x:bx,y:by,w:bw,h:8})).find(r=>r.x>=8&&r.x+r.w<w-8&&r.y>=y0+3&&r.y+r.h<h-45&&!overlap(r));
  if(!r){
   for(let by=y0+3;by<h-45&&!r;by+=10){const t={x:w-25,y:by,w:bw,h:8};if(!overlap(t))r=t;}
  }
  assert(Boolean(r),'badge-layout-full',{board:b.id,ref:p.ref});if(!r)return;
  badges.push(r);
  if(Math.hypot(r.x-x,r.y-y)>20)badgeLeaders+=`<path d="M${x},${y}L${r.x},${r.y+4}" stroke="#a1acb2" stroke-width=".5"/>`;
  badgeText+=`<rect x="${r.x}" y="${r.y}" width="${bw}" height="8" fill="white"/><text x="${r.x+1}" y="${r.y+7}" style="font-size:7px;font-weight:bold">${n}</text>`;
 });
 for(const tp of (b.testPoints??[]).filter((t:any)=>!t.endpoint.startsWith('J_PROBE.'))){const [x,y]=pos(tp.hole);s+=`<circle cx="${x}" cy="${y}" r="4.4" fill="none" stroke="#c2185b" stroke-width="1"><title>${xml(tp.net)} test pad: ${xml(tp.endpoint)}</title></circle>`;}
 s+=badgeLeaders+badgeText;
 s+=`<text x="12" y="${h-40}">${b.width}×${b.height} mm · 2.54 mm pitch · isolated pads · pin 1 red</text><text x="12" y="${h-25}">TOP coordinates. Crossings are not joints. Match component guide numbers.</text><text x="12" y="${h-10}">PROTOTYPE: physical fit and hardware tests pending.</text></svg>`;
 return s;
}

for(const b of boards){
 save(`assets/${b.id}-top.svg`,drawing(b));save(`assets/${b.id}-underside.svg`,drawing(b,true,b.wires));
 for(const n of b.nets){const ws=b.wires.filter(w=>w.net===n.name);if(ws.length)save(`assets/${b.id}-net-${n.name.replace(/[^a-zA-Z0-9]+/g,'-')}.svg`,drawing(b,true,ws));}
 save(`${b.id}-pins.csv`,csv([['ref','pin','function','column','row','phase','net'],...b.parts.flatMap(p=>p.pins.map(pin=>[p.ref,pin.number,pin.label,...pin.hole,p.phase,p.signals?.[pin.number]??'NC']))]));
 save(`${b.id}-wires.csv`,csv([['wire','net','from','to','phase','path','physical run','insulated','sleeves'],...b.wires.map(w=>[w.id,w.net,w.from,w.to,w.phase,JSON.stringify(w.path),w.bar?w.from.split('.')[0]:w.uid,w.insulated,(w.sleeves??[]).join(' ')])]));
}
const wireGroups:any[]=[];
for(const cp of checkpoints)for(const b of boards){const added=b.wires.filter(w=>w.phase===cp.phase);for(let k=0;k<added.length;k+=10){const file=`assets/${cp.id}-${b.id}-wires-${k/10+1}.svg`;save(file,drawing(b,true,added.slice(k,k+10)));wireGroups.push({checkpoint:cp.id,board:b.id,file,wires:added.slice(k,k+10).map(w=>w.id)});}}
save('design.json',JSON.stringify({revision,sourceDigest,stock,release,boards:allBoards,cables,checkpoints,drawings,wireGroups},null,2)+'\n');
save('checks.json',JSON.stringify({revision,sourceDigest,softwareStatus:issues.length||native.some(r=>r.status==='fail')?'fail':'pass',assemblyIssues:issues,native,hardwareStatus:'pending',scope:'Native source/pin/netlist/schematic/placement and descriptor checks; hand wires are annotations, no routed copper.'},null,2)+'\n');
console.log(JSON.stringify({status:issues.length||native.some(r=>r.status==='fail')?'fail':'pass',assemblyIssues:issues,nativeFailures:native.filter(r=>r.status==='fail')},null,2));
if(issues.length||native.some(r=>r.status==='fail'))process.exitCode=1;
