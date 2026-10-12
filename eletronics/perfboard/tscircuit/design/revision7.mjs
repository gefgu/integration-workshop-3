// Four permanent perfboards. Smart layouts below are electrical reference
// contracts, not manufactured PCB layouts or additional permanent perfboards.
import {boards as baseline, checkpoints as prior, externalInterfaces} from './revision5.mjs';
import {place} from './place7.mjs';
import {finish, net, pinAt} from './model7.mjs';
import {addTestAids} from './testaids7.mjs';
import {applyLinks} from './links7.mjs';

export {externalInterfaces};
export {baseline};
export const revision='r7-testable-perfboards';
export const stock={width:200,height:100,cols:78,rows:38,pitch:2.54,verified:false,
  description:'10×20 cm isolated-pad perfboard; substrate, grid, thickness and plating must be measured'};
export const release={status:'EVALUATION CANDIDATE — NOT RELEASED FOR SOLDERING',pending:[
  'Exact 10×20 cm usable grid, isolated pads, thickness and contact fit',
  'Measured component, socket, adapter, converter and connector envelopes',
  'Enclosure and removable-tray clearance, extraction and wiring access',
  'Smart PCB placement, routing, manufacturing review and component availability',
  'Supply guard transients, output limits, watchdog, partial-power leakage and measurement qualification',
  'Checkpoint-compatible firmware and measured acceptance on final hardware']};
const byOld=Object.fromEntries(baseline.map(b=>[b.id,b]));
export const permanentIds=['contact-a','contact-b','power','router-matrix'];
const powerIds=['power-input','power-guards','power-analog','power-interlock'];
const routerIds=['router-core','router-safety','matrix-switches','matrix-control','integration'];
const smartIds=baseline.filter(b=>!permanentIds.includes(b.id)&&!powerIds.includes(b.id)&&!routerIds.includes(b.id)&&! /^[ab][123]$/.test(b.id)).map(b=>b.id);
export const mapping=[];
const qualified=(source,ref)=>ref.replace(/^([A-Z]+)_/,`$1_${source.replaceAll('-','_').toUpperCase()}_`);
function clonePart(source,p){
  const q=structuredClone(p);q.sourceBoard=source;q.sourceRef=p.ref;
  q.ref=qualified(source,p.ref);q.function=`${source}: ${p.function??p.section}`;
  q.signals=Object.fromEntries(byOld[source].nets.flatMap(n=>n.pins.filter(ep=>ep.startsWith(`${p.ref}.`)).map(ep=>[ep.split('.')[1],n.name])));
  q.section=q.function;delete q.sch;q.locked=false;
  mapping.push({fromBoard:source,fromRef:p.ref,toRef:q.ref});return q;
}
function collect(b){
  b.nets=[];
  for(const p of b.parts)for(const [label,name] of Object.entries(p.signals??{}))net(b,name,[[p.ref,label]],{bare:name.startsWith('NODE')&&b.kind==='contact'});
  return finish(b);
}
function base(id,title,kind){return {...stock,id,title,kind,parts:[],nets:[],wires:[],notes:[],sections:[],
  mounts:[[2,6],[77,6],[2,32],[77,32]],distributionChain:true,release:release.status};}
