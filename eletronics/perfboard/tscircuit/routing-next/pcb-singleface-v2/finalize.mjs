import {readFileSync,writeFileSync} from 'node:fs';
import {KiCadRoutingToolsAutorouter} from '@tscircuit/krt-wasm';
import {convertCircuitJsonToPcbSvg} from 'circuit-to-svg';
import {runAllNetlistChecks,runAllPinSpecificationChecks,runAllPlacementChecks,checkPadTraceClearance,checkPadPadClearance,checkEachPcbTraceNonOverlapping,checkHoleTraceClearance,checkPcbTracesOutOfBoard,checkTracesAreContiguous} from '@tscircuit/checks';
const D=new URL('./',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,D),'utf8')),write=(n,v)=>writeFileSync(new URL(n,D),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
const p=read('native-plan.json'),j=read('placement.circuit.json'),traces=[...p.anchorStubs,...p.traces],anchors=p.anchors;
// Refuse to reuse a routed snapshot after an electrical/position change.
const currentPorts=new Map(j.filter(x=>x.type==='pcb_port').map(x=>[x.pcb_port_id,x]));
const functional=read('parts.json');
for(const e of p.endpoints){const q=currentPorts.get(e.pcb_port_id),part=functional.find(p=>p.ref===e.ref),pin=part?.pins.find(p=>p.pin===e.pin);if(!q||Math.hypot(q.x-e.x,q.y-e.y)>1e-6||!pin||pin.net!==e.net)throw Error('Stale routing snapshot at '+e.endpoint);}
// Round 1.4 mm lands with 0.8 mm drills harden the TO-92 pattern for etching.
const componentRefs=new Map(j.filter(x=>x.type==='source_component').map(x=>[x.source_component_id,x.name]));
const transistorPcbs=new Set(j.filter(x=>x.type==='pcb_component'&&componentRefs.get(x.source_component_id)?.startsWith('Q')).map(x=>x.pcb_component_id));
for(const h of j.filter(x=>x.type==='pcb_plated_hole'&&transistorPcbs.has(x.pcb_component_id))){h.shape='circle';h.outer_diameter=1.4;h.hole_diameter=.8;delete h.rect_pad_width;delete h.rect_pad_height;delete h.rect_border_radius;delete h.rect_ccw_rotation;}
const by=new Map(p.endpoints.map(e=>[e.endpoint,e]));for(const a of anchors)by.set(a.name,{...a,endpoint:a.name});
const uf=new Map(),find=x=>{if(!uf.has(x))uf.set(x,x);if(uf.get(x)!==x)uf.set(x,find(uf.get(x)));return uf.get(x);},join=(a,b)=>uf.set(find(a),find(b));
const dist=(q,a,b)=>{let dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(q.x-a.x-t*dx,q.y-a.y-t*dy);};
const cross=(a,b)=>a.x*b.y-a.y*b.x,sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const hit=(a,b,c,d)=>{const r=sub(b,a),s=sub(d,c),q=sub(c,a),den=cross(r,s);if(Math.abs(den)<1e-7)return Math.min(dist(a,c,d),dist(b,c,d),dist(c,a,b),dist(d,a,b))<.49;const t=cross(q,s)/den,u=cross(q,r)/den;return t>=0&&t<=1&&u>=0&&u<=1;};
for(const t of traces){join(t.a,t.b);for(const ep of by.values())if(ep.net===t.net&&t.route.slice(1).some((b,i)=>dist(ep,t.route[i],b)<.99))join(t.a,ep.endpoint);}
for(let i=0;i<traces.length;i++)for(let k=0;k<i;k++){const a=traces[i],b=traces[k];if(a.net!==b.net)continue;if(a.route.slice(1).some((q,n)=>b.route.slice(1).some((s,m)=>hit(a.route[n],q,b.route[m],s))))join(a.a,b.a);}
const missing=[],bridges=[];
for(const net of new Set(p.endpoints.map(e=>e.net).filter(Boolean))){
 const endpoints=p.endpoints.filter(e=>e.net===net),roots=[...new Set(endpoints.map(e=>find(e.endpoint)))];if(roots.length<2)continue;
 const netAnchors=anchors.filter(a=>a.net===net);const grouped=roots.map(root=>({root,endpoints:endpoints.filter(e=>find(e.endpoint)===root),anchors:netAnchors.filter(a=>find(a.name)===root)}));
 for(const group of grouped)if(!group.anchors.length){missing.push({net,a:group.endpoints[0].endpoint,b:grouped.find(g=>g!==group).endpoints[0].endpoint,alternatives:group.endpoints.map(e=>e.endpoint)});}
 if(grouped.some(g=>!g.anchors.length))continue;
 const done=new Set([0]),degree=new Map(netAnchors.map(a=>[a.name,0]));
 while(done.size<grouped.length){let best;
  for(const i of done)for(let k=0;k<grouped.length;k++)if(!done.has(k))for(const a of grouped[i].anchors)if(degree.get(a.name)<3)for(const b of grouped[k].anchors){const d=Math.hypot(a.x-b.x,a.y-b.y);if(!best||d<best.d)best={a,b,k,d};}
  if(!best)throw Error('No bridge tree '+net);done.add(best.k);degree.set(best.a.name,degree.get(best.a.name)+1);degree.set(best.b.name,degree.get(best.b.name)+1);
  bridges.push({id:`JP${String(bridges.length+1).padStart(2,'0')}`,net,a:best.a.name,b:best.b.name,lengthStraightMm:best.d});
 }
}
if(missing.length){write('missing-anchor-targets.json',missing);write('candidate-status.json',{status:'MORE_ANCHORS_REQUIRED',missingAnchorComponents:missing.length,copperTraces:traces.length,manufacturingRelease:false});console.log('Missing anchors for',missing.length,'copper components');process.exit(2);}
for(const b of bridges)join(b.a,b.b);
for(const net of new Set(p.endpoints.map(e=>e.net).filter(Boolean)))if(new Set(p.endpoints.filter(e=>e.net===net).map(e=>find(e.endpoint))).size>1)throw Error('Assembled net open '+net);
// Dedicated wire pads are PCB features, not purchased connectors.
const group=j.find(x=>x.type==='source_component').source_group_id,subcircuit=j.find(x=>x.type==='pcb_board').subcircuit_id;
const sourceNets=new Map(j.filter(x=>x.type==='source_net').map(x=>[x.name,x.source_net_id]));
for(const a of anchors){
 const name=a.name,scid='source_component_'+name,spid='source_port_'+name,pcid='pcb_component_'+name,ppid='pcb_port_'+name;
 j.push({type:'source_component',source_component_id:scid,ftype:'simple_connector',name,manufacturer_part_number:'PCB wire pad - no purchased connector',source_group_id:group});
 j.push({type:'source_port',source_port_id:spid,name:'WIRE',pin_number:1,port_hints:['WIRE','pin1','1'],source_component_id:scid,subcircuit_id:subcircuit,is_input:true});
 j.push({type:'pcb_component',pcb_component_id:pcid,center:{x:a.x,y:a.y},width:1.8,height:1.8,layer:'top',rotation:0,source_component_id:scid,subcircuit_id:subcircuit,do_not_place:false,obstructs_within_bounds:true,is_allowed_to_be_off_board:false});
 j.push({type:'pcb_courtyard_circle',pcb_courtyard_circle_id:'courtyard_'+name,pcb_component_id:pcid,layer:'top',center:{x:a.x,y:a.y},radius:.9,subcircuit_id:subcircuit});
 j.push({type:'pcb_port',pcb_port_id:ppid,pcb_component_id:pcid,layers:['top'],x:a.x,y:a.y,source_port_id:spid,subcircuit_id:subcircuit});
 j.push({type:'pcb_plated_hole',pcb_plated_hole_id:'pcb_plated_hole_'+name,pcb_component_id:pcid,pcb_port_id:ppid,outer_diameter:1.8,hole_diameter:.8,shape:'circle',port_hints:['1'],x:a.x,y:a.y,layers:['top'],is_covered_with_solder_mask:false,subcircuit_id:subcircuit});
 j.push({type:'source_trace',source_trace_id:'source_trace_'+name,connected_source_port_ids:[spid,by.get(a.endpoint).source_port_id],connected_source_net_ids:[sourceNets.get(a.net)],subcircuit_id:subcircuit});
 Object.assign(by.get(name),{pcb_port_id:ppid,source_port_id:spid});
}
for(const [i,t]of traces.entries()){
 const a=by.get(t.a),b=by.get(t.b),route=t.route.map(p=>({...p,layer:'top'}));route[0].start_pcb_port_id=a.pcb_port_id;route.at(-1).end_pcb_port_id=b.pcb_port_id;
 const sourceId='source_trace_physical_'+i;
 j.push({type:'source_trace',source_trace_id:sourceId,connected_source_port_ids:[a.source_port_id,b.source_port_id],connected_source_net_ids:[sourceNets.get(t.net)],subcircuit_id:subcircuit});
 j.push({type:'pcb_trace',pcb_trace_id:'pcb_trace_v2_'+i,source_trace_id:sourceId,subcircuit_id:subcircuit,route});
}
write('copper.circuit.json',j);
const checks={netlist:await runAllNetlistChecks(j),pins:await runAllPinSpecificationChecks(j),placement:await runAllPlacementChecks(j),padTrace:checkPadTraceClearance(j),padPad:checkPadPadClearance(j),traceOverlap:checkEachPcbTraceNonOverlapping(j),holeTrace:checkHoleTraceClearance(j),boardBounds:checkPcbTracesOutOfBoard(j),contiguity:checkTracesAreContiguous(j)};
write('copper-checks.json',checks);
// Route insulated top-side wires around component envelopes using native engine.
const bodies=[];
for(const c of j.filter(x=>x.type.startsWith('pcb_courtyard_')&&!String(x.pcb_component_id).includes('WP'))){
 if(c.type==='pcb_courtyard_circle'){
  const r=c.radius;for(let y=-r;y<r;y+=.25){const h=Math.min(.25,r-y),edge=Math.max(0,Math.min(Math.abs(y),Math.abs(y+h))),w=2*Math.sqrt(Math.max(0,r*r-edge*edge));if(w>0)bodies.push({type:'rect',layers:['top'],center:{x:c.center.x,y:c.center.y+y+h/2},width:w,height:h,connectedTo:[]});}
 }else if(c.type==='pcb_courtyard_outline'){
  const xs=c.outline.map(p=>p.x),ys=c.outline.map(p=>p.y);bodies.push({type:'rect',layers:['top'],center:{x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2},width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys),connectedTo:[]});
 }else if(c.type==='pcb_courtyard_rect'){
  const turn=Math.abs(Math.round((c.ccw_rotation??0)/90))%2;bodies.push({type:'rect',layers:['top'],center:c.center,width:turn?c.height:c.width,height:turn?c.width:c.height,connectedTo:[]});
 }
}
bodies.push({type:'rect',layers:['top'],center:{x:0,y:80},width:33,height:55,connectedTo:[]});
for(const b of bridges){const a=by.get(b.a),c=by.get(b.b);
 try{const out=new KiCadRoutingToolsAutorouter({layerCount:1,minTraceWidth:.6,bounds:{minX:-48,maxX:48,minY:-98,maxY:98},obstacles:bodies,connections:[{name:b.id,pointsToConnect:[{x:a.x,y:a.y,layer:'top'},{x:c.x,y:c.y,layer:'top'}]}]},{gridStep:.2,clearance:.3,maxIterations:300000,turnCost:1000}).solveSync();b.route=out[0].route;b.lengthPlanMm=b.route.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-b.route[i].x,p.y-b.route[i].y),0);}catch(e){b.routeError=String(e);}
}
write('final-plan.json',{copperLayer:'single logical top = only physical copper face; underside orientation must be qualified',anchors,bridges,traces,sourceComponents:50,functionalNetEquivalence:true,assembledConnectivity:true});
write('assets/copper-native.svg',convertCircuitJsonToPcbSvg(j,{width:1000,height:2000}));
write('candidate-status.json',{status:Object.values(checks).some(a=>a.length)?'DRC_FAILED_NOT_FOR_MANUFACTURE':'GEOMETRY_CANDIDATE_NEEDS_INDEPENDENT_SHORTS_AND_PHYSICAL_FIT',functionalComponents:50,copperTraces:traces.length,wireBridges:bridges.length,dedicatedWirePads:anchors.length,copperLayers:1,copperCrossingsPermitted:false,sourceNetConnectivityVerified:true,assembledConnectivityVerified:true,wireRouteFailures:bridges.filter(b=>b.routeError).length,checks:Object.fromEntries(Object.entries(checks).map(([k,v])=>[k,v.length])),measuredFit:false,manufacturingRelease:false});
console.log(JSON.stringify(read('candidate-status.json'),null,2));
