// Independent hardware revision. The legacy application/catalog remains pinned.
import {boards as legacy, byId as old} from './boards.mjs';
import {checkpoints as previousCheckpoints} from './checkpoints.mjs';
import {finish, MAPS, dipPins, rowPins} from './model.mjs';
import {place} from './boards.mjs';

export const revision='r5-bank-modules';
export const stock={width:70,height:100,cols:26,rows:38,pitch:2.54,verified:false,
  description:'7×10 cm double-sided fiberglass isolated-pad board; actual grid/plating unverified'};
export const release={status:'ENGINEERING PROTOTYPE — NOT RELEASED FOR SOLDERING',
  pending:['Actual stock grid and plating','Pogo pin diameter, compressed height and mounting fit',
    'DevKit pinout and body measurements','Chosen ADS1115/INA226 carrier interfaces and envelopes',
    'Bench qualification of output clamps, supply guards and partial-power states',
    'Firmware implementation and measured acceptance']};
const node=n=>`NODE${String(n).padStart(2,'0')}`;
const scope=(name,n)=>['GND','5V_SYS','3V3_SYS','5V_EDU'].includes(name)?name:
  ['P1_RAW','P2_RAW','P3_RAW'].includes(name)?node((n<3?0:11)+(n%3)*4+Number(name[1])-1):
  ['HIGH_REQ','LOW_REQ','AMM_REQ'].includes(name)?`RELAY_${n*3+['HIGH_REQ','LOW_REQ','AMM_REQ'].indexOf(name)}`:
  name==='USB_3V3'?'USB_SMART_3V3':name==='SDA_A'?`SDA_${n}`:name==='SCL_A'?'SCL_A':
  name==='SDA_B'?`SDA_POSITION_${n}`:name==='SCL_B'?`SCL_POSITION_${n}`:`P${n}_${name}`;
function transform(p,map,refPrefix='') {
  const q=structuredClone(p),split=p.ref.indexOf('_');q.ref=refPrefix&&split>=0?`${p.ref.slice(0,split)}_${refPrefix}${p.ref.slice(split+1)}`:refPrefix+p.ref;q.signals=Object.fromEntries(Object.entries(p.signals??{}).map(([pin,n])=>[pin,map(n)]));
  q.locked=false;q.socket=q.body==='dip'&&!q.adapter;q.origin=p.ref;
  return q;
}
function device(ref,label,labels,signals,phase,{body='dip',mpn=label,gap=3,kind='chip',...extra}={}) {
  return {ref,label,kind,mpn,body,side:'top',section:'Circuit',phase,signals,
    pins:body==='dip'?dipPins(labels,4,4,gap):rowPins(labels,4,4),socket:body==='dip',...extra};
}
function resistor(ref,value,a,b,phase,extra={}) {
  return device(ref,`${ref}: ${value}Ω`,['A','B'],{A:a,B:b},phase,
    {kind:'resistor',body:'passive',mpn:`MFR-25FBF52-${value}`,value,
      pins:[{number:1,label:'A',hole:[4,4]},{number:2,label:'B',hole:[8,4]}],...extra});
}
function cap(ref,value,a,b,phase) {return resistor(ref,value,a,b,phase,{kind:'capacitor',mpn:'C315C104K5R5TA',pins:[{number:1,label:'A',hole:[4,4]},{number:2,label:'B',hole:[5,4]}]});}
function header(ref,names,phase,label=ref) {return device(ref,label,names,Object.fromEntries(names.map((n,k)=>[k+1,n]).filter(([,n])=>!n.startsWith('NC'))),phase,{kind:'header',body:'header',mpn:'TSW-110-07-G-S',provisional:true});}
function cloneGroup(source,sections,map=n=>n,prefix='') {
  return old[source].parts.filter(p=>sections.includes(p.section)).map(p=>transform(p,map,prefix));
}
const groups=[];
const add=(id,title,parts,notes=[])=>groups.push({id,title,parts,notes});

