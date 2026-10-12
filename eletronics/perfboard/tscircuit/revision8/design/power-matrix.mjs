// Independent revision8 proposal. Historical descriptors are read, never edited.
import {readFileSync} from 'node:fs';
import {finish, pinAt, flagSleeves} from '../../design/model7.mjs';
import {boards as contacts} from './revision8.mjs';
import {designate} from '../../design/testaids7.mjs';
import {reservePadCorridors} from './hand-wire-paths.mjs';
import {placeLowerBoard} from './place-lower.mjs';
export const baseline = JSON.parse(readFileSync(new URL('../../revision7/design.json', import.meta.url)));
export const revision = 'r8-simplified-lower-boards';
export const stock = baseline.stock;
export const release = {...baseline.release, status:'EVALUATION CANDIDATE — NOT RELEASED FOR SOLDERING'};
export const changes = [];
export const boards = structuredClone(baseline.boards);
for(const c of contacts) boards.splice(boards.findIndex(b=>b.id===c.id),1,structuredClone(c));
export const lowerBoards=boards.filter(b=>['power','router-matrix'].includes(b.id));
const get=(b,ref)=>{const p=b.parts.find(p=>p.ref===ref);if(!p)throw Error(`${b.id}/${ref}`);return p;};
const remove=(b,refs,reason)=>{const names=new Set(refs);for(const p of b.parts.filter(p=>names.has(p.ref)))changes.push({board:b.id,ref:p.ref,action:'remove',reason,phase:p.phase});b.parts=b.parts.filter(p=>!names.has(p.ref));};
const power=lowerBoards[0],router=lowerBoards[1];
const ledColors={
 'LED_POWER_INTERLOCK_BATTERY':'red',
 'LED_5VSYS':'red',
 'LED_3V3SYS':'red',
 'LED_NOTFAULT':'red',
 'LED_USBROUTER3V3':'red',
 'LED_ROUTERALIVE':'red',
};
for(const b of lowerBoards){
 b.parts=b.parts.filter(p=>!p.virtual);
 for(const p of b.parts)if(p.kind==='led'&&ledColors[p.ref])p.ledColor=ledColors[p.ref];
 for(const p of b.parts)p.signals=Object.fromEntries(Object.entries(p.signals??{}).map(([key,name])=>{const pin=p.pins.find(q=>String(q.number)===key||q.label===key);if(!pin)throw Error(`${p.ref}/${key}`);return [pin.number,name];}));
 delete b._bars;delete b._barsDone;b.nets=[];b.wires=[];
 b.parts=b.parts.filter(p=>!Object.values(p.signals??{}).some(n=>n.startsWith('LEDA_'))||p.body!=='terminal');
 for(const p of b.parts)for(const [number,name] of Object.entries(p.signals??{}))if(name.startsWith('LEDA_'))p.signals[number]=`${b.id.replaceAll('-','_')}__${name}`;
 b.notes=[...b.notes,'Independent revision8 model. Local LED nets never leave this board; two lower boards only.'];
}
for(const [b,names] of [[power,['12VFUSED','BUCK5V','BUCK3V3']],[router,['5VSYS','12VSYS']]])remove(b,names.flatMap(n=>[`LED_${n}`,`R_LED_${n}`]),'Optional indicator replaced by existing test pad');
remove(power,['J_POWER_INTERLOCK_FIXED_BATTERY'],'Staged fixed-battery patch interface is a temporary test fixture, not part of the complete matrix-controlled board');
remove(power,['J_PROBE'],'Removed from the power board at the user choice: duplicate buck-output access is available at the converters, and enable/fault control signals have no dedicated indicators.');
const permanentRouterLinks=['JP_R7_EN','JP_R7_RST','JP_R7_STBA','JP_R7_STBB'];
for(const ref of permanentRouterLinks){
 const jumper=get(router,ref),{net,farNet}=jumper.link;
 for(const part of router.parts)for(const [pin,signal] of Object.entries(part.signals??{}))if(signal===farNet)part.signals[pin]=net;
}
remove(router,permanentRouterLinks,'Replace bring-up isolation jumper with a permanent wire path required for normal enable, reset and matrix strobe operation');
// The final design has no removable consumer or safety links. Join each former
// split net in the board wiring, then remove the 2-pin jumper header itself.
for(const [ref,splitNet,systemNet] of [
 ['JP_POWER_INPUT_LOGIC','SAFE_5V','5V_SYS'],
 ['JP_POWER_INPUT_3V3','SAFE_3V3','3V3_SYS'],
]){
 for(const part of power.parts)for(const [pin,signal] of Object.entries(part.signals??{}))if(signal===splitNet)part.signals[pin]=systemNet;
 remove(power,[ref],'Replace removable consumer-rail jumper with permanent wire connection');
}
const permanentPowerLinks=['JP_R7_PASS','JP_R7_ENABLE','JP_R7_ALIVE'];
for(const ref of permanentPowerLinks){
 const jumper=get(power,ref),{net,farNet}=jumper.link;
 for(const part of power.parts)for(const [pin,signal] of Object.entries(part.signals??{}))if(signal===farNet)part.signals[pin]=net;
}
remove(power,permanentPowerLinks,'Replace safety bring-up jumper with permanent wire connection for normal operation');
remove(router,['C_INTEGRATION_ENERGIZE','C_INTEGRATION_BACK'],'Firmware must debounce for 20ms, release before rearming, and suppress held-at-boot presses');
// MCP130 pull-up resistance is specified only typically. Keep the external pull-ups
// until rise-time / capacitive loading and wired-OR fault behavior are measured.
export const pullupReview={decision:'retain',parts:['R_POWER_ANALOG_PRESET','R_ROUTER_SAFETY_USB_POR'],reason:'Power supervisor changed to MCP120: external pull-up required. Router MCP130 internal 5k is typical only; retain external pull-up pending rise-time measurement.'};
// The LTC4365 guarantees FAULT low at 500uA. MCP130's internal 5k in
// parallel with the external 10k would demand about 1mA. Use the pin-compatible
// MCP120 (open drain, no internal pull-up) for the wired-OR power fault line.
const powerPOR=get(power,'U_POWER_INTERLOCK_POR');
powerPOR.mpn='MCP120-300DI/TO';powerPOR.label=powerPOR.mpn;
changes.push({board:'power',ref:powerPOR.ref,action:'replace',phase:11,reason:'MCP120 removes internal pull-up from shared FAULT line; external 10k keeps sink demand below LTC4365 500uA specification'});
const logic=get(power,'U_POWER_INTERLOCK_ALLOW');
logic.ref='U_POWER_INTERLOCK_LOGIC';logic.sourceRef=logic.ref;logic.origin='U_INTERLOCK_LOGIC';
logic.mpn='SN74HC10N';logic.label='SN74HC10N';logic.socket=true;
const labels=['A1','B1','A2','B2','C2','Y2','GND','Y3','A3','B3','C3','Y1','C1','VCC'];
logic.pins=logic.pins.map((p,i)=>({...p,label:labels[i]}));
logic.signals={1:'EDU_PWR_EN',2:'NOT_FAULT',3:'power__ALLOW_N',4:'power__ALLOW_N',5:'power__ALLOW_N',6:'ALLOW_RAIL',7:'GND',8:'CLEAR_N',9:'EDU_FAULT_RESET',10:'PRESET_N',11:'PRESET_N',12:'power__ALLOW_N',13:'ROUTER_ALIVE',14:'3V3_SYS'};
logic.function='power-interlock: Latch';
const allowTestPoint=power.testPoints.find(t=>t.ref==='TP_ALLOW_RAIL');
if(allowTestPoint){const outputPin=logic.pins.find(p=>p.number===6);allowTestPoint.endpoint=`${logic.ref}.6`;allowTestPoint.hole=outputPin.hole;}
remove(power,['U_POWER_INTERLOCK_RESET','C_POWER_INTERLOCK_RESET'],'HC10 combines reset NAND and three-input rail enable');
const logicCap=get(power,'C_POWER_INTERLOCK_ALLOW');logicCap.ref='C_POWER_INTERLOCK_LOGIC';logicCap.sourceRef=logicCap.ref;
changes.push({board:'power',ref:logic.ref,action:'replace',reason:'One SN74HC10N replaces HC08 and HC00; HC74 latch retained',phase:11});
for(const link of power.parts.filter(p=>p.link))link.link.purpose=link.link.purpose.replace('AND gate','NAND interlock').replace('interlock logic','NAND interlock logic');
// Preserve nominal thresholds closely using a shared 0.1% three-resistor ladder.
export const ladders=[{rail:'5V',values:[91400,1350,10000],strings:['91.4k','1.35k','10k']},{rail:'3V3',values:[57600,2020,10100],strings:['57.6k','2.02k','10.1k']}];
for(const l of ladders){
 const template=get(power,`R_POWER_GUARDS_OV_${l.rail}_TOP`);
 remove(power,[`R_POWER_GUARDS_OV_${l.rail}_TOP`,`R_POWER_GUARDS_OV_${l.rail}_BOTTOM`,`R_POWER_GUARDS_UV_${l.rail}_TOP`,`R_POWER_GUARDS_UV_${l.rail}_BOTTOM`],'Replace four divider resistors with three-resistor UV/OV ladder');
 const nets=[`BUCK_${l.rail}`,`UV_${l.rail}`,`OV_${l.rail}`,'GND'];
 l.refs=[];
 for(let i=0;i<3;i++){
  const ref=`R_POWER_GUARDS_LADDER_${l.rail}_${['TOP','MID','BOTTOM'][i]}`;l.refs.push(ref);
  const value=l.strings[i],code=value.toUpperCase().replace(/^(\d+)\.(\d+)([KM])$/,'$1$3$2');
  power.parts.push({...structuredClone(template),ref,sourceRef:ref,origin:ref,value,label:`${value} ±0.1%`,mpn:`PTF56${code.padEnd(6,'0')}BZEK`,tolerance:.001,signals:{1:nets[i],2:nets[i+1]}});
 }
}
// Six explicit receiving connectors, matching the contact-board 4/4/3 bundles.
const replacedEndpoints=new Map();
// Install the new passive receiving interface with ESP1 at CP00; future power
// pins remain unpowered until CP09 qualification. This avoids permanent probe leads.
const primary=get(router,'J_ROUTER_CORE_POWER');
remove(router,[primary.ref],'Replace with permanent CP00 power/control receiving header');
primary.ref='J_ROUTER_POWER_CONTROL';primary.sourceRef=primary.ref;primary.phase=0;primary.origin='J_POWER_CONTROL';
router.parts.push(primary);
for(const pin of primary.pins)replacedEndpoints.set(`router-matrix/J_ROUTER_CORE_POWER.${pin.number}`,`${primary.ref}.${pin.number}`);
changes.push({board:router.id,ref:primary.ref,action:'add',phase:0,reason:'Passive 10-pin interface installed at CP00; final external supplies connect only after qualification'});

