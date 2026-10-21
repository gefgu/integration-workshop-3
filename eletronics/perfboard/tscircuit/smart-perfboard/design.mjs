// Separate 30x45-hole controller candidate. No legacy/revision5/6/7 source changes.
// Hole coordinates are TOP-view, 1-based. Standard pitch is a proposal pending dry fit.
export const board = {columns:30,rows:45,pitch:2.54,width:76.2,height:114.3,
  note:'Outline assumes half-pitch margins; measure actual board edges and plating.',
  expansion:{c1:17,c2:29,r1:28,r2:43},espEnvelope:{c1:9,c2:21,r1:1,r2:22}};
export const connectorMpn='61201021621'; // Tool placeholder only; NOT a purchased connector identity.
export const parts=[];
const pin=(label,net,c,r)=>({label,net,c,r});
const header=(ref,title,c,r,labels,nets,sx,sy,section)=>{
 const p={ref,title,kind:'header',section,sx,sy,pins:labels.map((l,i)=>pin(l,nets[i],c+i,r))};parts.push(p);return p;
};
const left=['3V3','GND','GPIO15','GPIO2','GPIO4','GPIO16','GPIO17','GPIO5','GPIO18','GPIO19','GPIO21','GPIO3_RX0','GPIO1_TX0','GPIO22','GPIO23'];
const leftN=['V3V3_BOARD','GND',null,null,'SDA_0','SDA_5','SDA_4',null,'SDA_3','SDA_2','SDA_1',null,null,'SCL', 'EXP_GPIO23'];
const right=['VIN','GND','GPIO13','GPIO12','GPIO14','GPIO27','GPIO26','GPIO25','GPIO33','GPIO32','GPIO35','GPIO34','GPIO39_VN','GPIO36_VP','EN'];
const rightN=[null,'GND','EXP_GPIO13',null,'EXP_GPIO14','EXP_GPIO27','EXP_GPIO26','EXP_GPIO25','UART_TX','UART_RX','SENSE2_ADC','SENSE1_ADC','JOY_Y','JOY_X',null];
for(const [ref,labels,nets,c,sx] of [['J_ESP_L',left,leftN,10,0],['J_ESP_R',right,rightN,20,7]]){
 parts.push({ref,title:`30-pin ESP32 ${ref.endsWith('L')?'left':'right'} socket`,kind:'header',section:'Controller',sx,sy:0,
  pins:labels.map((l,i)=>pin(l,nets[i],c,5+i))});
}
header('J_POWER','Regulated 3.3 V IN',25,3,['EXT_3V3','GND'],['V3V3_EXT','GND'],0,8,'Power');
header('JP_EXT','REMOVE for USB programming',25,6,['EXT','BOARD'],['V3V3_EXT','V3V3_BOARD'],5,8,'Power');
header('J_UART','Pi: cross TX/RX',25,14,['GND','ESP_TX','ESP_RX'],['GND','UART_TX','UART_RX'],13,1,'Controller');
header('J_JOY','Joystick axes ONLY',24,19,['3V3','GND','VRx','VRy'],['V3V3_BOARD','GND','JOY_X','JOY_Y'],13,-3,'Controller');
for(let i=0;i<6;i++)header(`J_OLED${i}`,`OLED slot ${i}`,2,4+i*3,['3V3','GND','SCL','SDA'],['V3V3_BOARD','GND','SCL',`SDA_${i}`],22+(i%3)*5.5,5-Math.floor(i/3)*5,'Screens');
header('J_SENSE','From main matrix: no raw ADC connection',2,28,['P1_RAW','GND','P2_RAW'],['P1_RAW','GND','P2_RAW'],0,-9,'Sensing');
header('JP_SENSE1','P1 disconnect link',3,30,['RAW','DIV'],['P1_RAW','P1_IN'],5,-9,'Sensing');
header('JP_SENSE2','P2 disconnect link',11,30,['RAW','DIV'],['P2_RAW','P2_IN'],5,-16,'Sensing');
header('J_EXP','Future GPIO: NO output driver fitted',21,25,['IO13','IO14','IO23','IO25','IO26','IO27','GND','3V3'],['EXP_GPIO13','EXP_GPIO14','EXP_GPIO23','EXP_GPIO25','EXP_GPIO26','EXP_GPIO27','GND','V3V3_BOARD'],23,-16,'Expansion');
header('J_GND','Ground distribution: insulated links',2,44,Array.from({length:8},(_,i)=>`G${i+1}`),Array(8).fill('GND'),34,-16,'Expansion');
const two=(ref,kind,value,a,b,nets,sx,sy,section,rotation=0)=>{
 parts.push({ref,kind,value,title:ref,section,sx,sy,rotation,pins:[pin('1',nets[0],...a),pin('2',nets[1],...b)]});
};
// OLED modules provide SDA/SCL pull-ups; no external pull-up footprints.
export const optional=[];
for(let n=1;n<=2;n++){
 const c=n===1?3:11,y=n===1?-9:-16;
 two(`R_P${n}_TOP`,'resistor','10k',[c,32],[c,35],[`P${n}_IN`,`SENSE${n}_DIV`],9,y,'Sensing');
 two(`R_P${n}_BOT`,'resistor','10k',[c,37],[c+3,37],[`SENSE${n}_DIV`,'GND'],13,y-3,'Sensing',270);
 two(`R_P${n}_SER`,'resistor','1k',[c,39],[c+3,39],[`SENSE${n}_DIV`,`SENSE${n}_ADC`],13,y,'Sensing');
 two(`C_P${n}`,'capacitor','100nF',[c+3,41],[c+4,41],[`SENSE${n}_ADC`,'GND'],17,y-3,'Sensing',270);
}
two('C_BULK','capacitor','47uF',[26,10],[27,10],['V3V3_BOARD','GND'],10,8,'Power',270);parts.at(-1).polarized=true;
two('C_LOCAL','capacitor','100nF',[24,22],[25,22],['V3V3_BOARD','GND'],11.6,8,'Power',270);
export const links=[{ref:'JP_EXT',normal:'FITTED',usb:'OPEN',purpose:'External 3.3 V source isolation; USB and external power never parallel'},
 {ref:'JP_SENSE1',normal:'FITTED only after input checks',usb:'OPEN',purpose:'Remove before unpowering receiver / during standalone programming'},
 {ref:'JP_SENSE2',normal:'FITTED only after input checks',usb:'OPEN',purpose:'Remove before unpowering receiver / during standalone programming'}];