// Contacts retain TOP hole coordinates and bank-B row direction. New board
// origins must be positioned from contact centres, never from board edges.
const contacts=legacy.filter(b=>/^[ab][123]$/.test(b.id)).map(original=>{
  const b=structuredClone(original);Object.assign(b,stock,{id:original.id,title:`${original.id.toUpperCase()} contacts`,distributionChain:true});
  b.mounts=original.id[0]==='a'?[[2,6],[25,6]]:[[2,32],[25,32]];
  for(const p of b.parts){
    if(p.ref==='J_NODE')for(const pin of p.pins)pin.hole[0]+=1;
    if(p.ref==='J_SMART'&&original.cols===28)for(const pin of p.pins)pin.hole[0]-=2;
    if(p.ref==='J_SMART'&&original.cols===21)for(const pin of p.pins)pin.hole[0]+=1;
    if(p.ref==='J_SMART')p.phase=original.id==='a1'?6:p.phase;
    if(p.ref==='J_SERVICE'){p.phase=original.id==='a1'?6:p.phase;p.signals={SCL:`SCL_POSITION_${(/a/.test(b.id)?0:3)+Number(b.id[1])-1}`,SDA:`SDA_POSITION_${(/a/.test(b.id)?0:3)+Number(b.id[1])-1}`,GND:'GND','3V3':'3V3_SYS'};}
    if(p.ref==='J_SMART')for(const [pin,signal] of Object.entries(p.signals)){
      const n=(b.id[0]==='a'?0:3)+Number(b.id[1])-1;
      if(signal===`SDA_${n}`)p.signals[pin]=`SDA_POSITION_${n}`;
      if(signal===`SCL_${n}`)p.signals[pin]=`SCL_POSITION_${n}`;
    }
    p.locked=true;
    const xs=p.pins.map(p=>p.hole[0]),ys=p.pins.map(p=>p.hole[1]),x=p.body==='idc'?2.5:.6,y=p.body==='idc'?1.6:.6;
    p.bounds={xmin:Math.min(...xs)-x,xmax:Math.max(...xs)+x,ymin:Math.min(...ys)-y,ymax:Math.max(...ys)+y};
  }
  b.notes=['Keep six contacts of each node strapped together. Adjacent nodes remain separate.',
    'Set neighbouring board origins 71.12 mm apart; locate by contact centres, not 70 mm edges.',
    'Capsules keep their orientation in both banks. TOP coordinates also label the mirrored underside.',
    'Pogo and carrier fit pending physical measurement.'];
  return b;
});

// Bank voltage scanner: one precision pair reused for CP01 diagnostics, four
// ordinary voltage/logic inputs; one dual 4:1 mux AFTER buffers, one ADC module.
for(let bank=0;bank<2;bank++) {
  const letter=bank?'B':'A',start=bank*3,phase=bank?29:1;
  const parts=[];
  for(let local=0;local<3;local++){
    const position=start+local,first=(bank?11:0)+local*4,installed=local===0?phase:26+position;
    for(let input=1;input<=2;input++){
      const key=`P${position}_${input}`;
      parts.push(resistor(`R_${key}_TOP`,'1M',node(first+input-1),`${key}_DIV`,installed,{tolerance:.01}),
        resistor(`R_${key}_BOTTOM`,'1M',`${key}_DIV`,`${letter}_${local===0?'PREC':'GENERAL'}_BIAS`,installed,{tolerance:.01}),
        cap(`C_${key}`,'1nF',`${key}_DIV`,'GND',installed),
        resistor(`R_${key}_ADC`,'1k',`${key}_BUF`,`${key}_MUX`,installed));
    }
  }
  // Keep zero-input outputs above the rail-swing region. Differential bias
  // cancels nominally; calibrate ratio mismatch and reference drift.
  for(const [group,installed] of [['PREC',phase],['GENERAL',27+start]]){
    const bias=`${letter}_${group}_BIAS`,tag=group==='GENERAL'?'general':'precision';
    parts.push(resistor(`R_${bias}_TOP`,'5.62k','3V3_SYS',bias,installed,{tolerance:.01,biasGroup:tag}),
      resistor(`R_${bias}_BOTTOM`,'1k',bias,'GND',installed,{tolerance:.01,biasGroup:tag}),
      Object.assign(cap(`C_${bias}`,'100nF',bias,'GND',installed),{biasGroup:tag}));
  }
  const p=start;
  parts.push(device(`U_${letter}_PRECISION`,'OPA2333AID precision diagnostic/voltage buffer',MAPS.opa2333,
    {OUTA:`P${p}_1_BUF`,INA_N:`P${p}_1_BUF`,INA_P:`P${p}_1_DIV`,VSS:'GND',INB_P:`P${p}_2_DIV`,INB_N:`P${p}_2_BUF`,OUTB:`P${p}_2_BUF`,VDD:'3V3_SYS'},phase,{mpn:'OPA2333AID',adapter:'SOIC8 to numbered DIP8',socket:false}));
  const mcp=['OUTA','INA_N','INA_P','VDD','INB_P','INB_N','OUTB','OUTC','INC_N','INC_P','VSS','IND_P','IND_N','OUTD'];
  const sig={VDD:'3V3_SYS',VSS:'GND'};
  for(let k=0;k<4;k++){
    const channel=start+1+Math.floor(k/2),input=k%2+1,amp='ABCD'[k];
    sig[`OUT${amp}`]=`P${channel}_${input}_BUF`;sig[`IN${amp}_N`]=`P${channel}_${input}_BUF`;sig[`IN${amp}_P`]=`P${channel}_${input}_DIV`;
  }
  const expansionPhase=27+start;
  parts.push(device(`U_${letter}_BUFFERS`,'MCP6004-I/P four voltage buffers',mcp,sig,expansionPhase,{mpn:'MCP6004-I/P'}),
    cap(`C_${letter}_PRECISION`,'100nF','3V3_SYS','GND',phase),cap(`C_${letter}_BUFFERS`,'100nF','3V3_SYS','GND',expansionPhase));
  const mux=['Y0','Y2','Y_COM','Y3','Y1','INHIBIT','VEE','VSS','SEL_B','SEL_A','X3','X0','X_COM','X1','X2','VDD'];
  const ms={Y_COM:`ADC_${letter}_P2`,X_COM:`ADC_${letter}_P1`,INHIBIT:'GND',VEE:'GND',VSS:'GND',VDD:'3V3_SYS',SEL_A:`MUX_${letter}_A`,SEL_B:`MUX_${letter}_B`,X3:'GND',Y3:'GND'};
  for(let k=0;k<3;k++){ms[`X${k}`]=`P${start+k}_1_MUX`;ms[`Y${k}`]=`P${start+k}_2_MUX`;}
  parts.push(device(`U_${letter}_MUX`,'CD4052BE buffered voltage selector',mux,ms,phase,{mpn:'CD4052BE'}),cap(`C_${letter}_MUX`,'100nF','3V3_SYS','GND',phase),
    resistor(`R_${letter}_SEL_A`,'100k',`MUX_${letter}_A`,'GND',phase),resistor(`R_${letter}_SEL_B`,'100k',`MUX_${letter}_B`,'GND',phase));
  // Logical carrier connector numbering, explicitly NOT the ADS1115 die pinout.
  parts.push(device(`J_${letter}_ADC_MODULE`,'ADS1115 carrier interface — verify labelled module pads',
    ['VDD','GND','SCL','SDA','ADDR','ALERT_N','AIN0','AIN1','AIN2','AIN3'],
    {VDD:'3V3_SYS',GND:'GND',SCL:`SCL_POSITION_${start}`,SDA:`SDA_POSITION_${start}`,ADDR:'GND',AIN0:`ADC_${letter}_P1`,AIN1:`ADC_${letter}_P2`,AIN2:'GND',AIN3:'GND'},phase,
    {mpn:'ADS1115 verified breakout carrier pending',kind:'header',body:'header',externalPart:'ADS1115 carrier',provisional:true,stageOpenPins:[6]}));
  if(!bank){
    parts.push(...cloneGroup('continuity-fixture',['Stimulus'],n=>n==='USB_3V3'?'3V3_SYS':n));
    parts.push(header('J_DIAGNOSTIC',['TEST_A','TEST_B'],1,'Removable diagnostic stimulus / return'),header('JP_RETURN',['TEST_B','GND'],1,'Fit only for unpowered continuity test'));
  }
  add(`measurement-${letter.toLowerCase()}`,`Bank ${letter}: buffered voltage scanner${bank?'':' and continuity stimulus'}`,parts,
    ['First precision pair also performs fixed-jumper diagnostics; no duplicate ADC fixture.',
    'ADC and buffer supply remains 3V3_SYS. CP01–08 use one removable USB-router 3V3 supply link, removed before final power.',
    'ADC bus belongs to position '+start+' even when its OLED capsule is absent.',
    'No raw node is switched by the CD4052. Carrier body is external on measured standoffs; connector drawing is not its footprint.']);
}

