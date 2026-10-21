// Independent interface proposal. Numbers on external modules are logical ports,
// not verified physical header positions. Only U_PI uses physical header numbers.
const piLabels = ['3V3','5V','GPIO2_SDA','5V','GPIO3_SCL','GND','GPIO4','GPIO14_TX','GND','GPIO15_RX','GPIO17','GPIO18','GPIO27','GND','GPIO22','GPIO23','3V3','GPIO24','GPIO10_MOSI','GND','GPIO9_MISO','GPIO25_RST','GPIO11_SCLK','GPIO8_CE0','GND','GPIO7_CE1','GPIO0_ID_SD','GPIO1_ID_SC','GPIO5_ENERGIZE','GND','GPIO6_BACK','GPIO12','GPIO13','GND','GPIO19','GPIO16','GPIO26','GPIO20','GND','GPIO21'];
const used = {1:'PI_3V3',6:'GND',19:'SPI_MOSI',21:'SPI_MISO',22:'RFID_RST',23:'SPI_SCLK',24:'RFID_CS_N',29:'ENERGIZE_N',31:'BACK_N'};
export const parts = [
 {ref:'U_PI',title:'Raspberry Pi 3B — physical header',x:0,y:0,w:13,h:19,pins:piLabels.map((label,i)=>({label,net:used[i+1]??null})),pi:true},
 {ref:'U_RFID',title:'RC522 module — labels ONLY',x:21,y:5,w:10,h:6,pins:['3V3','GND','SCK','MOSI','MISO','SDA_SS','RST','IRQ'].map((label,i)=>({label,net:['PI_3V3','GND','SPI_SCLK','SPI_MOSI','SPI_MISO','RFID_CS_N','RFID_RST',null][i]}))},
 {ref:'U_ESP2',title:'ESP32 #2 — GPIO interface',x:21,y:-7,w:9,h:4,pins:['3V3','GND','GPIO36_VP','GPIO39_VN','GPIO35'].map((label,i)=>({label,net:['ESP2_3V3','GND','JOY_X','JOY_Y','JOY_SW_N'][i]}))},
 {ref:'U_JOY',title:'KY-023 — labels ONLY',x:36,y:-7,w:7,h:4,pins:['VCC','GND','VRx','VRy','SW'].map((label,i)=>({label,net:['ESP2_3V3','GND','JOY_X','JOY_Y','JOY_SW_N'][i]}))},
 {ref:'R_EN',kind:'resistor',value:'10k',x:35,y:7,pins:[{label:'1',net:'PI_3V3'},{label:'2',net:'ENERGIZE_N'}]},
 {ref:'SW_EN',kind:'switch',x:35,y:3,pins:[{label:'1',net:'ENERGIZE_N'},{label:'2',net:'GND'}]},
 {ref:'R_BACK',kind:'resistor',value:'10k',x:43,y:7,pins:[{label:'1',net:'PI_3V3'},{label:'2',net:'BACK_N'}]},
 {ref:'SW_BACK',kind:'switch',x:43,y:3,pins:[{label:'1',net:'BACK_N'},{label:'2',net:'GND'}]},
 {ref:'R_JOY',kind:'resistor',value:'10k',x:43,y:-7,pins:[{label:'1',net:'ESP2_3V3'},{label:'2',net:'JOY_SW_N'}]},
];
for (const p of parts) { p.x *= 0.45; p.y *= 0.45; if (!p.kind) { p.w = p.pi ? 3.6 : p.ref === 'U_ESP2' ? 2 : p.ref === 'U_RFID' ? 1.65 : 1.38; if (p.ref === 'U_JOY') p.y += 0.2; p.h = p.pi ? 4.2 : p.ref === 'U_RFID' ? 1.8 : 1.2; } }
export const wires = [
 ['R_EN.2','SW_EN.1'],['R_BACK.2','SW_BACK.1'],
 ['U_ESP2.3','U_JOY.3'],['U_ESP2.4','U_JOY.4'],['U_ESP2.5','U_JOY.5'],
];
export const connectorMpn = '61202021621'; // Data placeholder; never a purchasing identification.
export const wiring = [
 ['Pi','1','3.3V','RC522 3.3V; R_EN.1; R_BACK.1'],['Pi','6','GND','RC522 GND; button returns; ESP32 #2 GND'],
 ['Pi','19','GPIO10 / MOSI','RC522 MOSI'],['Pi','21','GPIO9 / MISO','RC522 MISO'],['Pi','23','GPIO11 / SCLK','RC522 SCK'],['Pi','24','GPIO8 / CE0','RC522 SDA/SS'],['Pi','22','GPIO25','RC522 RST'],
 ['Pi','29','GPIO5 / ENERGIZE_N','Energize switch; R_EN.2'],['Pi','31','GPIO6 / BACK_N','Back switch; R_BACK.2'],
 ['ESP32 #2','Unconfirmed','3V3','KY-023 VCC; R_JOY.1'],['ESP32 #2','Unconfirmed','GND','KY-023 GND; common ground'],['ESP32 #2','Unconfirmed','GPIO36 / VP','KY-023 VRx'],['ESP32 #2','Unconfirmed','GPIO39 / VN','KY-023 VRy'],['ESP32 #2','Unconfirmed','GPIO35','KY-023 SW; R_JOY.2'],
];
