// Native tscircuit/KRT pathfinding only. Layers are assembly heights of insulated
// hand wires BELOW the same perfboard, never fabricated copper layers or vias.
import {KiCadRoutingToolsAutorouter} from '@tscircuit/krt-wasm';
import {readFileSync,writeFileSync} from 'node:fs';
const dir=new URL('./',import.meta.url),input=JSON.parse(readFileSync(new URL('layout-input.json',dir),'utf8'));
const pins=input.pins, original=input.wires;
const distance=(a,b)=>Math.hypot(pins[a].c-pins[b].c,pins[a].r-pins[b].r);
const wires=[];
for(const net of [...new Set(original.map(w=>w.net))]){
 const terminals=Object.keys(pins).filter(k=>pins[k].net===net), connected=new Set([terminals[0]]),degree=new Map(terminals.map(t=>[t,0]));
 while(connected.size<terminals.length){
  let best;
  for(const a of connected)if(degree.get(a)<3)for(const b of terminals)if(!connected.has(b)){
   const d=distance(a,b);if(!best||d<best.d)best={a,b,d};
  }
  if(!best)throw Error('No tree '+net);
  connected.add(best.b);degree.set(best.a,degree.get(best.a)+1);degree.set(best.b,degree.get(best.b)+1);
  wires.push({id:`W${String(wires.length+1).padStart(3,'0')}`,net,from:best.a,to:best.b,function:original.find(w=>w.net===net).function});
 }
}
const pt=e=>({x:pins[e].c*2.54,y:pins[e].r*2.54,layer:'top'});
const padObs=Object.entries(pins).map(([e,p])=>({type:'rect',layers:['top'],center:pt(e),width:1.6,height:1.6,connectedTo:[e]}));

