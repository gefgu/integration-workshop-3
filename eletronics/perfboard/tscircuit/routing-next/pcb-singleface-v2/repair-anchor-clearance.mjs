import {KiCadRoutingToolsAutorouter} from '@tscircuit/krt-wasm';
import {readFileSync,writeFileSync} from 'node:fs';
const D=new URL('./',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,D),'utf8'));
const p=read('native-plan.json'),j=read('placement.circuit.json'),checks=read('copper-checks.json');
const bad=[...new Set(checks.placement.flatMap(e=>(e.pcb_component_ids??[]).filter(x=>x.includes('_WP')).map(x=>x.slice(x.indexOf('WP')))))];
const eps=new Map(p.endpoints.map(e=>[e.endpoint,e])),byPcb=new Map(p.endpoints.map(e=>[e.pcb_port_id,e]));
const pads=j.filter(x=>x.type==='pcb_plated_hole').map(x=>({...x,net:byPcb.get(x.pcb_port_id)?.net??'NC_'+x.pcb_port_id,r:Math.max(x.outer_diameter??x.rect_pad_width??1.8,x.outer_diameter??x.rect_pad_height??1.8)/2}));
const circles=j.filter(x=>x.type==='pcb_courtyard_circle');
const boxes=j.filter(x=>x.type==='pcb_courtyard_outline').map(c=>({x:(Math.min(...c.outline.map(p=>p.x))+Math.max(...c.outline.map(p=>p.x)))/2,y:(Math.min(...c.outline.map(p=>p.y))+Math.max(...c.outline.map(p=>p.y)))/2,w:Math.max(...c.outline.map(p=>p.x))-Math.min(...c.outline.map(p=>p.x)),h:Math.max(...c.outline.map(p=>p.y))-Math.min(...c.outline.map(p=>p.y))}));
for(const c of j.filter(x=>x.type==='pcb_courtyard_rect')){const turn=Math.abs(Math.round((c.ccw_rotation??0)/90))%2;boxes.push({x:c.center.x,y:c.center.y,w:turn?c.height:c.width,h:turn?c.width:c.height});}
boxes.push({x:0,y:80,w:33,h:55});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),distSeg=(q,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(q.x-a.x-t*dx,q.y-a.y-t*dy);};
for(const name of bad){
 const anchor=p.anchors.find(a=>a.name===name),source=eps.get(anchor.endpoint),otherTraces=[...p.traces,...p.anchorStubs.filter(t=>t.b!==name)],others=p.anchors.filter(a=>a.name!==name);
 const obs=pads.map(p=>({type:'rect',layers:['top'],center:p,width:p.rect_pad_width??p.outer_diameter,height:p.rect_pad_height??p.outer_diameter,connectedTo:[p.net]}));
 for(const a of others)obs.push({type:'rect',layers:['top'],center:a,width:1.8,height:1.8,connectedTo:[a.net]});
 for(const t of otherTraces)for(let i=1;i<t.route.length;i++){const a=t.route[i-1],b=t.route[i],n=Math.max(1,Math.ceil(distance(a,b)/.3));for(let k=0;k<n;k++)obs.push({type:'rect',layers:['top'],center:{x:a.x+(b.x-a.x)*(k+.5)/n,y:a.y+(b.y-a.y)*(k+.5)/n},width:.5,height:.5,connectedTo:[t.net]});}
 const candidates=[];for(let r=.4;r<=10;r+=.4)for(let a=0;a<360;a+=15){const t=a*Math.PI/180;candidates.push({x:Math.round((anchor.x+r*Math.cos(t))*5)/5,y:Math.round((anchor.y+r*Math.sin(t))*5)/5});}
 let found;
 for(const q of candidates){
  if(Math.abs(q.x)>47||Math.abs(q.y)>97)continue;
  if(circles.some(c=>distance(q,c.center)<c.radius+1.2))continue;
  if(boxes.some(b=>Math.abs(q.x-b.x)<b.w/2+1.2&&Math.abs(q.y-b.y)<b.h/2+1.2))continue;
  if(pads.some(a=>distance(a,q)<a.r+.9+.35)||others.some(a=>distance(a,q)<2.15))continue;
  if(otherTraces.some(t=>t.net!==anchor.net&&t.route.slice(1).some((b,i)=>distSeg(q,t.route[i],b)<1.51)))continue;
  let out;try{out=new KiCadRoutingToolsAutorouter({layerCount:1,minTraceWidth:.5,bounds:{minX:-48,maxX:48,minY:-98,maxY:98},obstacles:obs,connections:[{name:anchor.net,pointsToConnect:[{x:source.x,y:source.y,layer:'top'},{...q,layer:'top'}]}]},{gridStep:.2,clearance:.35,maxIterations:150000,turnCost:1000}).solveSync();}catch{}
  if(!out?.length)continue;
  Object.assign(anchor,q);const stub=p.anchorStubs.find(t=>t.b===name);stub.route=out[0].route.filter(p=>p.route_type==='wire');found=true;break;
 }
 if(!found)throw Error('No repaired courtyard-safe pad for '+name);
 writeFileSync(new URL('native-plan.json',D),JSON.stringify(p,null,2)+'\n');console.log('Repaired',name,anchor.x,anchor.y);
}