function sections(b){b.sections=[...new Set(b.parts.map(p=>p.section))].map(name=>({name,label:name}));}
function contacts(bank){
  const b=base(`contact-${bank}`,`Bank ${bank.toUpperCase()} — continuous contact network`,'contact');
  // Reserve edge mounting positions outside both banks' header rows. Adding
  // mounting holes at row32 would collide with bank A's underside plugs.
  b.mounts=[[2,1],[77,1],[2,38],[77,38]];
  for(let i=0;i<3;i++)for(const p of byOld[`${bank}${i+1}`].parts.filter(p=>p.body!=='terminal')){
    const q=clonePart(`${bank}${i+1}`,p);q.pins=q.pins.map(pin=>({...pin,hole:[pin.hole[0]+28*i,pin.hole[1]]}));
    q.bounds={...p.bounds,xmin:p.bounds.xmin+28*i,xmax:p.bounds.xmax+28*i};q.locked=true;b.parts.push(q);
  }
  b.notes=['11 node columns: 177.80 mm first-to-last span; rows span 50.80 mm.',
    'Continuous provisional grid, not the former 212 mm three-board envelope.',
    'Same capsule orientation in both banks; retain service polarity and bank-B row direction.',
    'Only node-column straps are bare. Support contact insertion forces with an independent frame.',
    'Existing raw/service headers retained for compatibility; actual plug envelopes and access pending.'];
  sections(b);return collect(b);
}
function merged(id,title,sources){
  const b=base(id,title,'perfboard');
  b.parts=sources.flatMap(source=>byOld[source].parts.filter(p=>p.body!=='terminal').map(p=>clonePart(source,p)));
  // Reserve the large socket/header envelopes before the small passives;
  // inserting the Pi header last would create a false packing failure.
  applyLinks(b); // revision 7: removable links that split the board into testable halves
  const area=p=>(p.bounds.xmax-p.bounds.xmin)*(p.bounds.ymax-p.bounds.ymin);
  b.parts.sort((a,c)=>area(c)-area(a)||a.sourceBoard.localeCompare(c.sourceBoard));
  sections(b);b.mounts=[[2,2],[77,2],[2,37],[77,37]];
  // Pack complete functional zones with the existing placement engine. This
  // keeps the analogue feedback and watchdog RC next to their own devices.
  const zones=id==='power'?[
    {sources:['power-input','power-guards'],cols:38,rows:38,dx:0,dy:0},
    {sources:['power-analog','power-interlock'],cols:38,rows:38,dx:40,dy:0}]:[
    {sources:['router-core','router-safety'],cols:32,rows:38,dx:0,dy:0},
    {sources:['matrix-switches','matrix-control','integration'],cols:44,rows:38,dx:34,dy:0}];
  b.zones=zones;
  for(const zone of zones){
    const local={...b,cols:zone.cols,rows:zone.rows,parts:b.parts.filter(p=>zone.sources.includes(p.sourceBoard)),mounts:[],nets:[],wires:[]};
    place(local);
    for(const p of local.parts){
      p.pins=p.pins.map(pin=>({...pin,hole:[pin.hole[0]+zone.dx,pin.hole[1]+zone.dy]}));
      p.bounds={xmin:p.bounds.xmin+zone.dx,xmax:p.bounds.xmax+zone.dx,ymin:p.bounds.ymin+zone.dy,ymax:p.bounds.ymax+zone.dy};
    }
  }
  // Revision 7: the big supply rails of the two lower boards use bare bus bars (see model7.mjs).
  // Set after zone packing so the per-zone trial boards above stay plain.
  addTestAids(b);
  b.buses=true;
  return collect(b);
}
const contactBoards=[contacts('a'),contacts('b')];
const power=merged('power','Power — input, guards, student cutoff and interlock',powerIds);
power.notes=['All four power functional groups are consolidated; no protection is omitted.',
  'Buck bodies are external mounted modules and count in the tray space budget.',
  'Placement is provisional pad/body geometry; converter adjustment and module replacement need measured access.'];
const router=merged('router-matrix','Router — ESP1, watchdog, matrices and Pi interfaces',routerIds);
router.notes=['Both MT8816 DIP40s and all router/watchdog/control circuitry retained.',
  'USB, matrix bank connectors and peripheral connections require accessible cable exits.',
  'Pi uses a separate supply; common ground only. Keep USB_ROUTER_3V3 distinct.'];
