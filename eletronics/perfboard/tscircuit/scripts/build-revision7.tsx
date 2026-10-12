import React from 'react';
import {Circuit} from '@tscircuit/core';
import {convertCircuitJsonToSchematicSvg} from 'circuit-to-svg';
import {runAllPinSpecificationChecks,runAllNetlistChecks,runAllSchematicChecks,runAllPlacementChecks} from '@tscircuit/checks';
import {Component} from '../lib/board';
import {boards,cables,checkpoints,revision,stock,release,externalInterfaces,baseline,prototype} from '../design/revision7.mjs';
import {instances,byId} from '../design/boards.mjs';
import {pinAt} from '../design/model7.mjs';
import {designate} from '../design/testaids7.mjs';
import {MAX_ATTACH} from '../design/model7.mjs';
import {netDescription,partDescription} from '../design/descriptions.mjs';
import {mkdirSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';

await import('./use-canvas-renderer.mjs');
await import('./use-line-schematics.mjs');
const out='revision7';mkdirSync(`${out}/assets`,{recursive:true});mkdirSync(`${out}/circuits`,{recursive:true});
const xml=(s:any)=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const csv=(rows:any[])=>rows.map(r=>r.map((v:any)=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n')+'\n';
const save=(name:string,text:string)=>writeFileSync(`${out}/${name}`,text);
const sourceDigest=createHash('sha256').update(JSON.stringify({boards,cables,checkpoints,prototype})).digest('hex');
for(const b of boards)(b as any).testPoints=designate(b);
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
 assert(b.parts.some((p:any)=>p.probe&&p.pins.length===8),'testpoint-missing',{board:b.id,need:'J_PROBE'});
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
 assert(endpoints.get(`${h.from}/${h.fromPin}`)===h.net&&endpoints.get(`${h.to}/${h.toPin}`)===h.net,'harness-net-mismatch',{harness:h.id});
 const a=boards.find(b=>b.id===h.from)!,b=boards.find(b=>b.id===h.to)!;
 assert(h.phase>=pinAt(a,h.fromPin).part.phase&&h.phase>=pinAt(b,h.toPin).part.phase,'premature-harness',{harness:h.id});
}
const labelHeight=(p:any)=>p.body==='pogo'?Math.max(1,p.pins.length*.3+.3):['resistor','capacitor','diode','led'].includes(p.kind)||p.ref.startsWith('Q_')||p.ref.startsWith('F_')?1:Math.max(.6,Math.ceil(p.pins.length/2)*.2+.2);
const compact=(parts:any[])=>{let y=.5;return [...parts].sort((a,b)=>labelHeight(b)-labelHeight(a)).map((p,i,list)=>{
 if(i%2===0&&i)y+=Math.max(labelHeight(list[i-2]),labelHeight(list[i-1]))+1.2;
 return {...p,schematicLabel:p.ref,sch:[(i%2)*8.5,-y-labelHeight(p)/2]};
});};
const selector=(b:any,ep:string)=>{const {part:p,pin}=pinAt(b,ep);return `.${p.ref} > .${p.ref.startsWith('Q_')?({S:'source',G:'gate',D:'drain'} as any)[pin.label]:`pin${pin.number}`}`;};
function strip(svg:string,parts:any[]){
 const mpns=parts.filter(p=>p.kind==='header'||p.body==='pogo'||p.body==='idc').map(p=>xml(p.mpn));
 for(const mpn of mpns)svg=svg.replace(new RegExp(`<text[^>]*>\\s*${mpn.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*</text>`,'g'),'');
 for(const mpn of mpns)assert(!svg.includes(`>${mpn}<`),'connector-mpn-visible',{mpn});return svg;
}
const native:any[]=[];const drawings:any[]=[];
async function render(b:any,parts:any[],key:string,publish=true){
 const positioned=compact(parts),refs=new Set(parts.map(p=>p.ref));
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
  if(power(n.name)||!publish)return n.local.map(ep=><trace name={n.name} from={selector(b,ep)} to={`net.${netName(n.name)}`}/>);
  // Continuous lines inside the functional block; one named boundary per net.
  for(let k=1;k<n.local.length;k++)lines.push(<trace name={n.name} from={selector(b,n.local[k-1])} to={selector(b,n.local[k])}/>);
  if(b.kind==='temporary'||n.external.length||cables.some(c=>c.net===n.name&&(c.from===b.id||c.to===b.id))){
   const port=key==='Limits'&&/_SOURCE_OUT$/.test(n.name)?n.local.find(ep=>{const {part,pin}=pinAt(b,ep);return part.origin==='Q_HIGH'&&pin.label==='S';})??n.local[0]:n.local[0];
   lines.push(<trace name={n.name} from={selector(b,port)} to={`net.${netName(n.name)}`}/>);}
  return lines;
 })];
 circuit.add(<board width={b.width} height={b.height} routingDisabled schRelative schTraceAutoLabelEnabled={false} schMaxTraceDistance={10000}><schematicsheet name="Circuit" displayName={`${b.title}: ${key}`}><group name="Function" schRelative>{children}</group></schematicsheet></board>);
 await circuit.renderUntilSettled();const j=circuit.getCircuitJson();
 const checks={source:j.filter((e:any)=>/^source_.*(error|warning)$/.test(e.type)),pins:await runAllPinSpecificationChecks(j),netlist:await runAllNetlistChecks(j),schematic:await runAllSchematicChecks(j),placement:await runAllPlacementChecks(j)};
 const status=Object.values(checks).some(a=>a.length)?'fail':'pass';native.push({board:b.id,section:key,status,checks});
 const name=`${b.id}-${key.replace(/[^a-zA-Z0-9]+/g,'-')}`;
 save(`circuits/${name}.circuit.json`,JSON.stringify(j,null,2)+'\n');
 const stale=`${out}/circuits/${name}.json`;if(existsSync(stale))unlinkSync(stale);
 if(!publish){console.log(`${b.id}/${key}: ${status}`);return;}
 const svg=strip(convertCircuitJsonToSchematicSvg(j.filter((e:any)=>e.type!=='schematic_sheet'),{width:1400,height:950}).replace(/V_([35]V[^<\s]*|12V[^<\s]*)/g,'$1'),parts);
 save(`assets/${name}-schematic.svg`,svg);drawings.push({board:b.id,section:key,file:`assets/${name}-schematic.svg`,parts:parts.map(p=>p.ref),ports:nets.filter(n=>n.external.length).map(n=>({net:n.name,local:n.local,destinations:n.external}))});
 console.log(`${b.id}/${key}: ${status}`);
}
for(const b of boards){
 await render(b,b.parts.filter(p=>!p.virtual),'Complete board',false);
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

const diagnostic=baseline.find(b=>b.id==='measurement-a-precision')!;
const stimulusRefs=new Set(['D_STIM','R_STIM','K_STIM','R_LED','R_OFF','Q_STIM','J_DIAGNOSTIC','JP_RETURN']);
await render(diagnostic,diagnostic.parts.filter(p=>stimulusRefs.has(p.ref)),'External continuity stimulus');
save('prototype-stimulus-pins.csv',csv([['ref','pin','role','net'],...diagnostic.parts.filter(p=>stimulusRefs.has(p.ref)).flatMap(p=>p.pins.map(pin=>[p.ref,pin.number,pin.label,diagnostic.nets.find(n=>n.pins.includes(`${p.ref}.${pin.number}`))?.name??'']))]));
if(prototype.earlyPlacement){
 const b=prototype.earlyPlacement;await render(b,b.parts,'Complete board',false);
 for(let k=0;k<b.parts.length;k+=8)await render(b,b.parts.slice(k,k+8),`Early reference ${k/8+1}`);
}

// Temporary solderless source is excluded from permanent-board counts.
const fixture=structuredClone(byId['usb-prototype']);
await render(fixture,fixture.parts,'Temporary USB source');
function breadboardTop(){
 const pos=([x,y]:number[])=>[20+x*10,20+y*10];
 let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 355"><rect width="210" height="355" fill="white"/><style>text{font:7px DejaVu Sans;fill:#243746}</style><text x="10" y="12" style="font-size:6px">Temporary USB source — TOP only</text>';
 for(let y=1;y<=30;y++){
  for(const [a,z] of [[2,6],[9,13]]){const [x,py]=pos([a,y]);svg+=`<path d="M${x},${py}h${(z-a)*10}" stroke="#d5bd73" stroke-width="3"/>`;}
  svg+=`<text x="22" y="${22+y*10}">${y}</text>`;
  for(const x of [2,3,4,5,6,9,10,11,12,13]){const [px,py]=pos([x,y]);svg+=`<circle cx="${px}" cy="${py}" r="2" fill="#c3c9cc"/>`;}
 }
 for(const w of fixture.wires.filter(w=>!w.breadboardTie))svg+=`<polyline points="${w.path.map(pos).map(p=>p.join(',')).join(' ')}" fill="none" stroke="${w.color}" stroke-width="1.4"/>`;
 fixture.parts.forEach((p,i)=>{
  const pts=p.pins.map(pin=>pos(pin.hole));const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  if(p.kind!=='header')svg+=`<rect x="${Math.min(...xs)-3}" y="${Math.min(...ys)-3}" width="${Math.max(...xs)-Math.min(...xs)+6}" height="${Math.max(...ys)-Math.min(...ys)+6}" fill="#e9eef3" stroke="#697b88"/>`;
  pts.forEach(([x,y],k)=>svg+=`<circle cx="${x}" cy="${y}" r="2" fill="${k?'#33495b':'#bf3943'}"/>`);
  const [x,y]=pts[0];svg+=`<rect x="${x+3}" y="${y-9}" width="10" height="9" fill="white"/><text x="${x+4}" y="${y-2}">${i+1}</text>`;
 });
 for(const x of [2,3,4,5,6,9,10,11,12,13])svg+=`<text x="${20+x*10}" y="${x%2?23:17}" text-anchor="middle" style="font-size:5.5px">${x}</text>`;
 return svg+'<text x="10" y="337" style="font-size:4.5px">Gold: factory five-hole row ties. Check your fixture.</text><text x="10" y="349" style="font-size:4.5px">Coordinates follow this drawing; no underside soldering.</text></svg>';
}
save('assets/usb-prototype-top.svg',breadboardTop());
save('usb-prototype-pins.csv',csv([['ref','pin','function','column','row'],...fixture.parts.flatMap(p=>p.pins.map(pin=>[p.ref,pin.number,pin.label,...pin.hole]))]));
const fixtureData={file:'assets/usb-prototype-top.svg',schematic:drawings.find(d=>d.board===fixture.id)!.file,
 parts:fixture.parts.map((p,i)=>({number:i+1,ref:p.ref,label:p.label,pins:p.pins})),
 wires:fixture.wires.filter(w=>!w.breadboardTie).map(w=>({id:w.id,net:w.net,from:w.from,to:w.to,fromHole:pinAt(fixture,w.from).pin.hole,toHole:pinAt(fixture,w.to).pin.hole})),
 ties:fixture.wires.filter(w=>w.breadboardTie).map(w=>({net:w.net,from:w.from,to:w.to}))};

// Assembly SVGs draw manual wires only. No custom copper router is used.
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
  if(p.body!=='pogo')s+=`<rect class="body" x="${Math.min(...xs)-3}" y="${Math.min(...ys)-3}" width="${Math.max(...xs)-Math.min(...xs)+6}" height="${Math.max(...ys)-Math.min(...ys)+6}" rx="2"/>`;
 }
 for(const wire of wires){const points=wire.path.map(pos).map(p=>p.join(',')).join(' ');s+=`<polyline class="wire" points="${points}" stroke="${wire.color}" stroke-width="${wire.insulated?1.2:2.6}"${wire.sleeves?' stroke-dasharray="none"':''}/>`;}
 const active=new Set(wires.flatMap(w=>[w.from,w.to]));
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
 for(const tp of (b.testPoints??[]).filter((t:any)=>!t.endpoint.startsWith('J_PROBE.'))){const [x,y]=pos(tp.hole);s+=`<circle cx="${x}" cy="${y}" r="4.4" fill="none" stroke="#c2185b" stroke-width="1"/><text x="${x+5}" y="${y-4}" style="font-size:4.4px;font-weight:bold;fill:#c2185b">${xml(tp.net)}</text>`;}
 s+=badgeLeaders+badgeText;
 s+=`<text x="12" y="${h-40}">${b.width}×${b.height} mm · 2.54 mm pitch · isolated pads · pin 1 red</text><text x="12" y="${h-25}">TOP coordinates. Crossings are not joints. See numbered table.</text><text x="12" y="${h-10}">PROTOTYPE: physical fit and hardware tests pending.</text></svg>`;
 return s;
}
if(prototype.earlyPlacement){const b=prototype.earlyPlacement;save('assets/smart-early-top.svg',drawing(b));save('assets/smart-early-underside.svg',drawing(b,true));save('smart-early-pins.csv',csv([['ref','pin','role','col','row'],...b.parts.flatMap(p=>p.pins.map(pin=>[p.ref,pin.number,pin.label,...pin.hole]))]));save('smart-early-wires.csv',csv([['wire','net','from','to','path'],...b.wires.map(w=>[w.id,w.net,w.from,w.to,JSON.stringify(w.path)])]));}
for(const b of boards){
 save(`assets/${b.id}-top.svg`,drawing(b));save(`assets/${b.id}-underside.svg`,drawing(b,true));
 save(`${b.id}-pins.csv`,csv([['ref','description','pin','function','column','row','phase','adapter','carrier'],...b.parts.flatMap(p=>p.pins.map(pin=>[p.ref,p.label,pin.number,pin.label,...pin.hole,p.phase,p.adapter??'',p.externalPart??'']))]));
 save(`${b.id}-wires.csv`,csv([['wire','net','from','to','phase','description','path','kind','sleeve over bar wires'],...b.wires.map(w=>[w.id,w.net,w.from,w.to,w.phase,netDescription(w.net),JSON.stringify(w.path),w.bar?'bare bus bar segment':w.insulated?'insulated':'bare strap',(w.sleeves??[]).join(' ')])]));
}
save('testpoints.csv',csv([['board','ref','net','pad (part.pin)','column','row','install checkpoint','expected with bench supply on and student rail OFF','instrument','action'],...boards.flatMap(b=>((b as any).testPoints??[]).map((t:any)=>[b.id,t.ref,t.net,t.endpoint,...t.hole,'CP'+String(t.phase).padStart(2,'0'),t.expected,t.tool,'Optional: solder a short tin loop or pin to this pad and label it']))]));
save('probe-header.csv',csv([['board','pin','label','net','column','row'],...boards.flatMap(b=>b.parts.filter((p:any)=>p.probe).flatMap((p:any)=>p.pins.map((q:any)=>[b.id,q.number,q.label,p.signals[q.label]??'(not wired)',...q.hole])))]));
save('status-leds.csv',csv([['board','ref','meaning','resistor','install checkpoint'],...boards.flatMap(b=>b.parts.filter((p:any)=>p.ledMeaning).map((p:any)=>[b.id,p.ref,p.ledMeaning,b.parts.find((r:any)=>r.signals?.[2]&&r.signals[2]===p.signals[1])?.value??'','CP'+String(p.phase).padStart(2,'0')]))]));
save('links.csv',csv([['board','ref','net','far side net','install checkpoint','purpose when open','fail-safe when open','pull-down'],...boards.flatMap(b=>b.parts.filter((p:any)=>p.link).map((p:any)=>[b.id,p.ref,p.link.net,p.link.farNet,'CP'+String(p.phase).padStart(2,'0'),p.link.purpose,p.link.failSafe,p.link.pulldown??'']))]));
save('aids.json',JSON.stringify({boards:boards.filter(b=>['power','router-matrix'].includes(b.id)).map((b:any)=>{
 const probe=b.parts.find((p:any)=>p.probe);
 return {id:b.id,title:b.title,
  probe:(probe?.pins??[]).map((q:any)=>({pin:q.number,label:q.label,net:probe.signals[q.label]??null,hole:q.hole,phase:probe.phase})),
  testPoints:b.testPoints??[],
  leds:b.parts.filter((p:any)=>p.ledMeaning).map((p:any)=>({ref:p.ref,meaning:p.ledMeaning,phase:p.phase,hole:p.pins[0].hole,resistor:b.parts.find((r:any)=>r.ref===p.ref.replace(/^LED_/,'R_LED_'))?.value??''})),
  links:b.parts.filter((p:any)=>p.link).map((p:any)=>({ref:p.ref,...p.link,phase:p.phase,hole:p.pins[0].hole})),
  bars:b.parts.filter((p:any)=>p.virtual).map((p:any)=>({ref:p.ref,net:p.signals[1],row:p.pins[0].hole[1],x0:p.pins[0].hole[0],x1:p.pins.at(-1).hole[0],pads:p.pins.length,phase:p.phase}))};
})},null,2)+'\n');
const wireGroups:any[]=[];
for(const cp of checkpoints)for(const b of boards){
 const added=b.wires.filter(w=>w.phase===cp.phase);
 for(let k=0;k<added.length;k+=10){
  const group=added.slice(k,k+10),file=`assets/${cp.id}-${b.id}-wires-${k/10+1}.svg`;
  save(file,drawing(b,true,group));
  wireGroups.push({checkpoint:cp.id,board:b.id,file,wires:group.map(w=>({id:w.id,net:w.net,from:w.from,to:w.to,fromHole:pinAt(b,w.from).pin.hole,toHole:pinAt(b,w.to).pin.hole,description:netDescription(w.net),path:w.path}))});
 }
}
save('harnesses.csv',csv([['id','net','from board','from terminal','to board','to terminal','phase','description'],...cables.map(h=>[h.id,h.net,h.from,h.fromPin,h.to,h.toPin,h.phase,h.description])]));

