// Exploratory native two-plane routing: second plane is a wire-bridge proposal,
// not permission to fabricate a second copper layer. Conversion must be checked.
import {KiCadRoutingToolsAutorouter} from '@tscircuit/krt-wasm';
import {readFileSync,writeFileSync} from 'node:fs';
const D=new URL('./',import.meta.url),p=JSON.parse(readFileSync(new URL('native-plan.json',D),'utf8')),j=JSON.parse(readFileSync(new URL('placement.circuit.json',D),'utf8'));
const by=new Map(p.endpoints.map(e=>[e.endpoint,e])),byid=new Map(p.endpoints.map(e=>[e.pcb_port_id,e]));
const obs=j.filter(x=>x.type==='pcb_plated_hole').map(x=>({type:'rect',layers:['top','bottom'],center:{x:x.x,y:x.y},width:x.rect_pad_width??x.outer_diameter??1.8,height:x.rect_pad_height??x.outer_diameter??1.8,connectedTo:[byid.get(x.pcb_port_id)?.net??'NC_'+x.pcb_port_id]}));
const input={layerCount:2,minTraceWidth:.5,minViaDiameter:2.2,minViaHoleDiameter:.9,bounds:{minX:-48,maxX:48,minY:-98,maxY:98},obstacles:obs,connections:[...new Set(p.endpoints.map(e=>e.net).filter(Boolean))].map(net=>({name:net,pointsToConnect:p.endpoints.filter(e=>e.net===net).map(e=>({x:e.x,y:e.y,layer:'top'}))})).filter(c=>c.pointsToConnect.length>1)};
try{const traces=new KiCadRoutingToolsAutorouter(input,{gridStep:.2,clearance:.35,maxIterations:1000000,viaCost:300000,turnCost:1000}).solveSync();writeFileSync(new URL('two-plane-exploration.json',D),JSON.stringify({traces,input},null,2));console.log('Solved traces',traces.length,'proposed transitions',traces.reduce((n,t)=>n+t.route.filter(p=>p.route_type==='via').length,0));}catch(e){console.log('Two-plane exploration failed',String(e));process.exitCode=1;}
