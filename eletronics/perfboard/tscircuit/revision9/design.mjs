// Revision 9: minimal power board on stripboard. Single source of truth for the schematic,
// the stripboard layout and the connectivity check. Strips run along the rows (hole y); a hole is [row, col].
// Hole coordinates are written as [row, col], 1-based, looking at the TOP (component side).
export const revision = 'r9-minimal-power-stripboard';
// User-confirmed grid: 36 holes along the long axis and 32 across.
// Coordinates are portrait/top-view to match the supplied board photo.
export const ROWS = 36, COLS = 32;

// Compress the unused right-hand columns from the earlier 40-column layout.
// Keep the row-14 input isolation cut between distinct holes at columns 5/6.

// The pictured adapter has a center-positive barrel plug. The mating socket is
// a mechanical guide only: use a female pigtail socket because its exact body
// and terminal layout have not been identified or measured.
export const inputJackGuide = {
  ref: 'J_DC', value: '12 V center-positive barrel jack, female pigtail',
  mount: 'off-board at the input edge; two pigtails to J_IN',
  adapter: '12 V DC, 3 A; center positive',
  positiveLanding: [36, 2], groundLanding: [36, 3],
};

// Copper map inferred from the underside photo: vertical continuous buses and
// three banks of short horizontal islands. Verify lane boundaries with a meter.
export const copperGroups = [
  ...[1,2,9,10,16,17,19,20,26,31,32].map(c=>({id:`bus-${c}`,holes:Array.from({length:ROWS},(_,i)=>[i+1,c])})),
  ...Array.from({length:ROWS},(_,i)=>[
    {id:`island-a-${i+1}`,holes:Array.from({length:5},(_,j)=>[i+1,4+j])},
    {id:`island-b-${i+1}`,holes:Array.from({length:4},(_,j)=>[i+1,11+j])},
    {id:`island-c-${i+1}`,holes:Array.from({length:5},(_,j)=>[i+1,21+j])},
  ]).flat(),
  ...Array.from({length:ROWS},(_,ri)=>Array.from({length:COLS},(_,ci)=>[ri+1,ci+1])).flat()
    .filter(([r,c])=>![1,2,9,10,16,17,19,20,26,31,32].includes(c)&&!((c>=4&&c<=8)||(c>=11&&c<=14)||(c>=21&&c<=25)))
    .map(([r,c])=>({id:`pad-${r}-${c}`,holes:[[r,c]]})),
];
export const cuts = [];
// Net names of strip segments that differ from the row default (resolved by net of the pins, not by this table).
export const nets = {
  GND: 'Ground', '3V3_SYS': '3.3 V system rail', '12V_SYS': '12 V after fuse and diode', '5V_SYS': '5 V system rail',
  EDU_SW: 'Q1 drain', GATE: 'Q1 gate', EDU_PWR_EN: 'Enable from router', MID: 'Q2/Q3 junction', ROUTER_ALIVE: 'Heartbeat from router',
  '5V_EDU': 'Student rail', EDU_SENSE: 'Student-rail monitor', '12V_IN': '12 V input', '12V_F': '12 V after fuse',
};

