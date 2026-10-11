import { coordinate, PITCH, colorFor } from '../design/model.mjs'
import { byId } from '../design/boards.mjs'
import { jscadPlanner as modeling } from 'jscad-planner'
const {cuboid,cylinder}=modeling.primitives
const {translate}=modeling.transforms
const {union}=modeling.booleans
const {colorize}=modeling.colors

function bodyModel(p:any, center:any) {
  const mm=p.pins.map((pin:any)=>[pin.hole[0]*PITCH,-pin.hole[1]*PITCH]);
  const w=Math.max(...mm.map((x:any)=>x[0]))-Math.min(...mm.map((x:any)=>x[0]));
  const h=Math.max(...mm.map((x:any)=>x[1]))-Math.min(...mm.map((x:any)=>x[1]));
  const block=(width:number,height:number,z:number,c:number[])=>colorize(c,translate([0,0,z/2],cuboid({size:[width,height,z]})));
  if(p.body==='pogo') {
    return colorize([.85,.7,.2],union(...p.pins.map((pin:any)=> {
      const [x,y]=coordinate(center as any,pin.hole) // center argument is the board for pogo
      const points=p.pins.map((q:any)=>coordinate(center as any,q.hole));
      const cx=(Math.min(...points.map((q:any)=>q[0]))+Math.max(...points.map((q:any)=>q[0])))/2;
      const cy=(Math.min(...points.map((q:any)=>q[1]))+Math.max(...points.map((q:any)=>q[1])))/2;
      return union(colorize([.8,.65,.2],translate([x-cx,y-cy,1.25],cylinder({radius:.915,height:2.5,segments:20}))),colorize([.95,.8,.25],translate([x-cx,y-cy,2.99],cylinder({radius:.535,height:.98,segments:20}))));
    })));
  }
  if(p.body==='esp')return block(28,55,12,[.1,.25,.3]);
  if(p.body==='idc')return block(20.36,9.1,9,[.15,.15,.15]);
  if(p.body==='dip'){const pin=p.pins[0];const dx=pin.hole[0]*PITCH-(Math.min(...mm.map((q:any)=>q[0]))+Math.max(...mm.map((q:any)=>q[0])))/2;const dy=-pin.hole[1]*PITCH-(Math.min(...mm.map((q:any)=>q[1]))+Math.max(...mm.map((q:any)=>q[1])))/2;return union(block(w+1.2,h+2.5,4,[.15,.15,.15]),colorize([1,.12,.12],translate([dx,dy,4],cylinder({radius:.5,height:.3,segments:12}))));}
  if(p.kind==='resistor')return block(Math.max(w-2,3),1.8,1.8,[.7,.55,.35]);
  if(p.kind==='capacitor')return block(3,3,4,[.7,.4,.1]);
  if(p.kind==='diode')return block(Math.max(w-2,3),2,2,[.1,.1,.1]);
  return block(Math.max(w+2,3),Math.max(h+2,3),p.body==='transistor'?5:3,[.25,.25,.25]);
}
export function Component({board,p}:{board:any,p:any}) {
 const points=p.pins.map((pin:any)=>coordinate(board,pin.hole));
 const cx=(Math.min(...points.map((q:any)=>q[0]))+Math.max(...points.map((q:any)=>q[0])))/2;
 const cy=(Math.min(...points.map((q:any)=>q[1]))+Math.max(...points.map((q:any)=>q[1])))/2;
 const bottom=p.side==='bottom';
 const isMos=p.ref.startsWith("Q_");
 const portName=(pin:any)=>isMos?({S:"source",G:"gate",D:"drain"}[pin.label]):`pin${pin.number}`;
 const footprintPins=isMos?["D","S","G"].map(role=>p.pins.find((pin:any)=>pin.label===role)):p.pins;
 const footprint=<footprint insertionDirection="from_above">
   {footprintPins.map((pin:any)=><platedhole key={pin.number} portHints={[portName(pin)]} pcbX={(bottom?-1:1)*(coordinate(board,pin.hole)[0]-cx)} pcbY={coordinate(board,pin.hole)[1]-cy} shape="circle" holeDiameter={p.body==='idc'?'1.2mm':'1mm'} outerDiameter="1.7mm" />)}
   {p.body==='pogo'?p.pins.map((pin:any)=><courtyardrect key={pin.number} pcbX={coordinate(board,pin.hole)[0]-cx} pcbY={coordinate(board,pin.hole)[1]-cy} width={2} height={2} />):<courtyardrect pcbX={0} pcbY={0} width={(p.bounds.xmax-p.bounds.xmin)*PITCH} height={(p.bounds.ymax-p.bounds.ymin)*PITCH} />}
 </footprint>;
 const labels=Object.fromEntries(p.pins.map((pin:any)=>[`pin${pin.number}`,pin.label]));
 const pinAttributes=Object.fromEntries(p.pins.map((pin:any)=>[ `pin${pin.number}`, /^NC/.test(pin.label)||p.stageOpenPins?.includes(pin.number)?{doNotConnect:true}: /^(VCC|VDD|VIN|VS|VCCA|VCCB|3V3|LED_A)$/.test(pin.label)||(p.mpn==='TL431ACLP'&&pin.label==='K')||(p.mpn==='ULN2003AN'&&pin.label==='COM')?{requiresPower:true}: /^(GND|GND_L|GND_R1|GND_R2|VSS|VEE|LED_K)$/.test(pin.label)||(p.mpn==='TL431ACLP'&&pin.label==='A')?{requiresGround:true}: {isPassive:true} ]));
 const common={name:p.ref,displayName:p.schematicLabel??p.label,manufacturerPartNumber:p.mpn,pinAttributes,pcbX:cx,pcbY:cy,layer:p.side,schX:p.sch[0],schY:p.sch[1],schRotation:p.schRotation,schSheetName:"Circuit",footprint,cadModel:{jscad:bodyModel(p,board)}};
 if(p.kind==='resistor')return <resistor {...common} resistance={p.value} />;
 if(p.kind==='capacitor')return <capacitor {...common} capacitance={p.value} polarized={['470uF','10uF'].includes(p.value)} />;
 if(p.kind==='diode')return <diode {...common} />;
 if(p.kind==='led')return <led {...common} color="red" />;
 if(p.ref.startsWith('F_'))return <fuse {...common} currentRating={p.ref==='F_INPUT'?'2A':'500mA'} voltageRating="30V" />;
 if(isMos)return <mosfet {...common} pinAttributes={{pin1:{isPassive:true},pin2:{isPassive:true},pin3:{isInput:true}}} channelType={["BSS84","NDP6020P"].includes(p.mpn)?"p":"n"} mosfetMode="enhancement" />;
 if(p.body==='pogo')return <connector {...common} pinLabels={labels} schWidth={1.45} schHeight={Math.max(1,p.pins.length*.3+.3)} schPinArrangement={{rightSide:{direction:'top-to-bottom',pins:p.pins.map((pin:any)=>pin.number)}}} />;
 const half=Math.ceil(p.pins.length/2);
 const longest=(pins:any[])=>Math.max(0,...pins.map(pin=>pin.label.length));
 const symbolWidth=.095*(longest(p.pins.slice(0,half))+longest(p.pins.slice(half)))+.8;
 const Tag=p.kind==="header"||p.body==="pogo"?"connector":"chip";
 return <Tag {...common} pinLabels={labels} schWidth={symbolWidth} schHeight={Math.max(.6,half*.2+.2)} schPinArrangement={{leftSide:{direction:'top-to-bottom',pins:p.pins.slice(0,half).map((x:any)=>x.number)},rightSide:{direction:'bottom-to-top',pins:p.pins.slice(half).map((x:any)=>x.number)}}} />;
}
// Native section assignment in core 0.0.2121 repacks manual coordinates and
// replaces cross-section wires with labels. Draw functional boundaries explicitly
// to preserve both manual placement and continuous internal connections.
function Section({x,y,width,height,label}:any) {return <>
  <schematicrect schX={x} schY={y} width={width} height={height} isFilled={false} strokeWidth={.02} />
  <schematictext schX={x} schY={y+height/2-.3} text={label} fontSize={.3} />
</>;}
function Connection({board,wire:w}:{board:any,wire:any}) {
 const selector=(ep:string)=>{const [ref,num]=ep.split('.');const p=board.parts.find((p:any)=>p.ref===ref);const pin=p.pins.find((pin:any)=>pin.number===Number(num));return `.${ref} > .${ref.startsWith('Q_')?({S:'source',G:'gate',D:'drain'}[pin.label]):`pin${num}`}`;};
 return <trace name={w.net} from={selector(w.from)} to={selector(w.to)} schStroke={w.color} />;
}
export function Perfboard({id,descriptor}:{id:string,descriptor?:any}) {
 const source=descriptor??byId[id];const b=source&&id==='matrix'&&!descriptor?{...source,parts:source.parts.map((p:any)=>({...p,sch:[p.sch[0],p.sch[1]*.8]}))}:source;if(!b)throw Error(`Unknown board ${id}`);
 const occupied=new Set(b.parts.flatMap((p:any)=>p.pins.map((pin:any)=>pin.hole.join(','))));
 return <board width={b.width} height={b.height} routingDisabled schRelative schTraceAutoLabelEnabled={false} schMaxTraceDistance={10000} solderMaskColor="#c5a36b" silkscreenColor="white">
   <schematicsheet name="Circuit" displayName={b.title}>
   <schematictext schX={12} schY={2.6} text={b.title} fontSize={.35} />
   {b.sections.filter((s:any)=>b.parts.some((p:any)=>p.section===s.name)).map((s:any)=>{
     const members=b.parts.filter((p:any)=>p.section===s.name);const xs=members.map((p:any)=>p.sch[0]),ys=members.map((p:any)=>p.sch[1]);
     const symbolHeight=(p:any)=>p.body==='pogo'?Math.max(1,p.pins.length*.3+.3):["resistor","capacitor","diode","led"].includes(p.kind)||p.ref.startsWith("Q_")||p.ref.startsWith("F_")?1:Math.max(.6,Math.ceil(p.pins.length/2)*.2+.2);
     const upper=Math.max(...members.map((p:any)=>p.sch[1]+symbolHeight(p)/2))+.45,lower=Math.min(...members.map((p:any)=>p.sch[1]-symbolHeight(p)/2))-.35;
     const x=(Math.min(...xs)+Math.max(...xs))/2,y=(upper+lower)/2;
     return <Section key={s.name} x={x} y={y} width={Math.max(...xs)-Math.min(...xs)+4.5} height={upper-lower} label={s.label} />;
   })}
   {b.parts.map((p:any)=><Component key={p.ref} board={b} p={p} />)}
   {b.parts.map((p:any)=>{const h=p.body==='pogo'?Math.max(1,p.pins.length*.3+.3):["resistor","capacitor","diode","led"].includes(p.kind)||p.ref.startsWith("Q_")||p.ref.startsWith("F_")?1:Math.max(.6,Math.ceil(p.pins.length/2)*.2+.2);return <schematictext key={`label-${p.ref}`} schX={p.sch[0]} schY={p.sch[1]-h/2-.18} text={p.ref} fontSize={.13} />;})}
   {b.wires.map((w:any)=><Connection key={w.id} board={b} wire={w} />)}

   </schematicsheet>
   {/* Drill exposed substrate only; hidden grid holes appear in the authoritative assembly SVG. */}
   {Array.from({length:b.cols*b.rows},(_,k)=> {
     const hole=[k%b.cols+1,Math.floor(k/b.cols)+1];
     if(occupied.has(hole.join(',')))return null;
     if(b.mounts.some((m:number[])=>Math.hypot(m[0]-hole[0],m[1]-hole[1])<1.5))return null;
     if(b.parts.some((p:any)=>p.body!=='pogo'&&hole[0]>=p.bounds.xmin-0.5&&hole[0]<=p.bounds.xmax+0.5&&hole[1]>=p.bounds.ymin-0.5&&hole[1]<=p.bounds.ymax+0.5))return null;
     const [x,y]=coordinate(b,hole);return <hole key={`grid-${k}`} pcbX={x} pcbY={y} diameter="1mm" />;
   })}
   {b.mounts.map((hole:number[])=>{const [x,y]=coordinate(b,hole);return <hole key={hole.join(",")} pcbX={x} pcbY={y} diameter="3.2mm" />;})}
   {b.wires.flatMap((w:any)=>w.path.slice(1).map((to:number[],k:number)=>{const a=coordinate(b,w.path[k]),c=coordinate(b,to);return <pcbnoteline key={`${w.id}-${k}`} x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} color={w.color} strokeWidth={w.insulated?.4:.6} />;}))}
   <pcbnotetext pcbX={0} pcbY={b.height/2-2} text={`${b.id.toUpperCase()} — TOP / POGO REFERENCE — see assembly/ for mirrored underside`} fontSize={1.2} />
 </board>;
}
