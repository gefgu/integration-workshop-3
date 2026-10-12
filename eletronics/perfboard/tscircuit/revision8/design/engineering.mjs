// Static bounds only. Never substitute these calculations for bench waveforms.
export const sources={LTC4365:'https://www.analog.com/media/en/technical-documentation/data-sheets/ltc4365.pdf',HC10:'https://www.ti.com/lit/ds/symlink/sn74hc10.pdf',MCP130:'https://ww1.microchip.com/downloads/en/DeviceDoc/11184d.pdf'};
export function ladderBounds(values){
 const cases=[];
 for(let mask=0;mask<8;mask++){
  const [top,mid,bottom]=values.map((r,i)=>r*(mask&(1<<i)?1.001:.999));
  const a=1/top+1/mid,c=1/mid+1/bottom,det=a*c-1/mid**2;
  for(const iu of [-1e-8,1e-8])for(const io of [-1e-8,1e-8]){
   const gu=c/top/det,go=1/mid/top/det;
   const ou=(-iu*c-io/mid)/det,oo=(-io*a-iu/mid)/det;
   for(const threshold of [.4925,.5075])for(const hysteresis of [.020,.032])cases.push({uv:(threshold-ou)/gu,ov:(threshold-oo)/go,uvRecover:(threshold+hysteresis-ou)/gu,ovRecover:(threshold-hysteresis-oo)/go});
  }
 }
 const range=key=>[Math.min(...cases.map(c=>c[key])),Math.max(...cases.map(c=>c[key]))];
 const [top,mid,bottom]=values,total=top+mid+bottom;
 return {nominal:{uv:.5*total/(mid+bottom),ov:.5*total/bottom},uv:range('uv'),ov:range('ov'),uvRecover:range('uvRecover'),ovRecover:range('ovRecover'),cornerCount:cases.length,tolerance:.001,inputLeakageA:1e-8,hysteresisV:[.020,.032],thresholdV:[.4925,.5075]};
}
// Resolve the actual physical HC10 pin assignment, rather than assuming the intended equations.
export function interlockOutputs(part,inputs){
 const nets=Object.fromEntries(Object.entries(inputs).map(([name,value])=>[name.endsWith('__B')&&!name.startsWith('power__')?`power__${name}`:name,value]));const gates=[[1,2,13,12],[3,4,5,6],[9,10,11,8]];
 for(const [a,b,c,out] of gates){const read=n=>{const name=part.signals[n];if(!(name in nets))throw Error(`undefined logic input ${name}`);return nets[name];};nets[part.signals[out]]=!(read(a)&&read(b)&&read(c));}
 return {allow:nets.ALLOW_RAIL,clearN:nets.CLEAR_N,allowN:nets.power__ALLOW_N};
}
// Reference state machine for the firmware handoff; not deployed firmware.
export function buttonDebouncer(initialLevel,t=0){
 let candidate=initialLevel,stable=initialLevel,since=t,armed=false,last=t;
 return (level,now)=>{
  if(now<last)throw Error('button samples must be monotonic');last=now;
  if(level!==candidate){candidate=level;since=now;}
  if(now-since<20)return false;
  if(candidate){stable=true;armed=true;return false;}
  if(stable&&armed){stable=false;armed=false;return true;}
  stable=false;return false;
 };
}