const cross=(a,b)=>a.x*b.y-a.y*b.x;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
function intersection(a,b,c,d){
 const r=sub(b,a),s=sub(d,c),q=sub(c,a),den=cross(r,s);
 if(Math.abs(den)<1e-7){
  if(Math.abs(cross(q,r))>1e-6)return null;
  const rr=r.x*r.x+r.y*r.y;if(rr<1e-8)return null;
  const ts=[(q.x*r.x+q.y*r.y)/rr,((d.x-a.x)*r.x+(d.y-a.y)*r.y)/rr].sort((a,b)=>a-b);
  const lo=Math.max(0,ts[0]),hi=Math.min(1,ts[1]);
  if(hi-lo>1e-6)return {type:'overlap',a:{x:a.x+lo*r.x,y:a.y+lo*r.y},b:{x:a.x+hi*r.x,y:a.y+hi*r.y}};
  return null;
 }
 const t=cross(q,s)/den,u=cross(q,r)/den;
 if(t>=-1e-6&&t<=1+1e-6&&u>=-1e-6&&u<=1+1e-6)return {type:'cross',x:a.x+t*r.x,y:a.y+t*r.y};
 return null;
}
const segments=w=>w.route.slice(1).map((p,i)=>[w.route[i],p]);
const selected=[],crossings=[];
const routeOrder=[...wires].sort((a,b)=>distance(a.from,a.to)-distance(b.from,b.to)||a.id.localeCompare(b.id));
for(const w of routeOrder){
 const blockers=[];let solved=false,bestRoute=null,bestScore=Infinity;
 for(let attempt=0;attempt<30;attempt++){
  const obstacles=padObs.filter(o=>!o.connectedTo.includes(w.from)&&!o.connectedTo.includes(w.to));
  // Crossing/overlap lifts are assigned explicitly after all planar paths exist.
  obstacles.push(...blockers);
  const srj={layerCount:1,minTraceWidth:.8,bounds:{minX:1.27,maxX:95.25,minY:1.27,maxY:191.77},obstacles,connections:[{name:w.id,pointsToConnect:[pt(w.from),pt(w.to)]}]};
  let out;
  try{out=new KiCadRoutingToolsAutorouter(srj,{gridStep:.635,clearance:.1,maxIterations:300000,turnCost:1000,trackMargin:0}).solveSync();}catch(e){if(bestRoute)break;throw Error(w.id+' '+String(e));}
  if(!out.length)throw Error('Missing native path '+w.id);
  w.route=out[0].route.filter(p=>p.route_type==='wire');
  const overlaps=[],hits=[],hitKeys=new Set();
  for(const old of selected)if(old.net!==w.net)for(const [a,b]of segments(w))for(const [c,d]of segments(old)){
   const hit=intersection(a,b,c,d);if(hit?.type==='cross'){const k=old.id+':'+hit.x.toFixed(4)+':'+hit.y.toFixed(4);if(!hitKeys.has(k)){hitKeys.add(k);hits.push(hit);}continue;}if(hit?.type!=='overlap')continue;
   const shared=[w.from,w.to].filter(e=>e===old.from||e===old.to);
   if(shared.some(e=>Math.max(Math.hypot(hit.a.x-pt(e).x,hit.a.y-pt(e).y),Math.hypot(hit.b.x-pt(e).x,hit.b.y-pt(e).y))<1.91))continue;
   overlaps.push(hit);
  }
  const length=w.route.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-w.route[i].x,p.y-w.route[i].y),0);
  const score=overlaps.length*15+hits.length+length/80;
  if(score<bestScore){bestScore=score;bestRoute=structuredClone(w.route);}
  if(!overlaps.length&&!hits.length){solved=true;break;}
  // Ask the native solver to detour around coincident runs, while permitting
  // individual perpendicular/diagonal insulated crossings. No custom pathfinder.
  const avoid=overlaps.length?overlaps:[...hits].sort((a,b)=>Math.hypot(a.x-(pt(w.from).x+pt(w.to).x)/2,a.y-(pt(w.from).y+pt(w.to).y)/2)-Math.hypot(b.x-(pt(w.from).x+pt(w.to).x)/2,b.y-(pt(w.from).y+pt(w.to).y)/2)).slice(0,1);
  for(const h of avoid){
   const q=h.type==='overlap'?{x:(h.a.x+h.b.x)/2,y:(h.a.y+h.b.y)/2}:{x:h.x,y:h.y};
   if(Math.min(Math.hypot(q.x-pt(w.from).x,q.y-pt(w.from).y),Math.hypot(q.x-pt(w.to).x,q.y-pt(w.to).y))<1.5)continue;
   blockers.push({type:'rect',layers:['top'],center:q,width:.8,height:.8,connectedTo:[]});
  }
 }
 if(!solved){if(!bestRoute)throw Error('Missing native route '+w.id);w.route=bestRoute;}
 w.nativeCandidateScore=bestScore;
 w.installOrder=selected.length+1;w.method='native single-plane path + insulated bridges';
 const seen=new Set();
 for(const old of selected)for(const [a,b]of segments(w))for(const [c,d]of segments(old)){
  const hit=intersection(a,b,c,d);if(hit?.type!=='cross')continue;
  const shared=[w.from,w.to].filter(e=>e===old.from||e===old.to);
  if(shared.some(e=>Math.hypot(hit.x-pt(e).x,hit.y-pt(e).y)<1.91))continue;
  const key=old.id+':'+hit.x.toFixed(4)+':'+hit.y.toFixed(4);if(seen.has(key))continue;seen.add(key);
  crossings.push({id:`X${String(crossings.length+1).padStart(3,'0')}`,x:hit.x,y:hit.y,under:old.id,over:w.id,sameNet:old.net===w.net});
 }
 selected.push(w);
 if(selected.length%25===0)console.log(`Native hand-wire paths ${selected.length}/${wires.length}`);
}
const output={engine:'@tscircuit/krt-wasm (installed native solver)',gridStepMm:.635,wireOuterDiameterAssumptionMm:.8,original,wires,crossings};
writeFileSync(new URL('paths-native.json',dir),JSON.stringify(output,null,2)+'\n');
console.log('Native paths complete:',wires.length,'crossings:',crossings.length);
