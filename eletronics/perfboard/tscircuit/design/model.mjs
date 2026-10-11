import {phaseFor} from './stages.mjs';
// Physical coordinates are always read from the pogo/top side. No generated copper router.
export const PITCH = 2.54;
export const COLORS = { GND: '#222222', power: '#d32f2f', v3: '#ef8500', v12: '#795548', node: '#1976d2', analog: '#26873c', digital: '#c79500', i2c: '#888888', bare: '#78909c' };
export const colorFor = (net) => net === 'GND' ? COLORS.GND : /12V|MT_VDD/.test(net) ? COLORS.v12 : /3V3|USB_3V3/.test(net) ? COLORS.v3 : /5V|EDU_RAW/.test(net) ? COLORS.power : /NODE|BUS/.test(net) ? COLORS.node : /SDA|SCL/.test(net) ? COLORS.i2c : /ADC|SENSE|REF|SHUNT|DIV|MUX/.test(net) ? COLORS.analog : COLORS.digital;
export const coordinate = (board, [i,j]) => [(i-(board.cols+1)/2)*PITCH, ((board.rows+1)/2-j)*PITCH];
export function makeBoard(id, title, cols, rows, notes = []) {
  return { id, title, cols, rows, width: ({21:53.34,28:71.1,39:100,59:150}[cols]??cols*PITCH), height: ({38:100,39:100,58:150,59:150,78:200}[rows]??rows*PITCH), notes, parts: [], nets: [], wires: [], sections: [], mounts: [[2,2],[cols-1,2]], release: 'PROTOTYPE — physical dimensions and bench acceptance pending' };
}
export function section(b, name, label) { b.sections.push({name,label}); }
export function part(b, ref, label, kind, pins, options = {}) {
  const p = { ref,label,kind,pins,side:'top',section:b.sections.at(-1)?.name ?? 'Circuit',...options };
  p.phase=phaseFor(b.id,p);
  const members = b.parts.filter(x => x.section === p.section);
  const index = members.length, sectionIndex = b.sections.findIndex(x=>x.name===p.section);
  // Fixed schematic slots, not PCB placement: generous room for numbered IC symbols.
  p.sch = options.sch ?? [(sectionIndex%2)*56 + (index%4)*14, -Math.floor(sectionIndex/2)*48-Math.floor(index/4)*12];
  if(p.kind==='resistor' && p.tolerance===.001) {
    const code=p.value.toUpperCase().replace(/^(\d+)\.(\d+)([KM])$/, '$1$3$2').replace(/^(\d+)$/, '$1R');
    p.mpn=`PTF56${code.padEnd(6,'0')}BZEK`;p.watts=.125;
  }
  if(p.kind==='resistor' && p.watts===1 && p.value==='10')p.mpn='CPF110R000FKEE6';
  b.parts.push(p); return p;
}
export function rowPins(labels, i,j) { return labels.map((label,k)=>({number:k+1,label,hole:[i+k,j]})); }
export function dipPins(labels,i,j,gap=3) { const half=labels.length/2; return labels.map((label,k)=>({number:k+1,label,hole:k<half?[i,j+k]:[i+gap,j+labels.length-1-k]})); }
export function dip(b,ref,label,labels,i,j,options={}) { return part(b,ref,label,'chip',dipPins(labels,i,j,options.gap??3),{body:'dip',mpn:label,...options}); }
export function header(b,ref,labels,i,j,options={}) { return part(b,ref,options.label??ref,'header',rowPins(labels,i,j),{body:'header',mpn:`TSW-${100+labels.length}-07-G-S`,...options}); }
export function idc(b,ref,labels,i,j,options={}) { return part(b,ref,options.label??ref,'header',labels.map((label,k)=>({number:k+1,label,hole:[i+Math.floor(k/2),j+k%2]})),{body:'idc',mpn:'61201021621',...options}); }
export function passive(b,ref,value,i,j,options={}) { const pitch=options.pitch??4; return part(b,ref,options.label??value,options.kind??'resistor',[{number:1,label:options.labels?.[0]??'A',hole:[i,j]},{number:2,label:options.labels?.[1]??'B',hole:options.vertical?[i,j+pitch]:[i+pitch,j]}],{value,body:'passive',mpn:options.kind==='diode'?value:options.kind==='capacitor'?({'100nF':'C315C104K5R5TA','1nF':'C315C102J5G5TA','1uF':'C315C105K5R5TA','10uF':'EEU-FR1E100','470uF':'EEU-FR1E471'}[value]):`MFR-25FBF52-${value.toUpperCase().replace(/^(\d+)\.(\d+)([KM])$/, '$1$3$2').replace(/^(\d+)$/, '$1R')}`,...options}); }
export function endpoint(b,ref,label) { const p=b.parts.find(p=>p.ref===ref); if(!p)throw Error(`${b.id}: unknown ${ref}`); const pin=p.pins.find(p=>p.label===label || String(p.number)===String(label)); if(!pin)throw Error(`${ref}: unknown pin ${label}`); return `${ref}.${pin.number}`; }
export function pinAt(b,ep) { const [ref,n]=ep.split('.'); const p=b.parts.find(p=>p.ref===ref); if(!p)throw Error(ep); const pin=p.pins.find(p=>p.number===Number(n)); if(!pin)throw Error(ep); return {part:p,pin}; }
export function net(b,name,ends,options={}) {
  const pins=ends.map(([ref,label])=>endpoint(b,ref,label)); const existing=b.nets.find(n=>n.name===name);
  if(existing) { existing.pins.push(...pins.filter(p=>!existing.pins.includes(p))); } else b.nets.push({name,pins,...options});
}
export function finish(b) {
  // Place related symbols in compact cards on the default A4 drawing area.
  const heights=[0,0];
  for(const section of b.sections) {
    const symbolHeight=p=>p.body==='pogo'?Math.max(1,p.pins.length*.3+.3):p.kind==='resistor'||p.kind==='capacitor'||p.kind==='diode'||p.ref.startsWith('Q_')?1:Math.max(.6,Math.ceil(p.pins.length/2)*.2+.2);
    const members=b.parts.filter(p=>p.section===section.name).sort((a,c)=>symbolHeight(c)-symbolHeight(a));
    const col=heights[0]<=heights[1]?0:1;
    let y=heights[col]+.4;
    for(let k=0;k<members.length;k+=3) {
      const row=members.slice(k,k+3);
      const height=Math.max(...row.map(symbolHeight));
      const wide=row.filter(p=>p.body==='header'||p.body==='idc').length>1?8.5:6; // two connector cards need room for their side flags
      row.forEach((p,i)=>p.sch=[col*(wide>6?26:20)+i*wide,-y-height/2]);
      y+=height+(row.some(p=>p.body==='pogo')?.8:row.some(p=>p.ref.startsWith('Q_'))?1.5:.7); // gap leaves room for each card's title text
    }
    heights[col]=y+.2;
  }
  b.wires=[];
  const staged=ep=>pinAt(b,ep).part.phase;
  // Freeze the final connection tree now. Later branches only add wires to the
  // earliest installed terminal; a late component never bridges an early net.
  for(const [netIndex,n] of b.nets.entries()) {
    const ordered=[...n.pins].sort((a,c)=>staged(a)-staged(c)||(n.bare?Number(pinAt(b,c).part.body==='pogo')-Number(pinAt(b,a).part.body==='pogo'):0)||a.localeCompare(c,undefined,{numeric:true}));
    const barePins=ordered.filter(ep=>pinAt(b,ep).part.body==='pogo');
    if(n.starRoot){
      const index=ordered.indexOf(n.starRoot);
      if(index<0||staged(n.starRoot)>staged(ordered[0]))throw Error(`${b.id}: invalid early star root for ${n.name}`);
      ordered.splice(index,1);ordered.unshift(n.starRoot);
    }
    const root=ordered[0];
    for(let k=1;k<ordered.length;k++) {
      const to=ordered[k];
      const bare=n.bare&&barePins.includes(to)&&barePins.includes(root);
      // Revision 5 prescribes a growing distribution chain rather than attaching
      // every branch to an IC leg. Earlier links are immutable as phases advance.
      // This selects electrical joints only; it does not autoroute PCB copper.
      const from=bare?barePins[barePins.indexOf(to)-1]:b.distributionChain&&!n.starRoot?ordered[k-1]:root;
      const a=pinAt(b,from).pin.hole,c=pinAt(b,to).pin.hole;
      const bend=[a[0],c[1]];let path=[a];
      if(bend[0]!==a[0]||bend[1]!==a[1])path.push(bend);
      if(c[0]!==bend[0]||c[1]!==bend[1])path.push(c);
      if(path.length===1)throw Error(`${b.id}: duplicate hole`);
      // Explicit hand-wire fanout lanes, not copper autorouting. Keep sensitive
      // feedback/measurement loops direct; power/control lanes avoid common pin columns.
      if(!bare&&!/DIV|BUF|ADC|SENSE|REF|GATE|SHUNT/.test(n.name)) {
        const lane=Math.max(1.5,Math.min(b.cols-.5,Math.round((a[0]+c[0])/2)+(netIndex%3-1)*.5));
        path=[a,[a[0],a[1]-.5],[lane,a[1]-.5],[lane,c[1]+.5],[c[0],c[1]+.5],c].filter((h,i,all)=>!i||h[0]!==all[i-1][0]||h[1]!==all[i-1][1]);
      }
      const key=[from,to].sort().join('~');
      b.wires.push({id:`W${b.wires.length+1}`,uid:`wire:${n.name}:${key}`,net:n.name,from,to,path,color:bare?COLORS.bare:colorFor(n.name),side:'bottom',insulated:!bare,phase:Math.max(staged(from),staged(to))});
    }
  }
  return b;
}
export const MAPS = {
  hct595:['QB','QC','QD','QE','QF','QG','QH','GND','QH_SER','MR_N','SHCP','STCP','OE_N','DS','QA','VCC'],
  hc74:['CLR1_N','D1','CLK1','PRE1_N','Q1','QB1','GND','QB2','Q2','PRE2_N','CLK2','D2','CLR2_N','VCC'],
  hc00:['A1','B1','Y1','A2','B2','Y2','GND','Y3','A3','B3','Y4','A4','B4','VCC'],
  hc08:['A1','B1','Y1','A2','B2','Y2','GND','Y3','A3','B3','Y4','A4','B4','VCC'],
  hc123:['A1_N','B1','CLR1_N','Q1_N','Q2','CX2','RXCX2','GND','A2_N','B2','CLR2_N','Q2_N','Q1','CX1','RXCX1','VCC'],
  opa2333:['OUTA','INA_N','INA_P','VSS','INB_P','INB_N','OUTB','VDD'],
  ina219:['IN_P','IN_N','GND','VS','SCL','SDA','A0','A1'],
  ads1115:['ADDR','ALERT_N','GND','AIN0','AIN1','AIN2','AIN3','VDD','SDA','SCL'],
  tca9517:['VCCA','SCLA','SDAA','GND','EN','SDAB','SCLB','VCCB'],
  lm393:['OUT1','IN1_N','IN1_P','GND','IN2_P','IN2_N','OUT2','VCC'],
  mt8816:['Y3','AY2','RESET','AX3','AX0','X14','X15','X6','X7','X8','X9','X10','X11','NC14','Y7','VSS','Y6','STROBE','Y5','VEE','Y4','AX1','AX2','AY0','AY1','X13','X12','X5','X4','X3','X2','X1','X0','NC34','Y0','CS','Y1','DATA','Y2','VDD'],
};
// Address code written on AX3..AX0 for each physical X row (manufacturer Table 1).
export const MT_X_ADDRESS = [0,1,2,3,4,5,8,9,10,11,12,13,6,7,14,15];