// Three independent channel circuits form each bank assembly. Shared reference
// parts reduce repetition; no sharing of protection switches or series paths.
for(let bank=0;bank<2;bank++){
  const letter=bank?'B':'A',bankPhase=bank?29:15;
  const refs=old['smart-channel'].parts.filter(p=>p.section==='Limits'&&/R_(HI|LO)_(TOP|BOTTOM)|C_REF(HI|LO)/.test(p.ref));
  const shared=refs.map(p=>{const q=transform(p,n=>['GND','5V_EDU'].includes(n)?n:`${letter}_${n}`,`${letter}_`);q.phase=bankPhase;return q;});
  for(let local=0;local<3;local++){
    const n=bank*3+local,ph=n===0?15:26+n;
    const parts=old['smart-channel'].parts.filter(p=>['Limits','Output','Current'].includes(p.section)&&!refs.some(r=>r.ref===p.ref)&&!/^Q_K_|^R_K_.*_OFF$/.test(p.ref)).map(p=>{
      const q=transform(p,name=>['REF_HI','REF_LO'].includes(name)?`${letter}_${name}`:scope(name,n),`P${n}_`);
      q.phase=p.section==='Current'?(n===0?22:ph):ph;
      if(q.origin==='U_LIMIT'){q.mpn='MCP6002-I/P';q.label='MCP6002 dual source/sink clamp';delete q.adapter;q.socket=true;}
      return q;
    });
    // Ready-made INA226 module, modified for external 1Ω shunt; no bare SMD IC.
    const current=parts.find(p=>p.origin==='U_CURRENT');
    Object.assign(current,header(`J_P${n}_CURRENT_MODULE`,['VDD','GND','SCL','SDA','IN_P','IN_N'],n===0?22:ph,'INA226 carrier: remove onboard shunt; external 1Ω'));
    current.signals={VDD:'3V3_SYS',GND:'GND',SCL:`SCL_POSITION_${n}`,SDA:`SDA_POSITION_${n}`,IN_P:`P${n}_SHUNT_P`,IN_N:`P${n}_SHUNT_N`};
    delete current.adapter;current.socket=false;
    current.externalPart='INA226 carrier';current.address='0x40';current.rework='Remove onboard shunt completely; connect external 1Ω ±1% Kelvin sense to IN+/IN−. Verify address 0x40, 3V3 pull-ups and factory VBUS routing. Never ground VBUS on a carrier that ties it to an input. Include module loading in measured error.';
    const shunt=parts.find(p=>p.origin==='R_SHUNT');shunt.value='1';shunt.mpn='MFR-25FBF52-1R';shunt.label='1Ω ±1% external current shunt';
    // U_LIMIT pin numbering matches MCP6002 PDIP8; preserve circuit role labels.
    // Keep BSS84 adapter until a sourced TO92 substitute has guaranteed compliance.
    add(`bank-${letter.toLowerCase()}-channel-${local}`,`Bank ${letter}: position ${n} output and series-current isolation`,[...(local===0?shared:[]),...parts],
      ['Independent source/sink clamps and PhotoMOS isolation at this position. Never share these switches between positions.',
      'MCP6002 offset is included in static limit bounds. Stability, gate compliance and loaded levels require scope qualification.',
      'Source MOSFET remains BSS84 on a numbered adapter; a TO92 replacement is not assumed equivalent.',
      'INA226 module sits externally on standoffs. Carrier pin order and shunt modification require inspection before release.']);
  }
  // Two DIP16 driver arrays replace twelve discrete LED-driver MOSFETs and
  // twelve external gate pull-downs per bank. ULN2003A has internal bias paths.
  // Each AMM request drives two separate LED/resistor branches, not parallel LEDs.
  const pins=['IN1','IN2','IN3','IN4','IN5','IN6','IN7','GND','COM','OUT7','OUT6','OUT5','OUT4','OUT3','OUT2','OUT1'];
  const outputs=[];
  for(let local=0;local<3;local++){
    const n=bank*3+local;
    outputs.push([`RELAY_${3*n}`,`P${n}_K_HIGH_CATHODE`],[`RELAY_${3*n+1}`,`P${n}_K_LOW_CATHODE`],[`RELAY_${3*n+2}`,`P${n}_AMM_CATHODE`]);
    for(const g of groups.filter(g=>g.id===`bank-${letter.toLowerCase()}-channel-${local}`))for(const p of g.parts)for(const [pin,name] of Object.entries(p.signals??{}))if([`P${n}_K_AMM_P_CATHODE`,`P${n}_K_AMM_N_CATHODE`].includes(name))p.signals[pin]=`P${n}_AMM_CATHODE`;
  }
  const drivers=[];
  for(let chip=0;chip<2;chip++){
    const sig={GND:'GND',COM:'5V_SYS'};
    for(let k=0;k<7;k++){
      const entry=outputs[chip*7+k];sig[`IN${k+1}`]=entry?entry[0]:'GND';if(entry)sig[`OUT${k+1}`]=entry[1];
    }
    drivers.push(device(`U_${letter}_LED_DRIVER_${chip}`,'ULN2003AN PhotoMOS LED driver array',pins,sig,bankPhase,{mpn:'ULN2003AN'}));
  }
  add(`bank-${letter.toLowerCase()}-drivers`,`Bank ${letter} shared LED drivers`,drivers,['Driver arrays share control support only; every PhotoMOS switch and current clamp remains independent.']);
}

