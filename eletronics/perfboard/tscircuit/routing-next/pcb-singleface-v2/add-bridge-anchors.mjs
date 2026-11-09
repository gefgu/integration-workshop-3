// Native pathfinder routes every short copper stub. Anchor selection only places
// PCB wire pads; no custom pathfinding or copper autorouter is implemented.
import {KiCadRoutingToolsAutorouter} from '@tscircuit/krt-wasm';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const D=new URL('./',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,D),'utf8')),write=(n,v)=>writeFileSync(new URL(n,D),JSON.stringify(v,null,2)+'\n');
const p=read('native-plan.json'),bridges=[...read('bridge-plan.json'),...(existsSync(new URL('extra-anchor-targets.json',D))?read('extra-anchor-targets.json'):[])],j=read('placement.circuit.json');
const currentPorts=new Map(j.filter(x=>x.type==='pcb_port').map(x=>[x.pcb_port_id,x]));p.endpoints=p.endpoints.map(e=>({...e,...currentPorts.get(e.pcb_port_id)}));
const ep=new Map(p.endpoints.map(e=>[e.endpoint,e])),byPcb=new Map(p.endpoints.map(e=>[e.pcb_port_id,e]));
const pads=j.filter(x=>x.type==='pcb_plated_hole').map(x=>({...x,net:byPcb.get(x.pcb_port_id)?.net??'NC_'+x.pcb_port_id,r:Math.max(x.outer_diameter??x.rect_pad_width??1.8,x.outer_diameter??x.rect_pad_height??1.8)/2}));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),distSeg=(q,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(q.x-a.x-t*dx,q.y-a.y-t*dy);};
const components=j.filter(x=>x.type==='pcb_component');
const bodyBoxes=components.map(c=>({x:c.center.x,y:c.center.y,w:c.width,h:c.height}));
bodyBoxes.push({x:0,y:80,w:33,h:55}); // provisional full ESP32 module envelope
const traces=process.env.PREPARE==='1'?[]:[...p.traces],anchors=[],anchorByEndpoint=new Map();
const obstacles=[];
for(const pad of pads)obstacles.push({type:'rect',layers:['top'],center:{x:pad.x,y:pad.y},width:pad.rect_pad_width??pad.outer_diameter??1.8,height:pad.rect_pad_height??pad.outer_diameter??1.8,connectedTo:[pad.net]});
for(const h of j.filter(x=>x.type==='pcb_hole'))obstacles.push({type:'rect',layers:['top'],center:{x:h.x,y:h.y},width:5,height:5,connectedTo:[]});
function registerTrace(t){for(let i=1;i<t.route.length;i++){const a=t.route[i-1],b=t.route[i],n=Math.max(1,Math.ceil(distance(a,b)/.3));for(let k=0;k<n;k++)obstacles.push({type:'rect',layers:['top'],center:{x:a.x+(b.x-a.x)*(k+.5)/n,y:a.y+(b.y-a.y)*(k+.5)/n},width:.5,height:.5,connectedTo:[t.net]});}}
traces.forEach(registerTrace);
const targets=[...new Set(bridges.flatMap(b=>[b.a,b.b]))].sort((a,b)=>{const rank=e=>e.startsWith('U')?0:e.startsWith('J_ESP')?1:2;return rank(a)-rank(b)||a.split('.')[0].localeCompare(b.split('.')[0])||Number(a.split('.')[1])-Number(b.split('.')[1]);});
for(const endpoint of targets){
 if(anchorByEndpoint.has(endpoint))continue;
 const source=ep.get(endpoint);let found;
 const owner=components.find(c=>c.pcb_component_id===source.pcb_component_id);
 let primary;
 if(source.ref==='J_ESP_L')primary=180;
 else if(source.ref==='J_ESP_R')primary=0;
 else if(owner.width>owner.height*1.4)primary=source.y>=owner.center.y?90:270;
 else primary=source.x>=owner.center.x?0:180;
 const radii=[3.2,4,5,6,8,10,12,16,20],candidates=[];
 for(const offset of [0,180,15,-15,30,-30,45,-45,90,-90])for(const radius of radii){const t=(primary+offset)*Math.PI/180;candidates.push({x:Math.round((source.x+radius*Math.cos(t))*5)/5,y:Math.round((source.y+radius*Math.sin(t))*5)/5});}
 for(const q of candidates){
  if(Math.abs(q.x)>47||Math.abs(q.y)>97)continue;
  if(pads.some(p=>distance(p,q)<p.r+.9+.35))continue;
  if(anchors.some(p=>distance(p,q)<2.15))continue;
  if(bodyBoxes.some(b=>Math.abs(q.x-b.x)<b.w/2+1.2&&Math.abs(q.y-b.y)<b.h/2+1.2))continue;
  if(traces.some(t=>t.net!==source.net&&t.route.slice(1).some((b,i)=>distSeg(q,t.route[i],b)<1.51)))continue;
  let out;
  try{out=new KiCadRoutingToolsAutorouter({layerCount:1,minTraceWidth:.5,bounds:{minX:-48,maxX:48,minY:-98,maxY:98},obstacles,connections:[{name:source.net,pointsToConnect:[{x:source.x,y:source.y,layer:'top'},{...q,layer:'top'}]}]}, {gridStep:.2,clearance:.35,maxIterations:150000,turnCost:1000}).solveSync();}catch{}
  if(!out?.length)continue;
  found={...q,name:`WP${String(anchors.length+1).padStart(3,'0')}`,endpoint,net:source.net,diameter:1.8,drill:.8};
  const t={id:found.name+'_STUB',net:source.net,a:endpoint,b:found.name,route:out[0].route.filter(p=>p.route_type==='wire')};
  traces.push(t);registerTrace(t);break;
 }
 if(!found){write('anchor-failure.json',{endpoint,anchors,traces});throw Error('No safe routed bridge anchor for '+endpoint);}
 anchors.push(found);anchorByEndpoint.set(endpoint,found);obstacles.push({type:'rect',layers:['top'],center:found,width:1.8,height:1.8,connectedTo:[found.net]});
 if(anchors.length%10===0)console.log('Dedicated bridge anchors',anchors.length);
}
const wired=bridges.map(b=>({...b,anchorA:anchorByEndpoint.get(b.a).name,anchorB:anchorByEndpoint.get(b.b).name}));
write(process.env.PREPARE==='1'?'preanchors.json':'anchored-plan.json',{...p,traces,anchors,bridges:wired});console.log('Anchored',wired.length,'bridges on',anchors.length,'wire pads');
