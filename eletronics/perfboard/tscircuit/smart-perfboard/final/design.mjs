// Completion-board candidate. The soldered stage-1 board is not modified.
export const board={columns:30,rows:45,pitch:2.54,width:76.2,height:114.3};
export const parts=[];
const add=(ref,kind,value,labels,nets,section,mpn,extra={})=>{const p={ref,kind,value,section,mpn,...extra,pins:labels.map((label,i)=>({pin:i+1,label,net:nets[i]??null}))};parts.push(p);return p;};
const H=(ref,labels,nets,section)=>add(ref,'header',`${labels.length} pins`,labels,nets,section,'61201021621');
const R=(ref,v,a,b,s,tol='1%')=>add(ref,'resistor',v,['1','2'],[a,b],s,'MFR-25FBF52-'+v,{tolerance:tol});
const C=(ref,v,a,b,s)=>add(ref,'capacitor',v,['1','2'],[a,b],s,'RADIAL-'+v);
const D=(ref,a,b,s)=>add(ref,'diode','1N4148',['A','K'],[a,b],s,'1N4148');
const T=(ref,e,b,c,s)=>add(ref,'transistor','BC548B',['C','B','E'],[c,b,e],s,'BC548B');
const amp=(ref,nets,s)=>add(ref,'dip','MCP6002-I/P',['OUT_A','IN_A_N','IN_A_P','VSS','IN_B_P','IN_B_N','OUT_B','VDD'],nets,s,'MCP6002-I/P');
H('J_CTRL',['ARM13','HB14','A25','B26','C27','ADC34','ADC35','EDU23','3V3','GND'],['ARM','HB','MODE_A','MODE_B','MODE_C','ADC_A','ADC_B','EDU_ON','V3V3_LOCAL','GND'],'Interfaces');
H('J_POWER',['V5V_SYS','GND','V5V_EDU','GND'],['V5V_SYS','GND','V5V_EDU','GND'],'Interfaces');
H('J_ROUTER',['SENSE_A','GND','SENSE_B','PULSE','GND','EDU_ON','OFF_OK'],['SENSE_A','GND','SENSE_B','PULSE_OUT','GND','EDU_ON','EDU_OFF_OK'],'Interfaces');
// Safe-side ADC bias avoids near-ground buffer clipping. Calibrate each channel.
R('R_BIAS_TOP','5.62k','V3V3_LOCAL','BIAS','Voltage');R('R_BIAS_BOT','1k','BIAS','GND','Voltage');C('C_BIAS','100nF','BIAS','GND','Voltage');
for(const n of ['A','B']){R(`R_${n}_TOP`,'1M',`SENSE_${n}`,`DIV_${n}`,'Voltage','0.1%');R(`R_${n}_BOT`,'1M',`DIV_${n}`,'BIAS','Voltage','0.1%');C(`C_${n}_DIV`,'1nF',`DIV_${n}`,'GND','Voltage');R(`R_${n}_ADC`,'1k',`BUF_${n}`,`ADC_${n}`,'Voltage');C(`C_${n}_ADC`,'10nF',`ADC_${n}`,'GND','Voltage');}
amp('U_BUF',['BUF_A','BUF_A','DIV_A','GND','DIV_B','BUF_B','BUF_B','V3V3_LOCAL'],'Voltage');C('C_BUF','100nF','V3V3_LOCAL','GND','Voltage');
// Independent expiry. ARM has a physical pull-down; static heartbeat expires.
add('U_WATCH','dip','CD74HC123E',['A1_N','B1','CLR1_N','QB1','Q2','CX2','RXCX2','GND','A2_N','B2','CLR2_N','QB2','Q1','CX1','RXCX1','VCC'],['GND','HB','ARM',null,null,null,null,'GND','GND','GND','GND',null,'ALIVE','WATCH_CX','WATCH_RX','V3V3_LOCAL'],'Watchdog','CD74HC123E');
R('R_WATCH','680k','V3V3_LOCAL','WATCH_RX','Watchdog');C('C_WATCH','1uF','WATCH_RX','WATCH_CX','Watchdog');C('C_WATCH_VCC','100nF','V3V3_LOCAL','GND','Watchdog');
for(const n of ['ARM','HB','MODE_A','MODE_B','MODE_C','EDU_ON','EDU_OFF_OK'])R(`R_PD_${n}`,'100k',n,'GND','Watchdog');
// 001=source, 010=sink, 100=diagnostic; every other code has no used output.
add('U_MODE','dip','CD74HC238E',['A0','A1','A2','G0_N','G1_N','G2','Y7','GND','Y6','Y5','Y4','Y3','Y2','Y1','Y0','VCC'],['MODE_A','MODE_B','MODE_C','GND','GND','ALIVE',null,'GND',null,null,'DEC_DIAG',null,'DEC_LOW','DEC_HIGH',null,'V3V3_LOCAL'],'Mode','CD74HC238E');C('C_MODE','100nF','V3V3_LOCAL','GND','Mode');
add('U_GATE','dip','CD74HC08E',['A1','B1','Y1','A2','B2','Y2','GND','Y3','A3','B3','Y4','A4','B4','VCC'],['DEC_HIGH','EDU_ON','HIGH_EN','DEC_LOW','EDU_ON','LOW_EN','GND','DIAG_EN','DEC_DIAG','EDU_OFF_OK',null,'GND','GND','V3V3_LOCAL'],'Mode','CD74HC08E');C('C_GATE','100nF','V3V3_LOCAL','GND','Mode');
// Analog current regulation copied in principle from the precision source/sink
// topology. Compensation and compliance require physical qualification.
R('R_REF_H_TOP','1k','V5V_EDU','REF_H','Limits');R('R_REF_H_BOT','49.9k','REF_H','GND','Limits');
R('R_REF_L_TOP','49.9k','V5V_EDU','REF_L','Limits');R('R_REF_L_BOT','1k','REF_L','GND','Limits');
C('C_REF_H','100nF','REF_H','GND','Limits');C('C_REF_L','100nF','REF_L','GND','Limits');
R('R_H_SENSE','10','V5V_EDU','H_SENSE','Limits');R('R_L_SENSE','10','L_SENSE','GND','Limits');
for(const [ref,a,b] of [['H_N','H_SENSE','LIM_A_N'],['H_P','REF_H','LIM_A_P'],['L_P','REF_L','LIM_B_P'],['L_N','L_SENSE','LIM_B_N']])R(`R_IN_${ref}`,'47k',a,b,'Limits');
amp('U_LIMIT',['H_DRIVE','LIM_A_N','LIM_A_P','GND','LIM_B_P','LIM_B_N','L_DRIVE','V5V_SYS'],'Limits');C('C_LIMIT','100nF','V5V_SYS','GND','Limits');
R('R_H_GATE','1k','H_DRIVE','H_GATE','Limits');R('R_L_GATE','1k','L_DRIVE','L_GATE','Limits');
R('R_H_OFF','100k','H_GATE','H_SENSE','Limits');R('R_L_OFF','100k','L_GATE','GND','Limits');
C('C_H_COMP','1nF','H_DRIVE','H_SENSE','Limits');C('C_L_COMP','1nF','L_DRIVE','L_SENSE','Limits');
add('Q_H_ADAPTER','adapter','BSS84 on D-S-G adapter',['D','S','G'],['SOURCE_OUT','H_SENSE','H_GATE'],'Limits','BSS84',{note:'SOT23-to-3-pin adapter, verify actual mapping; body not measured'});
add('Q_LOW','adapter','2N7000 on D-S-G adapter',['D','S','G'],['SINK_IN','L_SENSE','L_GATE'],'Limits','2N7000');
const relay=(ref,en,a,b,section)=>{
 add(ref,'dip','AQY212EH',['LED_A','LED_K','SW1','SW2'],[`${ref}_A`,`${ref}_K`,a,b],section,'AQY212EH');
 R(`R_${ref}_LED`,'270','V3V3_LOCAL',`${ref}_A`,section);R(`R_${ref}_BASE`,'4.7k',en,`${ref}_BASE`,section);R(`R_${ref}_OFF`,'100k',`${ref}_BASE`,'GND',section);T(`Q_${ref}`,'GND',`${ref}_BASE`,`${ref}_K`,section);
};
relay('U_SSR_HIGH','HIGH_EN','SOURCE_OUT','PULSE_OUT','Pulse');relay('U_SSR_LOW','LOW_EN','PULSE_OUT','SINK_IN','Pulse');
D('D_STIM','V3V3_LOCAL','STIM_FEED','Diagnostic');R('R_STIM','11k','STIM_FEED','STIM_LIMITED','Diagnostic');
relay('U_SSR_STIM','DIAG_EN','STIM_LIMITED','SENSE_A','Diagnostic');relay('U_SSR_RETURN','DIAG_EN','SENSE_B','GND','Diagnostic');
export const sections=['Interfaces','Voltage','Watchdog','Mode','Limits','Pulse','Diagnostic'];
// Provisional packing envelopes on a separate 30x45 completion perfboard.
// This is placement only, not routing. Actual bodies/adapters must be dry-fitted.
const used=[];for(const p of [...parts].sort((a,b)=>(b.kind==='dip'?1:0)-(a.kind==='dip'?1:0))){
 const dip=p.kind==='dip',count=p.pins.length,span=dip?3:p.kind==='header'?count-1:p.kind==='resistor'||p.kind==='diode'?3:p.kind==='capacitor'?1:2;
 const height=dip?count/2-1:0,marginX=p.kind==='capacitor'?1.2:.7,marginY=dip?.8:p.kind==='capacitor'?1.2:.6;
 let found=false;
 for(let r=2;r<=44&&!found;r++)for(let c=2;c<=29&&!found;c++){
  const box={x1:c-marginX,x2:c+span+marginX,y1:r-marginY,y2:r+height+marginY};
  if(box.x2>29.5||box.y2>44.5||used.some(q=>box.x1<q.x2&&box.x2>q.x1&&box.y1<q.y2&&box.y2>q.y1))continue;
  p.pins.forEach((q,i)=>{q.c=dip?(i<count/2?c:c+3):c+(p.kind==='resistor'||p.kind==='diode'?i*3:i);q.r=dip?r+(i<count/2?i:count-1-i):r;});
  p.envelope=box;used.push(box);found=true;
 }
 if(!found)throw Error(`Completion board does not fit ${p.ref}`);
}
for(const ref of ['R_BIAS_BOT','R_PD_MODE_B','C_MODE','R_L_SENSE','C_LIMIT']){const p=parts.find(p=>p.ref===ref);const a={c:p.pins[0].c,r:p.pins[0].r};p.pins[0].c=p.pins[1].c;p.pins[0].r=p.pins[1].r;p.pins[1].c=a.c;p.pins[1].r=a.r;p.pcbRotation=180;}
export const endpoints=new Map(parts.flatMap(p=>p.pins.map(q=>[`${p.ref}.${q.pin}`,{...q,ref:p.ref}])));
export const nets=[...new Set(parts.flatMap(p=>p.pins.map(q=>q.net).filter(Boolean)))];
export const wires=nets.flatMap(net=>{const es=[...endpoints].filter(([_,q])=>q.net===net).map(([e])=>e);return es.slice(1).map((to,i)=>({net,from:es[i],to}));}).map((w,i)=>({id:`F${String(i+1).padStart(3,'0')}`,...w}));