const routerMap=n=>n==='USB_3V3'?'USB_ROUTER_3V3':n==='ALIVE'?'ROUTER_ALIVE':n;
add('router-controller','ESP1 routing owner / watchdog',cloneGroup('matrix',['Controller','Watchdog','Return'],routerMap),['ESP1 USB supply never connects to final 5V_SYS.']);
add('routing','Matrix address logic and two MT8816 DIP40',cloneGroup('matrix',['Control','Matrix','Tools'],routerMap));
const smartMap=n=>n==='USB_3V3'?'USB_SMART_3V3':['ALIVE','HEARTBEAT','USB_RESET_N','WATCH_CX','WATCH_RX'].includes(n)?`SMART_${n}`:n;
const smartParts=cloneGroup('smart-controller',['Controller','Watchdog','Registers'],smartMap);
const esp=smartParts.find(p=>p.ref==='U_ESP2');
Object.assign(esp.signals,{IO32:'MUX_A_A',IO33:'MUX_A_B',IO14:'MUX_B_A',IO23:'MUX_B_B'});
add('smart-controller','ESP2 smart owner / default-OFF registers',smartParts);
for(let bank=0;bank<2;bank++){
 const list=[];
 for(let local=0;local<3;local++){
  const n=bank*3+local,ph=n===0?6:26+n;
  list.push(...old['smart-channel'].parts.filter(p=>p.section==='Interface'&&!['J_MODULE','J_CONTROL'].includes(p.ref)).map(p=>{
    const q=transform(p,x=>scope(x,n),`P${n}_`);q.phase=ph;return q;
  }));
 }
 add(`service-${bank?'b':'a'}`,`Bank ${bank?'B':'A'}: six-contact raw/service interfaces and isolated OLED buses`,list,
  ['Keep TCA9517 B sides separate. ADC is local to the first bus in each bank; current/OLED devices stay on their own position bus.',
   'CP06–08 temporary ESP1 bus connections feed only position 0 A side; remove before ESP2 service control at CP15.']);
}
for(const [id,sections] of [['power-input',['Input']],['power-guards',['VoltageGuard']],['power-student',['Student','Reference','Latch','Indicator','Outputs']]]){
 const parts=cloneGroup('power',sections);
 for(const p of parts)if(p.ref.startsWith('J_BUCK')){
   const is5=p.ref==='J_BUCK_5V';Object.assign(p,header(p.ref,['12V_SYS','GND',is5?'BUCK_5V':'BUCK_3V3'],9,is5?'External LM2596 set to 5V':'External XL4015 set to 3.3V'));
   p.externalPart=is5?'Purchased LM2596 adjustable module':'Purchased XL4015 adjustable module';
 }
 add(id,id.replaceAll('-',' '),parts,['Both purchased buck modules are set and qualified with consumers disconnected. Do not assume printed current ratings are usable continuous ratings.']);
}
const integration=cloneGroup('integration',['Pi','Buttons']);
const reader=integration.find(p=>p.ref==='J_NFC');
Object.assign(reader,header('J_RFID',['PI_3V3','GND','SCLK','MOSI','MISO','CE0_N','RFID_RESET'],34,'RC522 labelled SPI carrier interface'));
reader.externalPart='Purchased RC522 reader';
const pi=integration.find(p=>p.ref==='J_PI');pi.pins.find(p=>p.number===22).label='RFID_RESET';pi.signals['22']='RFID_RESET';
add('integration','Pi buttons / RC522 / enclosure harness',integration,['Pi has separate 5V supply; common ground only. RC522 SPI mode 0, MSB first, start at 1 MHz.']);

