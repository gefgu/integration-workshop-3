// Current agreed scope: ONE perfboard, simple ADC inputs, external RC522,
// logic-only pulse command; source/sink/stimulus circuitry lives elsewhere.
import {parts as original,connectorMpn} from '../design.mjs';
import {readFileSync} from 'node:fs';
export const board={columns:30,rows:45,pitch:2.54,width:76.2,height:114.3};
const keep=/^(J_ESP_[LR]|J_POWER|JP_EXT|J_UART|J_JOY|J_OLED[0-5]|C_BULK|C_LOCAL)$/;
const changes={'J_ESP_L.15':'NFC_MOSI','J_ESP_R.3':'NFC_MISO','J_ESP_R.5':'NFC_SCK','J_ESP_R.8':'NFC_SS','J_ESP_R.7':'NFC_RST','J_ESP_R.6':'PULSE_CMD','J_ESP_R.12':'ADC_A','J_ESP_R.11':'ADC_B'};
export const existing=original.filter(p=>keep.test(p.ref)).map(p=>({...p,status:'SOLDERED',section:'Existing',mpn:p.kind==='header'?connectorMpn:p.polarized?'47UF-RADIAL-VERIFY':'100NF-RADIAL-VERIFY',pins:p.pins.map((q,i)=>({...q,pin:i+1,net:changes[`${p.ref}.${i+1}`]??(/^EXP_|^SENSE/.test(q.net??'')?null:q.net)}))}));
export const added=[];
const h=(ref,title,c,r,labels,names,section)=>added.push({ref,title,kind:'header',value:`${labels.length} pinos`,mpn:connectorMpn,status:'NEW',section,pins:labels.map((label,i)=>({pin:i+1,label,net:names[i],c:c+i,r}))});
h('J_ROUTER','Sinais externos: somente A/B/GND/comando',2,25,['A_RAW','GND','B_RAW','PULSE_CMD'],['SENSE_A','GND','SENSE_B','PULSE_CMD'],'Router');
h('J_NFC','RC522 externo, usar jumpers por sinal',21,25,['3V3','GND','SCK','MOSI','MISO','SS','RST'],['V3V3_BOARD','GND','NFC_SCK','NFC_MOSI','NFC_MISO','NFC_SS','NFC_RST'],'NFC');
const two=(ref,kind,value,a,b,names)=>added.push({ref,kind,value,mpn:kind==='resistor'?`RES-${value}-VERIFY`:'100NF-RADIAL-VERIFY',tolerance:kind==='resistor'?'1%':'',status:'NEW',section:'Voltage',pcbRotation:a[0]===b[0]?270:0,pins:[{pin:1,label:'1',net:names[0],c:a[0],r:a[1]},{pin:2,label:'2',net:names[1],c:b[0],r:b[1]}]});
for(const [n,c]of[['A',3],['B',11]]){
 two(`R_${n}_TOP`,'resistor','10k',[c,29],[c,32],[`SENSE_${n}`,`DIV_${n}`]);
 two(`R_${n}_BOT`,'resistor','10k',[c,34],[c+3,34],[`DIV_${n}`,'GND']);
 two(`R_${n}_ADC`,'resistor','1k',[c,37],[c+3,37],[`DIV_${n}`,`ADC_${n}`]);
 two(`C_${n}_ADC`,'capacitor','100nF',[c+3,40],[c+4,40],[`ADC_${n}`,'GND']);
}
export const parts=[...existing,...added];
export const sections=['Existing','Router','NFC','Voltage'];
export const endpoints=new Map(parts.flatMap(p=>p.pins.map(q=>[`${p.ref}.${q.pin}`,{...q,ref:p.ref}])));
export const nets=[...new Set(parts.flatMap(p=>p.pins.map(q=>q.net).filter(Boolean)))];
const csv=readFileSync(new URL('../stage1/wires.csv',import.meta.url),'utf8').trim().split('\n').slice(1).map(l=>[...l.matchAll(/"((?:[^"]|"")*)"/g)].map(m=>m[1]));
export const existingWires=csv.map(([id,net,a,b])=>({id,net,from:a.split(' — ')[0],to:b.split(' — ')[0],status:'EXISTING'}));
export const newWires=nets.flatMap(net=>{const es=added.flatMap(p=>p.pins.filter(q=>q.net===net).map(q=>`${p.ref}.${q.pin}`));if(!es.length)return[];const root=existing.flatMap(p=>p.pins.filter(q=>q.net===net).map(q=>`${p.ref}.${q.pin}`))[0];const path=root?[root,...es]:es;return path.slice(1).map((to,i)=>({net,from:path[i],to,status:'NEW'}));}).map((w,i)=>({id:`N${String(i+1).padStart(2,'0')}`,...w}));
export const wires=[...existingWires,...newWires];
export const colors=n=>n==='GND'?'#202020':n.startsWith('V3V3')?'#bd2026':n==='SCL'||n==='NFC_SCK'?'#1764b5':n.startsWith('SDA_')?'#16823a':n==='UART_TX'?'#bd4900':n==='UART_RX'?'#8538ad':n==='JOY_X'?'#b12d62':n==='JOY_Y'?'#007e88':n==='NFC_MOSI'?'#ca5c00':n==='NFC_MISO'?'#00858a':n==='NFC_SS'?'#8b3fb0':n==='NFC_RST'?'#79513a':n==='PULSE_CMD'?'#a03ba0':n.endsWith('_A')?'#146b9c':'#26824b';
