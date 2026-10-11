import {makeBoard,section,part,dip,header,idc,passive,rowPins,dipPins,net,finish,MAPS} from './model.mjs';
const N=(b,name,...ends)=>net(b,name,ends.map(s=>s.split('.')));
function assigned(p,mapping) { p.signals=mapping; return p; }
function collect(b) {
  for(const p of b.parts) for(const [label,name] of Object.entries(p.signals??{})) N(b,name,`${p.ref}.${label}`);
  return finish(b);
}
function labelsMap(labels) {return Object.fromEntries(labels.filter(x=>!/^NC/.test(x)).map(x=>[x,x]));}
function H(b,ref,labels,options={}) {return assigned(header(b,ref,labels,4,4,options),labelsMap(labels));}
function I(b,ref,labels,options={}) {return assigned(idc(b,ref,labels,4,4,options),Object.fromEntries(labels.map((n,k)=>[k+1,n]).filter(([,n])=>!/^NC/.test(n))));}
function R(b,ref,value,a,c,options={}) {return assigned(passive(b,ref,value,4,4,options),{'1':a,'2':c});}
function C(b,ref,value,a,c) {return R(b,ref,value,a,c,{kind:'capacitor',pitch:value==='470uF'?2:1,labels:['470uF','10uF'].includes(value)?['POS','NEG']:['A','B']});}
function U(b,ref,mpn,labels,signals,options={}) {return assigned(dip(b,ref,mpn,labels,4,4,options),signals);}
function power(b,ref,pins,rail='5V_SYS') {N(b,rail,`${ref}.${pins[0]}`);N(b,'GND',`${ref}.${pins[1]}`);C(b,`C_${ref}`,'100nF',rail,'GND');}
function transistor(b,ref,mpn,labels,signals) {return assigned(part(b,ref,mpn,'chip',rowPins(labels,4,4),{body:'transistor',mpn}),signals);}
function bound(p) { const xs=p.pins.map(p=>p.hole[0]),ys=p.pins.map(p=>p.hole[1]); const extra=p.body==='idc'?2.5:p.body==='dip'?0.65:0.6, ey=p.body==='esp'?2.3:p.body==='idc'?1.6:extra;return {xmin:Math.min(...xs)-extra,xmax:Math.max(...xs)+extra,ymin:Math.min(...ys)-ey,ymax:Math.max(...ys)+ey}; }
// Shelf-free deterministic placement into documented grid holes. This does not route wires.
// Stable order keeps repeated smart cards identical. Locked pogo coordinates never move.
export function place(b) {
 const occupied=[...b.parts.filter(p=>p.locked).map(bound),...(b.keepouts??[]),...b.mounts.map(([x,y])=>({xmin:x-.85,xmax:x+.85,ymin:y-.85,ymax:y+.85}))];
 for(const p of b.parts.filter(p=>!p.locked)) {
   const old=bound(p),w=old.xmax-old.xmin,h=old.ymax-old.ymin;let found=false;
   for(let j=4;j<b.rows-2&&!found;j++)for(let i=4;i<b.cols-2&&!found;i++) {
    const dx=i-Math.min(...p.pins.map(x=>x.hole[0])),dy=j-Math.min(...p.pins.map(x=>x.hole[1]));
    const rect={xmin:old.xmin+dx,xmax:old.xmax+dx,ymin:old.ymin+dy,ymax:old.ymax+dy};
    if(rect.xmax>b.cols-2||rect.ymax>b.rows-2)continue;
    if(occupied.some(o=>rect.xmin<o.xmax+1&&rect.xmax>o.xmin-1&&rect.ymin<o.ymax+1&&rect.ymax>o.ymin-1))continue;
    p.pins=p.pins.map(x=>({...x,hole:[x.hole[0]+dx,x.hole[1]+dy]}));occupied.push(bound(p));found=true;
   }
   if(!found)throw Error(`${b.id}: ${p.ref} does not fit ${b.cols}x${b.rows}`);
 }
 // Expand the original placements over the available board; lead pitch stays fixed.
 if(!b.parts.some(p=>p.locked))for(const axis of [0,1]) {
   const lo=axis===0?'xmin':'ymin',hi=axis===0?'xmax':'ymax',limit=axis===0?b.cols:b.rows;
   const oldBounds=b.parts.map(bound),origin=(Math.min(...oldBounds.map(o=>o[lo]))+Math.max(...oldBounds.map(o=>o[hi])))/2,target=(limit+1)/2;
   let spread=axis===0?1.5:3;
   for(const o of oldBounds){const c=(o[lo]+o[hi])/2,h=(o[hi]-o[lo])/2,d=c-origin;if(d>0)spread=Math.min(spread,(limit-2.5-target-h)/d);if(d<0)spread=Math.min(spread,(target-2.5-h)/(-d));}
   spread=Math.max(1,spread);
   b.parts.forEach((p,k)=>{const o=oldBounds[k],c=(o[lo]+o[hi])/2;const delta=Math.round(target+(c-origin)*spread-c);p.pins=p.pins.map(pin=>({...pin,hole:pin.hole.map((v,i)=>i===axis?v+delta:v)}));});
 }
 b.parts.forEach(p=>p.bounds=bound(p));return collect(b);
}
export function nodeModule(bank,module) {
 const count=module===2?3:4,position=(bank==='B'?3:0)+module,start=(bank==='B'?11:0)+module*4;
 const b=makeBoard(`${bank.toLowerCase()}${module+1}`,`Module ${bank}${module+1} — position ${position}`,count*7,38,['Pogo side faces capsules. All headers and insulated wires are underneath.','Pogo dimensions remain provisional: replace the mounting adapter after measuring the ordered part.','Revision 2 SMART cable uses raw P1/P2/P3; do not attach the old 10k/470-ohm frontend.']);
 section(b,'Nodes','Educational contacts — one node per column');
 for(let c=0;c<count;c++) {
   const name=`NODE${String(start+c).padStart(2,'0')}`;
   const p=part(b,`J_${name}`,`${name} — six contacts`,'chip',Array.from({length:6},(_,k)=>({number:k+1,label:`ROW${k+1}`,hole:[4+c*7,bank==='A'?9+k*4:30-k*4]})),{locked:true,body:'pogo',side:'top',sch:[0,-c*4],provisional:true,mpn:'0906-0-15-20-76-14-11-0'});
   net(b,name,p.pins.map(x=>[p.ref,String(x.number)]),{bare:true});
 }
 section(b,'Service','Capsule OLED service');
 const svc=['SCL','SDA','GND','3V3'];
 const s=part(b,'J_SERVICE','OLED service pogo contacts','chip',svc.map((label,k)=>({number:k+1,label,hole:[10+k,bank==='A'?3:36]})),{locked:true,body:'pogo',side:'top',sch:[12,-2],provisional:true,mpn:'0906-0-15-20-76-14-11-0'});
 const nodeSignals=Array.from({length:10},(_,k)=>k%2===0&&k<2*count?`NODE${String(start+k/2).padStart(2,'0')}`:`NC${k+1}`);
 const j=assigned(idc(b,'J_NODE',nodeSignals,3,bank==='A'?33:4,{locked:true,side:'bottom',sch:[8,-12],label:'NODE cable → matrix'}),Object.fromEntries(nodeSignals.map((n,k)=>[k+1,n]).filter(([,n])=>!/^NC/.test(n))));
 const smartSignals=[`NODE${String(start).padStart(2,'0')}`,'GND',`NODE${String(start+1).padStart(2,'0')}`,'GND',`NODE${String(start+2).padStart(2,'0')}`,'GND',`SDA_${position}`,'3V3_SYS',`SCL_${position}`,'NC10'];
 assigned(idc(b,'J_SMART',smartSignals,count*7-8,bank==='A'?33:4,{locked:true,side:'bottom',sch:[12,4],label:`SMART_RAW v2 → channel ${position}`}),Object.fromEntries(smartSignals.map((n,k)=>[k+1,n]).filter(([,n])=>!/^NC/.test(n))));
 s.signals={SCL:`SCL_${position}`,SDA:`SDA_${position}`,GND:'GND','3V3':'3V3_SYS'};
 b.mounts=bank==='A'?[[2,6],[b.cols-1,6]]:[[2,32],[b.cols-1,32]];
 return place(b);
}
function smartChannel() {
 const b=makeBoard('smart-channel','Smart channel — build six identical cards',39,58,['Fit SOIC/MSOP parts to numbered DIP adapters before installing them. Adapter pin numbers must preserve the IC numbering.','Two 10-ohm current regulators replace the old 470-ohm output resistor. Scope verification of loop stability and short transients is required.']);
 section(b,'Interface','Raw nodes, power and isolated service bus');
 I(b,'J_MODULE',['P1_RAW','GND','P2_RAW','GND','P3_RAW','GND','SDA_B','3V3_SYS','SCL_B','NC10'],{label:'SMART_RAW v2 → module'});
 I(b,'J_CONTROL',['HIGH_REQ','LOW_REQ','AMM_REQ','GND','5V_SYS','3V3_SYS','SDA_A','USB_3V3','SCL_A','5V_EDU'],{label:'CTRL v2 → smart controller'});
 U(b,'U_BUS','TCA9517D',MAPS.tca9517,{VCCA:'USB_3V3',SCLA:'SCL_A',SDAA:'SDA_A',GND:'GND',EN:'USB_3V3',SDAB:'SDA_B',SCLB:'SCL_B',VCCB:'3V3_SYS'},{adapter:'SOIC8 to DIP8'});
 C(b,'C_BUS_A','100nF','USB_3V3','GND');C(b,'C_BUS_B','100nF','3V3_SYS','GND');
 R(b,'R_SDA','4.7k','SDA_B','3V3_SYS');R(b,'R_SCL','4.7k','SCL_B','3V3_SYS');
 section(b,'Voltage','High impedance voltage and logic inputs');
 R(b,'R_P1_TOP','1M','P1_RAW','DIV_P1');R(b,'R_P1_BOTTOM','1M','DIV_P1','GND');
 R(b,'R_P2_TOP','1M','P2_RAW','DIV_P2');R(b,'R_P2_BOTTOM','1M','DIV_P2','GND');
 C(b,'C_P1','1nF','DIV_P1','GND');C(b,'C_P2','1nF','DIV_P2','GND');
 U(b,'U_VBUF','OPA2333AID',MAPS.opa2333,{OUTA:'BUFFER_P1',INA_N:'BUFFER_P1',INA_P:'DIV_P1',VSS:'GND',INB_P:'DIV_P2',INB_N:'BUFFER_P2',OUTB:'BUFFER_P2',VDD:'3V3_SYS'},{adapter:'SOIC8 to DIP8'});C(b,'C_VBUF','100nF','3V3_SYS','GND');
 R(b,'R_ADC1','1k','BUFFER_P1','ADC_P1');R(b,'R_ADC2','1k','BUFFER_P2','ADC_P2');
 U(b,'U_ADC','ADS1115IDGSR',MAPS.ads1115,{ADDR:'GND',GND:'GND',AIN0:'ADC_P1',AIN1:'ADC_P2',AIN2:'GND',AIN3:'GND',VDD:'3V3_SYS',SDA:'SDA_B',SCL:'SCL_B'},{adapter:'VSSOP10 to numbered DIP10'});C(b,'C_ADC','100nF','3V3_SYS','GND');
 section(b,'Current','Isolated bidirectional ammeter');
 R(b,'R_SHUNT','10','SHUNT_P','SHUNT_N',{tolerance:.01,watts:.25});
 U(b,'U_CURRENT','INA219BID',MAPS.ina219,{IN_P:'SHUNT_P',IN_N:'SHUNT_N',GND:'GND',VS:'3V3_SYS',SCL:'SCL_B',SDA:'SDA_B',A0:'GND',A1:'GND'},{adapter:'SOIC8 to DIP8'});C(b,'C_CURRENT','100nF','3V3_SYS','GND');
 const relay=(ref,req,a,c)=>{
   U(b,ref,'AQY212EH',['LED_A','LED_K','SW1','SW2'],{LED_A:`${ref}_LED`,LED_K:`${ref}_CATHODE`,SW1:a,SW2:c});
   R(b,`R_${ref}_LED`,'560','5V_SYS',`${ref}_LED`);R(b,`R_${ref}_OFF`,'100k',req,'GND');
   transistor(b,`Q_${ref}`,'2N7000',['S','G','D'],{S:'GND',G:req,D:`${ref}_CATHODE`});
 };
 relay('K_AMM_P','AMM_REQ','P1_RAW','SHUNT_P');relay('K_AMM_N','AMM_REQ','SHUNT_N','P2_RAW');
 section(b,'Limits','Precision source and sink current regulators');
 R(b,'R_HI_TOP','1k','5V_EDU','REF_HI');R(b,'R_HI_BOTTOM','49.9k','REF_HI','GND');
 R(b,'R_LO_TOP','49.9k','5V_EDU','REF_LO');R(b,'R_LO_BOTTOM','1k','REF_LO','GND');
 C(b,'C_REFHI','100nF','REF_HI','GND');C(b,'C_REFLO','100nF','REF_LO','GND');
 R(b,'R_SOURCE_SENSE','10','5V_EDU','SOURCE_SENSE');R(b,'R_SINK_SENSE','10','SINK_SENSE','GND');
 U(b,'U_LIMIT','OPA2333AID',MAPS.opa2333,{OUTA:'HI_GATE_DRIVE',INA_N:'SOURCE_SENSE',INA_P:'REF_HI',VSS:'GND',INB_P:'REF_LO',INB_N:'SINK_SENSE',OUTB:'LO_GATE_DRIVE',VDD:'5V_SYS'},{adapter:'SOIC8 to DIP8'});C(b,'C_LIMIT','100nF','5V_SYS','GND');
 R(b,'R_HI_GATE','1k','HI_GATE_DRIVE','HI_GATE');R(b,'R_LO_GATE','1k','LO_GATE_DRIVE','LO_GATE');
 // Feedback compensation: initial design value; acceptance tests must exclude oscillation.
 C(b,'C_HI_COMP','1nF','HI_GATE_DRIVE','SOURCE_SENSE');C(b,'C_LO_COMP','1nF','LO_GATE_DRIVE','SINK_SENSE');
 transistor(b,'Q_HIGH','BSS84',['G','S','D'],{G:'HI_GATE',S:'SOURCE_SENSE',D:'SOURCE_OUT'}).adapter='SOT23 to numbered 3-pin adapter';
 transistor(b,'Q_LOW','2N7000',['S','G','D'],{S:'SINK_SENSE',G:'LO_GATE',D:'SINK_IN'});
 section(b,'Output','P3 switched source/sink — both off means high impedance');
 relay('K_HIGH','HIGH_REQ','SOURCE_OUT','P3_RAW');relay('K_LOW','LOW_REQ','P3_RAW','SINK_IN');
 return place(b);
}
function esp(b,ref,role,signals) {
 const left=['3V3','EN','IO36','IO39','IO34','IO35','IO32','IO33','IO25','IO26','IO27','IO14','IO12','GND_L','IO13','SD2','SD3','CMD','V5'];
 const right=['GND_R1','IO23','IO22','TX0','RX0','IO21','GND_R2','IO19','IO18','IO5','IO17','IO16','IO4','IO0','IO2','IO15','SD1','SD0','CLK'];
 // DevKit right row numbers run downwards rather than DIP counterclockwise.
 return assigned(part(b,ref,`ESP32 DevKitC-38 — ${role}`,'chip',[...left.map((label,k)=>({number:k+1,label,hole:[4,4+k]})),...right.map((label,k)=>({number:k+20,label,hole:[14,4+k]}))],{body:'esp',mpn:'ESP32-DevKitC V4 ESP32-WROOM-32E',provisional:true,signals:{'3V3':'USB_3V3',GND_L:'GND',GND_R1:'GND',GND_R2:'GND',...signals}}),{'3V3':'USB_3V3',GND_L:'GND',GND_R1:'GND',GND_R2:'GND',...signals});
}
function watchdog(b) {
 U(b,'U_WATCH','SN74HC123N',MAPS.hc123,{A1_N:'GND',B1:'HEARTBEAT',CLR1_N:'USB_RESET_N',Q1:'ALIVE',CX1:'WATCH_CX',RXCX1:'WATCH_RX',VCC:'USB_3V3',GND:'GND',A2_N:'GND',B2:'GND',CLR2_N:'GND' });
 R(b,'R_WATCH','680k','USB_3V3','WATCH_RX');C(b,'C_WATCH','1uF','WATCH_RX','WATCH_CX');C(b,'C_WATCH_VCC','100nF','USB_3V3','GND');R(b,'R_HEART','100k','HEARTBEAT','GND');
 U(b,'U_USB_POR','MCP130-300DI/TO',['RESET_N','VDD','GND'],{GND:'GND',RESET_N:'USB_RESET_N',VDD:'USB_3V3'},{body:'transistor'});R(b,'R_USB_POR','10k','USB_3V3','USB_RESET_N');
}
function smartController() {
 const b=makeBoard('smart-controller','Smart controller — ESP2, relay register and watchdog',39,78,['Three HCT595 registers provide 18 relay controls. No 5-V pull-up reaches an ESP pin.','Each channel has its own service bus after its TCA9517; never join the buffer B sides.']);
 section(b,'Controller','ESP2 and USB supply');
 esp(b,'U_ESP2','smart controller',{IO25:'SR_SRCLK',IO26:'SR_RCLK',IO27:'SR_SER',IO13:'HEARTBEAT',IO22:'SCL_A',IO4:'SDA_0',IO21:'SDA_1',IO19:'SDA_2',IO18:'SDA_3',IO17:'SDA_4',IO16:'SDA_5'});
 I(b,'J_POWER',['5V_SYS','GND','5V_EDU','GND','3V3_SYS','GND','EDU_ON','NC8','NC9','NC10']);
 R(b,'R_SCL_A','4.7k','USB_3V3','SCL_A');for(let n=0;n<6;n++)R(b,`R_SDA_${n}`,'4.7k','USB_3V3',`SDA_${n}`);
 section(b,'Watchdog','Hardware expiry of valid configuration heartbeat');watchdog(b);
 R(b,'R_OE','10k','5V_SYS','SR_OE_N');
 transistor(b,'Q_ALIVE','2N7000',['S','G','D'],{S:'OE_MID',G:'ALIVE',D:'SR_OE_N'});
 transistor(b,'Q_RAIL','2N7000',['S','G','D'],{S:'GND',G:'EDU_ON',D:'OE_MID'});
 R(b,'R_ALIVE_OFF','100k','ALIVE','GND');R(b,'R_RAIL_OFF','100k','EDU_ON','GND');
 section(b,'Registers','18 default-off relay requests');
 for(let k=0;k<3;k++) {
 const outputs=['QA','QB','QC','QD','QE','QF','QG','QH'];
 const sig={VCC:'5V_SYS',GND:'GND',MR_N:'5V_SYS',OE_N:'SR_OE_N',SHCP:'SR_SRCLK',STCP:'SR_RCLK',DS:k?`SR_CHAIN_${k}`:'SR_SER',QH_SER:`SR_CHAIN_${k+1}`};
 for(let x=0;x<8;x++){const bit=k*8+x;if(bit<18)sig[outputs[x]]=`RELAY_${bit}`;}
 U(b,`U_SR${k}`,'SN74HCT595N',MAPS.hct595,sig);C(b,`C_SR${k}`,'100nF','5V_SYS','GND');
 }
 for(const s of ['SR_SER','SR_SRCLK','SR_RCLK'])R(b,`R_${s}_OFF`,'100k',s,'GND');
 section(b,'Channels','Six identical smart cards');
 for(let n=0;n<6;n++)I(b,`J_CH${n}`,[`RELAY_${3*n}`,`RELAY_${3*n+1}`,`RELAY_${3*n+2}`,'GND','5V_SYS','3V3_SYS',`SDA_${n}`,'USB_3V3','SCL_A','5V_EDU'],{label:`CTRL v2 → channel ${n}`});
 return place(b);
}
function powerBoard() {
 const b=makeBoard('power','Power board — hardware latch and student rail',39,78,['Set both buck modules with their output jumpers OPEN before connecting consumers.','Independent comparator/latch protection is a prototype pending oscilloscope acceptance.','Do not power the Pi from this board.']);
 section(b,'Input','12-V input and separately isolated regulator outputs');
 H(b,'J_INPUT',['12V_IN','GND'],{label:'5.5x2.1 mm barrel pigtail, centre positive'});
 R(b,'F_INPUT','2A slow fuse','12V_IN','12V_FUSED',{kind:'chip',labels:['IN','OUT'],body:'passive',mpn:'Littelfuse 0218002.MXP + holder'});
 H(b,'J_SW_MAIN',['12V_FUSED','12V_SWITCHED'],{label:'latching switch, 3A at 12V DC'});
 R(b,'D_REVERSE','1N5822','12V_SWITCHED','12V_SYS',{kind:'diode',labels:['A','K']});
 C(b,'C_INPUT','470uF','12V_SYS','GND');C(b,'C_INPUT_HF','100nF','12V_SYS','GND');
 // Real module interfaces, with dimensions checked before release (not bare-IC pinouts).
 H(b,'J_BUCK_5V',['NC_PG','NC_EN','12V_SYS','GND','BUCK_5V'],{label:'Pigtail → external Pololu D24V22F5, fixed 5V',body:'header',provisional:true,mpn:'TSW-105-07-G-S',externalPart:'D24V22F5'});
 H(b,'J_BUCK_3V3',['NC_PG','NC_EN','12V_SYS','GND','BUCK_3V3'],{label:'Pigtail → external Pololu D24V22F3, fixed 3.3V',body:'header',provisional:true,mpn:'TSW-105-07-G-S',externalPart:'D24V22F3'});
 H(b,'JP_LOGIC',['SAFE_5V','5V_SYS'],{label:'removable 5-V consumer link'});H(b,'JP_3V3',['SAFE_3V3','3V3_SYS'],{label:'removable 3.3-V consumer link'});
 section(b,'VoltageGuard','Independent buck overvoltage disconnects');
 for(const [suffix,input,output,ovTop,uvTop] of [['5V','BUCK_5V','SAFE_5V','92.8k','80.6k'],['3V3','BUCK_3V3','SAFE_3V3','59k','47.5k']]) {
  U(b,`U_OV_${suffix}`,'LTC4365ITS8#TRMPBF',['VIN','UV','OV','GND','SHDN_N','FAULT_N','VOUT','GATE'],{VIN:input,UV:`UV_${suffix}`,OV:`OV_${suffix}`,GND:'GND',SHDN_N:input,FAULT_N:'PRESET_N',VOUT:output,GATE:`OV_GATE_${suffix}`},{adapter:'TSOT23-8 to numbered DIP8'});
  for(const [n,top] of [['OV',ovTop],['UV',uvTop]]) {
   R(b,`R_${n}_${suffix}_TOP`,top,input,`${n}_${suffix}`,{tolerance:.001});
   R(b,`R_${n}_${suffix}_BOTTOM`,'10k',`${n}_${suffix}`,'GND',{tolerance:.001});
  }
  transistor(b,`Q_OV_${suffix}_IN`,'IRLML6344TRPBF',['G','S','D'],{G:`OV_GATE_${suffix}`,S:`OV_MID_${suffix}`,D:input}).adapter='SOT23 to numbered 3-pin adapter';
  transistor(b,`Q_OV_${suffix}_OUT`,'IRLML6344TRPBF',['G','S','D'],{G:`OV_GATE_${suffix}`,S:`OV_MID_${suffix}`,D:output}).adapter='SOT23 to numbered 3-pin adapter';
  C(b,`C_OV_${suffix}_IN`,'100nF',input,'GND');C(b,`C_OV_${suffix}_OUT`,'470uF',output,'GND');
 }
 section(b,'Student','PTC, MOSFET and current sense');
 R(b,'F_EDU','MF-R050','5V_SYS','PTC_OUT',{kind:'chip',body:'passive',labels:['IN','OUT'],mpn:'Bourns MF-R050'});
 transistor(b,'Q_PASS','NDP6020P',['G','D','S'],{G:'PASS_GATE',D:'SHUNT_P',S:'PTC_OUT'});
 R(b,'R_GATE_OFF','10k','PTC_OUT','PASS_GATE');transistor(b,'Q_ENABLE','2N7000',['S','G','D'],{S:'GND',G:'ALLOW_RAIL',D:'PASS_GATE'});
 R(b,'R_SHUNT','10','SHUNT_P','5V_EDU',{tolerance:.01,watts:1});C(b,'C_EDU','100nF','5V_EDU','GND');
 U(b,'U_SENSE','INA180A1IDBVR',['OUT','GND','IN_P','IN_N','VS'],{OUT:'CURRENT_SENSE',GND:'GND',IN_P:'SHUNT_P',IN_N:'5V_EDU',VS:'3V3_SYS'},{adapter:'SOT23-5 to numbered single-row adapter',body:'header'});C(b,'C_SENSE','100nF','3V3_SYS','GND');
 section(b,'Reference','Precision trip reference and actual rail detection');
 transistor(b,'U_REF','TL431ACLP',['REF','A','K'],{REF:'REF_2V495',A:'GND',K:'REF_2V495'});
 R(b,'R_REF_FEED','1k','5V_SYS','REF_2V495');
 R(b,'R_TRIP_TOP','5.11k','REF_2V495','REF_TRIP');R(b,'R_TRIP_BOTTOM','46.4k','REF_TRIP','GND');
 R(b,'R_EDU_TOP','47k','5V_EDU','EDU_DIV');R(b,'R_EDU_BOTTOM','47k','EDU_DIV','GND');
 U(b,'U_TRIP','LM393P',MAPS.lm393,{OUT1:'PRESET_N',IN1_N:'CURRENT_SENSE',IN1_P:'REF_TRIP',GND:'GND',IN2_P:'EDU_DIV',IN2_N:'REF_TRIP',OUT2:'EDU_ON',VCC:'5V_SYS'});C(b,'C_TRIP','100nF','5V_SYS','GND');
 R(b,'R_PRESET','10k','3V3_SYS','PRESET_N');R(b,'R_EDU_ON','10k','3V3_SYS','EDU_ON');
 section(b,'Latch','Fault latch and simultaneous-reset interlock');
 U(b,'U_POR','MCP130-300DI/TO',['RESET_N','VDD','GND'],{GND:'GND',RESET_N:'PRESET_N',VDD:'3V3_SYS'},{body:'transistor'});
 U(b,'U_FAULT','SN74HC74N',MAPS.hc74,{CLR1_N:'CLEAR_N',D1:'GND',CLK1:'GND',PRE1_N:'PRESET_N',Q1:'EDU_FAULT',QB1:'NOT_FAULT',GND:'GND',VCC:'3V3_SYS',CLR2_N:'3V3_SYS',D2:'GND',CLK2:'GND',PRE2_N:'3V3_SYS'});C(b,'C_FAULT','100nF','3V3_SYS','GND');
 U(b,'U_RESET','SN74HC00N',MAPS.hc00,{A1:'EDU_FAULT_RESET',B1:'PRESET_N',Y1:'CLEAR_N',A2:'GND',B2:'GND',A3:'GND',B3:'GND',A4:'GND',B4:'GND',GND:'GND',VCC:'3V3_SYS'});C(b,'C_RESET','100nF','3V3_SYS','GND');
 U(b,'U_ALLOW','SN74HC08N',MAPS.hc08,{A1:'EDU_PWR_EN',B1:'NOT_FAULT',Y1:'ENABLE_NO_FAULT',A2:'ENABLE_NO_FAULT',B2:'ROUTER_ALIVE',Y2:'ALLOW_RAIL',A3:'GND',B3:'GND',A4:'GND',B4:'GND',GND:'GND',VCC:'3V3_SYS'});C(b,'C_ALLOW','100nF','3V3_SYS','GND');
 for(const s of ['EDU_PWR_EN','EDU_FAULT_RESET','ROUTER_ALIVE'])R(b,`R_${s}_OFF`,'100k',s,'GND');
 section(b,'Indicator','Visible student battery state');
 R(b,'R_BATTERY_LED','2.2k','5V_SYS','BATTERY_LED_A');
 R(b,'LED_BATTERY','WP7113ID','BATTERY_LED_A','BATTERY_LED_K',{kind:'led',pitch:1,labels:['A','K'],mpn:'WP7113ID',label:'red LED — actual student rail on'});
 transistor(b,'Q_BATTERY_LED','2N7000',['S','G','D'],{S:'GND',G:'EDU_ON',D:'BATTERY_LED_K'});
 R(b,'R_LED_GATE_OFF','100k','EDU_ON','GND');
 section(b,'Outputs','Keyed power/control cables and test points');
 I(b,'J_MATRIX',['5V_EDU','GND','3V3_SYS','5V_SYS','EDU_PWR_EN','EDU_FAULT','EDU_FAULT_RESET','CURRENT_SENSE','ROUTER_ALIVE','12V_SYS'],{label:'POWER_MATRIX v2'});
 I(b,'J_SMART',['5V_SYS','GND','5V_EDU','GND','3V3_SYS','GND','EDU_ON','NC8','NC9','NC10'],{label:'POWER_SMART v2'});
 H(b,'J_FIXED_BATTERY',['5V_EDU','GND'],{label:'fixed battery patch lead: C2 positive, C1 ground; unplug before matrix mode'});
 H(b,'J_TEST',['5V_EDU','GND','REF_TRIP','CURRENT_SENSE','PRESET_N','EDU_FAULT'],{label:'scope / known load fixture'});
 return place(b);
}
function matrixBoard() {
 const b=makeBoard('matrix','Matrix board — 22 nodes, shared buses and test tools',59,59,['12V_SYS must remain within 10.0–12.6V at the MT8816 pins. VSS and VEE are ground.','12mA limit applies to every analog pin, including a shared Y bus, not just an individual crosspoint.']);
 section(b,'Controller','ESP1 and safe default routing control');
 esp(b,'U_ESP1','router',{IO23:'XBAR_DAT',IO18:'XBAR_CLK',IO22:'XBAR_LATCH',IO19:'STB_A_IN',IO21:'STB_B_IN',IO27:'RST_RELEASE',IO33:'HEARTBEAT',IO32:'EDU_PWR_EN',IO35:'FAULT_USB',IO17:'EDU_FAULT_RESET',IO34:'CURRENT_USB',IO36:'DIAG_ADC',IO4:'FIX_SDA',IO16:'FIX_SCL',IO25:'FIX_STIM',V5:'USB_5V'});
 I(b,'J_POWER',['5V_EDU','GND','3V3_SYS','5V_SYS','EDU_PWR_EN','EDU_FAULT','EDU_FAULT_RESET','CURRENT_SENSE','ALIVE','12V_SYS'],{label:'POWER_MATRIX v2'});
 H(b,'J_FIXTURE',['USB_3V3','GND','FIX_SDA','FIX_SCL','FIX_STIM'],{label:'manual continuity fixture; ESP1 GPIO4 SDA / GPIO16 SCL / GPIO25 stimulus'});
 H(b,'J_PROTOTYPE',['USB_5V','USB_3V3','GND','EDU_PWR_EN'],{label:'USB breadboard prototype; remove before final rail connection'});
 section(b,'Watchdog','USB-powered watchdog and output enable');watchdog(b);
 R(b,'R_BUF_OE','10k','5V_SYS','XBAR_OE_N');transistor(b,'Q_BUF','2N7000',['S','G','D'],{S:'GND',G:'ALIVE',D:'XBAR_OE_N'});R(b,'R_ALIVE_OFF','100k','ALIVE','GND');
 section(b,'Control','5-V serial address latch and tri-state strobes');
 U(b,'U_ADDR','SN74HCT595N',MAPS.hct595,{VCC:'5V_SYS',GND:'GND',MR_N:'5V_SYS',OE_N:'XBAR_OE_N',SHCP:'XBAR_CLK',STCP:'XBAR_LATCH',DS:'XBAR_DAT',QA:'AX0',QB:'AX1',QC:'AX2',QD:'AX3',QE:'AY0',QF:'AY1',QG:'AY2',QH:'XBAR_DATA'});C(b,'C_ADDR','100nF','5V_SYS','GND');
 U(b,'U_BUFFER','SN74HCT125N',['OE1_N','A1','Y1','OE2_N','A2','Y2','GND','Y3','A3','OE3_N','Y4','A4','OE4_N','VCC'],{OE1_N:'XBAR_OE_N',A1:'STB_A_IN',Y1:'STROBE_A',OE2_N:'XBAR_OE_N',A2:'STB_B_IN',Y2:'STROBE_B',OE3_N:'5V_SYS',A3:'GND',OE4_N:'5V_SYS',A4:'GND',GND:'GND',VCC:'5V_SYS'});C(b,'C_BUFFER','100nF','5V_SYS','GND');
 for(const s of ['XBAR_DAT','XBAR_CLK','XBAR_LATCH','STB_A_IN','STB_B_IN','RST_RELEASE'])R(b,`R_${s}_OFF`,'100k',s,'GND');
 R(b,'R_RESET_ON','47k','12V_SYS','XBAR_RESET');
 transistor(b,'Q_RESET_RELEASE','2N7000',['S','G','D'],{S:'RESET_MID',G:'RST_RELEASE',D:'XBAR_RESET'});
 transistor(b,'Q_RESET_ALIVE','2N7000',['S','G','D'],{S:'GND',G:'ALIVE',D:'RESET_MID'});
 // MT RESET tolerates VDD and ignores CS: no dependency on the 5-V guard startup.
 R(b,'R_STBA_OFF','10k','STROBE_A','GND');R(b,'R_STBB_OFF','10k','STROBE_B','GND');
 section(b,'Matrix','Two MT8816AE1 DIP40 matrices');
 for(let bank=0;bank<2;bank++) {
 const sig={VDD:'12V_SYS',VSS:'GND',VEE:'GND',CS:'5V_SYS',DATA:'XBAR_DATA',RESET:'XBAR_RESET',STROBE:bank?'STROBE_B':'STROBE_A',Y0:'GND',Y1:'5V_EDU'};
 for(let x=0;x<11;x++)sig[`X${x}`]=`NODE${String(bank*11+x).padStart(2,'0')}`;
 for(let y=2;y<8;y++)sig[`Y${y}`]=`BUS${y}`;
 for(const a of ['AX0','AX1','AX2','AX3','AY0','AY1','AY2'])sig[a]=a;
 if(!bank)Object.assign(sig,{X11:'SOURCE_HI',X12:'SOURCE_LO',X13:'DIAG_NODE',X14:'DISCHARGE',X15:'CAL_LOAD'});
 U(b,bank?'U_MT_B':'U_MT_A','MT8816AE1',MAPS.mt8816,sig,{gap:6});C(b,`C_MT${bank}`,'100nF','12V_SYS','GND');C(b,`C_MT${bank}_BULK`,'10uF','12V_SYS','GND');
 }
 section(b,'Nodes','Node ribbon headers');
 for(let bank=0;bank<2;bank++)for(let m=0;m<3;m++) {
 const count=m===2?3:4,start=bank*11+m*4;
 I(b,`J_${bank?'B':'A'}${m+1}`,Array.from({length:10},(_,k)=>k%2===0&&k<count*2?`NODE${String(start+k/2).padStart(2,'0')}`:`NC${k+1}`));
 }
 section(b,'Tools','Low-current source, discharge and buffered diagnostic ADC');
 R(b,'D_SOURCE','BAT85','3V3_SYS','SOURCE_FEED',{kind:'diode',labels:['A','K']});
 R(b,'R_SOURCE_HI','10k','SOURCE_FEED','SOURCE_HI');R(b,'R_SOURCE_LO','470','SOURCE_FEED','SOURCE_LO');
 R(b,'R_DISCHARGE','470','DISCHARGE','GND');R(b,'R_CAL','1k','CAL_LOAD','GND',{tolerance:.01});
 R(b,'R_DIAG_TOP','1M','DIAG_NODE','DIAG_DIV');R(b,'R_DIAG_BOTTOM','1M','DIAG_DIV','GND');C(b,'C_DIAG','1nF','DIAG_DIV','GND');
 U(b,'U_DIAG','OPA2333AID',MAPS.opa2333,{OUTA:'DIAG_ADC',INA_N:'DIAG_ADC',INA_P:'DIAG_DIV',VSS:'GND',VDD:'USB_3V3',OUTB:'DIAG_UNUSED',INB_N:'DIAG_UNUSED',INB_P:'GND'},{adapter:'SOIC8 to DIP8'});C(b,'C_DIAG_VCC','100nF','USB_3V3','GND');
 section(b,'Return','Power-off isolated fault and current returns');
 U(b,'U_FAULT_RETURN','SN74LVC1G125DBVR',['OE_N','A','GND','Y','VCC'],{OE_N:'GND',A:'EDU_FAULT',GND:'GND',Y:'FAULT_USB',VCC:'USB_3V3'},{body:'header',adapter:'SOT23-5 to numbered adapter'});C(b,'C_RETURN','100nF','USB_3V3','GND');
 U(b,'K_ADC','AQY212EH',['LED_A','LED_K','SW1','SW2'],{LED_A:'K_ADC_LED',LED_K:'GND',SW1:'CURRENT_SENSE',SW2:'CURRENT_USB'});R(b,'R_KADC_LED','330','USB_3V3','K_ADC_LED');
 return place(b);
}
function integration() {
 const b=makeBoard('integration','Pi buttons and PN532 SPI harness',39,39,['Pi uses its own rated USB supply. This harness shares ground, never a 5-V supply.','PN532 carrier is Adafruit product 364; interface switches select SPI. Mount it with standoffs and use its labelled connector.']);
 section(b,'Pi','Raspberry Pi 40-pin header — physical pin numbers');
 const labels=Array.from({length:40},(_,k)=>`NC${k+1}`);const map={1:'PI_3V3',6:'GND',19:'MOSI',21:'MISO',23:'SCLK',24:'CE0_N',29:'ENERGIZE_N',31:'BACK_N'};
 for(const [p,s]of Object.entries(map))labels[Number(p)-1]=s;
 assigned(part(b,'J_PI','Pi physical header','header',labels.map((label,k)=>({number:k+1,label,hole:[4+k%2,4+Math.floor(k/2)]})),{body:'header',mpn:'TSW-120-07-G-D'}),Object.fromEntries(Object.entries(map)));
 H(b,'J_NFC',['PI_3V3','GND','SCLK','MOSI','MISO','CE0_N'],{label:'PN532 labelled SPI harness (Adafruit 364)',provisional:true});
 section(b,'Buttons','Debounced active-low request buttons');
 H(b,'J_SW_ENERGIZE',['ENERGIZE_N','GND'],{label:'Energizar dry-contact button'});H(b,'J_SW_BACK',['BACK_N','GND'],{label:'Back dry-contact button'});
 R(b,'R_ENERGIZE','10k','PI_3V3','ENERGIZE_N');R(b,'R_BACK','10k','PI_3V3','BACK_N');C(b,'C_ENERGIZE','100nF','ENERGIZE_N','GND');C(b,'C_BACK','100nF','BACK_N','GND');
 H(b,'J_GROUND',['GND'],{label:'ground to electronics'});return place(b);
}
function continuityFixture() {
 const b=makeBoard('continuity-fixture','Manual continuity fixture — no matrix required',39,39,['Connect TEST_A to A1 C4 and TEST_B to A1 C1 using removable test leads. Student supply stays OFF.','Stimulus is limited by 10kΩ and isolated by a PhotoMOS switch. Unplug educational leads before ordinary operation.']);
 section(b,'Interface','USB-powered ESP1 interface and fixed test endpoints');
 H(b,'J_CONTROL',['USB_3V3','GND','FIX_SDA','FIX_SCL','FIX_STIM'],{label:'from router J_FIXTURE'});
 H(b,'J_TEST',['TEST_A','TEST_B'],{label:'removable sense leads: C4 / C1'});
 H(b,'JP_RETURN',['TEST_B','GND'],{label:'fit only during supervised continuity test'});
 R(b,'R_SDA','4.7k','USB_3V3','FIX_SDA');R(b,'R_SCL','4.7k','USB_3V3','FIX_SCL');
 section(b,'Stimulus','Default-off limited continuity stimulus');
 R(b,'D_STIM','BAT85','USB_3V3','STIM_FEED',{kind:'diode',labels:['A','K']});
 R(b,'R_STIM','10k','STIM_FEED','STIM_LIMIT');
 U(b,'K_STIM','AQY212EH',['LED_A','LED_K','SW1','SW2'],{LED_A:'STIM_LED_A',LED_K:'STIM_LED_K',SW1:'STIM_LIMIT',SW2:'TEST_A'});
 R(b,'R_LED','560','USB_3V3','STIM_LED_A');R(b,'R_OFF','100k','FIX_STIM','GND');
 transistor(b,'Q_STIM','2N7000',['S','G','D'],{S:'GND',G:'FIX_STIM',D:'STIM_LED_K'});
 section(b,'Sense','Buffered fixed-pair differential measurement');
 for(const n of ['A','B']){R(b,`R_${n}_TOP`,'1M',`TEST_${n}`,`DIV_${n}`);R(b,`R_${n}_BOTTOM`,'1M',`DIV_${n}`,'GND');C(b,`C_${n}`,'1nF',`DIV_${n}`,'GND');R(b,`R_ADC_${n}`,'1k',`BUF_${n}`,`ADC_${n}`);}
 U(b,'U_BUFFER','OPA2333AID',MAPS.opa2333,{OUTA:'BUF_A',INA_N:'BUF_A',INA_P:'DIV_A',VSS:'GND',INB_P:'DIV_B',INB_N:'BUF_B',OUTB:'BUF_B',VDD:'USB_3V3'},{adapter:'SOIC8 to DIP8'});C(b,'C_BUFFER','100nF','USB_3V3','GND');
 U(b,'U_ADC','ADS1115IDGSR',MAPS.ads1115,{ADDR:'GND',GND:'GND',AIN0:'ADC_A',AIN1:'ADC_B',AIN2:'GND',AIN3:'GND',VDD:'USB_3V3',SDA:'FIX_SDA',SCL:'FIX_SCL'},{adapter:'VSSOP10 to numbered DIP10'});C(b,'C_ADC','100nF','USB_3V3','GND');
 return place(b);
}
function usbPrototype() {
 const b=makeBoard('usb-prototype','USB test-source breadboard',14,30,['Temporary 400-tie breadboard fixture; identify its actual row and rail breaks before wiring.','Only the switch GPIO is a control signal. Educational power comes from USB through a 560Ω hardware limiter.','Disconnect this source before installing the final supply. Never connect two sources to the same bank.']);
 b.kind='breadboard';b.width=54;b.height=82;b.mounts=[];
 section(b,'Switch','Default-OFF USB switch and bounded LED test source');
 const add=(ref,label,kind,pins,opts={})=>part(b,ref,label,kind,pins.map(([number,label,x,y])=>({number,label,hole:[x,y]})),opts);
 assigned(add('J_CONTROL','Four individual flying leads from ESP1 prototype header','header',[[1,'USB_5V',13,2],[2,'USB_3V3',13,3],[3,'GND',13,4],[4,'EDU_PWR_EN',13,5]],{body:'header',mpn:'24AWG male flying jumper leads (identify purchased set)',provisional:true}),labelsMap(['USB_5V','USB_3V3','GND','EDU_PWR_EN']));
 assigned(add('Q_PASS','USB high-side switch','chip',[[1,'G',2,10],[2,'D',2,11],[3,'S',2,12]],{body:'transistor',mpn:'NDP6020P'}),{G:'PROTO_GATE',D:'PROTO_DRAIN',S:'USB_5V'});
 assigned(add('Q_ENABLE','3.3V gate-control transistor','chip',[[1,'S',2,17],[2,'G',2,18],[3,'D',2,19]],{body:'transistor',mpn:'2N7000'}),{S:'GND',G:'EDU_PWR_EN',D:'PROTO_GATE'});
 assigned(add('R_GATE_OFF','10kΩ makes the P-channel switch OFF','resistor',[[1,'1',4,10],[2,'2',4,14]],{value:'10k',mpn:'MFR-25FBF52-10K'}),{'1':'PROTO_GATE','2':'USB_5V'});
 assigned(add('R_ENABLE_OFF','100kΩ holds enable LOW','resistor',[[1,'1',6,18],[2,'2',6,22]],{value:'100k',mpn:'MFR-25FBF52-100K'}),{'1':'EDU_PWR_EN','2':'GND'});
 assigned(add('R_LIMIT','560Ω ±1%, 0.25W; bounds every educational-source path','resistor',[[1,'1',6,11],[2,'2',9,11]],{value:'560',watts:.25,tolerance:.01,mpn:'MFR-25FBF52-560R'}),{'1':'PROTO_DRAIN','2':'USB_TEST_LIMITED'});
 assigned(add('J_OUTPUT','Two flying leads: C2 positive / C1 return','header',[[1,'USB_TEST_LIMITED',13,11],[2,'GND',13,24]],{body:'header',mpn:'24AWG male flying jumper leads (identify purchased set)',provisional:true}),labelsMap(['USB_TEST_LIMITED','GND']));
 assigned(add('C_USB','USB3V3 fixture decoupling','capacitor',[[1,'1',9,3],[2,'2',9,4]],{value:'100nF',mpn:'C315C104K5R5TA'}),{'1':'USB_3V3','2':'GND'});
 b.parts.forEach(p=>p.bounds=bound(p));collect(b);
 const group=x=>x>=2&&x<=6?'left':x>=9&&x<=13?'right':null;
 b.wires.forEach(w=>{const a=w.path[0],z=w.path.at(-1);w.breadboardTie=a[1]===z[1]&&group(a[0])&&group(a[0])===group(z[0]);});
 return b;
}
export const boards=[...['A','B'].flatMap(bank=>[0,1,2].map(m=>nodeModule(bank,m))),powerBoard(),smartController(),smartChannel(),matrixBoard(),integration(),continuityFixture(),usbPrototype()];
export const byId=Object.fromEntries(boards.map(b=>[b.id,b]));
export const instances=boards.map(b=>({board:b.id,quantity:b.id==='smart-channel'?6:1}));