const peripheralParts=[header('J_12V',['12V_SYS','GND'],32,'Protected 12V input'),header('J_5V',['5V_SYS','GND'],32,'System 5V input'),
 header('J_FAN1',['12V_SYS','GND'],32,'12V fan 1 — fixed-speed'),header('J_FAN2',['12V_SYS','GND'],32,'12V fan 2 — fixed-speed'),
 header('J_LIGHT',['5V_SYS','GND'],32,'5V white lighting — never 5V_EDU'),
 header('J_JOYSTICK',['USB_SMART_3V3','GND','JOY_X','JOY_Y','JOY_SW_N'],32,'Joystick powered at 3.3V'),
 resistor('R_JOY_SW','10k','USB_SMART_3V3','JOY_SW_N',32)];
// ADC1 inputs avoid the ESP32 ADC2/WiFi conflict. GPIO35 needs the external pull-up.
Object.assign(esp.signals,{IO36:'JOY_X',IO39:'JOY_Y',IO35:'JOY_SW_N'});
add('peripherals','Fans / lighting / 3.3V joystick distribution',peripheralParts,
 ['Fans and lighting use system power, never the 12mA educational rail. Measure their actual current before final load qualification.',
  'Pi camera, HDMI LCD and speakers use external Pi/USB interfaces, not these perfboard signal headers.']);
for(const g of groups)for(const p of g.parts){
 if(p.origin==='R_WATCH'){p.value='549k';p.mpn='MFR-25FBF52-549K';p.label='549kΩ ±1% watchdog timing — qualify before permanent installation';p.tolerance=.01;}
 if(p.origin==='C_WATCH'){p.label='1µF ±5% film timing capacitor; not unverified inventory electrolytic';p.tolerance=.05;p.mpn='1uF film timing capacitor verified dimensions pending';p.provisional=true;}
 if(p.origin==='R_LED'&&Object.values(p.signals??{}).includes('STIM_LED_A')){p.value='270';p.mpn='MFR-25FBF52-270R';p.tolerance=.01;p.label='270Ω ±1% diagnostic PhotoMOS LED drive';}
 if(/^R_K_.*_LED$/.test(p.origin??'')){p.value='390';p.mpn='MFR-25FBF52-390R';p.tolerance=.01;p.label='390Ω ±1% PhotoMOS LED drive with ULN2003 saturation allowance';}
 if(p.origin==='R_STIM'){p.value='11k';p.mpn='MFR-25FBF52-11K';p.label='11kΩ ±1% independently bounds diagnostic stimulus below0.34mA';p.tolerance=.01;}
}