const metric=(list:any[],qty:(b:any)=>number)=>{
 const sum=(f:(b:any)=>number)=>list.reduce((s,b)=>s+qty(b)*f(b),0);
 const pins=sum(b=>b.parts.filter(p=>!p.virtual).reduce((s,p)=>s+p.pins.length,0)),wires=sum(b=>b.wires.filter(w=>!w.bar).length),barPads=sum(b=>b.parts.filter(p=>p.virtual).reduce((s,p)=>s+p.pins.length,0)),barWires=sum(b=>b.wires.filter(w=>w.bar).length),sleeves=sum(b=>b.wires.filter(w=>w.sleeves).length);
 return {boards:sum(()=>1),parts:sum(b=>b.parts.filter(p=>!p.virtual).length),functionalParts:sum(b=>b.parts.filter(p=>p.body!=='terminal'&&!p.virtual&&!p.section?.startsWith?.('Test aids')&&p.section!=='Test aids').length),busBars:sum(b=>b.parts.filter(p=>p.virtual).length),removableLinks:sum(b=>b.parts.filter(p=>p.link).length),testPoints:sum(b=>((b as any).testPoints??[]).length),statusLeds:sum(b=>b.parts.filter(p=>p.ledMeaning).length),busBarPads:barPads,busBarSegments:barWires,sleevesRequired:sleeves,terminalPosts:sum(b=>b.parts.filter(p=>p.body==='terminal').length),pins,wires,adapters:sum(b=>b.parts.filter(p=>p.adapter).length),estimatedBoardSolderOperations:pins+2*wires+barPads,maxLocalWireAttachments:Math.max(...list.flatMap(b=>{const count:any={},onBar=new Set<string>();b.wires.forEach(w=>[w.from,w.to].forEach(ep=>{if(w.bar)onBar.add(ep);else count[ep]=(count[ep]??0)+1;}));onBar.forEach(ep=>count[ep]=(count[ep]??0)+1);return Object.values(count) as number[];}))};
};
const metrics={revision5:metric(baseline,()=>1),permanent:metric(boards.filter(b=>b.kind!=='pcb-contract'),()=>1),smartReference:metric(boards.filter(b=>b.kind==='pcb-contract'),()=>1),
 harnessConductors:cables.length,harnessEndTerminations:cables.length*2,
 caveat:'Permanent totals count four perfboards only. SmartReference totals describe inherited electrical contracts, not PCB dimensions or fabrication files. Module internals, sockets and adapters are excluded from solder estimates.'};
