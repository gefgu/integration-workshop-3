import React from 'react';
import {parts,nets,sections} from './model.mjs';
export default function Router(){let out:any[]=[];
 for(const n of nets)out.push(<net name={n} isGroundNet={n==='GND'} isPowerNet={n==='V5'||n==='V12'}/>);
 for(const [si,section]of sections.entries()){
  const ps=parts.filter(p=>p.section===section);let children:any[]=[];
  // Schematic layout is independent of physical placement; functional sheets avoid a dense overview.
  for(const [i,p]of ps.entries()){
   const isBig=p.kind==='IC', rows=p.kind==='IC'?p.pins.length/2:p.pins.length;
   const common:any={name:p.ref,pcbX:p.x,pcbY:p.y,pcbRotation:p.rotation??0,schX:(i%4)*11,schY:-Math.floor(i/4)*9,schSheetName:section,manufacturerPartNumber:p.mpn,footprint:p.footprint};
   if(section.startsWith('Adaptacao')){const cell=Math.floor(i/4)*10;const k=i%4;common.schX=cell+[0,-3,-1.5,.5][k];common.schY=[0,0,-3,3][k];}
   if(section==='Registros'&&p.ref==='C4'){common.schX=0;common.schY=-4.5;}if(section==='Registros'&&p.ref==='C5'){common.schX=1.6;common.schY=-4.5;}
   const manual:any={R8:[14.5,1],R9:[14.5,-1],Q7:[0,3],Q8:[-5,0],R21:[2,5],R30:[-2,2],R13:[-8,0],R14:[-6.5,-3],R17:[3,0],Q11:[12,-8],R_LOW_BASE:[9,-8],R_LOW_PD:[10.5,-11],R_LOW_LIMIT:[15,-6],Q9:[0,3],Q10:[-5,0],R24:[2,5],R27:[-2,2],R15:[-8,0],R16:[-6.5,-3],R18:[3,0],R_PULSE_IN:[15,-1]};if(manual[p.ref]){[common.schX,common.schY]=manual[p.ref];}
   if(p.kind==='R')children.push(<resistor {...common} resistance={p.value} schRotation={p.pins.some(q=>['GND','V5','V12'].includes(q.net))?270:0}/>);
   else if(p.kind==='C')children.push(<capacitor {...common} capacitance={p.value} polarized={p.polarized??false} schRotation={270}/>);
   else if(p.kind==='Q')children.push(<transistor {...common} type={p.pnp?'pnp':'npn'}/>);
   else{const props={...common,pinLabels:Object.fromEntries(p.pins.map(q=>[`pin${q.pin}`,q.label])),pinAttributes:Object.fromEntries(p.pins.map(q=>[`pin${q.pin}`,!q.net?{doNotConnect:true}:q.net==='GND'?{requiresGround:true}:['V5','V12'].includes(q.net)?{requiresPower:true}:{isInput:true}])),schWidth:p.kind==='IC'?(Math.max(...p.pins.slice(0,rows).map(q=>q.label.length))+Math.max(...p.pins.slice(rows).map(q=>q.label.length)))*.09+.8:Math.max(...p.pins.map(q=>q.label.length))*.09+.95,schHeight:Math.max(.8,rows*.2+.2),schPinArrangement:isBig?{leftSide:{direction:'top-to-bottom',pins:p.pins.slice(0,rows).map(q=>q.pin)},rightSide:{direction:'bottom-to-top',pins:p.pins.slice(rows).map(q=>q.pin)}}:{rightSide:{direction:'top-to-bottom',pins:p.pins.map(q=>q.pin)}}};
    children.push(p.kind==='J'?<connector {...props}/>:<chip {...props}/>);
   }
  }
  // Labels retain full membership. Native traces inside passive/transistor cells where adjacent.
  for(const n of nets){const es=ps.flatMap(p=>p.pins.filter(q=>q.net===n).map(q=>({ref:p.ref,pin:q.pin})));if(!es.length)continue;if(['GND','V5','V12'].includes(n)){for(const e of es)children.push(<trace from={`.${e.ref} > .pin${e.pin}`} to={`net.${n}`} schDisplayLabel={n}/>);}else{const root=es[0];children.push(<trace from={`.${root.ref} > .pin${root.pin}`} to={`net.${n}`} schDisplayLabel={n}/>);for(const e of es.slice(1))children.push(<trace from={`.${root.ref} > .pin${root.pin}`} to={`.${e.ref} > .pin${e.pin}`}/>);}}
  out.push(<schematicsheet name={section} displayName={section} sheetIndex={si}><group name={`Block_${section}`} schSheetName={section}>{children.map((c,i)=>React.cloneElement(c,{key:i,...(c.type==='trace'?{name:`T_${section}_${i}`}:{})}))}</group></schematicsheet>);
 }
 for(const x of[-45,45])for(const y of[-95,95])out.push(<hole name={`MH_${x}_${y}`} diameter={3.2} pcbX={x} pcbY={y}/>);
 const route=process.env.ROUTE_PCB==='1';
 return <board width={100} height={200} layers={1} routingDisabled={!route} minTraceWidth={0.4} autorouter={{local:true,traceClearance:0.25}} schTraceAutoLabelEnabled={false}>{out.map((c,i)=>React.cloneElement(c,{key:i}))}</board>;
}