// Electrical blocks are split only when they cannot fit stock. Module envelopes
// are external; this packing is provisional geometry, not measured hardware fit.
function assemble(g,parts,id=g.id){
 const b={...stock,id,title:g.title,notes:g.notes,parts:structuredClone(parts),nets:[],wires:[],
   sections:[{name:'Circuit',label:g.title}],mounts:[[2,2],[25,2]],distributionChain:true,release:release.status,
   keepouts:[{xmin:.4,xmax:1.6,ymin:4,ymax:37},{xmin:25.4,xmax:26.6,ymin:4,ymax:37}]};
 b.parts.forEach(p=>{p.function=p.function??p.section;p.section='Circuit';p.locked=false;});
 if(id.endsWith('-buffers'))b.parts.sort((a,c)=>Number(c.body==='dip')-Number(a.body==='dip')||Number(Boolean(c.adapter))-Number(Boolean(a.adapter))||a.phase-c.phase);
 return place(b);
}
function partition(g){
 const pages=[];
 // Place large sockets before small passives to avoid fragmented empty space.
 // This changes placement order only, never electrical connectivity or phases.
 const ordered=[...g.parts].sort((a,b)=>{
   const area=p=>{const xs=p.pins.map(p=>p.hole[0]),ys=p.pins.map(p=>p.hole[1]);return (Math.max(...xs)-Math.min(...xs)+3)*(Math.max(...ys)-Math.min(...ys)+3);};
   return area(b)-area(a)||a.phase-b.phase||a.ref.localeCompare(b.ref);
 });
 for(const p of ordered){
  let fitted=false;
  for(const page of pages){try{assemble(g,[...page,p]);page.push(p);fitted=true;break;}catch{}}
  if(!fitted){assemble(g,[p]);pages.push([p]);}
 }
 return pages.map((parts,k)=>assemble(g,parts,`${g.id}-${k+1}`));
}
// Combine small leftovers within each bank rather than allocating an almost
// empty perfboard to the last relay or shared reference.
const combined=[];
for(const bank of ['a','b']){
 const selected=groups.filter(g=>g.id.startsWith(`bank-${bank}-channel-`)||g.id===`bank-${bank}-drivers`||g.id===`service-${bank}`);
 combined.push({id:`bank-${bank}`,title:`Bank ${bank.toUpperCase()}: independent outputs, current and service`,parts:selected.flatMap(g=>g.parts),notes:[...new Set(selected.flatMap(g=>g.notes))]});
}
const effectiveGroups=[...groups.filter(g=>!/^bank-[ab]-channel-|^bank-[ab]-drivers$|^service-[ab]$/.test(g.id)),...combined];
// Analog loops are indivisible construction units. Only buffered outputs and
// shared reference/control nets may cross between the resulting boards.
const analogGroups=[];
for(const letter of ['A','B']){
 const measure=groups.find(g=>g.id===`measurement-${letter.toLowerCase()}`),start=letter==='A'?0:3;
 const ordinary=measure.parts.filter(p=>p.biasGroup==='general'||p.ref===`U_${letter}_BUFFERS`||p.ref===`C_${letter}_BUFFERS`||[start+1,start+2].some(n=>p.ref.startsWith(`R_P${n}_`)||p.ref.startsWith(`C_P${n}_`)));
 const bankSupport=combined.find(g=>g.id===`bank-${letter.toLowerCase()}`).parts.filter(p=>new RegExp(`^[A-Z]+_${letter}_`).test(p.ref));
 analogGroups.push({...measure,id:measure.id+'-precision',parts:measure.parts.filter(p=>!ordinary.includes(p))},
   {...measure,id:measure.id+'-buffers',parts:[...ordinary,...bankSupport]});
 const bank=combined.find(g=>g.id===`bank-${letter.toLowerCase()}`);
 const assigned=new Set();
 for(let k=0;k<3;k++){
   const n=start+k,parts=bank.parts.filter(p=>new RegExp(`^[A-Z]+_P${n}_`).test(p.ref));parts.forEach(p=>assigned.add(p));
   analogGroups.push({id:`bank-${letter.toLowerCase()}-position-${n}`,title:`Bank ${letter}: position ${n} complete isolated channel`,parts,notes:bank.notes});
 }
}
// Preserve local decoupling, watchdog RC loops and current-sense feedback.
const coherent=[];
const groupFrom=(id,title,source,predicate,extras=[])=>{
 const g=groups.find(g=>g.id===source);coherent.push({id,title,parts:[...g.parts.filter(predicate),...extras],notes:g.notes});
};
const routerGroup=groups.find(g=>g.id==='router-controller');
groupFrom('router-core','ESP1 carrier and enclosure I/O','router-controller',p=>p.section==='Controller',peripheralParts.filter(p=>!['J_JOYSTICK','R_JOY_SW'].includes(p.ref)));
groupFrom('router-safety','ESP1 watchdog / isolated returns','router-controller',p=>p.section!=='Controller');
groupFrom('smart-core','ESP2 carrier and service pull-ups','smart-controller',p=>p.section==='Controller',peripheralParts.filter(p=>['J_JOYSTICK','R_JOY_SW'].includes(p.ref)));
groupFrom('smart-safety','ESP2 watchdog / relay registers','smart-controller',p=>p.section!=='Controller');
const matrixGroup=groups.find(g=>g.id==='routing');
const matrixRefs=new Set(['R_RESET_ON','Q_RESET_RELEASE','Q_RESET_ALIVE','R_STBA_OFF','R_STBB_OFF','R_RST_RELEASE_OFF']);
groupFrom('matrix-switches','Two MT8816 matrices / default reset','routing',p=>p.section==='Matrix'||matrixRefs.has(p.ref));
groupFrom('matrix-control','Matrix latch / local diagnostic buffer','routing',p=>p.section!=='Matrix'&&!matrixRefs.has(p.ref));
const powerGroup=groups.find(g=>g.id==='power-student');
const senseRefs=new Set(['C_SENSE','C_TRIP','R_PRESET']);
groupFrom('power-analog','Student switch / current sense / comparator','power-student',p=>['Student','Reference'].includes(p.section)||senseRefs.has(p.ref));
groupFrom('power-interlock','Fault latch / watchdog interlock / test headers','power-student',p=>!['Student','Reference'].includes(p.section)&&!senseRefs.has(p.ref));
let assembled=[...effectiveGroups.filter(g=>['power-input','power-guards','integration'].includes(g.id)).map(g=>assemble(g,g.parts)),
 ...coherent.map(g=>assemble(g,g.parts)),...analogGroups.map(g=>assemble(g,g.parts))];