const smart=smartIds.map(id=>{
  const b=structuredClone(byOld[id]);b.kind='pcb-contract';b.release=release.status;
  b.title=`SMART PCB CONTRACT / ${b.title}`;b.notes.unshift('Logical revision-5 reference layout only. Not an additional perfboard or a manufacturable PCB.');
  b.parts=b.parts.filter(p=>p.body!=='terminal');
  for(const p of b.parts){p.sourceBoard=id;p.sourceRef=p.ref;mapping.push({fromBoard:id,fromRef:p.ref,toRef:p.ref});}
  return collect(b);
});
export const boards=[...contactBoards,power,router,...smart];
const boardMap=Object.fromEntries(boards.map(b=>[b.id,b]));
for(const entry of mapping)entry.toBoard=boards.find(b=>b.parts.some(p=>p.sourceBoard===entry.fromBoard&&p.sourceRef===entry.fromRef)).id;
export const cables=[];
// Reserve stable, one-pin labelled boundary posts, one per net and assembly.
// Removed r5 distribution posts represented internal seams, not components.
const owners=new Map();
for(const b of boards)for(const n of b.nets){const list=owners.get(n.name)??[];list.push(b);owners.set(n.name,list);}
for(const [name,list] of owners){
  if(list.length<2)continue;
  const ends=list.map(b=>{
    const n=b.nets.find(n=>n.name===name),phase=Math.min(...n.pins.map(ep=>pinAt(b,ep).part.phase));
    let ep=n.pins.find(ep=>{const p=pinAt(b,ep).part;return p.kind==='header'&&!p.externalPart&&p.phase===phase;});
    if(!ep){
      const used=new Set(b.parts.flatMap(p=>p.pins.map(pin=>pin.hole.join(','))));
      const candidates=[];
      for(let row=4;row<=b.rows-3;row++)for(const col of [1,b.cols])candidates.push([col,row]);
      const hole=candidates.find(h=>!used.has(h.join(','))&&!b.mounts.some(m=>Math.hypot(m[0]-h[0],m[1]-h[1])<1.5));
      if(!hole)throw Error(`${b.id}: no boundary terminal for ${name}`);
      const ref=`J_BOUNDARY_${b.parts.filter(p=>p.body==='terminal').length+1}`;
      b.parts.push({ref,label:`Boundary: ${name}`,kind:'header',body:'terminal',side:'top',phase,
        mpn:'TSW-101-07-G-S',provisional:true,locked:true,function:'Boundary',section:'Boundary',
        signals:{1:name},pins:[{number:1,label:name,hole}],bounds:{xmin:hole[0]-.45,xmax:hole[0]+.45,ymin:hole[1]-.45,ymax:hole[1]+.45}});
      ep=`${ref}.1`;n.pins.push(ep);
    }
    return {board:b.id,endpoint:ep,phase:name.startsWith('NODE')&&b.id==='measurement-a-precision'?Math.max(6,phase):phase};
  }).sort((a,b)=>a.phase-b.phase||a.board.localeCompare(b.board));
  for(let i=1;i<ends.length;i++)cables.push({id:`H${cables.length+1}`,net:name,
    from:ends[i-1].board,fromPin:ends[i-1].endpoint,to:ends[i].board,toPin:ends[i].endpoint,
    phase:Math.max(ends[i-1].phase,ends[i].phase),description:`Detachable ${name} harness; inspect actual endpoint polarity and power domain.`});
}
for(const b of boards){
  for(const n of b.nets.filter(n=>/^P\d_SHUNT_[PN]$/.test(n.name))){const shunt=b.parts.find(p=>p.origin==='R_SHUNT');n.starRoot=n.pins.find(ep=>ep.startsWith(`${shunt.ref}.`));}
  sections(b);finish(b);
}
export const checkpoints=prior.map(cp=>{
  const c=structuredClone(cp);c.hardwareRevision=revision;
  c.install=boards.flatMap(b=>b.parts.filter(p=>p.phase===c.phase).map(p=>({board:b.id,ref:p.ref,reason:p.label})));
  c.wires=boards.flatMap(b=>b.wires.filter(w=>w.phase===c.phase).map(w=>({board:b.id,...w})));
  c.harnesses=cables.filter(h=>h.phase===c.phase);
  // Human-facing baseline instructions retain component identities via crosswalk;
  // these aren't blindly rewritten with ambiguous board-name substitutions.
  c.links.unshift('Use revision7 endpoint tables and baseline-crosswalk.csv for relocated references. Legacy hole coordinates do not apply.');
  c.firmware+='; r6 preserves GPIO/net protocol; use new physical endpoint crosswalk';
  c.prototypeEvidenceTransfers=false;return c;
});
export const evaluation={permanentIds,smartReferenceIds:smartIds,lowerBoardLimit:2,
  tray:'Removable; harnesses detachable; no desoldering for extraction',
  contactGeometry:{columnsPerBank:11,columnPitchMm:17.78,rowPitchMm:10.16,columnSpanMm:177.8,rowSpanMm:50.8},
  mechanicalStatus:'pending',electricalStatus:'pending',manufacturingStatus:'pending',
  exclusions:['Smart reference layouts are not PCB designs or Gerbers','Buck bodies and smart PCB bodies require measured tray/enclosure allocation'],
  fitFailurePolicy:'Fail the four-perfboard arrangement; report minimum PCB consolidation; do not add a lower board',
  boardMap:Object.keys(boardMap)};