const bom=new Map<string,any>();
let busBarMm=0,shunts:string[]=[];
for(const b of boards)for(const p of b.parts){if(p.link)shunts.push(`${b.id}/${p.ref}`);if(p.virtual){const xs=p.pins.map((q:any)=>q.hole[0]);busBarMm+=(Math.max(...xs)-Math.min(...xs)+2)*2.54;continue;}const key=p.kind==='header'&&!p.externalPart?`unverified ${p.body} interface`:p.externalPart??p.mpn;const entry=bom.get(key)??{part:key,quantity:0,refs:[],adapter:p.adapter??'',status:p.externalPart||p.provisional?'Purchased part/carrier must be identified':'Selected design part, availability pending'};entry.quantity++;entry.refs.push(`${b.id}/${p.ref}`);bom.set(key,entry);}
if(busBarMm)bom.set('Bare tinned wire for bus bars (mm, 24 AWG assumed)',{part:'Bare tinned wire for bus bars (mm, 24 AWG assumed)',quantity:Math.ceil(busBarMm),refs:boards.flatMap(b=>b.parts.filter(p=>p.virtual).map(p=>`${b.id}/${p.ref}`)),adapter:'',status:'Size not set by the guidelines for bare wire; confirm'});
if(shunts.length)bom.set('Jumper shunt, 2.54 mm',{part:'Jumper shunt, 2.54 mm',quantity:shunts.length,refs:shunts,adapter:'',status:'Selected design part, availability pending'});
save('bom.csv',csv([['part','quantity','adapter','status','references'],...[...bom.values()].map(p=>[p.part,p.quantity,p.adapter,p.status,p.refs.join(';')])]));