// Contacts and interface connectors reuse legacy cable maps explicitly below.
// Logical cross-board nets receive one accessible harness terminal per board.
function collectNets(b){
 const nets=new Map();
 for(const p of b.parts)for(const [role,name] of Object.entries(p.signals??{})){
  const pin=p.pins.find(pin=>pin.label===role||String(pin.number)===role);if(!pin)throw Error(`${b.id}/${p.ref}: ${role}`);
  const list=nets.get(name)??[];list.push(`${p.ref}.${pin.number}`);nets.set(name,list);
 }
 // Locked pogo straps have no signals object in the historical source.
 for(const p of b.parts.filter(p=>p.body==='pogo'&&p.ref.startsWith('J_NODE'))){const name=p.ref.slice(2);nets.set(name,[...(nets.get(name)??[]),...p.pins.map(pin=>`${p.ref}.${pin.number}`)]);}
 b.nets=[...nets].map(([name,pins])=>({name,pins,bare:name.startsWith('NODE')&&b.id.match(/^[ab][123]$/)}));
}
contacts.forEach(collectNets);assembled.forEach(collectNets);
const netOwners=new Map();
for(const b of [...contacts,...assembled])for(const n of b.nets){const owners=netOwners.get(n.name)??[];owners.push(b);netOwners.set(n.name,owners);}
// Explicit aliases inherited from the legacy control/interface harnesses.
for(const b of assembled)for(const p of b.parts){
 for(const [pin,name] of Object.entries(p.signals??{})){
  const pos=/^P(\d)_/.exec(p.ref)?.[1];
  if(pos!==undefined&&p.origin==='J_CONTROL'&&name.startsWith(`P${pos}_SCL_A`))p.signals[pin]='SCL_A';
 }
}
// Keep measured carriers and DevKits separate from GPIO die pin assumptions.
export const externalInterfaces=[
 {device:'Pi',power:'Separate rated 5V supply',links:'USB webcam; HDMI LCD only if actual carrier is HDMI; AUX speakers with separately budgeted USB power',status:'LCD carrier interface and total Pi load pending'},
 {device:'RC522',power:'Pi 3.3V',links:'J_RFID pin1 3.3V,2 GND,3 SCK,4 MOSI,5 MISO,6 SDA/SS,7 RST; IRQ unused',status:'Verify actual carrier labels; SPI MSB first'},
 {device:'OLED',power:'3V3_SYS',links:'Each contact service rail SCL,SDA,GND,3V3; check effective pull-ups',status:'Purchased carrier pin order unverified'},
 {device:'Buck modules',power:'12V_SYS',links:'VIN+, VIN−, OUT+ to corresponding BUCK rail; OUT− to GND',status:'Adjust and load-test before connecting consumers'},
];
export const boards=[...contacts,...assembled];
// Renumber only non-contact board-local references to make cross-board endpoint
// identity unambiguous. Original refs remain available in origin.
for(const b of boards)for(const p of b.parts)if(!p.origin)p.origin=p.ref;
export const byId=Object.fromEntries(boards.map(b=>[b.id,b]));
export const baseline=legacy;
export let checkpoints=previousCheckpoints.map(cp=>{
 const c=structuredClone(cp);c.hardwareRevision=revision;
 c.install=boards.flatMap(b=>b.parts.filter(p=>p.phase===c.phase).map(p=>({board:b.id,ref:p.ref,reason:p.label})));
 c.links=c.links.filter(s=>!s.includes('ADC0x48 collision')&&!s.includes('continuity fixture must'));
 if(c.phase>=1&&c.phase<=3)c.links.push('Use bank-A precision input pair for TEST_A=C4 / TEST_B=C1 through removable sense leads. Its permanent NODE00/NODE01 harness is absent until CP06. Select CD4052 channel0; verify actual ADC/buffer supply before stimulus.');
 if(c.phase===6)c.links.push('Reuse bank-A ADC/buffer. Remove diagnostic probes, JP_RETURN and stimulus leads; attach permanent NODE00/NODE01 harness. Connect service position0 after inspecting pull-ups; no duplicate ADC fixture.');
 if(c.phase===15)c.links.push('Remove temporary ESP1 I2C/mux and USB-router-to-3V3_SYS links. ESP2 owns mux select and measurement; only final regulated rails supply bank electronics.');
 c.firmware+='; revision5 bank acquisition, carrier interfaces and selector ownership supersede legacy ADC pin mapping';
 c.tests=c.tests.map(t=>({...t,description:t.description.replaceAll('PN532','RC522').replaceAll('INA219','INA226 with external 1Ω shunt').replaceAll('LSB-first','MSB-first').replaceAll('R=10k×','R=11k×')}));
 if(c.phase===9)c.links.push('Keep JP_LOGIC and JP_3V3 open while adjusting and qualifying both purchased buck outputs. Final consumers are not connected at this checkpoint.');
 if(c.phase===11)c.links.push('Remove the temporary USB-router-to-3V3_SYS feed before fitting qualified JP_LOGIC/JP_3V3 consumer links. Never parallel USB and buck rails.');
 if(c.phase===27||c.phase===30)c.links.push(`Before powering U_${c.phase===27?'A':'B'}_BUFFERS, fit removable GND ties at noninverting inputs pin10/pin12 for the future third position. Remove these ties with power OFF at the next expansion checkpoint before attaching its divider inputs.`);
 return c;
});

