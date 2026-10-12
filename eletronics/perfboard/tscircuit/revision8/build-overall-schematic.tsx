import React from 'react';
import {Circuit} from '@tscircuit/core';
import {convertCircuitJsonToSchematicSvg} from 'circuit-to-svg';
import {runAllPinSpecificationChecks,runAllNetlistChecks,runAllSchematicChecks} from '@tscircuit/checks';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

// Schematic-only build: read the saved electrical model; never run the
// perfboard placement generator or alter earlier construction exports.
const root='revision8',out=`${root}/schematic`;
for(const dir of [out,`${out}/assets`,`${out}/circuits`])mkdirSync(dir,{recursive:true});
const model=JSON.parse(readFileSync(`${root}/lower/design.json`,'utf8'));
const xml=(s:any)=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const save=(name:string,data:any)=>writeFileSync(`${out}/${name}`,typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const errors:any[]=[];
const required=(ok:any,code:string,detail:any)=>{if(!ok)errors.push({code,...detail});};
const byBoard=new Map<string,any>(model.boards.map((b:any)=>[b.id,b]));
const resolve=(id:string,ep:string)=>{
 const b=byBoard.get(id);const at=ep.lastIndexOf('.');const ref=ep.slice(0,at),key=ep.slice(at+1);
 const p=b?.parts.find((p:any)=>p.ref===ref),pin=p?.pins.find((q:any)=>String(q.number)===key||q.label===key);
 if(!pin)throw Error(`Unknown endpoint ${id}/${ep}`);
 const n=b.nets.find((n:any)=>n.pins.some((item:string)=>{const i=item.lastIndexOf('.');return item.slice(0,i)===ref&&(item.slice(i+1)===String(pin.number)||item.slice(i+1)===pin.label);}));
 if(!n)throw Error(`Endpoint has no net: ${id}/${ep}`);
 return {board:id,part:p,pin,net:n.name,key:`${id}/${p.ref}.${pin.number}`};
};
const interfaceChanges:any[]=[];
const operatingCables=model.cables.filter((h:any)=>{
 const drop=/^NODE/.test(h.net)&&[h.from,h.to].includes('router-matrix')||['GND','3V3_SYS'].includes(h.net)&&[h.from,h.to].some((id:string)=>id.startsWith('contact-'));
 if(drop)interfaceChanges.push({action:'replace',id:h.id,net:h.net,reason:/^NODE/.test(h.net)?'NODE cable goes directly from grouped contact header to matrix receiver':'Explicit shared contact power branches replace inherited daisy-chain hops'});
 return !drop;
});
function addCable(id:string,net:string,from:string,fromPin:string,to:string,toPin:string,description:string){
 const a=resolve(from,fromPin),b=resolve(to,toPin);if(a.net!==net||b.net!==net)throw Error(`New interface mismatch ${id}`);
 operatingCables.push({id,net,from,fromPin,to,toPin,description,phase:Math.max(a.part.phase,b.part.phase)});interfaceChanges.push({action:'add',id,net,from,fromPin,to,toPin,description});
}
for(const bank of ['a','b']){
 const contact=byBoard.get(`contact-${bank}`),router=byBoard.get('router-matrix');
 for(let group=1;group<=3;group++){
  const source=contact.parts.find((p:any)=>p.ref===`J_${bank.toUpperCase()}_NODE_BUNDLE_${group}`),target=router.parts.find((p:any)=>p.ref===`J_MATRIX_NODE_${bank.toUpperCase()}_${group}`);
  for(const pin of source.pins){if(!source.signals[pin.number])continue;const n=resolve(contact.id,`${source.ref}.${pin.number}`);if(!/^NODE/.test(n.net))continue;const tp=target.pins.find((q:any)=>target.signals[q.number]===n.net);addCable(`NODE_${bank}_${group}_${pin.number}`,n.net,contact.id,`${source.ref}.${pin.number}`,router.id,`${target.ref}.${tp.number}`,'Direct grouped NODE cable; SMART taps branch independently from the contact bus.');}
 }
 for(const [net,powerPin,contactPin] of [['GND',2,1],['3V3_SYS',5,2]] as const)addCable(`CONTACT_POWER_${bank}_${contactPin}`,net,'power',`J_POWER_INTERLOCK_SMART.${powerPin}`,contact.id,`J_${bank.toUpperCase()}_SMART_POWER.${contactPin}`,'Shared power harness branch to the contact bank.');
}
for(const [net,pin] of [['5V_SYS',1],['GND',2],['5V_EDU',3],['GND',4],['3V3_SYS',5],['GND',6],['EDU_ON',7]] as const){
 if(!operatingCables.some((h:any)=>h.net===net&&h.from==='power'&&h.to==='smart-core'&&h.toPin===`J_POWER.${pin}`))addCable(`SMART_POWER_${pin}`,net,'power',`J_POWER_INTERLOCK_SMART.${pin}`,'smart-core',`J_POWER.${pin}`,'Explicit power-board to smart-controller supply/control harness.');
}
for(const h of model.cables.filter((h:any)=>['GND','3V3_SYS'].includes(h.net)&&[h.from,h.to].some((id:string)=>id.startsWith('contact-')))){
 const other=h.from.startsWith('contact-')?h.to:h.from,otherPin=h.from.startsWith('contact-')?h.toPin:h.fromPin;
 if(other.startsWith('contact-')||['power','router-matrix'].includes(other))continue;
 addCable(`SMART_BRANCH_${h.id}`,h.net,'power',`J_POWER_INTERLOCK_SMART.${h.net==='GND'?2:5}`,other,otherPin,'Explicit smart supply branch replaces a contact-board power pass-through; inherited smart boundary is a logical interface.');
}

// Board-local nets become one global electrical net only through declared
// harness endpoints. This prevents name-based, accidental supply/bus joins.
const parents=new Map<string,string>();
const find=(key:string):string=>{if(!parents.has(key))parents.set(key,key);const p=parents.get(key)!;if(p===key)return key;const r=find(p);parents.set(key,r);return r;};
const join=(a:string,b:string)=>parents.set(find(b),find(a));
for(const b of model.boards)for(const n of b.nets)find(`${b.id}/${n.name}`);
const harnesses=operatingCables.map((h:any)=>{
 const a=resolve(h.from,h.fromPin),b=resolve(h.to,h.toPin);
 required(a.net===h.net&&b.net===h.net,'harness-net-mismatch',{id:h.id,net:h.net,a:a.net,b:b.net});
 join(`${h.from}/${a.net}`,`${h.to}/${b.net}`);
 return {...h,fromEndpoint:a.key,toEndpoint:b.key};
});
const groups=new Map<string,any>();
for(const b of model.boards)for(const n of b.nets){
 const key=find(`${b.id}/${n.name}`);const g=groups.get(key)??{id:`N${groups.size+1}`,name:n.name,members:[],boards:new Set(),aliases:new Set()};
 g.boards.add(b.id);g.aliases.add(n.name);g.members.push(...n.pins.map((ep:string)=>resolve(b.id,ep).key));groups.set(key,g);
}
const globalNets=[...groups.values()].map(g=>({...g,boards:[...g.boards],aliases:[...g.aliases],members:[...new Set(g.members)]}));
const endpointNet=new Map(globalNets.flatMap(n=>n.members.map((ep:string)=>[ep,n])));
// The cable correction must preserve the complete electrical partition.
const oldParents=new Map<string,string>();
function oldFind(k:string):string{if(!oldParents.has(k))oldParents.set(k,k);const p=oldParents.get(k)!;if(p===k)return k;const r=oldFind(p);oldParents.set(k,r);return r;}
for(const b of model.boards)for(const n of b.nets)oldFind(`${b.id}/${n.name}`);
for(const h of model.cables){const a=resolve(h.from,h.fromPin),b=resolve(h.to,h.toPin);oldParents.set(oldFind(`${b.board}/${b.net}`),oldFind(`${a.board}/${a.net}`));}
const before=new Map<string,string[]>();for(const b of model.boards)for(const n of b.nets){const r=oldFind(`${b.id}/${n.name}`),a=before.get(r)??[];a.push(...n.pins.map((ep:string)=>resolve(b.id,ep).key));before.set(r,a);}
const partition=(sets:string[][])=>sets.map(s=>[...new Set(s)].sort().join('|')).sort();
required(JSON.stringify(partition([...before.values()]))===JSON.stringify(partition(globalNets.map(n=>n.members))),'electrical-partition-changed',{reason:'Presentation harness changes must preserve every source net membership.'});
const selected=(p:any)=>!p.virtual&&p.body!=='terminal'&&p.kind!=='bar';
const refMap:any[]=[];const parts:any[]=[];const index=new Map<string,any>();
for(const [bi,b] of model.boards.entries()){
 const counts:any={};
 for(const original of b.parts.filter(selected)){
  const prefix=original.body==='pogo'?'P':original.ref.split('_')[0];
  const number=(bi+1)*100+(counts[prefix]=(counts[prefix]??0)+1);
  const short=`${prefix}${number}`;
  const p={...structuredClone(original),boardId:b.id,uid:`${b.id}/${original.ref}`,name:short,short};
  p.nets=Object.fromEntries(p.pins.map((pin:any)=>{const n=endpointNet.get(`${p.uid}.${pin.number}`);return [pin.number,n?.id];}));
  parts.push(p);index.set(p.uid,p);refMap.push({board:b.id,sourceRef:original.ref,schematicRef:short,mpn:original.mpn,pins:p.pins.map((q:any)=>({number:q.number,function:q.label,net:endpointNet.get(`${p.uid}.${q.number}`)?.name}))});
 }
}
// Local boundaries and ground-bar posts are construction artefacts. Their
// net membership survives in the integrated netlist, without extra symbols.
const excluded=model.boards.flatMap((b:any)=>b.parts.filter((p:any)=>!selected(p)).map((p:any)=>({board:b.id,ref:p.ref,reason:p.virtual||p.kind==='bar'?'Perfboard ground-bar geometry':'Synthetic board-boundary post'})));
const canonicalName=(n:any)=>n.boards.length>1?n.name:`${n.boards[0].replaceAll('-','_')}__${n.name}`;
const colors=(s:string)=>s==='GND'?'#222222':/^(12V|[35]V|USB_.*3V3|USB_5V|BUCK_|SAFE_|PI_3V3|PTC_OUT)/.test(s)?'#c62d32':/SDA|SCL/.test(s)?'#727f89':/NODE|BUS/.test(s)?'#1976b4':/ADC|SENSE|REF|SHUNT|DIV|BUF|WATCH_(CX|RX)/.test(s)?'#248248':'#9a7000';

// Source audit of the ignored EasyEDA exports. Parse symbol text and pins,
// preserving raw geometry for reconstruction rather than trusting sheet names.
const easyPath='../../SCH_TedTronics_2026-10-04(6).json';
const easyText=readFileSync(easyPath,'utf8'),easy=JSON.parse(easyText);
const easySheets=easy.schematics.map((s:any)=>{
 const data=typeof s.dataStr==='string'?JSON.parse(s.dataStr):s.dataStr;
 const symbols=data.shape.filter((s:string)=>s.startsWith('LIB~')).map((shape:string)=>{
  const chunks=shape.split('#@$'),texts=chunks.slice(1).filter(c=>c.startsWith('T~')).map(t=>t.split('~'));
  return {ref:texts.find(t=>t[1]==='P')?.[12],value:texts.find(t=>t[1]==='N')?.[12],header:chunks[0],pins:chunks.filter(c=>c.startsWith('P~')),shape};
 }).filter((s:any)=>s.ref);
 return {title:s.title,symbols,noConnects:data.shape.filter((s:string)=>s.startsWith('O~')),wires:data.shape.filter((s:string)=>s.startsWith('W~')),labels:data.shape.filter((s:string)=>/^(N|F|J)~/.test(s)),shapeCount:data.shape.length};
});
// Recover legacy connectivity from wire vertices, pin anchors and flags.
// A crossing joins only where a vertex/pin/flag is present; two unmarked
// wire interiors remain separate. Keep this legacy graph separate from the
// later protected architecture, rather than silently merging the designs.
for(const sheet of easySheets){
 const p=new Map<string,string>();const key=(xy:number[])=>xy.join(',');
 const get=(k:string):string=>{if(!p.has(k))p.set(k,k);const r=p.get(k)!;if(r===k)return k;const n=get(r);p.set(k,n);return n;};
 const union=(a:string,b:string)=>p.set(get(b),get(a));
 const pins=sheet.symbols.flatMap((s:any)=>s.pins.map((raw:string)=>{const chunks=raw.split('^^'),a=chunks[0].split('~');return {ref:s.ref,pin:a[3],name:chunks[3]?.split('~')[4],point:[Number(a[4]),Number(a[5])]};}));
 const flags=sheet.labels.filter((r:string)=>r.startsWith('F~')).map((raw:string)=>{const chunks=raw.split('^^'),a=chunks[0].split('~');return {name:chunks[2]?.split('~')[0],point:[Number(a[2]),Number(a[3])]};}).filter((a:any)=>a.name&&a.point.every(Number.isFinite));
 const segments:number[][][]=[];const vertices:number[][]=[];
 for(const raw of sheet.wires){const nums=raw.split('~')[1].trim().split(/\s+/).map(Number),points:number[][]=[];for(let i=0;i<nums.length;i+=2)points.push([nums[i],nums[i+1]]);vertices.push(...points);for(let i=1;i<points.length;i++){segments.push([points[i-1],points[i]]);union(key(points[i-1]),key(points[i]));}}
 const anchors=[...vertices,...pins.map((a:any)=>a.point),...flags.map((a:any)=>a.point)];
 for(const xy of anchors){get(key(xy));for(const [a,b] of segments){const cross=(xy[0]-a[0])*(b[1]-a[1])-(xy[1]-a[1])*(b[0]-a[0]);if(Math.abs(cross)<1e-6&&xy[0]>=Math.min(a[0],b[0])&&xy[0]<=Math.max(a[0],b[0])&&xy[1]>=Math.min(a[1],b[1])&&xy[1]<=Math.max(a[1],b[1]))union(key(xy),key(a));}}
 const named=new Map<string,string>();for(const f of flags){if(named.has(f.name))union(key(f.point),named.get(f.name)!);else named.set(f.name,key(f.point));}
 const nets=new Map<string,any>();const record=(xy:number[])=>{const k=get(key(xy)),n=nets.get(k)??{labels:[],pins:[],wireVertices:[]};nets.set(k,n);return n;};
 for(const f of flags)record(f.point).labels.push(f.name);
 for(const a of pins)record(a.point).pins.push({ref:a.ref,pin:a.pin,function:a.name});
 for(const xy of vertices)record(xy).wireVertices.push(xy);
 (sheet as any).connectivity=[...nets.values()].map((n,i)=>({...n,id:`E${i+1}`,labels:[...new Set(n.labels)],wireVertices:[...new Map(n.wireVertices.map((xy:number[])=>[key(xy),xy])).values()]}));
 (sheet as any).counts={symbols:sheet.symbols.length,pins:pins.length,wires:sheet.wires.length,flags:flags.length,nets:nets.size};
 (sheet as any).interpretation='Legacy wire/pin geometry audit only; not a pin-compatibility approval or hardware verification.';
}
save('easyeda-source.json' ,{path:easyPath,sha256:hash(easyText),sheets:easySheets});
save('reference-crosswalk.json',refMap);save('harnesses.json',harnesses);save('interface-changes.json',interfaceChanges);
save('integrated-model.json',{source:'revision8/lower/design.json',sourceDigest:hash(readFileSync(`${root}/lower/design.json`,'utf8')),nets:globalNets.map(n=>({...n,displayName:canonicalName(n)})),parts:refMap,excluded,harnesses});

type Sheet={id:string,title:string,subtitle:string,parts:any[],panels?:any[]};
const boardParts=(id:string)=>parts.filter(p=>p.boardId===id);
const sheets:Sheet[]=[
 {id:'02-contacts',title:'Terminal contacts',subtitle:'Bank A and bank B • 22 independent NODEs • six OLED service interfaces',parts:parts.filter(p=>p.boardId.startsWith('contact-'))},
 {id:'03-power',title:'Power board',subtitle:'Input → independent voltage guards → current trip → protected student output',parts:boardParts('power')},
 {id:'04-router-matrix',title:'Routing matrix and peripherals',subtitle:'ESP1 • watchdog • two MT8816 matrices • Pi and RFID interfaces',parts:boardParts('router-matrix')},
 {id:'05-smart-controller',title:'Smart controller',subtitle:'ESP2 • six SDA channels • shared A-side SCL • bank selection • joystick',parts:boardParts('smart-core')},
 {id:'06-smart-safety',title:'Smart safety and register control',subtitle:'Independent watchdog • default-off output enable • three cascaded registers',parts:boardParts('smart-safety')},
];
for(const [bank,start] of [['a',7],['b',9]] as const){
 for(const [kind,offset,title] of [['precision',0,'Precision sensing and bank selector'],['buffers',1,'Buffered inputs and references']] as const)sheets.push({id:`${String(start+offset).padStart(2,'0')}-measurement-${bank}-${kind}`,title:`Measurement bank ${bank.toUpperCase()} — ${title}`,subtitle:'Buffered voltage sensing • ADS1115 interfaces • named continuations to the smart positions',parts:boardParts(`measurement-${bank}-${kind}`)});
}
for(let pos=0;pos<6;pos++)sheets.push({id:`${11+pos}-smart-position-${pos+1}`,title:`Smart position ${pos+1} — bank ${pos<3?'A':'B'}`,subtitle:'Isolated service bus • protected P3 source/sink • isolated current path • OLED capsule interface',parts:boardParts(`bank-${pos<3?'a':'b'}-position-${pos}`)});
required(sheets.length===15,'sheet-count',{count:sheets.length});
const coverage=new Map<string,string>();
for(const s of sheets)for(const p of s.parts){required(!coverage.has(p.uid),'duplicate-part',{uid:p.uid});coverage.set(p.uid,s.id);}
for(const p of parts)required(coverage.has(p.uid),'missing-part',{uid:p.uid});

// Standard-symbol dimensions, with wider pin spacing than the perfboard
// renderer. Rows have reserved label space and wiring gutters.
const passive=(p:any)=>['resistor','capacitor','diode','led'].includes(p.kind)||p.ref.startsWith('Q_')||p.ref.startsWith('F_');
const pinText=(s:string)=>s.replace(/(SCL|SDA)_POSITION_(\d+)/g,(_,bus,i)=>`${bus}${Number(i)+1}`).replace('EDU_FAULT_RESET','FAULT_RST').replace('EDU_PWR_EN','PWR_EN').replace('CURRENT_SENSE','I_SENSE').replace('ROUTER_ALIVE','ALIVE').replace('RST_RELEASE','RST_REL');
const size=(p:any)=>passive(p)?{w:4,h:p.ref.startsWith('Q_')?5.2:3.2}:{w:Math.max(10.8,Math.min(18,.65*(Math.max(...p.pins.map((q:any)=>pinText(q.label).length))*2)+1.2)),h:Math.max(2.1,(p.body==='pogo'?p.pins.length:Math.ceil(p.pins.length/2))*1.4+.8)};
function classify(p:any){
 if(p.boardId.startsWith('contact-'))return `${p.boardId==='contact-a'?'Bank A':'Bank B'} — ${p.body==='pogo'?'NODE columns':'cable interfaces'}`;
 if(p.boardId==='power'){
  if(p.function?.includes('VoltageGuard'))return p.ref.includes('3V3')?'3V3 voltage guard':'5V voltage guard';
  return ({'power-input: Input':'Input and reverse protection','power-input: Circuit':'Buck module interfaces','power-analog: Reference':'Reference and fault comparator','power-analog: Student':'Student current cutoff','power-interlock: Latch':'Fault latch and interlock','power-interlock: Outputs':'Output connectors','power-interlock: Indicator':'Student rail indication','Test aids':'Rail and fault indicators'} as any)[p.function]??'Power interfaces';
 }
 if(p.boardId==='router-matrix'&&p.function==='matrix-switches: Matrix')return /MT_A|MT0|NODE_A/.test(p.ref)?'Matrix A and NODE cables':'Matrix B and NODE cables';
 if(p.boardId==='router-matrix')return ({'router-core: Controller':'ESP1 and power/control interface','router-core: Circuit':'Fan and light interfaces','router-safety: Watchdog':'Router watchdog','router-safety: Return':'Fault and current return','matrix-control: Control':'Matrix address and logic','matrix-control: Tools':'Diagnostic stimulus and sensing','matrix-switches: Control':'Matrix reset control','matrix-switches: Matrix':'Analog matrices and NODE cables','integration: Pi':'Raspberry Pi interface','integration: Circuit':'RFID interface','integration: Buttons':'User buttons','Test aids':'Status and probe interface'} as any)[p.function]??'External interface';
 if(p.boardId==='smart-safety')return p.ref.includes('SR')||p.ref.includes('RELAY')?'Relay registers':p.ref.includes('WATCH')||p.ref.includes('USB')||p.ref.includes('HEART')?'Watchdog and reset':'Output enable and drivers';
 if(p.boardId.includes('position-'))return p.ref.includes('AMM')||p.ref.includes('SHUNT')?'Current sensing and isolation':p.ref.includes('BUS')||p.ref.includes('CONTROL')||p.ref.includes('OLED')?'Service bus and capsule':'Protected source/sink output';
 return p.ref.includes('MUX')||p.ref.includes('ADC')?'Selector and ADC':p.ref.includes('STIM')||p.ref.includes('TEST')||p.ref.includes('RETURN')?'Continuity fixture':p.ref.includes('JOY')?'Joystick interface':p.ref.includes('ESP')||p.ref.startsWith('J_')?'Controller and connectors':'Buffers, reference and bypass';
}
function place(sheet:Sheet){
 const panels=new Map<string,any>();for(const p of sheet.parts){const key=classify(p);if(!panels.has(key))panels.set(key,{title:key,parts:[]});panels.get(key).parts.push(p);}
 // Dense sheets use four panel columns; sparse sheets retain generous spacing.
 const orders:any={power:['Input and reverse protection','Buck module interfaces','5V voltage guard','3V3 voltage guard','Reference and fault comparator','Student current cutoff','Fault latch and interlock','Output connectors','Student rail indication','Rail and fault indicators'],'router-matrix':['Matrix A and NODE cables','Matrix B and NODE cables','ESP1 and power/control interface','Router watchdog','Matrix address and logic','Matrix reset control','Diagnostic stimulus and sensing','Fault and current return','Raspberry Pi interface','RFID interface','User buttons','Fan and light interfaces','Status and probe interface']};
 const order=orders[sheet.parts[0]?.boardId];
 const list=[...panels.values()].sort((a,b)=>order?order.indexOf(a.title)-order.indexOf(b.title):0);const cols=sheet.id==='02-contacts'?4:sheet.id==='04-router-matrix'?6:list.length>8?4:list.length>3?3:Math.max(1,list.length);
 const width=30,gap=2.5;const rows:any[][]=[];
 for(let i=0;i<list.length;i+=cols)rows.push(list.slice(i,i+cols));
 let y=0;
 for(const row of rows){
  for(const [col,panel] of row.entries()){
   panel.x=col*(width+gap);panel.y=y;panel.w=width;let yy=y-3.5;
   const sorted=[...panel.parts].sort((a,b)=>Number(passive(a))-Number(passive(b))||b.pins.length-a.pins.length||a.short.localeCompare(b.short));
   for(let i=0;i<sorted.length;){const ncols=passive(sorted[i])?3:sorted[i].pins.length>24||size(sorted[i]).w>12?1:2;const chunk=sorted.slice(i,i+ncols);i+=ncols;const h=Math.max(...chunk.map(p=>size(p).h));
    for(const [k,p] of chunk.entries()){p.sch=[panel.x+width*(k+.5)/ncols,yy-h/2];p.panel=panel.title;p.dim=size(p);}
    yy-=h+2.8;
   }
   panel.h=y-yy+.4;
  }
  y-=Math.max(...row.map(p=>p.h))+gap;
 }
 const bounds={width:cols*(width+gap)-gap,height:-y-gap};
 for(const panel of list){panel.x-=bounds.width/2;panel.y+=bounds.height/2;}
 for(const p of sheet.parts){p.sch[0]-=bounds.width/2;p.sch[1]+=bounds.height/2;}
 sheet.panels=list;return bounds;
}
function Symbol({p}:any){
 const pins=p.pins,labels=Object.fromEntries(pins.map((q:any)=>[`pin${q.number}`,pinText(q.label)]));
 const attrs=Object.fromEntries(pins.map((q:any)=>[`pin${q.number}`,!p.nets[q.number]||/^NC/.test(q.label)||p.stageOpenPins?.includes(q.number)?{doNotConnect:true}:/^(VCC|VDD|VIN|VS|VCCA|VCCB|3V3|LED_A)$/.test(q.label)||(p.mpn==='TL431ACLP'&&q.label==='K')||(p.mpn==='ULN2003AN'&&q.label==='COM')?{requiresPower:true}:/^(GND|GND_L|GND_R1|GND_R2|VSS|VEE|LED_K)$/.test(q.label)||(p.mpn==='TL431ACLP'&&q.label==='A')?{requiresGround:true}:{isPassive:true}]));
 const common:any={name:p.name,displayName:p.short,manufacturerPartNumber:p.mpn,schX:p.sch[0],schY:p.sch[1],pinAttributes:attrs};
 const line=(x1:number,y1:number,x2:number,y2:number)=><schematicline x1={x1} y1={y1} x2={x2} y2={y2} strokeColor="#a23232" strokeWidth={.045}/>;
 const twoTerminal=(primitives:any[],value:string)=><symbol>
  <port name="pin1" pinNumber={1} direction="left" schX={-1.4} schY={0}/><port name="pin2" pinNumber={2} direction="right" schX={1.4} schY={0}/>
  <schematictext name="{REFDES}" schX={0} schY={1.05} text={p.short} fontSize={.55}/>
  <schematictext schX={0} schY={-1.05} text={value} fontSize={.5}/>
  {primitives.map((c,i)=>React.cloneElement(c,{key:i}))}
 </symbol>;
 if(p.kind==='resistor')return <resistor {...common} resistance={p.value} symbol={twoTerminal([line(-1.4,0,-.75,0),<schematicrect width={1.5} height={.6} strokeColor="#a23232" strokeWidth={.045} isFilled={false}/>,line(.75,0,1.4,0)],p.value+(p.tolerance===.001?' 0.1%':''))}/>;
 if(p.kind==='capacitor')return <capacitor {...common} capacitance={p.value} symbol={twoTerminal([line(-1.4,0,-.18,0),line(-.18,-.6,-.18,.6),line(.18,-.6,.18,.6),line(.18,0,1.4,0),...(/uF$/.test(p.value)&&parseFloat(p.value)>=10?[<schematictext schX={-.65} schY={.5} text="+" fontSize={.45}/>]:[])],p.value)}/>;
 if(p.kind==='diode'||p.kind==='led'){
  const primitives=[line(-1.4,0,-.55,0),<schematicpath points={[{x:-.55,y:-.55},{x:.55,y:0},{x:-.55,y:.55},{x:-.55,y:-.55}]} strokeColor="#a23232" strokeWidth={.045}/>,line(.55,-.55,.55,.55),line(.55,0,1.4,0)];
  if(p.kind==='led')primitives.push(line(0,.6,.5,1),line(.3,1,.5,1),line(.5,.8,.5,1));
  return p.kind==='led'?<led {...common} symbol={twoTerminal(primitives,'LED')}/>:<diode {...common} symbol={twoTerminal(primitives,p.mpn)}/>;
 }
 if(p.ref.startsWith('Q_')){
  const pos:any={G:[-2,0],D:[1,1.5],S:[1,-1.5]};const pChannel=['BSS84','NDP6020P'].includes(p.mpn);
  return <mosfet {...common} channelType={pChannel?'p':'n'} mosfetMode="enhancement" symbol={<symbol>
   <schematictext name="{REFDES}" schX={0} schY={2.7} text={p.short} fontSize={.55}/>
   <schematictext schX={0} schY={-2.7} text={p.mpn} fontSize={.5}/>
   {line(-2,0,-.55,0)}{line(-.55,-.9,-.55,.9)}
   {[-.8,0,.8].map((y,i)=>React.cloneElement(line(0,y-.2,0,y+.2),{key:i}))}
   {line(0,.8,1,.8)}{line(1,.8,1,1.5)}{line(0,-.8,1,-.8)}{line(1,-.8,1,-1.5)}
   {line(1,-.8,1,.8)}{line(0,0,.7,0)}
   {pChannel?<schematicpath points={[{x:0,y:0},{x:.35,y:.18},{x:.35,y:-.18},{x:0,y:0}]} strokeColor="#a23232" strokeWidth={.045}/>:<schematicpath points={[{x:.7,y:0},{x:.35,y:.18},{x:.35,y:-.18},{x:.7,y:0}]} strokeColor="#a23232" strokeWidth={.045}/>}
   {pins.flatMap((q:any)=>{const [x,y]=pos[q.label];return [<port name={`pin${q.number}`} pinNumber={q.number} direction={q.label==='G'?'left':'right'} schX={x} schY={y}/>,<schematictext schX={x+.35} schY={y+.3} text={`${q.label}${q.number}`} fontSize={.45}/>];}).map((c:any,i:number)=>React.cloneElement(c,{key:i}))}
  </symbol>}/>;
 }

 if(p.ref.startsWith('F_'))return <fuse {...common} currentRating={p.value==='MF-R050'?'500mA':'2A'} voltageRating="30V" symbol={twoTerminal([line(-1.4,0,1.4,0),<schematicrect width={1.5} height={.6} strokeColor="#a23232" strokeWidth={.045} isFilled={false}/>],p.value==='MF-R050'?'PTC 0.5A hold':p.value)}/>;
 const half=Math.ceil(pins.length/2),w=p.dim.w,h=p.dim.h;
 // This pinned core ignores schPinSpacing. Explicit symbol ports provide
 // readable pin pitch using supported primitives, without dependency patches.
 const geometry=pins.map((q:any,i:number)=>{const right=p.body==='pogo'||i>=half;const row=p.body==='pogo'?i:right?pins.length-1-i:i;return {q,right,x:(right?1:-1)*(w/2+.6),y:h/2-1-row*1.4};});
 const isConnector=p.kind==='header'||p.body==='pogo';
 const typeLabel=isConnector?(p.body==='pogo'?'6 contacts':`${pins.length}-pin interface`):p.mpn?.includes('ESP32')?'ESP32 DevKit':p.mpn;
 const symbol=<symbol>
  <schematicrect schX={0} schY={0} width={w} height={h} isFilled={false} strokeColor="#a23232" strokeWidth={.04}/>
  <schematictext name="{REFDES}" schX={0} schY={h/2+.6} text={p.short} fontSize={.55}/>
  <schematictext schX={0} schY={h/2+1.3} text={typeLabel??''} fontSize={.48}/>
  {geometry.flatMap(({q,right,x,y}:any)=>[
   <port name={`pin${q.number}`} pinNumber={q.number} direction={right?'right':'left'} schX={x} schY={y}/>,
   <schematicline x1={x} y1={y} x2={right?w/2:-w/2} y2={y} strokeColor="#a23232" strokeWidth={.04}/>,
   <schematictext schX={right?w/2-.4:-w/2+.4} schY={y} anchor={right?'center_right':'center_left'} text={pinText(q.label)} fontSize={.48}/>,
   <schematictext schX={right?w/2+.25:-w/2-.25} schY={y+.35} text={String(q.number)} fontSize={.4}/>
  ]).map((child,i)=>React.cloneElement(child,{key:i}))}
 </symbol>;
 const Tag:any=isConnector?'connector':'chip';
 return <Tag {...common} symbol={symbol}/>;
}
function selector(p:any,pin:any){return `.${p.name} > .pin${pin.number}`;}
function netKey(n:any){return 'N_'+pinText(n.name).replace('router_matrix__','R_').replace('power__','P_');}
const results:any[]=[];const pages:any[]=[];
function frame(svg:string,sheet:any,page:number,total:number){
 const W=2400,H=1697; // A2 landscape aspect, native vector content.
 const body=svg.replace(/^.*?<svg[^>]*>/s,'').replace(/<\/svg>\s*$/,'').replace(/@font-face\s*\{[^}]*\}/g,'').replace(/[ \t]+$/gm,'');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="594mm" height="420mm" viewBox="0 0 ${W} ${H}"><rect width="2400" height="1697" fill="white"/>${Array.from({length:8},(_,i)=>`<text x="${172+i*294}" y="20" text-anchor="middle" font-family="DejaVu Sans" font-size="12">${String.fromCharCode(65+i)}</text>`).join('')}${Array.from({length:5},(_,i)=>`<text x="13" y="${192+i*329}" text-anchor="middle" font-family="DejaVu Sans" font-size="12">${i+1}</text>`).join('')}<rect x="25" y="25" width="2350" height="1647" fill="none" stroke="#20323f" stroke-width="2"/>
 <text x="65" y="80" font-family="DejaVu Sans" font-size="34" fill="#20323f">${xml(sheet.title)}</text><text x="65" y="115" font-family="DejaVu Sans" font-size="16">${xml(sheet.subtitle)}</text>
 <svg x="55" y="145" width="2290" height="1420" viewBox="0 0 2290 1420">${body}</svg>
 <path d="M25 1585H2375 M1500 1585V1672 M2180 1585V1672" stroke="#20323f" fill="none"/><text x="55" y="1617" font-family="DejaVu Sans" font-size="15">POWER red • GND black • NODE blue • ANALOG green • CONTROL ochre • I²C grey/white</text><text x="55" y="1645" font-family="DejaVu Sans" font-size="15">Junction dot = connected. Named pins and flags identify continuations; see net index. Modules show interface pins.</text><text x="1520" y="1620" font-family="DejaVu Sans" font-size="20">TedTronics — electrical schematic</text><text x="1520" y="1647" font-family="DejaVu Sans" font-size="15">Revision8 candidate • circuit consistency checks; hardware qualification pending</text><text x="2200" y="1624" font-family="DejaVu Sans" font-size="22">${page} / ${total}</text><text x="2200" y="1650" font-family="DejaVu Sans" font-size="15">A2 landscape</text></svg>`;
}
async function render(sheet:Sheet,page:number){
 const bounds=place(sheet);const circuit=new Circuit();
 const members=new Map<string,any>();for(const p of sheet.parts)for(const pin of p.pins){const ep=`${p.uid}.${pin.number}`,n=endpointNet.get(ep);if(n){const a=members.get(n.id)??{net:n,points:[]};a.points.push({p,pin,ep});members.set(n.id,a);}}
 const traces:any[]=[];
 for(const {net:n,points} of members.values()){
  const key=netKey(n);const power=/^(GND|12V|[35]V|USB_|BUCK_|SAFE_|PI_3V3)/.test(n.name);
  const panels=new Map<string,any[]>();for(const pt of points){const a=panels.get(pt.p.panel)??[];a.push(pt);panels.set(pt.p.panel,a);}
  for(const local of panels.values()){
   // Power and cross-panel wiring use local flags. Signal connections inside
   // a functional panel use continuous native tscircuit routing.
   if(power){for(const pt of local)traces.push(<trace name={key} from={selector(pt.p,pt.pin)} to={`net.${key}`} schStroke={colors(n.name)}/>);continue;}
   const reached=[local[0]],remaining=local.slice(1);
   while(remaining.length){let best={i:0,from:reached[0],d:Infinity};for(const a of reached)for(const [i,b] of remaining.entries()){const d=Math.abs(a.p.sch[0]-b.p.sch[0])+Math.abs(a.p.sch[1]-b.p.sch[1]);if(d<best.d)best={i,from:a,d};}const to=remaining.splice(best.i,1)[0];reached.push(to);traces.push(<trace name={key} from={selector(best.from.p,best.from.pin)} to={selector(to.p,to.pin)} schStroke={colors(n.name)}/>);}
   const first=local[0];traces.push(<trace name={key} from={selector(first.p,first.pin)} to={`net.${key}`} schStroke={colors(n.name)}/>);
  }
 }
 circuit.add(<board pcbDisabled routingDisabled schRelative schTraceAutoLabelEnabled={true} schMaxTraceDistance={35}><schematicsheet name="Circuit" displayName={sheet.title} sheetWidth={(bounds.width+80)*10} sheetHeight={(bounds.height+80)*10}>
  {sheet.panels!.map(panel=><schematicbox key={panel.title} schX={panel.x+panel.w/2} schY={panel.y-panel.h/2} width={panel.w} height={panel.h} title={panel.title}/>)}
  {sheet.parts.map(p=><Symbol key={p.uid} p={p}/>)}
  {[...members.values()].map(({net:n})=><net key={n.id} name={netKey(n)} isGroundNet={n.name==='GND'} isPowerNet={n.name!=='GND'&&/^(12V|[35]V|USB_|BUCK_|SAFE_|PI_3V3)/.test(n.name)}/>)}
  {traces.map((child,i)=>React.cloneElement(child,{key:`trace${i}`}))}
 </schematicsheet></board>);
 await circuit.renderUntilSettled();const j:any[]=circuit.getCircuitJson();
 const checks={drawing:j.filter(e=>/^(schematic_.*(error|warning)|error)$/.test(e.type)&&e.type!=='schematic_sheet_styling_warning'),source:j.filter(e=>/^source_.*(error|warning)$/.test(e.type)),pins:await runAllPinSpecificationChecks(j),netlist:await runAllNetlistChecks(j),schematic:await runAllSchematicChecks(j)};
 for(const [kind,issues] of Object.entries(checks))required(issues.length===0,'native-check',{sheet:sheet.id,kind,issues});
 const sourceById=new Map(j.filter(e=>e.type==='source_component').map(e=>[e.source_component_id,e.name]));
 const ports=new Map(j.filter(e=>e.type==='source_port').map(e=>[e.source_port_id,e]));
 const sourceNets=new Map(j.filter(e=>e.type==='source_net').map(e=>[e.source_net_id,e.name]));
 // Compare compiled source-trace membership to the expected electrical net.
 for(const trace of j.filter(e=>e.type==='source_trace')){
  const expected=[...members.values()].find(({net:n})=>netKey(n)===trace.name)?.net;
  required(Boolean(expected),'unknown-compiled-net',{sheet:sheet.id,trace:trace.name});
  for(const id of trace.connected_source_port_ids??[]){const port=ports.get(id),p=sheet.parts.find(p=>p.name===sourceById.get(port?.source_component_id));if(!p)continue;
   const pin=p.pins.find((q:any)=>`pin${q.number}`===port.name||(port.pin_number!==undefined&&q.number===port.pin_number));
   required(Boolean(pin)&&endpointNet.get(`${p.uid}.${pin?.number}`)?.id===expected?.id,'compiled-pin-net-mismatch',{sheet:sheet.id,part:p.uid,port:port.name,net:expected?.name});
  }
 }
 // Native solver synthesizes route IDs from port pairs. Net identity comes
 // from its connectivity key, not from that synthetic source_trace_id.
 const compiledPorts=new Set(j.filter(e=>e.type==='source_trace').flatMap(e=>e.connected_source_port_ids??[]));
 const drawnPorts=new Set(j.filter(e=>e.type==='schematic_port').map(e=>e.source_port_id));
 for(const p of sheet.parts)for(const pin of p.pins){
  if(!endpointNet.has(`${p.uid}.${pin.number}`))continue;
  const port=[...ports.values()].find(e=>sourceById.get(e.source_component_id)===p.name&&(e.name===`pin${pin.number}`||e.pin_number===pin.number));
  required(Boolean(port)&&compiledPorts.has(port?.source_port_id)&&drawnPorts.has(port?.source_port_id),'missing-connected-pin',{sheet:sheet.id,part:p.uid,pin:pin.number});
 }
 const netByConnectivity=new Map(j.filter(e=>e.type==='source_trace').map(e=>[e.subcircuit_connectivity_map_key,[...members.values()].find(({net:n})=>netKey(n)===e.name)?.net]));
 for(const e of j){
  if(e.type==='schematic_net_label'){
   const n=[...members.values()].find(({net:n})=>netKey(n)===sourceNets.get(e.source_net_id))?.net;
   if(n){
    e.text=pinText(n.name).replace('router_matrix__','R_').replace('power__','P_');
    // The named pin already identifies this continuation. Hide duplicate
    // flag text beside it, while retaining the compiled net and trace.
    if(!e.symbol_name){
     const nearby=j.filter(q=>q.type==='schematic_port'&&Math.hypot(q.center.x-e.anchor_position.x,q.center.y-e.anchor_position.y)<2.5);
     const duplicate=nearby.some(q=>{const port=ports.get(q.source_port_id),p=sheet.parts.find(p=>p.name===sourceById.get(port?.source_component_id));const pin=p?.pins.find((a:any)=>a.number===port?.pin_number);return pin&&pinText(pin.label)===e.text;});
     if(duplicate){e.documentary_duplicate_label=e.text;e.text='';}
    }
   }
  }
  if(e.type==='schematic_text'&&!e.schematic_component_id&&sheet.panels?.some(p=>p.title===e.text))e.font_size=.65;
 }
 save(`circuits/${sheet.id}.circuit.json`,j);
 let svg=convertCircuitJsonToSchematicSvg(j.filter(e=>e.type!=='schematic_sheet'),{width:2290,height:1420,includeVersion:false,shouldDrawErrors:false,shouldDrawWarnings:false,colorOverrides:{schematic:{background:'#ffffff',wire:'#44545f',component_body:'#ffffff',component_outline:'#a23232',component_name:'#20323f',value:'#20323f',pin:'#a23232'}}});
 // Presentation-only names: original net identifiers remain in circuit JSON.
 for(const {net:n} of members.values())svg=svg.replaceAll(netKey(n),xml(pinText(n.name).replace('router_matrix__','R_').replace('power__','P_')));
 const connectorMpns=sheet.parts.filter(p=>p.kind==='header'||p.body==='pogo'||p.body==='idc').map(p=>xml(p.mpn));
 svg=svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g,t=>connectorMpns.some(m=>m&&t.includes(`>${m}<`))?'':t);
 const colorMap=new Map(j.filter(e=>e.type==='schematic_trace').map(e=>[e.schematic_trace_id,colors(netByConnectivity.get(e.subcircuit_connectivity_map_key)?.name??'Signal')]));
 svg=svg.replace(/<g\b([^>]*data-schematic-trace-id="([^"]+)"[^>]*)>([\s\S]*?)<\/g>/g,(_,attrs,id,body)=>`<g${attrs}>${body.replace(/stroke="[^"]*"/g,`stroke="${colorMap.get(id)??'#44545f'}"`)}</g>`);
 // Keep native wire geometry; enforce the A2 print typography in the export.
 // Pin pitch and label gutters above reserve space for these larger labels.
 svg=svg.replace(/font-size="([0-9.]+)(px)?"/g,(_,n,unit)=>`font-size="${Math.max(11.5,Number(n))}${unit??''}"`);
 svg=svg.replace(/font-family="[^"]*"/g,'font-family="DejaVu Sans"').replaceAll('font-family: sans-serif','font-family: DejaVu Sans');
 const textSizes=[...svg.matchAll(/font-size="([0-9.]+)(?:px)?"/g)].map(m=>Number(m[1]));
 const minPt=Math.min(...textSizes)*594/2400*72/25.4;
 required(minPt>=8,'print-type-too-small',{sheet:sheet.id,minPt});
 const result={sheet:sheet.id,parts:sheet.parts.length,traces:j.filter(e=>e.type==='schematic_trace').length,bounds,minTextPt:minPt,checks};results.push(result);
 save(`assets/${sheet.id}.svg`,frame(svg,sheet,page,16));pages.push({...sheet,parts:sheet.parts.map(p=>p.uid),file:`assets/${sheet.id}.svg`});
 console.log(`${sheet.id}: ${sheet.parts.length} components, ${result.traces} routed traces, ${Object.entries(checks).map(([k,v])=>`${k}:${v.length}`).join(' ')}`);
}

// Overview uses documentary bundle lines, not fictional merged electrical
// nets. Individual signals and physical connector pins are on detail sheets.
async function overview(){
 const circuit=new Circuit();
 const boxes=[{x:0,y:12,w:30,h:16,title:'Terminal contacts',lines:['Contact A + contact B','22 independent NODE nets','Six OLED service interfaces','Grouped NODE + SMART cables','Detail: sheet 2']},{x:0,y:-10,w:30,h:16,title:'Power board',lines:['12 V input and buck modules','Independent 5 V / 3V3 guards','Current trip and fault latch','Protected student supply','Detail: sheet 3']},{x:39,y:-10,w:32,h:16,title:'Routing matrix',lines:['ESP1 and watchdog','Two MT8816 analog matrices','Diagnostic and peripheral I/O','Pi separately powered','Detail: sheet 4']},{x:78,y:9,w:34,h:22,title:'Smart components',lines:['ESP2 + independent watchdog','Voltage sensing in both banks','Six protected P3 / current paths','Six isolated B-side service buses','At most three active capsules','Details: sheets 5–16']}];
 const children:any[]=boxes.flatMap(b=>[<schematicbox schX={b.x} schY={b.y} width={b.w} height={b.h}/>,<schematictext schX={b.x-b.w/2+1} schY={b.y+b.h/2-1} anchor="left" text={b.title} fontSize={1.1}/>,...b.lines.map((line,i)=><schematictext schX={b.x} schY={b.y+b.h/2-3-i*2} text={line} fontSize={.75}/>)]);
 const line=(points:any[],label:string,x:number,y:number,color:string)=>{children.push(<schematicpath points={points.map(([x,y])=>({x,y}))} strokeColor={color} strokeWidth={.12}/>,<schematictext schX={x} schY={y} text={label} fontSize={.65}/>);};
 line([[15,16],[20,16],[20,-3],[23,-3]],'22 NODEs · six 4-pin cables',34,3,'#1976b4');
 line([[15,6],[18,6],[18,27],[78,27],[78,20]],'P1/P2/P3 + six independent service buses',52,29,'#1976b4');
 line([[15,-10],[23,-10]],'10-pin power/control',20,-7,'#c62d32');
 line([[-10,-2],[-10,4]],'GND / 3V3',-7,1,'#c62d32');
 line([[10,-18],[10,-24],[90,-24],[90,-2]],'5V_SYS · 3V3_SYS · GND · EDU_ON → smart power',50,-27,'#c62d32');
 line([[55,-10],[61,-10],[61,0]],'NODE taps / diagnostic fixture',67,-14,'#1976b4');
 children.push(<schematictext schX={40} schY={-33} text="Bundle lines contain separate conductors. Exact pins and nets are shown on detailed sheets." fontSize={.65}/>);
 circuit.add(<board pcbDisabled routingDisabled schRelative><schematicsheet name="Overview" displayName="Overall system" sheetWidth={1800} sheetHeight={1200}>{children.map((c,i)=>React.cloneElement(c,{key:i}))}</schematicsheet></board>);
 await circuit.renderUntilSettled();const j=circuit.getCircuitJson();save('circuits/01-overview.circuit.json',j);
 let svg=convertCircuitJsonToSchematicSvg(j.filter(e=>e.type!=='schematic_sheet'),{width:2290,height:1420,includeVersion:false,colorOverrides:{schematic:{background:'#ffffff'}}});
 const s={id:'01-overview',title:'Complete system — overview',subtitle:'Four functional sections • explicit interfaces • detailed circuits on sheets 2–16'};
 svg=svg.replace(/font-family="[^"]*"/g,'font-family="DejaVu Sans"').replaceAll('font-family: sans-serif','font-family: DejaVu Sans');
 save('assets/01-overview.svg',frame(svg,s,1,16));pages.unshift({...s,file:'assets/01-overview.svg',parts:[]});
}
await overview();for(const [i,sheet] of sheets.entries())await render(sheet,i+2);
const netIndex=globalNets.map(n=>({net:n.name,drawingLabel:pinText(n.name).replace('router_matrix__','R_').replace('power__','P_'),sheets:[...new Set(n.members.map((ep:string)=>coverage.get(ep.slice(0,ep.lastIndexOf('.')))).filter(Boolean))],pins:n.members.filter((ep:string)=>index.has(ep.slice(0,ep.lastIndexOf('.'))))}));
 required(new Set(netIndex.map(n=>n.drawingLabel)).size===globalNets.length,'ambiguous-display-net',{});
 save('net-index.json',netIndex);
 save('net-index.csv','Net,Drawing label,Sheets,Pins\n'+netIndex.map(n=>[n.net,n.drawingLabel,n.sheets.join(' | '),n.pins.join(' | ')].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n');
 save('checks.json',{status:errors.length?'fail':'pass',errors,native:results,coverage:{expected:parts.length,represented:coverage.size,excluded},waivers:[{type:'schematic_sheet_styling_warning',reason:'A2 vector export is explicitly requested; native sheet extents are normalized to the custom A2 frame, rather than using the suggested A4 styling.'}],hardwareStatus:'pending',scope:'Schematic-only connectivity and placement; PCB checks do not apply.'});
save('manifest.json',{revision:model.revision,pages:pages.map(({panels,...page})=>page),componentCount:parts.length,netCount:globalNets.length,harnessCount:harnesses.length});
save('reconciliation.md',`# Smart circuit reconciliation\n\nSource: \`eletronics/SCH_TedTronics_2026-10-04(6).json\` (SHA256 ${hash(easyText)}). EasyEDA symbol/pin/wire geometry is preserved in easyeda-source.json. Revision8/lower/design.json is the integrated electrical authority.\n\n| Earlier EasyEDA function | Integrated circuit |\n|---|---|\n| ESP32 on J1/J2 | ESP2, final revision5/6/8 GPIO contract; physical pin labels retained |\n| U1/U3 74HCT125 P3 buffers | Independent active source/sink clamps and default-off PhotoMOS isolation at all six positions |\n| U4/U5 74HCT595 | Three SN74HCT595 registers with HIGH/LOW/AMMETER bits for six positions |\n| Shared SCL and six SDA lines | Shared controller-side SCL_A and six separate TCA9517 buffered B-side buses |\n| U6/U7 74HCT4051 before dividers | Buffered voltage inputs, two bank selectors and ADS1115 interfaces |\n| U2 INA219 on one position | INA226 module interfaces, external 1-ohm Kelvin shunts and isolated current paths at every position |\n| Firmware-only shutdown assumptions | Independent smart watchdog, rail-qualified register OE and default-off drivers |\n\nAll 22 NODEs remain independent. Terminal labels NODE1–NODE11 are bank-local display numbers; original NODE00–NODE21 identities remain in the electrical source. Capsule electronics are passive OLED/service interfaces; smart controllers and sensing live on the base side. Pi supply stays separate.\n\nConstruction ground-bar geometry and synthetic boundary posts are omitted as symbols; their electrical membership is retained. Existing physical diagnostic/prototype headers remain as unused final-board interfaces; no temporary USB bridge or fixed-source cable is added. Physical board boundaries are documentation, not a new PCB partition.\n\nThe legacy EasyEDA geometry extraction records ${easySheets.reduce((sum:any,s:any)=>sum+s.counts.symbols,0)} symbols and ${easySheets.reduce((sum:any,s:any)=>sum+s.counts.pins,0)} pins. It joins wire vertices, pin anchors and matching named flags, while preserving unmarked interior crossings. This graph documents the legacy source; it is not substituted for the later protected circuit.\n\nNo historical source or hardware pin assignment is modified. The exact source-to-drawing reference and connector mappings are in reference-crosswalk.json and harnesses.json. Generated results do not establish hardware performance.\n`);
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Complete system schematic</title><style>body{font:16px system-ui;color:#20323f;background:#eef2f5;margin:0}header{padding:1.5rem;position:sticky;top:0;background:#fff;border-bottom:1px solid #ccd5dc}main{max-width:1600px;margin:auto;padding:1rem}article{background:white;padding:1rem;margin:1rem 0;border:1px solid #ccd5dc}object{width:100%;aspect-ratio:594/420;height:auto;display:block}a{color:#165e92;margin-right:1rem}nav{display:flex;gap:.5rem;flex-wrap:wrap}nav a{font-size:13px}h2{margin:.5rem 0}</style><header><h1>Complete system schematic</h1><p><a href="overall-schematic.pdf" target="_blank">Open complete PDF ↗</a><a href="schematic/reconciliation.md">Source reconciliation</a><a href="schematic/checks.json">Check results</a><a href="schematic/net-index.csv">Net and sheet index</a><a href="schematic/reference-crosswalk.json">Pin/reference crosswalk</a></p><nav>${pages.map((p,i)=>`<a href="#${p.id}">${i+1}. ${xml(p.title)}</a>`).join('')}</nav></header><main>${pages.map((p,i)=>`<article id="${p.id}"><h2>${i+1}. ${xml(p.title)}</h2><a href="schematic/${p.file}" target="_blank" rel="noopener">Open SVG ↗</a><object data="schematic/${p.file}" type="image/svg+xml" aria-label="${xml(p.title)}"></object></article>`).join('')}</main></html>`;
writeFileSync(`${root}/overall-schematic.html`,html);
save('overall.typ',`#set page(width: 594mm, height: 420mm, margin: 0mm)\n#for file in (${pages.map(p=>JSON.stringify(p.file)).join(',')},) {\n image(file, width: 594mm, height: 420mm)\n pagebreak(weak: true)\n}\n`);
const pdf=spawnSync('typst',['compile','--root',root,`${out}/overall.typ`,`${root}/overall-schematic.pdf`],{stdio:'inherit'});
if(pdf.status!==0)process.exit(pdf.status??1);
if(errors.length){console.error(`${errors.length} integration errors; see ${out}/checks.json`);process.exit(1);}
console.log(`${root}/overall-schematic.pdf: ${pages.length} vector sheets, ${parts.length} components`);