const engineering={
 voltage:{dividerNominalInputOhm:2e6,dividerMinOhm:1.98e6,dividerMaxGain:1.01/(1.01+.99),maxBufferInputV:.505*(5.25+3.38*1010/(5620*.99+1010)+.01),minBufferInputV:.495*(3.2*990/(5620*1.01+990)-.01),biasNominalV:3.3/6.62,biasLoadAllowanceV:.01,generalBufferOffsetMaxV:.0045,precisionBufferOffsetMaxV:.00001,
   generalPairInputReferredOffsetContributionV:.018,dividerWorstDifferentialErrorV:5.25*.01,staticAllowanceV:.1+5.25*.05,
   scan:{adcRateSps:860,conversionWaitUs:1500,settlingWaitUs:1000,discardConversions:1,sampleConversions:1,positionsPerBank:3,worstBankScanMs:3*(1+2*1.5+1.5),targetBankScanMs:20,status:'Firmware/scope pending; poll conversion-ready, discard after switch, retain timestamp per position. No sample is valid before settling.'}},
 continuity:{stimulusResistorOhm:11000,stimulusMaxMa:3.38/10890*1000,passMaxOhm:20,rejectMinOhm:100,
   precisionPairMaxInputReferredOffsetV:.00004,status:'Requires short/open/1k calibration, known stimulus voltage, actual error bound and inconclusive band. MCP6004 is excluded from the first diagnostic pair.'},
 relayDrive:{bankResistorOhm:390,stimulusResistorOhm:270,minBankLedMa:(4.75-1.5-1.1)/(390*1.01)*1000,minStimulusLedMa:(3.2-1.5-.1)/(270*1.01)*1000,maxBankLedMa:5.25/(390*.99)*1000,maxStimulusLedMa:3.38/(270*.99)*1000,recommendedMinMa:5,recommendedMaxMa:30,status:'Conservative static driver-drop budget; verify measured LED current and PhotoMOS timing over supply extremes.'},
 outputClamp:{referenceTopOhm:1000,referenceBottomOhm:49900,senseOhm:10,resistorTolerance:.01,opampOffsetV:.0045,
   worstSourceSinkMa:(5.25*(1010/(1010+49401))+.0045)/9.9*1000,
   minStaticClampMa:(4.75*(990/(990+50399))-.0045)/10.1*1000,
   status:'Static current bound only. Saturation, MOSFET compliance, PhotoMOS response, stability and transient shorts require bench qualification.'},
 current:{shuntOhm:1,tolerance:.01,maxOffsetUv:10,offsetErrorMa:.01,lsbMa:.0025,shuntBurdenAt10MaV:.01,
   status:'INA226 carrier shunt bypass must be removed; Kelvin routing and actual carrier address/pull-ups inspected. Include PhotoMOS resistance in total burden.'},
 power:{benchInputV:12,availableInputW:24,piSupplySeparate:true,educationalContactMaxV:5.25,tripMaxMs:1,
   guard5V:{minimumStaticTripV:.4925*(1+92800*.999/(10000*1.001))-1e-8*92800*1.001,maximumStaticTripV:.5075*(1+92800*1.001/(10000*.999))+1e-8*92800*1.001,thresholdTolerance:.015,dividerTolerance:.001,inputLeakageA:1e-8},
   guard3V3:{minimumStaticTripV:.4925*(1+59000*.999/(10000*1.001))-1e-8*59000*1.001,maximumStaticTripV:.5075*(1+59000*1.001/(10000*.999))+1e-8*59000*1.001},
   status:'Actual buck losses, fan/light load, display interface and fault transients pending. Existing LTC4365 guards retained until proven substitute exists.'},
 watchdog:{targetExpiryMs:[200,350],heartbeatPeriodMs:50,status:'HC123 actual capacitor type/tolerance and scope expiry pending; fixed levels do not constitute heartbeat.'},
 sources:[
  ['OPA2333','https://www.ti.com/lit/ds/symlink/opa333.pdf'],
  ['AQY212EH','https://industry.panasonic.com/ap/en/products/control/relay/photomos/number/aqy212eh'],
  ['LTC4365','https://www.analog.com/media/en/technical-documentation/data-sheets/4365fa.pdf'],
  ['MCP6001/2/4','https://ww1.microchip.com/downloads/en/DeviceDoc/MCP6001-1R-1U-2-4-1-MHz-Low-Power-Op-Amp-DS20001733L.pdf'],
  ['INA226','https://www.ti.com/lit/ds/symlink/ina226.pdf'],['ADS1115','https://www.ti.com/lit/ds/symlink/ads1115.pdf'],
  ['CD4052','https://www.ti.com/lit/ds/symlink/cd4053b.pdf'],['ULN2003','https://www.ti.com/lit/ds/symlink/uln2003a.pdf'],
  ['MT8816','https://www.mouser.com/datasheet/2/268/Microchip_06182024_MT8816AE1-3459976.pdf'],['RC522','https://www.nxp.com/docs/en/data-sheet/MFRC522.pdf']]
};
assert(engineering.relayDrive.minBankLedMa>=5&&engineering.relayDrive.minStimulusLedMa>=5&&engineering.relayDrive.maxBankLedMa<=30&&engineering.relayDrive.maxStimulusLedMa<=30,'photomos-led-drive',engineering.relayDrive);
assert(engineering.continuity.stimulusMaxMa<=.34,'stimulus-current-bound',engineering.continuity);
assert(engineering.outputClamp.worstSourceSinkMa<=12,'static-clamp-limit',engineering.outputClamp);
assert(engineering.voltage.minBufferInputV>.05,'buffer-low-rail-headroom',engineering.voltage);
assert(engineering.voltage.maxBufferInputV<3.2,'buffer-input-headroom',engineering.voltage);
assert(engineering.voltage.dividerMinOhm>=1e6,'voltage-input-loading',engineering.voltage);
const report={revision,sourceDigest,softwareStatus:issues.length||native.some(r=>r.status==='fail')?'fail':'pass',hardwareStatus:release.status,
 assemblyIssues:issues,native,metrics,engineering,releaseGates:release.pending,stock,scope:'Native software and descriptor consistency checks, not measured hardware verification. No routed copper; copper-short and style checks cannot validate insulated hand wires.'};
