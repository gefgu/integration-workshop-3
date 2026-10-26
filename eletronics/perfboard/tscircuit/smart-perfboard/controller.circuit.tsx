import React from 'react';
import {board,parts,connectorMpn,endpoints} from './design.mjs';
export const holePosition=(c:number,r:number)=>({x:(c-(board.columns+1)/2)*board.pitch,y:((board.rows+1)/2-r)*board.pitch});
export default function SmartPerfboard({stage1=false,compact=false}:{stage1?:boolean,compact?:boolean}={}){
 const activeParts=(stage1?parts.filter(p=>/^(J_ESP_[LR]|J_POWER|JP_EXT|J_UART|J_JOY|J_OLED[0-5]|C_BULK|C_LOCAL)$/.test(p.ref)).map(p=>({...p,pins:p.pins.map(q=>({...q,net:q.net&&/^(EXP_|SENSE)/.test(q.net)?null:q.net}))})):parts).filter(p=>!compact||!['J_POWER','JP_EXT'].includes(p.ref));
 const activeEndpoints=[...endpoints].filter(([_,p])=>activeParts.some(q=>q.ref===p.ref));
 const children:any[]=[];
 const compactPosition=(p:any)=>{
  if(p.ref==='J_ESP_L')return {...p,sx:-6,sy:4};
  if(p.ref==='J_ESP_R')return {...p,sx:-6,sy:-4};
  if(p.ref.startsWith('J_OLED'))return {...p,sx:6,sy:9-Number(p.ref.slice(-1))*3.5};
  if(p.ref==='J_UART')return {...p,sx:-13,sy:-2};
  if(p.ref==='J_JOY')return {...p,sx:-13,sy:-7};
  return {...p,sx:p.ref==='C_BULK'?-13:-11.4,sy:8};
 };
 const schematicParts=activeParts.map(p=>compact?compactPosition(p):stage1?p:p.ref==='J_ESP_R'?{...p,sx:19,sy:-13}:p.ref==='J_EXP'?{...p,sx:32}:p.ref==='J_GND'?{...p,sx:41}:/^R_P[12]_(BOT|SER)$/.test(p.ref)?{...p,sx:15}:p);
 for(const p of schematicParts){
  const a=holePosition(p.pins[0].c,p.pins[0].r),b=holePosition(p.pins.at(-1)!.c,p.pins.at(-1)!.r);
  const common={name:p.ref,pcbX:(a.x+b.x)/2,pcbY:(a.y+b.y)/2,pcbRotation:p.pins[0].c===p.pins.at(-1)!.c?270:0,schX:p.sx,schY:p.sy};
  if(p.kind==='header'){
   const ids=p.pins.map((_,i)=>i+1);
   children.push(<connector {...common} manufacturerPartNumber={connectorMpn}
    footprint={`pinrow${p.pins.length}_p2.54mm`} schWidth={Math.max(...p.pins.map(q=>(q.label+(q.net?'':'_NC')).length))*.09+.95} schHeight={p.pins.length*.2+.2}
    pinLabels={Object.fromEntries(p.pins.map((q,i)=>[`pin${i+1}`,q.label+(q.net?'':'_NC')]))}
    pinAttributes={Object.fromEntries(p.pins.map((q,i)=>[`pin${i+1}`,!q.net?{doNotConnect:true}:q.net==='GND'?{requiresGround:true}:q.net?.startsWith('V3V3')?{requiresPower:true}:{isInput:true}]))}
    schPinArrangement={compact&&p.ref.startsWith('J_OLED')?{leftSide:{direction:'top-to-bottom',pins:ids}}:{rightSide:{direction:'top-to-bottom',pins:ids}}} />);
   if(stage1||!['J_POWER','JP_EXT'].includes(p.ref))children.push(<schematictext text={p.title} schX={p.sx} schY={p.ref==='J_ESP_R'&&!stage1?-17.5:p.ref==='JP_SENSE2'?p.sy-1.1:p.sy+p.pins.length*.1+.85} fontSize={.25}/>);
  } else if(p.kind==='resistor')children.push(<resistor {...common} resistance={p.value} footprint="axial_p0.3in" manufacturerPartNumber={p.value==='1k'?'CFR-25JB-52-1K':'CFR-25JB-52-10K'} schRotation={p.rotation}/>);
  else children.push(<capacitor {...common} capacitance={p.value} polarized={p.polarized??false} footprint={p.polarized?'electrolytic_d5mm_p2.54mm':'radial_p2.54mm'} manufacturerPartNumber={p.polarized?'47UF-10V-RADIAL-VERIFY':'100NF-50V-RADIAL-VERIFY'} schRotation={p.rotation}/>);
 }
 const nets=[...new Set(activeParts.flatMap(p=>p.pins.map(q=>q.net).filter(Boolean)))];
 for(const n of nets)children.push(<net name={n} isGroundNet={n==='GND'} isPowerNet={n.startsWith('V3V3')}/>);
 const sel=(e:string)=>{const [ref,i]=e.split('.');return `.${ref} > .pin${i}`;};
 // Ports belong only to external cable/module connectors and supply rails.
 // Passives and removable signal links are joined by native schematic traces.
 const external=(e:string)=>e.startsWith('J_');
 const partFor=(e:string)=>schematicParts.find(p=>p.ref===e.split('.')[0])!;
 for(const n of nets){
  const eps=activeEndpoints.filter(([_,p])=>p.net===n).map(([e])=>e);
  if(n==='GND'||n.startsWith('V3V3')){
   for(const e of eps)children.push(<trace name={n} schDisplayLabel={n} from={sel(e)} to={`net.${n}`}/>);
   continue;
  }
  if(compact){
   for(let i=1;i<eps.length;i++)children.push(<trace name={`${n}_wire_${i}`} from={sel(eps[0])} to={sel(eps[i])}/>);
   continue;
  }
  const outside=eps.filter(external),inside=eps.filter(e=>!external(e));
  for(const e of outside)children.push(<trace name={n} schDisplayLabel={n} from={sel(e)} to={`net.${n}`}/>);
  for(let i=1;i<inside.length;i++)children.push(<trace name={`${n}_internal_${i}`} from={sel(inside[0])} to={sel(inside[i])}/>);
  if(inside.length&&outside.length){
   const p=partFor(inside[0]);
   const nearest=outside.toSorted((a,b)=>{const x=partFor(a),y=partFor(b);return Math.hypot(x.sx-p.sx,x.sy-p.sy)-Math.hypot(y.sx-p.sx,y.sy-p.sy);})[0];
   children.push(<trace name={`${n}_boundary`} from={sel(inside[0])} to={sel(nearest)}/>);
  }
 }
 for(const [x,y,w,h,label] of [[6.5,8,19,5,'POWER / regulated 3.3 V rail'],[7,-1,20,9,'CONTROLLER / sockets, not bare ESP32'],[27.5,3,19,12,'SIX OLED PORTS / separate SDA'],[11,-14,28,14,'TWO BASIC VOLTAGE INPUTS / ADC socket'],[36,-16,18,7,'RESERVED LOGIC / ground distribution']] as any[]){
  if(compact||(stage1&&y < -5))continue;
  children.push(<schematicrect schX={x} schY={y} width={w} height={h} isFilled={false} strokeWidth={.02}/>);
  children.push(<schematictext text={label} schX={x} schY={y+h/2-.3} fontSize={.27}/>);
 }
 return <board width={board.width} height={board.height} routingDisabled schTraceAutoLabelEnabled={false}>{children.map((c,i)=>React.cloneElement(c,{key:i}))}</board>;
}
