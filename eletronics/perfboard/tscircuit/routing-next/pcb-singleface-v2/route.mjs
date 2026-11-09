// All pathfinding uses the installed native tscircuit KRT solver.
import {KiCadRoutingToolsAutorouter} from '@tscircuit/krt-wasm';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {parts} from './model.mjs';
const D=new URL('./',import.meta.url),write=(n,v)=>writeFileSync(new URL(n,D),JSON.stringify(v,null,2)+'\n');
const base=JSON.parse(readFileSync(new URL('placement.circuit.json',D),'utf8'));
const sc=new Map(base.filter(p=>p.type==='source_component').map(p=>[p.source_component_id,p.name]));
const sp=new Map(base.filter(p=>p.type==='source_port').map(p=>[p.source_port_id,p]));
const eps=base.filter(p=>p.type==='pcb_port').map(p=>{const s=sp.get(p.source_port_id),ref=sc.get(s.source_component_id),pin=s.pin_number;const q=parts.find(p=>p.ref===ref).pins.find(q=>q.pin===pin);return {...p,ref,pin,net:q.net,endpoint:`${ref}.${pin}`};});
const byEp=new Map(eps.map(p=>[p.endpoint,p]));const byPcb=new Map(eps.map(p=>[p.pcb_port_id,p]));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const pads=base.filter(p=>['pcb_plated_hole','pcb_smtpad'].includes(p.type));
const padObs=pads.map(p=>({type:'rect',layers:['top'],center:{x:p.x,y:p.y},width:p.rect_pad_width??p.outer_diameter??p.width??1.8,height:p.rect_pad_height??p.outer_diameter??p.height??1.8,connectedTo:[byPcb.get(p.pcb_port_id)?.net??'NC_'+p.pcb_port_id]}));
for(const h of base.filter(p=>p.type==='pcb_hole'))padObs.push({type:'rect',layers:['top'],center:{x:h.x,y:h.y},width:5,height:5,connectedTo:[]});
const connections=[];
for(const net of new Set(eps.map(p=>p.net).filter(Boolean))){
 const es=eps.filter(p=>p.net===net);if(es.length<2)continue;
 const done=new Set([es[0]]),degree=new Map(es.map(e=>[e,0]));
 while(done.size<es.length){let best;for(const a of done)if(degree.get(a)<4)for(const b of es)if(!done.has(b)){const d=distance(a,b);if(!best||d<best.d)best={a,b,d};}
  done.add(best.b);degree.set(best.a,degree.get(best.a)+1);degree.set(best.b,degree.get(best.b)+1);
  connections.push({id:`C${String(connections.length+1).padStart(3,'0')}`,net,a:best.a.endpoint,b:best.b.endpoint,d:best.d});
 }
}
const rank=n=>/^(AX|AY|DATA|CS_|STROBE|RESET)/.test(n)?0:n.startsWith('NODE')?1:2;
const ordered=[...connections].sort((a,b)=>process.env.ORDER==='long'?b.d-a.d:process.env.ORDER==='backbone'?(rank(a.net)-rank(b.net)||a.d-b.d):(a.d-b.d||a.id.localeCompare(b.id)));
const pre=existsSync(new URL('preanchors.json',D))?JSON.parse(readFileSync(new URL('preanchors.json',D),'utf8')):null;
const obstacles=[...padObs],traces=[],bridges=[];
if(pre){
 for(const a of pre.anchors)obstacles.push({type:'rect',layers:['top'],center:a,width:1.8,height:1.8,connectedTo:[a.net]});
 for(const t of pre.traces)for(let i=1;i<t.route.length;i++){const a=t.route[i-1],b=t.route[i],n=Math.max(1,Math.ceil(distance(a,b)/.3));for(let k=0;k<n;k++)obstacles.push({type:'rect',layers:['top'],center:{x:a.x+(b.x-a.x)*(k+.5)/n,y:a.y+(b.y-a.y)*(k+.5)/n},width:.5,height:.5,connectedTo:[t.net]});}
}

let done=0;
for(const conn of ordered){
 const a=byEp.get(conn.a),b=byEp.get(conn.b);
 const srj={layerCount:1,minTraceWidth:.5,bounds:{minX:-48,maxX:48,minY:-98,maxY:98},obstacles,connections:[{name:conn.net,pointsToConnect:[{x:a.x,y:a.y,layer:'top'},{x:b.x,y:b.y,layer:'top'}]}]};
 let result;
 try{result=new KiCadRoutingToolsAutorouter(srj,{gridStep:.2,clearance:.35,trackMargin:0,maxIterations:400000,turnCost:1000}).solveSync();}catch{}
 if(result?.length){
  const route=result[0].route.filter(p=>p.route_type==='wire');
  traces.push({...conn,route});
  for(let i=1;i<route.length;i++){
   const a=route[i-1],b=route[i],n=Math.max(1,Math.ceil(distance(a,b)/.3));
   for(let k=0;k<n;k++)obstacles.push({type:'rect',layers:['top'],center:{x:a.x+(b.x-a.x)*(k+.5)/n,y:a.y+(b.y-a.y)*(k+.5)/n},width:.5,height:.5,connectedTo:[conn.net]});
  }
 }else bridges.push(conn);
 if(++done%25===0)console.log(`PCB single face ${done}/${ordered.length}: ${traces.length} copper, ${bridges.length} wire bridges`);
}
write(process.env.PLANNAME??'native-plan.json',{engine:'@tscircuit/krt-wasm',widthMm:100,heightMm:200,copperLayers:1,minTraceWidthMm:.5,routerClearanceMm:.35,connections,traces,bridges,endpoints:eps,anchors:pre?.anchors??[],anchorStubs:pre?.traces??[]});
console.log('FINISHED',traces.length,'copper',bridges.length,'bridges');