// Build actual per-board nets before generating terminal/harness assignment.
// Shared electrical identities do not themselves represent physical connections.
for(const b of boards)collectNets(b);
function finalize(){
 const owners=new Map();
 for(const b of boards)for(const n of b.nets){const a=owners.get(n.name)??[];a.push(b);owners.set(n.name,a);}
 const cables=[];const terminalCount=new Map();
 for(const [name,list] of owners){
  if(list.length<2)continue;
  const ends=list.map(b=>{
   const n=b.nets.find(n=>n.name===name),phase=Math.min(...n.pins.map(ep=>b.parts.find(p=>p.ref===ep.split('.')[0]).phase));
   let endpoint=n.pins.find(ep=>{const p=b.parts.find(p=>p.ref===ep.split('.')[0]);return p.kind==='header'&&!p.externalPart&&p.phase===phase;});
   if(!endpoint){
    if(/^[ab][123]$/.test(b.id))throw Error(`${b.id}: missing existing harness terminal for ${name}`);
    const index=terminalCount.get(b.id)??0;if(index>=64)throw Error(`${b.id}: more than 64 reserved terminal positions`);
    const ref=`J_LINK_${index+1}`,hole=[index<32?1:26,5+index%32];
    const p=header(ref,[name],phase,`Harness terminal: ${name}`);
    Object.assign(p,{pins:[{number:1,label:name,hole}],locked:true,body:'terminal',function:'Harness',section:'Circuit',bounds:{xmin:hole[0]-.45,xmax:hole[0]+.45,ymin:hole[1]-.45,ymax:hole[1]+.45},origin:ref});
    b.parts.push(p);n.pins.push(`${ref}.1`);endpoint=`${ref}.1`;terminalCount.set(b.id,index+1);
   }
   const connectPhase=name.startsWith('NODE')&&b.id==='measurement-a-precision'?Math.max(6,phase):phase;
   return {board:b.id,endpoint,net:name,phase:connectPhase};
  });
  ends.sort((a,b)=>a.phase-b.phase||a.board.localeCompare(b.board));
  for(let k=1;k<ends.length;k++)cables.push({id:`H${cables.length+1}`,net:name,from:ends[k-1].board,fromPin:ends[k-1].endpoint,to:ends[k].board,toPin:ends[k].endpoint,phase:Math.max(ends[k-1].phase,ends[k].phase),description:`Join ${name} between ${ends[k-1].board}.${ends[k-1].endpoint} and ${ends[k].board}.${ends[k].endpoint}; insulated detachable harness, not a drawing-only net label.`});
 }
 for(const b of boards){
  // Sensor leads terminate at each shunt leg, independently of load leads.
  // A chain through a relay terminal is not a Kelvin connection.
  for(const n of b.nets.filter(n=>/^P\d_SHUNT_[PN]$/.test(n.name))){
   const shunt=b.parts.find(p=>p.origin==='R_SHUNT');
   n.starRoot=n.pins.find(ep=>ep.startsWith(`${shunt.ref}.`));
  }
  // Keep derived net membership, including the physical terminal pads, intact.
  finish(b);
 }
 return {owners,cables};
}
export const {cables}=finalize();
for(const c of checkpoints){
 c.install=boards.flatMap(b=>b.parts.filter(p=>p.phase===c.phase).map(p=>({board:b.id,ref:p.ref,reason:p.label})));
 c.wires=boards.flatMap(b=>b.wires.filter(w=>w.phase===c.phase).map(w=>({board:b.id,...w})));
 c.harnesses=cables.filter(h=>h.phase===c.phase);
}