// kind: header | fuse | diode | resistor | capacitor | pmos | nmos | module
// Original electrical pin/net definitions, reassigned below to actual isolated copper islands.
export const parts = [
  { ref: 'J_IN', kind: 'header', value: '1×2 header', role: '12 V input', mount: 'vertical',
    pins: [['12V', '12V_IN', [14, 2]], ['GND', 'GND', [13, 2]]] },
  { ref: 'F1', kind: 'fuse', value: '2 A slow fuse + holder', role: 'Input fuse', mount: 'horizontal on row 14',
    pins: [['1', '12V_IN', [14, 3]], ['2', '12V_F', [14, 12]]] },
  { ref: 'D1', kind: 'diode', value: '1N5822', role: 'Reverse-polarity diode', mount: 'vertical',
    pins: [['A', '12V_F', [14, 18]], ['K', '12V_SYS', [15, 18]]] },
  { ref: 'C1', kind: 'capacitor', value: '470 µF', polarized: true, role: '12 V bulk', mount: 'vertical',
    pins: [['+', '12V_SYS', [3, 16]], ['-', 'GND', [1, 16]]] },
  { ref: 'C2', kind: 'capacitor', value: '100 nF', role: '12 V bypass', mount: 'vertical',
    pins: [['1', '12V_SYS', [3, 13]], ['2', 'GND', [1, 13]]] },
  { ref: 'M_BUCK5', kind: 'module', value: 'Blue XL4015 buck module', role: '5 V supply', mount: 'three insulated pigtails (shared negative); module off-board',
    pins: [['IN+', '12V_SYS', [3, 8]], ['GND', 'GND', [1, 8]], ['OUT+', '5V_SYS', [4, 8]]] },
  { ref: 'M_BUCK3', kind: 'module', value: 'Red HW-155 / LM2596 buck module', role: '3.3 V supply', mount: 'three insulated pigtails (shared negative); module off-board',
    pins: [['IN+', '12V_SYS', [3, 11]], ['GND', 'GND', [1, 11]], ['OUT+', '3V3_SYS', [2, 11]]] },
  { ref: 'Q1', kind: 'pmos', value: 'NDP6020P', role: 'Student-rail switch', mount: 'vertical',
    pins: [['S', '5V_SYS', [4, 19]], ['D', 'EDU_SW', [5, 19]], ['G', 'GATE', [6, 19]]] },
  { ref: 'R_GP', kind: 'resistor', value: '100 kΩ', role: 'Gate pull-up (rail OFF by default)', mount: 'standing',
    pins: [['1', '5V_SYS', [4, 21]], ['2', 'GATE', [6, 21]]] },
  { ref: 'Q2', kind: 'nmos', value: '2N7000', role: 'AND: enable', mount: 'vertical',
    pins: [['S', 'MID', [8, 23]], ['G', 'EDU_PWR_EN', [7, 23]], ['D', 'GATE', [6, 23]]] },
  { ref: 'Q3', kind: 'nmos', value: '2N7000', role: 'AND: heartbeat', mount: 'vertical',
    pins: [['S', 'GND', [10, 25]], ['G', 'ROUTER_ALIVE', [9, 25]], ['D', 'MID', [8, 25]]] },
  { ref: 'R_PD_EN', kind: 'resistor', value: '100 kΩ', role: 'Enable pull-down', mount: 'lying',
    pins: [['1', 'EDU_PWR_EN', [7, 27]], ['2', 'GND', [10, 27]]] },
  { ref: 'R_S', kind: 'resistor', value: '470 Ω', role: 'Student-rail current limit', mount: 'lying',
    pins: [['1', 'EDU_SW', [5, 29]], ['2', '5V_EDU', [8, 29]]] },
  { ref: 'R_PD_RA', kind: 'resistor', value: '100 kΩ', role: 'Heartbeat pull-down', mount: 'standing',
    pins: [['1', 'ROUTER_ALIVE', [9, 31]], ['2', 'GND', [10, 31]]] },
  { ref: 'R_DT', kind: 'resistor', value: '47 kΩ', role: 'Monitor divider top', mount: 'standing',
    pins: [['1', '5V_EDU', [11, 35]], ['2', 'EDU_SENSE', [12, 35]]] },
  { ref: 'R_DB', kind: 'resistor', value: '47 kΩ', role: 'Monitor divider bottom', mount: 'standing',
    pins: [['1', 'EDU_SENSE', [12, 37]], ['2', 'GND', [13, 37]]] },
  { ref: 'C_SENSE', kind: 'capacitor', value: '100 nF', role: 'Monitor filter', mount: 'vertical',
    pins: [['1', 'EDU_SENSE', [12, 22]], ['2', 'GND', [10, 22]]] },
  // 12 interface pins down col 39; pins 5, 6 and 8 land on cut strips and stay unconnected. Pull those header pins out (keying).
  { ref: 'J_OUT', kind: 'header', value: '1×12 header (pins 5, 6, 8 pulled)', role: 'Power and control interface', mount: 'vertical',
    pins: [['1 GND', 'GND', [1, 39]], ['2 3V3_SYS', '3V3_SYS', [2, 39]], ['3 12V_SYS', '12V_SYS', [3, 39]], ['4 5V_SYS', '5V_SYS', [4, 39]],
      ['7 EDU_PWR_EN', 'EDU_PWR_EN', [7, 39]], ['9 ROUTER_ALIVE', 'ROUTER_ALIVE', [9, 39]], ['10 GND', 'GND', [10, 39]],
      ['11 5V_EDU', '5V_EDU', [11, 39]], ['12 EDU_SENSE', 'EDU_SENSE', [12, 39]]],
    unconnected: [[5, 39], [6, 39], [8, 39]] },
];
// Put shared rails and control nets on the board's continuous copper buses.
// Only 3V3_SYS and EDU_SENSE stay on local island banks.
export const busForNet = {
  '12V_F':1, '12V_IN':2, '12V_SYS':9, GND:10, '5V_SYS':16, GATE:17,
  EDU_PWR_EN:19, MID:20, '5V_EDU':31, ROUTER_ALIVE:32,
};
const usedBusHoles=new Set();
const busHole=(net,row,ref)=>{
  let col=busForNet[net];
  if(net==='GND'&&['M_BUCK5','M_BUCK3','Q3','R_PD_EN','R_PD_RA','R_DB','C_SENSE'].includes(ref))col=26;
  if(!col)return null;
  let r=row;
  while(usedBusHoles.has(`${r},${col}`))r++;
  usedBusHoles.add(`${r},${col}`);return [r,col];
};
let componentRow=1;
for(const p of parts.filter(p=>!['J_OUT','J_IN'].includes(p.ref))){
  p.pins=p.pins.map(([label,net])=>{
    const row=['Q1','R_S'].includes(p.ref)?20:['R_DT','R_DB','C_SENSE'].includes(p.ref)?12:componentRow;
    if(p.ref==='Q1'&&net==='EDU_SW')return [label,net,[20,23]];
    if(p.ref==='R_S'&&net==='EDU_SW')return [label,net,[20,24]];
    if(busForNet[net]||(net==='GND'&&['M_BUCK5','M_BUCK3','Q3','R_PD_EN','R_PD_RA','R_DB','C_SENSE'].includes(p.ref)))return [label,net,busHole(net,row,p.ref)];
    if(net==='3V3_SYS')return [label,net,[2,23]];
    if(net==='EDU_SENSE'){
      const index=p.ref==='R_DT'?0:p.ref==='R_DB'?1:2;
      return [label,net,[12,23+index]];
    }
    throw new Error(`No copper lane assigned for ${net}`);
  });
  componentRow++;
}
// Keep J_IN as a compact two-pin landing next to the external barrel-jack guide.
const jIn=parts.find(p=>p.ref==='J_IN');
jIn.pins[0][2]=[36,busForNet['12V_IN']];jIn.pins[1][2]=[36,3];
// J_OUT remains a physical 1x12 header in the isolated pad field; one short
// insulated jumper per used header net joins it to the corresponding bus/island.
const jOut=parts.find(p=>p.ref==='J_OUT');
jOut.pins.forEach(pin=>{pin[2]=[Number(pin[0].split(' ')[0]),29]});
jOut.unconnected=[[5,29],[6,29],[8,29]];
export const links=[];
const rootAt=new Map();
const holesByRoot=new Map();
for(const g of copperGroups){holesByRoot.set(g.id,g.holes);for(const h of g.holes)rootAt.set(h.join(','),g.id);}
const byNet=new Map();
for(const p of parts)for(const [,net,h] of p.pins){const root=rootAt.get(h.join(','));if(root)(byNet.get(net)??byNet.set(net,[]).get(net)).push({root,h});}
let linkNo=1;
const gridDistance=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
for(const [net,entries] of byNet){
  const roots=[...new Set(entries.map(e=>e.root))];
  if(roots.length<2)continue;
  const connected=new Set([roots[0]]);
  while(connected.size<roots.length){
    let best=null;
    for(const aRoot of connected)for(const bRoot of roots)if(!connected.has(bRoot))
      for(const a of holesByRoot.get(aRoot))for(const b of holesByRoot.get(bRoot)){
        const distance=gridDistance(a,b);
        if(!best||distance<best.distance)best={aRoot,bRoot,a,b,distance};
      }
    links.push({id:`L${linkNo++}`,net,from:best.a,to:best.b,why:`shortest bridge between ${net} copper groups`});
    connected.add(best.bRoot);
  }
}
// Manufacturer part numbers for the BOM and tscircuit checks. Headers and modules are intentionally absent:
// exact purchased variants/terminal layouts have not been verified, so no part number is claimed or drawn.
export const mpnFor = (p) => {
  const r = { '1 kΩ': '1K', '2.2 kΩ': '2K2', '100 kΩ': '100K', '470 Ω': '470R', '47 kΩ': '47K' };
  if (p.kind === 'resistor') return `MFR-25FBF52-${r[p.value]}`;
  return { D1: '1N5822', C1: 'EEU-FR1E471', C2: 'C315C104K5R5TA', C_SENSE: 'C315C104K5R5TA', Q1: 'NDP6020P', Q2: '2N7000', Q3: '2N7000',
    F1: '0218002.MXP' }[p.ref];
};