save('checks.json',JSON.stringify(report,null,2)+'\n');
save('design.json',JSON.stringify({revision,sourceDigest,stock,release,boards,cables,checkpoints,externalInterfaces,metrics,engineering,drawings},null,2)+'\n');
save('data.json',JSON.stringify({revision,release,metrics,engineering,externalInterfaces,wireGroups,fixture:fixtureData,
 boards:boards.map(b=>({id:b.id,title:b.title,notes:b.notes,parts:b.parts.map((p,i)=>({number:i+1,ref:p.ref,label:p.label,phase:p.phase,description:p.virtual?`Bare bus bar for ${p.signals[1]}: one bare wire soldered along row ${p.pins[0].hole[1]} on the underside, columns ${p.pins[0].hole[0]} to ${p.pins.at(-1).hole[0]}. Solder it to every pad listed, add one insulated stub per pin, and sleeve every signal wire that crosses it.`:partDescription(b,p),adapter:p.adapter??'',carrier:p.externalPart??'',pins:p.pins})),schematics:drawings.filter(d=>d.board===b.id)})),
 checkpoints:checkpoints.map(c=>({...c,parts:c.install.length,wireCount:c.wires.length,harnessCount:c.harnesses.length,
    boards:[...new Set(c.install.map(p=>p.board))]}))},null,2)+'\n');
console.log(JSON.stringify({status:report.softwareStatus,assemblyIssues:issues,nativeFailures:native.filter(r=>r.status==='fail').map(r=>({board:r.board,section:r.section,checks:r.checks})),metrics},null,2));
if(report.softwareStatus==='fail')process.exitCode=1;