// Full prototype is evaluated independently and is never counted as a fifth
// permanent board. A failed small-board packing is reported, never hidden.
const prototypeSources=['smart-core','smart-safety','measurement-a-precision','bank-a-position-0'];
export const prototype={id:'smart-reference',width:70,height:100,cols:26,rows:38,
  stages:[['CP04–05','Display and OFF identity'],['CP01–03','Precision continuity, fixed jumper'],['CP06–08','Voltage calibration and signed voltage'],['CP15–23','Bounded outputs, pulse/gates/memory and current']],
  parts:prototypeSources.flatMap(id=>byOld[id].parts.filter(p=>p.body!=='terminal').map(p=>({...structuredClone(p),sourceBoard:id,sourceRef:p.ref}))),
  status:'pending',firmware:'Standalone test ownership must use an explicit jumper profile; final ESP1/ESP2 ownership remains unchanged.',
  evidence:'Repeat tests on final smart PCB; no automatic transfer of acceptance'};
// Include the actual LED driver support required by the one-position output
// circuits; the general voltage buffers for positions 1/2 are not included.
prototype.parts.push(...byOld['measurement-a-buffers'].parts.filter(p=>p.origin?.startsWith('U_A_LED_DRIVER')).map(p=>({...structuredClone(p),sourceBoard:'measurement-a-buffers',sourceRef:p.ref})));
try {
  const candidate={...prototype,id:'smart-reference',parts:prototype.parts.map(p=>({...p,ref:qualified(p.sourceBoard,p.ref),locked:false,section:'Prototype'})),
    sections:[{name:'Prototype',label:'Single-position reference'}],mounts:[[2,2],[25,2]],nets:[],wires:[]};
  place(candidate);prototype.status='provisional-pad-fit';prototype.placement=candidate;
}catch(error){prototype.status='full-7x10-layout-failed';prototype.fitFinding=String(error.message);prototype.placement=null;}
const earlyParts=[
  ...byOld['smart-core'].parts.filter(p=>['U_ESP2','R_SCL_A','R_SDA_0'].includes(p.ref)),
  ...byOld['measurement-a-precision'].parts.filter(p=>p.body!=='terminal'&&!['U_A_MUX','C_A_MUX','R_A_SEL_A','R_A_SEL_B','D_STIM','R_STIM','K_STIM','R_LED','R_OFF','Q_STIM','J_DIAGNOSTIC','JP_RETURN'].includes(p.ref)),
];
try{
  const early={...stock,width:70,height:100,cols:26,rows:38,id:'smart-early',title:'Temporary smart reference — display / precision diagnostics / voltage',kind:'temporary',
    parts:earlyParts.map(p=>({...structuredClone(p),locked:false,section:'Early prototype'})),sections:[{name:'Early prototype',label:'Early prototype'}],mounts:[],nets:[],wires:[]};
  const adc=early.parts.find(p=>p.ref==='J_A_ADC_MODULE');adc.signals.AIN0='P0_1_MUX';adc.signals.AIN1='P0_2_MUX';
  // Explicit standalone profile: no mux and no isolated multi-position bus.
  // This measures one precision channel, not final scanner/bus performance.
  const mcu=early.parts.find(p=>p.ref==='U_ESP2');mcu.phase=0;
  mcu.signals.IO4='SDA_POSITION_0';mcu.signals.IO22='SCL_POSITION_0';mcu.signals.IO26='FIX_STIM';
  for(const p of early.parts.filter(p=>['R_SCL_A','R_SDA_0'].includes(p.ref))){p.phase=0;p.signals=Object.fromEntries(Object.entries(p.signals).map(([pin,n])=>[pin,n==='SCL_A'?'SCL_POSITION_0':n==='SDA_0'?'SDA_POSITION_0':n]));}
  early.notes=['Standalone GPIO4 SDA, GPIO22 SCL, GPIO26 stimulus. No matrix, no multi-position mux and no isolated service buffer.',
    'One removable USB_SMART_3V3 to 3V3_SYS link; disconnect before external supply. Power external OLED/ADC only from verified 3.3V.',
    'Pull-ups terminate in the same linked 3.3V domain. No final-bank timing, presence-isolation or partial-power qualification claimed.',
    'Keep student source OFF for diagnostics. Remove JP_RETURN/test probes before voltage operation.',
    'Late output/current circuits require an external temporary fixture or final smart PCB; full 7×10 packing failed.'];
  early.parts.sort((a,b)=>(b.bounds.xmax-b.bounds.xmin)*(b.bounds.ymax-b.bounds.ymin)-(a.bounds.xmax-a.bounds.xmin)*(a.bounds.ymax-a.bounds.ymin));
  place(early);prototype.earlyPlacement=early;prototype.earlyStatus='provisional-pad-fit';
}catch(error){prototype.earlyPlacement=null;prototype.earlyStatus='7x10-early-layout-failed';prototype.earlyFinding=String(error.message);}
