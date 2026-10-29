export const parts=[];
const add=(ref,kind,value,section,x,y,pinNets,pinLabels={},extra={})=>{const p={ref,kind,value,section,x,y,pins:Object.entries(pinNets).map(([pin,net])=>({pin:Number(pin),net,label:pinLabels[pin]??`P${pin}`})),...extra};parts.push(p);return p;};
const r=(ref,value,section,x,y,a,b)=>add(ref,'R',value,section,x,y,{1:a,2:b},{1:'A',2:'B'},{mpn:'Generic axial resistor',footprint:'axial_p0.3in'});
const c=(ref,value,section,x,y,a,b,polarized=false)=>add(ref,'C',value,section,x,y,{1:a,2:b},{1:polarized?'+':'A',2:polarized?'-':'B'},{mpn:'Generic radial capacitor',footprint:polarized?'electrolytic_d6.3mm_p2.54mm':'radial_p2.54mm',polarized});
const q=(ref,pnp,section,x,y,C,B,E)=>add(ref,'Q',pnp?'BC557B':'BC548B',section,x,y,{1:C,2:B,3:E},{1:'C',2:'B',3:'E'},{mpn:pnp?'BC557B':'BC548B',footprint:'to92',pnp});
const h=(ref,section,x,y,nets,rotation=0)=>add(ref,'J','Conector sem modelo comprado',section,x,y,Object.fromEntries(nets.map((n,i)=>[i+1,n])),Object.fromEntries(nets.map((n,i)=>[i+1,n??'NC'])),{mpn:'61201021621',footprint:`pinrow${nets.length}_p2.54mm`,rotation});
export const gpio={SER:23,CLK:18,LATCH:22,STROBE:19,OE_ENABLE:21,RESET_RELEASE:25,HIGH:26,LOW:27,TEST:14,PULSE_IN:34};
// Existing 30-pin DevKit socket spacing is provisional: measure before PCB manufacture.
const L=['3V3','GND','15','2','4','16','17','5','18','19','21','3_RX0','1_TX0','22','23'];
const R=['VIN','GND','13','12','14','27','26','25','33','32','35','34','39_VN','36_VP','EN'];
const gn=n=>n==='GND'?'GND':Object.values(gpio).includes(Number(n))?`GPIO${n}`:null;
for(const [ref,x,labels]of[['J_ESP_L',-12.7,L],['J_ESP_R',12.7,R]])h(ref,'ESP32',x,76,labels.map(gn),270).pins.forEach((p,i)=>p.label=/^[0-9]/.test(labels[i])&&!['3V3'].includes(labels[i])?'GPIO'+labels[i]:labels[i]);
// Preserve original NPN converters. All commands are inverted at collectors.
const signals=[['Q1',23,'SER5','R19','R20','R2'],['Q2',18,'CLK5','R22','R23','R3'],['Q3',22,'LATCH5','R25','R26','R4'],['Q4',19,'STROBE5','R28','R29','R5'],['Q5',21,'OE_N5','R31','R32','R1'],['Q6',25,'RESET12','R6','R12','R7']];
signals.forEach(([ref,g,out,rb,rpd,rpu],i)=>{let x=-35+i*14;const sec=i<3?'AdaptacaoSerial':'AdaptacaoControle';q(ref,false,sec,x,44,out,`${ref}_B`,'GND');r(rb,ref==='Q6'?'10k':'4.7k',sec,x,40,`GPIO${g}`,`${ref}_B`);r(rpd,'100k',sec,x,35,`${ref}_B`,'GND');r(rpu,ref==='Q6'?'47k':'1k',sec,x,30,ref==='Q6'?'V12':'V5',out);});
const base595={8:'GND',10:'V5',11:'CLK5',12:'LATCH5',13:'OE_N5',16:'V5'};
const labs595={1:'QB',2:'QC',3:'QD',4:'QE',5:'QF',6:'QG',7:'QH',8:'GND',9:'QH_SER',10:'SRCLR_N',11:'SRCLK',12:'RCLK',13:'OE_N',14:'SER',15:'QA',16:'VCC'};
add('U5','IC','74HC595','Registros',-21,15,{...base595,14:'SER5',9:'CHAIN',15:'AX0',1:'AX1',2:'AX2',3:'AX3',4:'AY0',5:'AY1',6:'AY2',7:'DATA'},labs595,{mpn:'SN74HC595N',footprint:'dip16_w7.62mm'});
add('U6','IC','74HC595','Registros',21,15,{...base595,14:'CHAIN',15:'CS_A',1:'CS_B',2:null,3:null,4:null,5:null,6:null,7:null,9:null},labs595,{mpn:'SN74HC595N',footprint:'dip16_w7.62mm'});
c('C4','100nF','Registros',-33,15,'V5','GND');c('C5','100nF','Registros',33,15,'V5','GND');
r('R8','10k','Registros',-7,10,'CS_A','GND');r('R9','10k','Registros',7,10,'CS_B','GND');
// Each bank uses X0..X10 for 11 nodes. Y5/Y6/Y7 are PRIVATE buses.
const mtLabels={1:'Y3',2:'AY2',3:'RESET',4:'AX3',5:'AX0',6:'X14',7:'X15',8:'X6',9:'X7',10:'X8',11:'X9',12:'X10',13:'X11',14:'NC',15:'Y7',16:'VSS',17:'Y6',18:'STROBE',19:'Y5',20:'VEE',21:'Y4',22:'AX1',23:'AX2',24:'AY0',25:'AY1',26:'X13',27:'X12',28:'X5',29:'X4',30:'X3',31:'X2',32:'X1',33:'X0',34:'NC',35:'Y0',36:'CS',37:'Y1',38:'DATA',39:'Y2',40:'VDD'};
const xPins=[33,32,31,30,29,28,8,9,10,11,12];
for(const [b,x,offset]of[['A',-23,0],['B',23,11]]){let ns={};for(let i=1;i<=40;i++){const l=mtLabels[i];ns[i]=['AX0','AX1','AX2','AX3','AY0','AY1','AY2','DATA'].includes(l)?l:null;}Object.assign(ns,{3:'RESET12',16:'GND',20:'GND',18:'STROBE5',35:'GND',37:'PULSE_BUS',39:'TEST_BUS',1:'SENSE_A',21:'SENSE_B',19:`BUS_${b}5`,17:`BUS_${b}6`,15:`BUS_${b}7`,36:`CS_${b}`,40:'V12'});xPins.forEach((pin,i)=>ns[pin]=`NODE${String(offset+i).padStart(2,'0')}`);add(b==='A'?'U1':'U2','IC','MT8816AE1',`Matriz${b}`,x,-25,ns,mtLabels,{mpn:'MT8816AE1',footprint:'dip40_w15.24mm'});c(b==='A'?'C1':'C2','100nF',`Matriz${b}`,b==='A'?-10:10,-8,'V12','GND');h(b==='A'?'H1':'H3',`Matriz${b}`,b==='A'?-45:45,-25,xPins.map((_,i)=>`NODE${String(offset+i).padStart(2,'0')}`),270);}
// High and low have SEPARATE series limit resistors: even overlap cannot short rails directly.
q('Q7',true,'Pulso',-34,-64,'HIGH_C','HIGH_B','V5');q('Q8',false,'Pulso',-20,-64,'HIGH_DRV','Q8_B','GND');
r('R21','47k','Pulso',-34,-72,'V5','HIGH_B');r('R30','4.7k','Pulso',-20,-72,'HIGH_B','HIGH_DRV');r('R13','10k','Pulso',-20,-80,'GPIO26','Q8_B');r('R14','100k','Pulso',-20,-88,'Q8_B','GND');r('R17','470','Pulso',-34,-88,'HIGH_C','PULSE_BUS');
q('Q11',false,'Pulso',34,-64,'LOW_C','Q11_B','GND');r('R_LOW_BASE','4.7k','Pulso',34,-72,'GPIO27','Q11_B');r('R_LOW_PD','100k','Pulso',34,-80,'Q11_B','GND');r('R_LOW_LIMIT','470','Pulso',34,-88,'PULSE_BUS','LOW_C');
// Reuse original 3.3 V PNP stage as 5 V / 10 k stimulus, not as another experiment source.
q('Q9',true,'Continuidade',-4,-64,'TEST_C','TEST_B','V5');q('Q10',false,'Continuidade',10,-64,'TEST_DRV','Q10_B','GND');
r('R24','47k','Continuidade',-4,-72,'V5','TEST_B');r('R27','10k','Continuidade',10,-72,'TEST_B','TEST_DRV');r('R15','10k','Continuidade',10,-80,'GPIO14','Q10_B');r('R16','100k','Continuidade',10,-88,'Q10_B','GND');r('R18','10k','Continuidade',-4,-88,'TEST_C','TEST_BUS');
h('H2','Interfaces',-44,-74,['V12','V5',null,'GND'],270);h('J_SMART','Interfaces',44,-74,['SENSE_A','GND','SENSE_B','GPIO34'],270);r('R_PULSE_IN','47k','Interfaces',0,-51,'GPIO34','GND');
c('C_BULK5','47uF','Interfaces',-27,62,'V5','GND',true);c('C_BULK12','47uF','Interfaces',27,62,'V12','GND',true);
export const sections=[...new Set(parts.map(p=>p.section))];export const nets=[...new Set(parts.flatMap(p=>p.pins.map(q=>q.net).filter(Boolean)))];
export const serviceAllocation={Y0:'GND',Y1:'PULSE_BUS',Y2:'TEST_BUS',Y3:'SENSE_A',Y4:'SENSE_B',Y5:'PRIVATE_5',Y6:'PRIVATE_6',Y7:'PRIVATE_7'};

for(const p of parts)if(['R19','R22','R2','R3','R5','R13','R15','C_BULK12'].includes(p.ref))p.rotation=180;