for(const c of contacts){
 const headers=c.parts.filter(p=>p.origin==='J_NODE_BUNDLE');
 for(const [index,h] of headers.entries()){
  const ref=`J_MATRIX_NODE_${c.id==='contact-a'?'A':'B'}_${index+1}`;
  const pins=h.pins.map(p=>({...p,hole:[4+p.number-1,4]}));
  const p={ref,label:`Contact ${c.id==='contact-a'?'A':'B'} group ${index+1}`,kind:'header',body:'header',side:'top',phase:24,section:'matrix-switches: Matrix',function:'matrix-switches: Matrix',origin:'J_NODE_RECEIVER',mpn:'TSW-104-07-G-S',provisional:true,pins,signals:structuredClone(h.signals),bounds:{xmin:3.4,xmax:7.6,ymin:3.4,ymax:4.6},locked:false};
  router.parts.push(p);
  for(const [number,name] of Object.entries(p.signals)){
   const old=router.parts.find(p=>p.body==='terminal'&&Object.values(p.signals).includes(name));
   if(!old)throw Error(`missing NODE terminal ${name}`);
   replacedEndpoints.set(`router-matrix/${old.ref}.1`,`${ref}.${number}`);
   remove(router,[old.ref],`NODE receiver ${ref}.${number}`);
  }
 }
}
// Existing power/control connector is the sole interboard supply/control cable.
for(const ref of ['J_ROUTER_CORE_5V','J_ROUTER_CORE_12V']){
 const p=get(router,ref);for(const [number,name] of Object.entries(p.signals)){
  const primary=get(router,'J_ROUTER_POWER_CONTROL');const target=Object.entries(primary.signals).find(([,n])=>n===name);
  replacedEndpoints.set(`router-matrix/${ref}.${number}`,`${primary.ref}.${target[0]}`);
 }
 remove(router,[ref],'Supply already carried by primary 10-pin power/control cable');
}
for(const b of lowerBoards){
 // Link far sides are internal to a board. They must never create a harness.
 for(const p of b.parts){
  for(const [n,name] of Object.entries(p.signals??{}))if(name.endsWith('__B'))p.signals[n]=`${b.id.replaceAll('-','_')}__${name}`;
  if(p.link)p.link.farNet=`${b.id.replaceAll('-','_')}__${p.link.farNet}`;
 }
 placeLowerBoard(b);
 collect(b);
 if(b.id==='power'){
  const shuntP=b.nets.find(n=>n.name==='SHUNT_P');shuntP.starRoot='R_POWER_ANALOG_SHUNT.1';
  const edu=b.nets.find(n=>n.name==='5V_EDU'),allPins=[...edu.pins];
  const root='R_POWER_ANALOG_SHUNT.2',sense='U_POWER_ANALOG_SENSE.4';
  edu.pins=edu.pins.filter(ep=>ep!==root&&ep!==sense);
  finish(b);edu.pins=allPins;
  const counts=new Map();for(const w of b.wires.filter(w=>w.net==='5V_EDU'))for(const ep of [w.from,w.to])counts.set(ep,(counts.get(ep)??0)+1);
  const rootHole=pinAt(b,root).pin.hole;
  const leaf=allPins.filter(ep=>ep!==root&&ep!==sense&&(counts.get(ep)??0)<2&&pinAt(b,ep).part.phase<=11).sort((a,c)=>{const ah=pinAt(b,a).pin.hole,ch=pinAt(b,c).pin.hole;return Math.abs(ah[0]-rootHole[0])+Math.abs(ah[1]-rootHole[1])-Math.abs(ch[0]-rootHole[0])-Math.abs(ch[1]-rootHole[1]);})[0];
  if(!leaf)throw Error('No load-chain endpoint for Kelvin shunt');
  for(const [from,to] of [[leaf,root],[root,sense]]){
   const a=pinAt(b,from).pin.hole,c=pinAt(b,to).pin.hole;
   const path=[a,[a[0],c[1]],c].filter((xy,i,all)=>!i||xy[0]!==all[i-1][0]||xy[1]!==all[i-1][1]);
   b.wires.push({id:`W${b.wires.length+1}`,uid:`wire:5V_EDU:${from}~${to}`,net:'5V_EDU',from,to,path,color:'#d32f2f',side:'bottom',insulated:true,bar:false,phase:11});
  }
  flagSleeves(b);
 }else finish(b);
 reservePadCorridors(b);
 b.testPoints=designate(b);
 for(const w of b.wires)w.color=colorFor8(w.net,w.insulated);
}
function collect(b){
 const nets=new Map();for(const p of b.parts)for(const [n,name] of Object.entries(p.signals??{})){const net=nets.get(name)??{name,pins:[],bare:false};net.pins.push(`${p.ref}.${n}`);nets.set(name,net);}b.nets=[...nets.values()];
}
export function colorFor8(name,insulated=true){return name==='GND'?'#222222':!insulated?'#78909c':/^(12V|[35]V|USB_.*3V3|USB_5V|BUCK_|SAFE_|PI_3V3|PTC_OUT)/.test(name)?'#d32f2f':/NODE|BUS/.test(name)?'#1976d2':/ADC|SENSE|REF|SHUNT|DIV|WATCH_(CX|RX)/.test(name)?'#26873c':/SDA|SCL/.test(name)?'#ffffff':'#ffca28';}
// Translate only declared baseline interfaces; no harness is inferred from net names.
export const cables=[];
const contactEndpoint=(b,name,other)=>{
 const preferred=/^NODE/.test(name)?(other==='router-matrix'?'J_NODE_BUNDLE':'J_SMART'):['GND','3V3_SYS'].includes(name)?'J_SMART_POWER':'J_SMART';
 const p=b.parts.find(p=>p.origin===preferred&&Object.values(p.signals??{}).includes(name));
 const entry=p&&Object.entries(p.signals).find(([,n])=>n===name);return entry?`${p.ref}.${entry[0]}`:null;
};
for(const old of baseline.cables){
 if(old.net.startsWith('LEDA_')||old.net.endsWith('__B'))continue;
 if([old.from,old.to].includes('power')&&[old.from,old.to].includes('router-matrix'))continue;
 // The previous contact-to-power ground hop is replaced by the direct primary
 // cable; early router/fixture/contact grounds still join at their original phases.
 if(old.net==='GND'&&[old.from,old.to].includes('power')&&[old.from,old.to].includes('contact-a'))continue;
 const h=structuredClone(old);
 for(const side of ['from','to']){
  const id=h[side],b=boards.find(b=>b.id===id),other=h[side==='from'?'to':'from'],key=`${side}Pin`;
  if(id.startsWith('contact-'))h[key]=contactEndpoint(b,h.net,other)??h[key];
  else h[key]=replacedEndpoints.get(`${id}/${h[key]}`)??h[key];
  const {part,pin}=pinAt(b,h[key]);
  if(part.signals?.[pin.number]!==h.net)throw Error(`harness ${h.id}: ${id}/${h[key]} not ${h.net}`);
 }
 h.phase=Math.max(h.phase,pinAt(boards.find(b=>b.id===h.from),h.fromPin).part.phase,pinAt(boards.find(b=>b.id===h.to),h.toPin).part.phase);
 if(!cables.some(c=>c.net===h.net&&c.from===h.from&&c.fromPin===h.fromPin&&c.to===h.to&&c.toPin===h.toPin))cables.push(h);
}
for(const [n,name] of Object.entries(get(power,'J_POWER_INTERLOCK_MATRIX').signals))cables.push({id:`H_R8_POWER_${n}`,net:name,from:'power',fromPin:`J_POWER_INTERLOCK_MATRIX.${n}`,to:'router-matrix',toPin:`J_ROUTER_POWER_CONTROL.${n}`,phase:9,description:'Keyed primary 10-pin power/control cable. Fit only during qualified final-power bring-up.'});
export const dormantInterfaces=[{board:'router-matrix',endpoint:'J_ROUTER_POWER_CONTROL.3',net:'3V3_SYS',activeFrom:9,reason:'Unused passive supply receiving pin; leave open until the qualified primary cable is fitted. No IC supply is exempted.'}];
export const checkpoints=baseline.checkpoints.map(cp=>({...structuredClone(cp),hardwareRevision:revision,install:boards.flatMap(b=>b.parts.filter(p=>p.phase===cp.phase).map(p=>({board:b.id,ref:p.ref,reason:p.label}))),wires:boards.flatMap(b=>b.wires.filter(w=>w.phase===cp.phase).map(w=>({board:b.id,...w}))),harnesses:cables.filter(c=>c.phase===cp.phase)}));
