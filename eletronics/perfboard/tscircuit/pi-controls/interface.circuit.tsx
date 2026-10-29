import React from 'react';
import { parts, wires, connectorMpn } from './design.mjs';
export default function Interface() {
 const children:any[]=[
  <schematicrect schX={0} schY={0.1} width={7.2} height={7.4} isFilled={false} strokeColor="#888888" strokeWidth={0.02} />,
  <schematicrect schX={9.3} schY={2.4} width={5.7} height={4.4} isFilled={false} strokeColor="#888888" strokeWidth={0.02} />,
  <schematicrect schX={17.3} schY={2.6} width={7.6} height={4.8} isFilled={false} strokeColor="#888888" strokeWidth={0.02} />,
  <schematictext text="Energize / Back buttons" schX={17.3} schY={4.7} fontSize={0.28} />,
  <schematicrect schX={13.8} schY={-3.75} width={14.6} height={4.8} isFilled={false} strokeColor="#888888" strokeWidth={0.02} />,
  <schematictext text="Module port numbers are logical; physical header order is unconfirmed." schX={13.5} schY={-6.5} fontSize={0.23} />,
 ];
 for (const p of parts) {
  const common={name:p.ref,schX:p.x,schY:p.y};
  if(p.kind==='resistor') children.push(<resistor {...common} resistance={p.value} schRotation={270} manufacturerPartNumber="CFR-25JB-52-10K" />);
  else if(p.kind==='switch') children.push(<switch {...common} schRotation={270} manufacturerPartNumber="GENERIC-NO-CONTACT" />);
  else {
   const ids=p.pins.map((_,i)=>i+1);
   children.push(<chip {...common} manufacturerPartNumber={connectorMpn} doNotPlace
    schWidth={p.w} schHeight={p.h}
    pinLabels={Object.fromEntries(p.pins.map((q,i)=>[`pin${i+1}`,q.label+(!q.net?'_NC':'')]))}
    pinAttributes={Object.fromEntries(p.pins.map((q,i)=>[`pin${i+1}`,q.net==='GND'?{requiresGround:true}:q.net?.endsWith('3V3')?{requiresPower:true}:(p.pi&&['SPI_MOSI','SPI_SCLK','RFID_CS_N','RFID_RST'].includes(q.net))||(p.ref==='U_RFID'&&q.label==='MISO')||(p.ref==='U_JOY'&&['VRx','VRy','SW'].includes(q.label))?{isOutput:true}:{isInput:true}]))}
    schPinArrangement={p.pi?{leftSide:{direction:'top-to-bottom',pins:ids.filter(i=>i%2===1)},rightSide:{direction:'top-to-bottom',pins:ids.filter(i=>i%2===0)}}:p.ref==='U_ESP2'?{topSide:{direction:'left-to-right',pins:[1]},bottomSide:{direction:'left-to-right',pins:[2]},rightSide:{direction:'top-to-bottom',pins:[3,4,5]}}:{leftSide:{direction:'top-to-bottom',pins:ids}}} />);
   children.push(<schematictext text={p.title} schX={p.x} schY={p.ref==='U_ESP2'?p.y-2.2:p.y+p.h/2+0.55} fontSize={0.28} />);
  }
 }
 const nets=[...new Set(parts.flatMap(p=>p.pins.map(q=>q.net).filter(Boolean)))];
 for(const n of nets) children.push(<net name={n} isGroundNet={n==='GND'} isPowerNet={n.endsWith('3V3')} />);
 const sel=(e:string)=>{const [ref,i]=e.split('.');return `.${ref} > .pin${i}`;};
 const wired=new Set(wires.flat());
 for(const [i,[a,b]] of wires.entries()) children.push(<trace name={`WIRE_${i}`} from={sel(a)} to={sel(b)} />);
 for(const n of nets){
  const endpoints=parts.flatMap(p=>p.pins.flatMap((q,i)=>q.net===n?[`${p.ref}.${i+1}`]:[]));
  let anchor=false;
  for(const e of endpoints) if(!wired.has(e)||!anchor){
   if(['R_EN.2','R_BACK.2','R_JOY.2'].includes(e)) {
    const p=parts.find(p=>p.ref===e.split('.')[0])!;
    children.push(<netlabel net={n} connection={`${p.ref}.pin2`} schX={p.x-1.2} schY={p.y-0.75} anchorSide="right" />);
   } else children.push(<trace name={n} schDisplayLabel={n} from={sel(e)} to={`net.${n}`} />);
   if(wired.has(e))anchor=true;
  }
 }
 return <board width="150mm" height="100mm" routingDisabled schTraceAutoLabelEnabled={false}>{children.map((c,i)=>React.cloneElement(c,{key:i}))}</board>;
}
