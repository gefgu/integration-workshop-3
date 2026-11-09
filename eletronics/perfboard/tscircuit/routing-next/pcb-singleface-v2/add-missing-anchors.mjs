import {KiCadRoutingToolsAutorouter} from '@tscircuit/krt-wasm';
import {readFileSync,writeFileSync} from 'node:fs';
const D=new URL('./',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,D),'utf8'));
const p=read('native-plan.json'),j=read('placement.circuit.json'),missing=read('missing-anchor-targets.json');
const eps=new Map(p.endpoints.map(e=>[e.endpoint,e])),byPcb=new Map(p.endpoints.map(e=>[e.pcb_port_id,e]));
const pads=j.filter(x=>x.type==='pcb_plated_hole').map(x=>({...x,net:byPcb.get(x.pcb_port_id)?.net??'NC_'+x.pcb_port_id,r:Math.max(x.outer_diameter??x.rect_pad_width??1.8,x.outer_diameter??x.rect_pad_height??1.8)/2}));
const components=j.filter(x=>x.type==='pcb_component'),boxes=components.map(c=>({x:c.center.x,y:c.center.y,w:c.width,h:c.height}));boxes.push({x:0,y:80,w:33,h:55});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),distSeg=(q,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(q.x-a.x-t*dx,q.y-a.y-t*dy);};
const all=[...p.anchorStubs,...p.traces],obs=pads.map(p=>({type:'rect',layers:['top'],center:p,width:p.rect_pad_width??p.outer_diameter,height:p.rect_pad_height??p.outer_diameter,connectedTo:[p.net]}));
function reg(t){for(let i=1;i<t.route.length;i++){const a=t.route[i-1],b=t.route[i],n=Math.max(1,Math.ceil(distance(a,b)/.3));for(let k=0;k<n;k++)obs.push({type:'rect',layers:['top'],center:{x:a.x+(b.x-a.x)*(k+.5)/n,y:a.y+(b.y-a.y)*(k+.5)/n},width:.5,height:.5,connectedTo:[t.net]});}}
all.forEach(reg);for(const a of p.anchors)obs.push({type:'rect',layers:['top'],center:a,width:1.8,height:1.8,connectedTo:[a.net]});
for(const group of missing){if((group.alternatives??[group.a]).some(e=>p.anchors.some(a=>a.endpoint===e)))continue;let found;
 for(const endpoint of group.alternatives??[group.a]){
  const s=eps.get(endpoint),owner=components.find(c=>c.pcb_component_id===s.pcb_component_id);
  const primary=owner.width>owner.height*1.4?(s.y>=owner.center.y?90:270):(s.x>=owner.center.x?0:180);
  const candidates=[];for(const offset of [0,180,90,-90,15,-15,30,-30,45,-45])for(const r of [3.2,4,5,6,8,10,12,16,20,25,30]){const t=(primary+offset)*Math.PI/180;candidates.push({x:Math.round((s.x+r*Math.cos(t))*5)/5,y:Math.round((s.y+r*Math.sin(t))*5)/5});}
  for(const q of candidates){
   if(Math.abs(q.x)>47||Math.abs(q.y)>97)continue;
   if(pads.some(p=>distance(p,q)<p.r+.9+.35)||p.anchors.some(a=>distance(a,q)<2.15))continue;
   if(boxes.some(b=>Math.abs(q.x-b.x)<b.w/2+1.2&&Math.abs(q.y-b.y)<b.h/2+1.2))continue;
   if(all.some(t=>t.net!==group.net&&t.route.slice(1).some((b,i)=>distSeg(q,t.route[i],b)<1.51)))continue;
   let out;try{out=new KiCadRoutingToolsAutorouter({layerCount:1,minTraceWidth:.5,bounds:{minX:-48,maxX:48,minY:-98,maxY:98},obstacles:obs,connections:[{name:group.net,pointsToConnect:[{x:s.x,y:s.y,layer:'top'},{...q,layer:'top'}]}]},{gridStep:.2,clearance:.35,maxIterations:150000,turnCost:1000}).solveSync();}catch{}
   if(!out?.length)continue;
   found={...q,name:`WP${String(p.anchors.length+1).padStart(3,'0')}`,endpoint,net:group.net,diameter:1.8,drill:.8};
   const t={id:found.name+'_STUB',net:group.net,a:endpoint,b:found.name,route:out[0].route.filter(p=>p.route_type==='wire')};p.anchorStubs.push(t);all.push(t);reg(t);break;
  }
  if(found)break;
 }
 if(!found)throw Error('Could not add final anchor for '+group.net+' '+group.a);
 p.anchors.push(found);writeFileSync(new URL('native-plan.json',D),JSON.stringify(p,null,2)+'\n');obs.push({type:'rect',layers:['top'],center:found,width:1.8,height:1.8,connectedTo:[found.net]});console.log('Added',found.name,'for',found.endpoint);
}
writeFileSync(new URL('native-plan.json',D),JSON.stringify(p,null,2)+'\n');
