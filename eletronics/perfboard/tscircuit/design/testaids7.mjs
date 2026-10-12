// Revision 7 test aids for the two lower boards: a labelled test-point strip, one standard probe
// header and a row of status LEDs. Nothing here changes an original net: every test point, header
// pin and LED joins an existing net; each LED adds one private net between its resistor and anode.
//
// Geometry (hole units, 78x38 boards): row 1 = probe header (top left), row 38 = status LEDs.
// Rows 3..36 stay free for the functional parts; bus bars never use rows 1-2 or 37-38.
// Test points are NOT extra parts or wires: designate() picks an existing pad on each listed net
// (solder a short tin loop or pin on it). This keeps the crossings and wire count unchanged.
export const PROBE_STD=['GND','5V','3V3','12V','SIG1','SIG2','TRIG','FAULT'];
const SENSITIVE=/DIV|BUF|ADC|SENSE|REF|GATE|SHUNT|WATCH_(CX|RX)/;

// expected: what a healthy board shows with the bench supply on and the student rail OFF.
export const SPEC={
  power:{
    probe:{'5V':'5V_SYS','3V3':'3V3_SYS','12V':'12V_SYS',SIG1:'BUCK_5V',SIG2:'BUCK_3V3',TRIG:'EDU_PWR_EN',FAULT:'PRESET_N'},
    tps:[['12V_FUSED','12.0 V (after fuse and reverse diode)','DMM'],['BUCK_5V','5.00 V, below the guard trip (about 5.05 V)','DMM'],['BUCK_3V3','3.30 V','DMM'],
      ['12V_SYS','12.0 V once the consumer link is fitted','DMM'],['5V_SYS','5.00 V once JP_LOGIC is fitted','DMM'],['3V3_SYS','3.30 V once JP_3V3 is fitted','DMM'],
      ['5V_EDU','0 V while OFF; at most 5.25 V when ON','DMM + scope'],['EDU_PWR_EN','0 V at boot and reset; 3.3 V only while enabled','DMM'],
      ['ALLOW_RAIL','0 V while OFF (enable AND no fault AND alive)','DMM'],['NOT_FAULT','high when no fault latched (verify polarity on the schematic)','DMM'],
      ['PRESET_N','high when idle, pulled low by a trip (verify on the schematic)','Scope'],['ROUTER_ALIVE','high while the heartbeat is fresh; low within 350 ms of HB OFF','Scope']],
    leds:[['12V_FUSED','4.7k','12 V fused input present'],['BUCK_5V','2.2k','5 V buck output present'],['BUCK_3V3','1k','3.3 V buck output present'],['5V_SYS','2.2k','5 V system rail present'],['3V3_SYS','1k','3.3 V system rail present'],['NOT_FAULT','1k','no fault latched']],
  },
  'router-matrix':{
    probe:{'5V':'5V_SYS','3V3':'USB_ROUTER_3V3','12V':'12V_SYS',SIG1:'ROUTER_ALIVE',SIG2:'HEARTBEAT',TRIG:'XBAR_LATCH',FAULT:'EDU_FAULT'},
    tps:[['USB_ROUTER_3V3','3.3 V from the router USB','DMM'],['5V_SYS','5.00 V','DMM'],['12V_SYS','12.0 V','DMM'],['EDU_PWR_EN','0 V at boot and reset','DMM'],
      ['HEARTBEAT','50 ms edges only while the session is fresh','Scope'],['ROUTER_ALIVE','high while the heartbeat is fresh','Scope'],['EDU_FAULT','low when clear (verify polarity)','DMM'],
      ['XBAR_DAT','0 V idle, shift data when configuring','Scope'],['XBAR_CLK','0 V idle, shift clock when configuring','Scope'],['XBAR_LATCH','0 V idle, latch pulse after a shift','Scope'],
      ['STB_A_IN','0 V idle','Scope'],['STB_B_IN','0 V idle','Scope'],['STROBE_A','0 V idle, strobe pulse on a write (50 ms or less)','Scope'],['STROBE_B','0 V idle, strobe pulse on a write (50 ms or less)','Scope'],
      ['XBAR_RESET','held in reset until RESET_RELEASE and ALIVE','Scope'],['RST_RELEASE','0 V at boot','DMM'],['FIX_SDA','3.3 V idle (pull-up)','Scope'],['FIX_SCL','3.3 V idle (pull-up)','Scope']],
    leds:[['USB_ROUTER_3V3','1k','router 3.3 V present'],['5V_SYS','2.2k','5 V system rail present'],['12V_SYS','4.7k','12 V system rail present'],['ROUTER_ALIVE','1k','watchdog output high (heartbeat fresh)']],
  },
};

const rowPins=(labels,x,y)=>labels.map((label,k)=>({number:k+1,label,hole:[x+k,y]}));
const bounds=pins=>({xmin:Math.min(...pins.map(p=>p.hole[0]))-.4,xmax:Math.max(...pins.map(p=>p.hole[0]))+.4,ymin:Math.min(...pins.map(p=>p.hole[1]))-.4,ymax:Math.max(...pins.map(p=>p.hole[1]))+.4});
const mpnR=v=>`MFR-25FBF52-${v.toUpperCase().replace(/^(\d+)\.(\d+)K$/,'$1K$2')}`;