export const pinmap=[
 ['SCL',22,'Shared clock; six SDA wires remain separate'],['SDA_0',4,'OLED slot 0'],['SDA_1',21,'OLED slot 1'],['SDA_2',19,'OLED slot 2'],['SDA_3',18,'OLED slot 3'],['SDA_4',17,'OLED slot 4'],['SDA_5',16,'OLED slot 5'],
 ['JOY_X',36,'ADC1; VP'],['JOY_Y',39,'ADC1; VN'],['SENSE1_ADC',34,'ADC1; P1 through divider/filter'],['SENSE2_ADC',35,'ADC1; P2 through divider/filter; NO joystick click pull-up'],
 ['UART_RX',32,'Pi TX GPIO14 / physical 8 -> this pin'],['UART_TX',33,'This pin -> Pi RX GPIO15 / physical 10'],
 ...[13,14,23,25,26,27].map(i=>[`EXP_GPIO${i}`,i,'Reserved logic only; no educational output drive'])];
const endpoint=(ref,i)=>`${ref}.${i}`;
// Explicit assembly connectivity trees, NOT copper routes or an automatic wire router.
// Consecutive endpoints in each list are joined with insulated wire.
const chains=[];
chains.push(['V3V3_EXT',['J_POWER.1','JP_EXT.1']]);
chains.push(['V3V3_BOARD',['JP_EXT.2','C_BULK.1','C_LOCAL.1','J_ESP_L.1','J_OLED0.1','J_OLED1.1','J_OLED2.1','J_OLED3.1','J_OLED4.1','J_OLED5.1']]);
chains.push(['V3V3_BOARD',['C_LOCAL.1','J_JOY.1','J_EXP.8']]);
chains.push(['GND',Array.from({length:8},(_,i)=>endpoint('J_GND',i+1))]);
chains.push(['GND',['J_POWER.2','J_GND.8']]);
chains.push(['GND',['J_GND.1','J_OLED5.2','J_OLED4.2','J_OLED3.2','J_OLED2.2','J_OLED1.2','J_OLED0.2']]);
chains.push(['GND',['J_GND.2','J_ESP_L.2','J_ESP_R.2']]);
chains.push(['GND',['J_GND.3','R_P1_BOT.2','C_P1.2']]);
chains.push(['GND',['J_GND.4','R_P2_BOT.2','C_P2.2']]);
chains.push(['GND',['J_GND.5','J_SENSE.2']]);
chains.push(['GND',['J_GND.6','C_LOCAL.2','C_BULK.2']]);
chains.push(['GND',['J_GND.7','J_UART.1','J_JOY.2','J_EXP.7']]);
chains.push(['SCL',['J_ESP_L.14',...Array.from({length:6},(_,i)=>endpoint(`J_OLED${i}`,3))]]);
const hostSda=[5,11,10,9,7,6];
for(let i=0;i<6;i++)chains.push([`SDA_${i}`,[endpoint('J_ESP_L',hostSda[i]),endpoint(`J_OLED${i}`,4)]]);
for(const [net,ends] of [['JOY_X',['J_ESP_R.14','J_JOY.3']],['JOY_Y',['J_ESP_R.13','J_JOY.4']],['UART_TX',['J_ESP_R.9','J_UART.2']],['UART_RX',['J_ESP_R.10','J_UART.3']]])chains.push([net,ends]);
for(let n=1;n<=2;n++){
 chains.push([`P${n}_RAW`,[endpoint('J_SENSE',n===1?1:3),endpoint(`JP_SENSE${n}`,1)]]);
 chains.push([`P${n}_IN`,[endpoint(`JP_SENSE${n}`,2),endpoint(`R_P${n}_TOP`,1)]]);
 chains.push([`SENSE${n}_DIV`,[endpoint(`R_P${n}_TOP`,2),endpoint(`R_P${n}_BOT`,1),endpoint(`R_P${n}_SER`,1)]]);
 chains.push([`SENSE${n}_ADC`,[endpoint(`R_P${n}_SER`,2),endpoint(`C_P${n}`,1),endpoint('J_ESP_R',n===1?12:11)]]);
}
const expHost=[3,5,15,8,7,6];
for(let i=0;i<6;i++)chains.push([`EXP_GPIO${[13,14,23,25,26,27][i]}`,[endpoint(i===2?'J_ESP_L':'J_ESP_R',expHost[i]),endpoint('J_EXP',i+1)]]);
export const wires=chains.flatMap(([net,ends])=>ends.slice(1).map((to,i)=>({net,from:ends[i],to}))).map((w,i)=>({id:`W${String(i+1).padStart(3,'0')}`,...w}));
export const endpoints=new Map(parts.flatMap(p=>p.pins.map((q,i)=>[`${p.ref}.${i+1}`,{...q,ref:p.ref,pin:i+1}])));
export const powerModes=[{mode:'external operation',external:true,usb:false,sense:true},{mode:'USB programming',external:false,usb:true,sense:false}];
