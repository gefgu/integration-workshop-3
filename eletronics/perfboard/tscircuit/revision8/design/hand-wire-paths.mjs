// Reuse the established orthogonal underside wire convention, with half-hole
// corridors that keep insulated runs off every foreign component/bar pad.
// This is manual assembly annotation geometry, not a PCB copper autorouter.
import {pinAt,flagSleeves} from '../../design/model7.mjs';
const orient=(a,c,p)=>(c[0]-a[0])*(p[1]-a[1])-(c[1]-a[1])*(p[0]-a[0]);
export const onSegment=(a,c,p)=>Math.abs(orient(a,c,p))<1e-8&&p[0]>=Math.min(a[0],c[0])&&p[0]<=Math.max(a[0],c[0])&&p[1]>=Math.min(a[1],c[1])&&p[1]<=Math.max(a[1],c[1]);
const distance=p=>p.slice(1).reduce((s,c,i)=>s+Math.abs(c[0]-p[i][0])+Math.abs(c[1]-p[i][1]),0);
const simplify=path=>path.filter((p,i,all)=>!i||p[0]!==all[i-1][0]||p[1]!==all[i-1][1]);
export function reservePadCorridors(b){
 const pads=b.parts.flatMap(p=>p.pins.map(pin=>({endpoint:`${p.ref}.${pin.number}`,hole:pin.hole})));
 const segs=[];
 const wires=[...b.wires.filter(w=>w.insulated)].sort((a,c)=>{
  const rank=w=>/REF|SENSE|SHUNT|DIV|WATCH_(CX|RX)/.test(w.net)?0:/GND|^(12V|[35]V|USB_|SAFE_|BUCK_)/.test(w.net)?2:1;
  return rank(a)-rank(c)||distance(a.path)-distance(c.path)||a.id.localeCompare(c.id,undefined,{numeric:true});
 });
 for(const w of wires){
  const a=pinAt(b,w.from).pin.hole,c=pinAt(b,w.to).pin.hole;
  const occupied=pads.filter(p=>p.endpoint!==w.from&&p.endpoint!==w.to);
  const valid=path=>path.every(p=>p[0]>=1&&p[0]<=b.cols&&p[1]>=.5&&p[1]<=b.rows+.5)&&!path.slice(1).some((c,i)=>occupied.some(p=>onSegment(path[i],c,p.hole)));
  const candidates=[w.path];
  for(const sx of [-.5,.5])for(const sy of [-.5,.5])for(const tx of [-.5,.5])for(const ty of [-.5,.5]){
   const start=[a[0]+sx,a[1]+sy],end=[c[0]+tx,c[1]+ty];
   for(const horizontalFirst of [true,false])candidates.push(simplify([a,[start[0],a[1]],start,horizontalFirst?[end[0],start[1]]:[start[0],end[1]],end,[end[0],c[1]],c]));
  }
  const score=path=>{
   let overlaps=0,crossings=0;
   for(let i=1;i<path.length;i++)for(const s of segs){if(s.net===w.net)continue;const a=path[i-1],c=path[i];
    if(orient(a,c,s.a)*orient(a,c,s.c)<0&&orient(s.a,s.c,a)*orient(s.a,s.c,c)<0)crossings++;
    if(orient(a,c,s.a)===0&&orient(a,c,s.c)===0){const axis=a[0]===c[0]?1:0;overlaps+=Math.max(0,Math.min(Math.max(a[axis],c[axis]),Math.max(s.a[axis],s.c[axis]))-Math.max(Math.min(a[axis],c[axis]),Math.min(s.a[axis],s.c[axis])));}
   }
   return distance(path)+crossings*.25+overlaps*100;
  };
  let best=null;for(const path of candidates){if(!valid(path))continue;const value=score(path);if(!best||value<best.score)best={path,score:value};}
  if(!best)throw Error(`${b.id}/${w.id}: no pad-clear corridor`);
  w.path=best.path;
  for(let i=1;i<w.path.length;i++)segs.push({a:w.path[i-1],c:w.path[i],net:w.net});
 }
 flagSleeves(b);
}
