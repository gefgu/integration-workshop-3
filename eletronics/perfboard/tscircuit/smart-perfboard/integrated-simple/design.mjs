// Same perfboard as the already-soldered stage 1; no existing part is moved.
import {parts as old,connectorMpn} from '../design.mjs';
import {parts as completion} from '../final/design.mjs';
import {readFileSync} from 'node:fs';
export const board={columns:30,rows:45,pitch:2.54,width:76.2,height:114.3};
const keep=/^(J_ESP_[LR]|J_POWER|JP_EXT|J_UART|J_JOY|J_OLED[0-5]|C_BULK|C_LOCAL)$/;
const change={'J_ESP_R.3':'ARM','J_ESP_R.5':'HB','J_ESP_R.8':'MODE_A','J_ESP_R.7':'MODE_B','J_ESP_R.6':'MODE_C','J_ESP_R.12':'ADC_A','J_ESP_R.11':'ADC_B','J_ESP_L.15':'EDU_ON'};
export const existing=old.filter(p=>keep.test(p.ref)).map(p=>({...p,status:'SOLDERED',section:'Existing',kind:p.kind==='header'?'header':p.kind,mpn:p.kind==='header'?connectorMpn:p.value==='100nF'?'100NF-RADIAL-VERIFY':'47UF-RADIAL-VERIFY',pins:p.pins.map((q,i)=>({...q,pin:i+1,net:change[`${p.ref}.${i+1}`]??(/^EXP_|^SENSE/.test(q.net??'')?null:q.net)}))}));
export const added=completion.filter(p=>!['Interfaces','Voltage'].includes(p.section)).map(p=>({...structuredClone(p),status:'NEW',pins:p.pins.map(q=>({...q,net:q.net==='V3V3_LOCAL'?'V3V3_BOARD':q.net}))}));
const H=(ref,labels,nets)=>added.unshift({ref,kind:'header',value:`${labels.length} pins`,mpn:connectorMpn,status:'NEW',section:'Interfaces',pins:labels.map((label,i)=>({pin:i+1,label,net:nets[i]}))});
H('J_AUX_PWR',['5V_SYS','GND','5V_EDU','GND'],['V5V_SYS','GND','V5V_EDU','GND']);
H('J_SIGNALS',['A_RAW','GND','B_RAW','PULSE','GND','EDU_ON','OFF_OK'],['SENSE_A','GND','SENSE_B','PULSE_OUT','GND','EDU_ON','EDU_OFF_OK']);
const two=(ref,kind,value,a,b)=>added.push({ref,kind,value,mpn:kind==='resistor'?'RES-'+value+'-VERIFY':'CAP-'+value+'-VERIFY',section:'Voltage',status:'NEW',tolerance:'1%',pins:[{pin:1,label:'1',net:a},{pin:2,label:'2',net:b}]});
for(const n of ['A','B']){two(`R_${n}_TOP`,'resistor','10k',`SENSE_${n}`,`DIV_${n}`);two(`R_${n}_BOT`,'resistor','10k',`DIV_${n}`,'GND');two(`R_${n}_ADC`,'resistor','1k',`DIV_${n}`,`ADC_${n}`);two(`C_${n}_ADC`,'capacitor','100nF',`ADC_${n}`,'GND');}
// Reserve the measured-by-guide ESP32 envelope and actual existing pin positions.
const used=[{x1:8.5,x2:21.5,y1:.5,y2:22.5},...existing.filter(p=>!p.ref.startsWith('J_ESP')).map(p=>({x1:Math.min(...p.pins.map(q=>q.c))-(p.ref==='C_BULK'?1.8:.8),x2:Math.max(...p.pins.map(q=>q.c))+(p.ref==='C_BULK'?1.8:.8),y1:Math.min(...p.pins.map(q=>q.r))-(p.kind==='capacitor'?1.5:.8),y2:Math.max(...p.pins.map(q=>q.r))+(p.kind==='capacitor'?1.5:.8)}))];
// Measurement parts placed first, followed by ICs and the output/test circuitry.
const priority=p=>p.ref==='J_SIGNALS'?0:p.section==='Voltage'?1:p.kind==='dip'?2:p.kind==='header'?3:p.kind==='capacitor'?4:p.kind==='resistor'?6:5;
for(const p of [...added].sort((a,b)=>priority(a)-priority(b)||(b.pins.length-a.pins.length))){
 const dip=p.kind==='dip',count=p.pins.length,span=dip?3:p.kind==='header'?count-1:p.kind==='resistor'?1:p.kind==='diode'?3:p.kind==='capacitor'?1:2;
 const height=dip?count/2-1:0,mx=p.kind==='capacitor'?1.2:.7,my=dip?.8:p.kind==='capacitor'?1.2:p.kind==='resistor'?.7:.6;
 let found=false;
 for(const r of [...Array.from({length:21},(_,i)=>25+i),...Array.from({length:23},(_,i)=>2+i)])for(let c=2;c<=29&&!found;c++){
  if(found)break;
  if(p.ref==='C_B_ADC'&&(r!==28||c!==28))continue;
  const box={x1:c-mx,x2:c+span+mx,y1:r-my,y2:r+height+my};
  if((p.kind==='resistor'?c+span+.45:box.x2)>30.5||(p.kind==='resistor'?r+.45:box.y2)>45.5||used.some(q=>box.x1<q.x2&&box.x2>q.x1&&box.y1<q.y2&&box.y2>q.y1))continue;
  p.pcbRotation=0;if(p.kind==='resistor')p.mount='upright; 2.54mm lead pitch; insulate returning lead';p.pins.forEach((q,i)=>{q.c=dip?(i<count/2?c:c+3):c+(p.kind==='diode'?i*3:i);q.r=dip?r+(i<count/2?i:count-1-i):r;});p.envelope=box;used.push(box);found=true;
 }
 if(!found)throw Error(`Insufficient lower-board space for ${p.ref}; do not overlap the soldered hardware.`);
}
for(const ref of []){const p=added.find(p=>p.ref===ref);const a={c:p.pins[0].c,r:p.pins[0].r};p.pins[0].c=p.pins[1].c;p.pins[0].r=p.pins[1].r;p.pins[1].c=a.c;p.pins[1].r=a.r;p.pcbRotation=180;}
export const parts=[...existing,...added];
export const sections=['Existing','Interfaces','Voltage','Watchdog','Mode','Limits','Pulse','Diagnostic'];
export const endpoints=new Map(parts.flatMap(p=>p.pins.map(q=>[`${p.ref}.${q.pin}`,{...q,ref:p.ref}])));
export const nets=[...new Set(parts.flatMap(p=>p.pins.map(q=>q.net).filter(Boolean)))];
const baseLines=readFileSync(new URL('../stage1/wires.csv',import.meta.url),'utf8').trim().split('\n').slice(1).map(l=>[...l.matchAll(/"((?:[^"]|"")*)"/g)].map(m=>m[1]));
export const existingWires=baseLines.map(([id,net,a,b])=>({id,net,from:a.split(' — ')[0],to:b.split(' — ')[0],status:'EXISTING'}));
export const newWires=nets.flatMap(net=>{const es=added.flatMap(p=>p.pins.filter(q=>q.net===net).map(q=>`${p.ref}.${q.pin}`));if(!es.length)return [];const old=existing.flatMap(p=>p.pins.filter(q=>q.net===net).map(q=>`${p.ref}.${q.pin}`));const path=old.length?[old[0],...es]:es;return path.slice(1).map((to,i)=>({net,from:path[i],to,status:'NEW'}));}).map((w,i)=>({id:`N${String(i+1).padStart(3,'0')}`,...w}));
export const wires=[...existingWires,...newWires];
