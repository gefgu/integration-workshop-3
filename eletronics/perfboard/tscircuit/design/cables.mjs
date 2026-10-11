import {byId} from './boards.mjs';
const link=(id,from,fromRef,to,toRef,aliases={})=>({id,from,fromRef,to,toRef,aliases,pins:byId[from.split(':')[0]].parts.find(p=>p.ref===fromRef).pins.map(p=>({fromPin:p.number,toPin:p.number}))});
export const cables=[];
for(let n=0;n<6;n++) {
 const bank=n<3?'a':'b',m=n%3+1,id=bank+m,start=(n<3?0:11)+(m-1)*4;
 cables.push(link(`NODE_${id.toUpperCase()}`,id,'J_NODE','matrix',`J_${id.toUpperCase()}`));
 const aliases=Object.fromEntries([['P1_RAW',`NODE${String(start).padStart(2,'0')}`],['P2_RAW',`NODE${String(start+1).padStart(2,'0')}`],['P3_RAW',`NODE${String(start+2).padStart(2,'0')}`],['SDA_B',`SDA_${n}`],['SCL_B',`SCL_${n}`]]);
 cables.push(link(`SMART_RAW_${n}`,id,'J_SMART',`smart-channel:${n}`,'J_MODULE',aliases));
 cables.push(link(`CTRL_${n}`,'smart-controller',`J_CH${n}`,`smart-channel:${n}`,'J_CONTROL',{'HIGH_REQ':`RELAY_${3*n}`,'LOW_REQ':`RELAY_${3*n+1}`,'AMM_REQ':`RELAY_${3*n+2}`,'SDA_A':`SDA_${n}`}));
}
cables.push(link('POWER_MATRIX','power','J_MATRIX','matrix','J_POWER',{'ALIVE':'ROUTER_ALIVE'}));
cables.push(link('POWER_SMART','power','J_SMART','smart-controller','J_POWER'));
cables.push(link('USB_PROTOTYPE','matrix','J_PROTOTYPE','usb-prototype','J_CONTROL'));
cables.push(link('FIXTURE_CONTROL','matrix','J_FIXTURE','continuity-fixture','J_CONTROL'));
export const external=[
 {name:'fixed battery harness',board:'power',ref:'J_FIXED_BATTERY',pins:{1:'removable lead to A1 J_NODE pin3 / C2 positive',2:'removable lead to A1 J_NODE pin1 / C1 ground'}},
 {name:'manual continuity probes',board:'continuity-fixture',ref:'J_TEST',pins:{1:'removable lead to A1 C4 / J_NODE pin7',2:'removable lead to A1 C1 / J_NODE pin1'}},
 {name:'12-V supply',board:'power',ref:'J_INPUT',pins:{1:'centre positive 12V',2:'barrel sleeve GND'}},
 {name:'main switch',board:'power',ref:'J_SW_MAIN',pins:{1:'switch terminal',2:'switch terminal'}},
 {name:'buck 5V',board:'power',ref:'J_BUCK_5V',pins:{1:'PG unconnected',2:'EN unconnected',3:'VIN',4:'GND',5:'VOUT'}},
 {name:'buck 3V3',board:'power',ref:'J_BUCK_3V3',pins:{1:'PG unconnected',2:'EN unconnected',3:'VIN',4:'GND',5:'VOUT'}},
 {name:'Pi',board:'integration',ref:'J_PI',pins:{1:'3.3V',6:'GND',19:'GPIO10 MOSI',21:'GPIO9 MISO',23:'GPIO11 SCLK',24:'GPIO8 CE0',29:'GPIO5 Energizar',31:'GPIO6 Back'}},
 {name:'PN532 carrier labelled SPI harness',board:'integration',ref:'J_NFC',pins:{1:'3.3V',2:'GND',3:'SCK',4:'MOSI',5:'MISO',6:'SSEL'}},
 {name:'electronics common ground',board:'integration',ref:'J_GROUND',pins:{1:'power board GND, no positive supply'}},
 {name:'Energizar button',board:'integration',ref:'J_SW_ENERGIZE',pins:{1:'dry contact',2:'dry contact'}},
 {name:'Back button',board:'integration',ref:'J_SW_BACK',pins:{1:'dry contact',2:'dry contact'}}
];
