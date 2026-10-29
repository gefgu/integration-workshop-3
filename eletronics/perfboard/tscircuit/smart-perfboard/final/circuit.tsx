import React from 'react';
import {parts,board,nets,sections} from './design.mjs';
export const position=(c:number,r:number)=>({x:(c-15.5)*2.54,y:(23-r)*2.54});
export default function Completion(){
 const out:any[]=[];
 for(const n of nets)out.push(<net name={n} isGroundNet={n==='GND'} isPowerNet={/^V(3V3|5V)/.test(n)}/>);
 for(const [index,section] of sections.entries()){
  const group:any[]=[];const ps=parts.filter(p=>p.section===section);
  const sorted=[...ps].sort((a,b)=>(b.kind==='dip'?1:0)-(a.kind==='dip'?1:0));const coords=new Map();
  sorted.forEach((p,i)=>coords.set(p.ref,{x:(i%4)*7,y:-Math.floor(i/4)*3.7}));
  if(section==='Mode'){coords.set('U_MODE',{x:0,y:0});coords.set('U_GATE',{x:7,y:0});coords.set('C_MODE',{x:11,y:0});coords.set('C_GATE',{x:12.6,y:0});}
  if(section==='Limits'){coords.set('R_H_GATE',{x:1.8,y:-16});}
  if(section==='Pulse'){coords.set('R_U_SSR_HIGH_LED',{x:13.8,y:0});coords.set('R_U_SSR_LOW_LED',{x:14.2,y:-3.7});}
  if(section==='Diagnostic'){coords.set('D_STIM',{x:13.8,y:0});coords.set('R_U_SSR_STIM_OFF',{x:14.2,y:-3.7});}
  for(const p of sorted){
   const first=position(p.pins[0].c,p.pins[0].r),last=position(p.pins.at(-1)!.c,p.pins.at(-1)!.r),s:any=coords.get(p.ref);
   const common={name:p.ref,pcbRotation:p.pcbRotation??0,pcbX:(first.x+last.x)/2,pcbY:(Math.min(...p.pins.map(q=>position(q.c,q.r).y))+Math.max(...p.pins.map(q=>position(q.c,q.r).y)))/2,schX:s.x,schY:s.y,schSheetName:section};
   if(p.kind==='resistor')group.push(<resistor {...common} resistance={p.value} schRotation={p.pins.some(q=>q.net==='GND'||/^V(3V3|5V)/.test(q.net??''))?270:0} footprint="axial_p0.3in" manufacturerPartNumber={p.mpn}/>);
   else if(p.kind==='capacitor')group.push(<capacitor {...common} capacitance={p.value} footprint="radial_p2.54mm" manufacturerPartNumber={p.mpn} schRotation={270}/>);
   else if(p.kind==='transistor')group.push(<transistor {...common} type="npn" footprint="pinrow3_p2.54mm" manufacturerPartNumber={p.mpn}/>);
   else if(p.kind==='adapter')group.push(<mosfet {...common} channelType={p.ref==='Q_H_ADAPTER'?'p':'n'} mosfetMode="enhancement" footprint="pinrow3_p2.54mm" manufacturerPartNumber={p.mpn}/>);
   else if(p.kind==='diode')group.push(<diode {...common} schRotation={270} footprint="axial_p0.3in" manufacturerPartNumber={p.mpn}/>);
   else {
    const prop={...common,pinLabels:Object.fromEntries(p.pins.map(q=>[`pin${q.pin}`,q.label])),pinAttributes:Object.fromEntries(p.pins.map(q=>[`pin${q.pin}`,!q.net?{doNotConnect:true}:q.label==='LED_A'?{requiresPower:true}:q.label==='LED_K'?{requiresGround:true}:q.label.startsWith('SW')?{isPassive:true}:q.net==='GND'?{requiresGround:true}:/^V(3V3|5V)/.test(q.net)?{requiresPower:true}:{isInput:true}])),footprint:p.kind==='dip'?`dip${p.pins.length}_w7.62mm`:`pinrow${p.pins.length}_p2.54mm`,manufacturerPartNumber:p.mpn,schWidth:p.kind==='dip'?(Math.max(...p.pins.slice(0,p.pins.length/2).map(q=>q.label.length))+Math.max(...p.pins.slice(p.pins.length/2).map(q=>q.label.length)))*.09+.8:Math.max(...p.pins.map(q=>q.label.length))*.09+.95,schHeight:Math.max(.8,p.pins.length*(p.kind==='dip'?.1:.2)+.2),schPinArrangement:p.kind==='dip'?{leftSide:{direction:'top-to-bottom',pins:p.pins.slice(0,p.pins.length/2).map(q=>q.pin)},rightSide:{direction:'bottom-to-top',pins:p.pins.slice(p.pins.length/2).map(q=>q.pin)}}:{rightSide:{direction:'top-to-bottom',pins:p.pins.map(q=>q.pin)}}};
    group.push(p.kind==='header'?<connector {...prop}/>:<chip {...prop}/>);
   }
  }
  const select=(ref:string,pin:number)=>`.${ref} > .pin${pin}`;
  for(const n of nets){
   const es=ps.flatMap(p=>p.pins.filter(q=>q.net===n).map(q=>({ref:p.ref,pin:q.pin})));if(!es.length)continue;
   const clusters:any[][]=[];
   for(const e of es){const a:any=coords.get(e.ref);const near=clusters.find(g=>g.some(f=>{const b:any=coords.get(f.ref);return Math.hypot(a.x-b.x,a.y-b.y)<4.1;}));if(near)near.push(e);else clusters.push([e]);}
   for(const cluster of clusters){
    if(n==='GND'||/^V(3V3|5V)/.test(n)){for(const e of cluster)group.push(<trace from={select(e.ref,e.pin)} to={`net.${n}`} schDisplayLabel={n}/>);}
    else{const root=cluster[0];group.push(<trace from={select(root.ref,root.pin)} to={`net.${n}`} schDisplayLabel={n}/>);for(const e of cluster.slice(1))group.push(<trace from={select(root.ref,root.pin)} to={select(e.ref,e.pin)}/>);}
   }
  }
  out.push(<schematicsheet name={section} displayName={section} sheetIndex={index}><group name={`Block_${section}`} schSheetName={section}>{group.map((c,i)=>React.cloneElement(c,{key:i,...(c.type==='trace'?{name:`T_${section}_${i}`}:{})}))}</group></schematicsheet>);
 }
 return <board width={board.width} height={board.height} routingDisabled schTraceAutoLabelEnabled={false}>{out.map((c,i)=>React.cloneElement(c,{key:i}))}</board>;
}
