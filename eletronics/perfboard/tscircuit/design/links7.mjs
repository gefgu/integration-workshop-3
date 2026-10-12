// Revision 7 removable links: 2-pin headers with a shunt that split a net so one half of a board can be
// tested alone. A link replaces nothing: with the shunt fitted the board is the revision 5/6 netlist
// (the assessor merges `NET__B` back into `NET` before comparing).
//
// Rules for every link:
//  - never on a sensitive analogue net (the same regex as the wire router),
//  - the side that loads the signal must be held OFF when the shunt is removed (an existing pull-down,
//    or one added here), so an open link can only ever mean "OFF",
//  - `far` pins move to net `<NET>__B`; the side that carries the cross-board harness keeps the name.
export const LINKS={
  power:[
    {ref:'JP_R7_ENABLE',net:'EDU_PWR_EN',far:[['U_POWER_INTERLOCK_ALLOW','A1'],['R_POWER_INTERLOCK_EDU_PWR_EN_OFF','A']],loadSide:'far',pulldown:'R_POWER_INTERLOCK_EDU_PWR_EN_OFF',
      purpose:'Open: the interlock AND gate ignores the router enable; drive its input by hand to test the gate.',failSafe:'Enable input is pulled low by the existing OFF resistor.'},
    {ref:'JP_R7_ALIVE',net:'ROUTER_ALIVE',far:[['U_POWER_INTERLOCK_ALLOW','B2'],['R_POWER_INTERLOCK_ROUTER_ALIVE_OFF','A']],loadSide:'far',pulldown:'R_POWER_INTERLOCK_ROUTER_ALIVE_OFF',
      purpose:'Open: the interlock sees the watchdog as stopped; apply 3.3 V to the far pad to simulate a live heartbeat.',failSafe:'Alive input is pulled low by the existing OFF resistor.'},
    {ref:'JP_R7_PASS',net:'ALLOW_RAIL',far:[['Q_POWER_ANALOG_ENABLE','G']],loadSide:'far',addPulldown:{ref:'R_R7_PASS_PD',value:'100k'},
      purpose:'Open: the interlock logic is cut off from the student-rail switch; measure ALLOW_RAIL with the rail provably OFF.',failSafe:'Added 100 kΩ holds the enable gate low, so the pass FET stays OFF.'},
  ],
  'router-matrix':[
    {ref:'JP_R7_EN',net:'EDU_PWR_EN',far:[['U_ROUTER_CORE_ESP1','IO32']],loadSide:'near',pulldown:'external',
      purpose:'Open: ESP1 cannot enable the student rail whatever the firmware does; use for the first power-up and for bring-up of the ESP.',failSafe:'The power board pulls EDU_PWR_EN low through its own OFF resistor.'},
    {ref:'JP_R7_STBA',net:'STROBE_A',far:[['U_MATRIX_CONTROL_BUFFER','Y1']],loadSide:'near',pulldown:'R_MATRIX_SWITCHES_STBA_OFF',
      purpose:'Open: matrix A strobe is cut off from the control buffer; test the buffer and the MT8816 separately.',failSafe:'MT_A STROBE is pulled low by its OFF resistor.'},
    {ref:'JP_R7_STBB',net:'STROBE_B',far:[['U_MATRIX_CONTROL_BUFFER','Y2']],loadSide:'near',pulldown:'R_MATRIX_SWITCHES_STBB_OFF',
      purpose:'Open: matrix B strobe is cut off from the control buffer.',failSafe:'MT_B STROBE is pulled low by its OFF resistor.'},
    {ref:'JP_R7_RST',net:'RST_RELEASE',far:[['U_ROUTER_CORE_ESP1','IO27']],loadSide:'near',pulldown:'R_MATRIX_SWITCHES_RST_RELEASE_OFF',
      purpose:'Open: the matrix reset can never be released by ESP1; use to test the reset chain with the matrix held in reset.',failSafe:'The reset-release gate is pulled low by its OFF resistor, so the matrix stays in reset.'},
  ],
};
const SENSITIVE=/DIV|BUF|ADC|SENSE|REF|GATE|SHUNT|WATCH_(CX|RX)/;

const withBounds=p=>{const xs=p.pins.map(q=>q.hole[0]),ys=p.pins.map(q=>q.hole[1]);return {...p,bounds:{xmin:Math.min(...xs)-.6,xmax:Math.max(...xs)+.6,ymin:Math.min(...ys)-.6,ymax:Math.max(...ys)+.6}};};
const part=(b,ref)=>b.parts.find(p=>p.ref===ref);
const pinNumber=(p,label)=>{const pin=p.pins.find(q=>q.label===label||String(q.number)===String(label));if(!pin)throw Error(`${p.ref}: no pin ${label}`);return String(pin.number);};

// Apply the links of board b before zone packing. Clones of the revision 5 parts carry `signals`
// (pin number -> net); moving a pin to NET__B and adding the link part is all it takes.
export function applyLinks(b){
  const list=LINKS[b.id]??[],added=[];
  for(const L of list){
    if(SENSITIVE.test(L.net))throw Error(`${b.id}: link ${L.ref} on sensitive net ${L.net}`);
    const farNet=`${L.net}__B`,farParts=[];
    for(const [ref,label] of L.far){
      const p=part(b,ref);if(!p)throw Error(`${b.id}: link ${L.ref} needs ${ref}`);
      const n=pinNumber(p,label);
      if(p.signals[n]!==L.net)throw Error(`${b.id}: ${ref}.${label} is on ${p.signals[n]}, expected ${L.net}`);
      p.signals[n]=farNet;farParts.push(p);
    }
    const anchor=farParts[0],phase=Math.min(...farParts.map(p=>p.phase));
    const common={sourceBoard:anchor.sourceBoard,side:'top',section:anchor.section,function:anchor.function,phase,locked:false,provisional:true};
    added.push(withBounds({...common,ref:L.ref,label:`Removable link ${L.net}`,kind:'header',body:'header',mpn:'TSW-102-07-G-S',sourceRef:L.ref,
      link:{net:L.net,farNet,purpose:L.purpose,failSafe:L.failSafe,loadSide:L.loadSide,pulldown:L.pulldown??L.addPulldown?.ref},
      signals:{1:L.net,2:farNet},pins:[{number:1,label:'1',hole:[4,4]},{number:2,label:'2',hole:[5,4]}]}));
    if(L.addPulldown){
      const v=L.addPulldown.value;
      added.push(withBounds({...common,ref:L.addPulldown.ref,label:`Pull-down ${v} for ${farNet}`,kind:'resistor',body:'passive',value:v,mpn:`MFR-25FBF52-${v.toUpperCase()}`,sourceRef:L.addPulldown.ref,
        signals:{1:farNet,2:'GND'},pins:[{number:1,label:'A',hole:[4,4]},{number:2,label:'B',hole:[8,4]}]}));
    }
  }
  b.parts.push(...added);
  return added;
}