// Add test aids to board b (merged power/router board, before collect()). Returns the added parts.
export function addTestAids(b){
  const spec=SPEC[b.id];if(!spec)return [];
  const have=new Map();    // net -> min phase of the functional parts that carry it
  for(const p of b.parts)for(const name of Object.values(p.signals??{})){have.set(name,Math.min(have.get(name)??99,p.phase));}
  const phaseOf=net=>have.get(net);
  const added=[];
  const used=new Set(b.parts.flatMap(p=>p.pins.map(q=>q.hole.join(','))));
  const take=pins=>{for(const q of pins){const k=q.hole.join(',');if(used.has(k))throw Error(`${b.id}: test aid hole ${k} already used`);used.add(k);}};
  const push=part=>{take(part.pins);part.bounds=bounds(part.pins);b.parts.push(part);added.push(part);return part;};
  if(!b.sections.some(s=>s.name==='Test aids'))b.sections.push({name:'Test aids',label:'Test points, probe header and status LEDs'});

  // Probe header, row 1, right of the strip: GND 5V 3V3 12V SIG1 SIG2 TRIG FAULT. Same order on every board.
  const probeNets={GND:'GND',...spec.probe};
  const probeX=6;
  const gndPhase=Math.min(...[...have.values()]);
  const probePhase=Math.min(...PROBE_STD.map(l=>probeNets[l]==='GND'?gndPhase:phaseOf(probeNets[l])).filter(v=>v!==undefined));
  push({ref:'J_PROBE',label:'Standard probe header',kind:'header',body:'header',side:'top',phase:probePhase,mpn:'TSW-108-07-G-S',provisional:true,locked:true,function:'Test aids',section:'Test aids',
    signals:Object.fromEntries(PROBE_STD.filter(l=>probeNets[l]).map(l=>[l,probeNets[l]])),pins:rowPins(PROBE_STD,probeX,1),probe:true});

  // Status LEDs, row 38: resistor (rail -> R -> LED -> GND), 12 holes per group.
  spec.leds.filter(([n])=>have.has(n)).forEach(([net,value,meaning],k)=>{
    const x0=5+k*11,name=net.replace(/[^A-Z0-9]/g,''),anode=`LEDA_${name}`;
    const phase=phaseOf(net);
    push({ref:`R_LED_${name}`,label:value,kind:'resistor',body:'passive',side:'top',phase,value,mpn:mpnR(value),function:'Test aids',section:'Test aids',
      signals:{1:net,2:anode},pins:[{number:1,label:'A',hole:[x0,38]},{number:2,label:'B',hole:[x0+4,38]}]});
    push({ref:`LED_${name}`,label:meaning,kind:'led',body:'passive',side:'top',phase,value:'red LED',mpn:'LED 3 mm red, low current',function:'Test aids',section:'Test aids',
      signals:{1:anode,2:'GND'},pins:[{number:1,label:'A',hole:[x0+6,38]},{number:2,label:'K',hole:[x0+8,38]}],ledMeaning:meaning});
  });
  return added;
}

// Pick the pad to use as the test point for each listed net, from the finished board (after collect()).
// Preference: a connector/header pin, else the earliest-installed part, nearest the top edge for access.
export function designate(b){
  const spec=SPEC[b.id];if(!spec)return [];
  const real=p=>!p.virtual;
  const pads=name=>{
    const n=b.nets.find(n=>n.name===name);if(!n)return [];
    return n.pins.map(ep=>{const [ref,num]=ep.split('.');const p=b.parts.find(p=>p.ref===ref);return {p,pin:p.pins.find(q=>String(q.number)===num),ep};}).filter(x=>real(x.p));
  };
  const rank=x=>[x.p.kind==='header'||x.p.ref.startsWith('J_')?0:1,x.p.phase,x.pin.hole[1],x.pin.hole[0]];
  const cmp=(a,c)=>{const ra=rank(a),rc=rank(c);for(let i=0;i<ra.length;i++)if(ra[i]!==rc[i])return ra[i]-rc[i];return 0;};
  const out=[];
  for(const [net,expected,tool] of spec.tps){
    if(SENSITIVE.test(net))continue;
    const list=pads(net).sort(cmp);if(!list.length)continue;
    const x=list[0];
    out.push({ref:'TP_'+net,net,endpoint:x.ep,hole:x.pin.hole,phase:Math.min(...list.map(y=>y.p.phase)),expected,tool});
  }
  // Ground: one pad near each top corner of the board, away from the bar rows.
  const gnd=pads('GND').sort((a,c)=>a.pin.hole[1]-c.pin.hole[1]||a.pin.hole[0]-c.pin.hole[0]);
  if(gnd.length){
    const left=gnd.reduce((m,x)=>x.pin.hole[0]+x.pin.hole[1]*2<m.pin.hole[0]+m.pin.hole[1]*2?x:m);
    const right=gnd.reduce((m,x)=>(b.cols-x.pin.hole[0])+x.pin.hole[1]*2<(b.cols-m.pin.hole[0])+m.pin.hole[1]*2?x:m);
    const phase=Math.min(...gnd.map(x=>x.p.phase));
    out.unshift({ref:'TP_GND_2',net:'GND',endpoint:right.ep,hole:right.pin.hole,phase,expected:'0 V reference (right side)',tool:'DMM'});
    out.unshift({ref:'TP_GND_1',net:'GND',endpoint:left.ep,hole:left.pin.hole,phase,expected:'0 V reference (left side)',tool:'DMM'});
  }
  return out;
}
