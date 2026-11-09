import {readFileSync,writeFileSync} from 'node:fs';
import {convertCircuitJsonToPcbSvg} from 'circuit-to-svg';
const D=new URL('./',import.meta.url),read=n=>JSON.parse(readFileSync(new URL(n,D),'utf8')),write=(n,v)=>writeFileSync(new URL(n,D),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
const j=read('placement.circuit.json'),p=read('native-plan.json');
const byEp=new Map(p.endpoints.map(e=>[e.endpoint,e]));
// Copper connectivity is audited independently of the router's requested trees.
const uf=new Map(),find=x=>{if(!uf.has(x))uf.set(x,x);if(uf.get(x)!==x)uf.set(x,find(uf.get(x)));return uf.get(x);},join=(a,b)=>uf.set(find(a),find(b));
const dist=(q,a,b)=>{let dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(q.x-a.x-t*dx,q.y-a.y-t*dy);};
for(const t of p.traces){join(t.a,t.b);for(const ep of p.endpoints)if(ep.net===t.net&&t.route.slice(1).some((b,i)=>dist(ep,t.route[i],b)<.7))join(t.a,ep.endpoint);}
const cross=(a,b)=>a.x*b.y-a.y*b.x,sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
const hit=(a,b,c,d)=>{const r=sub(b,a),s=sub(d,c),q=sub(c,a),den=cross(r,s);if(Math.abs(den)<1e-7)return Math.min(dist(a,c,d),dist(b,c,d),dist(c,a,b),dist(d,a,b))<.49;const t=cross(q,s)/den,u=cross(q,r)/den;return t>=0&&t<=1&&u>=0&&u<=1;};
for(let i=0;i<p.traces.length;i++)for(let k=0;k<i;k++){const a=p.traces[i],b=p.traces[k];if(a.net!==b.net)continue;if(a.route.slice(1).some((q,n)=>b.route.slice(1).some((s,m)=>hit(a.route[n],q,b.route[m],s))))join(a.a,b.a);}
const required=[];for(const b of p.bridges){if(find(b.a)===find(b.b))continue;required.push({...b,id:`JP${String(required.length+1).padStart(2,'0')}`,originalConnection:b.id});join(b.a,b.b);}
for(const net of new Set(p.endpoints.map(e=>e.net).filter(Boolean))){const roots=new Set(p.endpoints.filter(e=>e.net===net).map(e=>find(e.endpoint)));if(roots.size>1)throw Error('Open net '+net);}
write('bridge-plan.json',required);
const sourceNetById=new Map(j.filter(e=>e.type==='source_net').map(e=>[e.source_net_id,e.name]));
for(const x of j){if(x.type==='pcb_plated_hole'||x.type==='pcb_smtpad'||x.type==='pcb_port')x.layers=['top'];}
const subcircuit=j.find(x=>x.type==='pcb_board').subcircuit_id;
for(const [i,t]of p.traces.entries()){
 const a=byEp.get(t.a),b=byEp.get(t.b);
 const sourceTrace=j.find(x=>x.type==='source_trace'&&((x.connected_source_port_ids??[]).includes(a.source_port_id)||(x.connected_source_net_ids??[]).some(id=>sourceNetById.get(id)===t.net)));
 const route=t.route.map(p=>({...p,layer:'top'}));route[0].start_pcb_port_id=a.pcb_port_id;route.at(-1).end_pcb_port_id=b.pcb_port_id;
 j.push({type:'pcb_trace',pcb_trace_id:`pcb_trace_v2_${i}`,source_trace_id:sourceTrace?.source_trace_id,subcircuit_id:subcircuit,route});
}
write('copper.circuit.json',j);write('assets/copper-native.svg',convertCircuitJsonToPcbSvg(j,{width:1000,height:2000,layer:'top'}));
write('candidate-status.json',{status:'ROUTING_CANDIDATE_NEEDS_BRIDGE_ANCHORS_AND_CHECKS',copperConnections:p.traces.length,initialWireBridges:p.bridges.length,requiredWireBridges:required.length,duplicateWireBridgesRemoved:p.bridges.length-required.length,sourceNodesPreserved:true,copperLayers:1,bridgeAnchorPadsDesigned:false,copperShortsChecked:false,manufacturingRelease:false});
console.log('Copper traces',p.traces.length,'required wire bridges',required.length,'of',p.bridges.length);
