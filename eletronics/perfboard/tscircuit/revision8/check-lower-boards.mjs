import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {boards,lowerBoards,baseline,cables,checkpoints,changes,ladders,revision,pullupReview,dormantInterfaces} from './design/power-matrix.mjs';
import {onSegment} from './design/hand-wire-paths.mjs';
import {pinAt} from '../design/model7.mjs';
import {ladderBounds,interlockOutputs,buttonDebouncer,sources} from './design/engineering.mjs';
const out=new URL('./lower/',import.meta.url);
const save=(name,data)=>writeFileSync(new URL(name,out),typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');
const csv=rows=>rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
const issues=[];let checks=0;
const check=(ok,code,context={})=>{checks++;if(!ok)issues.push({code,...context});};
const permanentNetAliases={SAFE_5V:'5V_SYS',SAFE_3V3:'3V3_SYS',power__ALLOW_RAIL__B:'ALLOW_RAIL',power__EDU_PWR_EN__B:'EDU_PWR_EN',power__ROUTER_ALIVE__B:'ROUTER_ALIVE',router_matrix__EDU_PWR_EN__B:'EDU_PWR_EN',router_matrix__RST_RELEASE__B:'RST_RELEASE',router_matrix__STROBE_A__B:'STROBE_A',router_matrix__STROBE_B__B:'STROBE_B'};
const ori=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const crossing=(a,c,b,d)=>ori(a,c,b)*ori(a,c,d)<0&&ori(b,d,a)*ori(b,d,c)<0;
export function validateWires(b){
 const errors=[];const membership=new Map();for(const n of b.nets)for(const ep of n.pins){if(membership.has(ep))errors.push('duplicate-membership');membership.set(ep,n.name);}
 for(const w of b.wires){
  if(membership.get(w.from)!==w.net||membership.get(w.to)!==w.net)errors.push('wire-net-mismatch');
  const a=pinAt(b,w.from),c=pinAt(b,w.to);if(w.phase<Math.max(a.part.phase,c.part.phase))errors.push('premature-wire');
  if(JSON.stringify(w.path[0])!==JSON.stringify(a.pin.hole)||JSON.stringify(w.path.at(-1))!==JSON.stringify(c.pin.hole))errors.push('wrong-path-endpoint');
  for(const xy of w.path)if(xy[0]<1||xy[0]>b.cols||xy[1]<.5||xy[1]>b.rows+.5)errors.push('route-outside-board');
  if(w.insulated)for(const p of b.parts)for(const pin of p.pins){const ep=`${p.ref}.${pin.number}`;if(ep!==w.from&&ep!==w.to&&w.path.slice(1).some((c,i)=>onSegment(w.path[i],c,pin.hole)))errors.push('wire-over-foreign-pad');}
  for(const bare of b.wires.filter(v=>!v.insulated&&v.net!==w.net))if(w.path.slice(1).some((c,i)=>bare.path.slice(1).some((d,j)=>crossing(w.path[i],c,bare.path[j],d)))&&!w.sleeves?.includes(bare.id))errors.push('unsleeved-bar-crossing');
 }
 return errors;
}
const metric=b=>{
 const segments=b.wires.flatMap(w=>w.path.slice(1).map((c,i)=>({a:w.path[i],c,net:w.net})));
 let crossings=0;for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){const a=segments[i],b=segments[j];if(a.net!==b.net&&crossing(a.a,a.c,b.a,b.c))crossings++;}
 const lengthMm=b.wires.reduce((s,w)=>s+w.path.slice(1).reduce((t,c,i)=>t+Math.hypot(c[0]-w.path[i][0],c[1]-w.path[i][1])*2.54,0),0);
 const insulated=b.wires.filter(w=>w.insulated),bars=b.parts.filter(p=>p.virtual);
 return {resistors:b.parts.filter(p=>p.kind==='resistor').length,capacitors:b.parts.filter(p=>p.kind==='capacitor').length,logicPackages:b.parts.filter(p=>p.kind==='chip'&&p.body==='dip').length,physicalWireRuns:insulated.length+bars.length,insulatedWireRuns:insulated.length,continuousGroundBars:bars.length,connectionSegments:b.wires.length,wireEndpointSolderJoints:insulated.length*2+bars.reduce((s,p)=>s+p.pins.length,0),componentPinJoints:b.parts.filter(p=>!p.virtual).reduce((s,p)=>s+p.pins.length,0),crossings,lengthMm};
};
const comparison=lowerBoards.map(b=>({board:b.id,before:metric(baseline.boards.find(old=>old.id===b.id)),after:metric(b)}));
for(const row of comparison){check(row.after.crossings<row.before.crossings,'crossing-budget',row);check(row.after.lengthMm<row.before.lengthMm,'length-budget',row);}
for(const b of lowerBoards){
 check(validateWires(b).length===0,'manual-wire-validation',{board:b.id,errors:validateWires(b)});
 for(const [cap,owner] of Object.entries(b.capacitorOwners)){
  const p=b.parts.find(p=>p.ref===cap),q=b.parts.find(p=>p.ref===owner);if(!p||!q)continue;
  const vp=q.pins.find(pin=>/VCC|VDD|VIN|VS$/.test(pin.label));const distance=Math.hypot(p.pins[0].hole[0]-vp.hole[0],p.pins[0].hole[1]-vp.hole[1])*2.54;
  check(distance<=12,'bypass-too-far',{board:b.id,cap,owner,distanceMm:distance});
  check(p.signals[1]===q.signals[vp.number]&&p.signals[2]==='GND','wrong-bypass-domain',{cap,owner});
 }
 // Every unchanged component retains its pin roles, supply domains and checkpoint.
 const exclusions=new Set(changes.filter(c=>c.board===b.id).map(c=>c.ref));
 for(const old of baseline.boards.find(o=>o.id===b.id).parts.filter(p=>!p.virtual&&p.body!=='terminal')){
  if(exclusions.has(old.ref)||['U_POWER_INTERLOCK_ALLOW','C_POWER_INTERLOCK_ALLOW'].includes(old.ref))continue;
  const p=b.parts.find(p=>p.ref===old.ref);check(!!p,'unapproved-part-removal',{board:b.id,ref:old.ref});if(!p)continue;
  check(p.phase===old.phase,'checkpoint-changed',{board:b.id,ref:p.ref});
  const oldSignals=Object.fromEntries(Object.entries(old.signals).map(([k,n])=>{const normalized=n.startsWith('LEDA_')||n.endsWith('__B')?`${b.id.replaceAll('-','_')}__${n}`:n;return [old.pins.find(q=>String(q.number)===k||q.label===k).number,permanentNetAliases[normalized]??normalized];}));
  check(JSON.stringify(p.signals)===JSON.stringify(oldSignals),'pin-net-changed',{board:b.id,ref:p.ref});
 }
}
const endpointNet=(id,ep)=>boards.find(b=>b.id===id)?.nets.find(n=>n.pins.includes(ep))?.name;
const harnessValid=h=>endpointNet(h.from,h.fromPin)===h.net&&endpointNet(h.to,h.toPin)===h.net;
for(const h of cables){check(harnessValid(h),'harness-net-mismatch',{harness:h.id});check(!/LEDA_|__ALLOW_N|WATCH_(CX|RX)|__B$/.test(h.net),'private-net-harness',{harness:h.id});}
for(const bank of ['A','B'])for(let i=1;i<=3;i++){
 const c=boards.find(b=>b.id===(bank==='A'?'contact-a':'contact-b'));
 const bundle=c.parts.find(p=>p.ref===`J_${bank}_NODE_BUNDLE_${i}`);
 const receiver=lowerBoards[1].parts.find(p=>p.ref===`J_MATRIX_NODE_${bank}_${i}`);
 check(JSON.stringify(bundle.signals)===JSON.stringify(receiver.signals),'NODE-cable-pinout',{bank,group:i});
 for(const [n,net] of Object.entries(receiver.signals))check(cables.some(h=>h.net===net&&(h.toPin===`${receiver.ref}.${n}`||h.fromPin===`${receiver.ref}.${n}`)),'NODE-cable-missing',{net});
}
// Full global continuity including inherited smart contracts and new contact endpoints.
for(const d of dormantInterfaces){const b=boards.find(b=>b.id===d.board);check(pinAt(b,d.endpoint).part.kind==='header','dormant-interface-is-not-passive',d);check(!b.wires.some(w=>w.phase<d.activeFrom&&(w.from===d.endpoint||w.to===d.endpoint))&&!cables.some(h=>h.phase<d.activeFrom&&((h.from===d.board&&h.fromPin===d.endpoint)||(h.to===d.board&&h.toPin===d.endpoint))),'dormant-interface-connected-early',d);}
const partial=[];
for(let phase=0;phase<=36;phase++){
 const graph=new Map(),members=new Map();const edge=(a,b)=>{if(!graph.has(a))graph.set(a,new Set());if(!graph.has(b))graph.set(b,new Set());graph.get(a).add(b);graph.get(b).add(a);};
 for(const b of boards){for(const n of b.nets)for(const ep of n.pins)if(pinAt(b,ep).part.phase<=phase&&!dormantInterfaces.some(d=>d.board===b.id&&d.endpoint===ep&&phase<d.activeFrom)){const group=members.get(n.name)??[];group.push(`${b.id}/${ep}`);members.set(n.name,group);}for(const w of b.wires.filter(w=>w.phase<=phase))edge(`${b.id}/${w.from}`,`${b.id}/${w.to}`);}
 for(const h of cables.filter(h=>h.phase<=phase))edge(`${h.from}/${h.fromPin}`,`${h.to}/${h.toPin}`);
 let groups=0;for(const [net,list] of members){const parts=phase>=1&&phase<=5&&['NODE00','NODE01'].includes(net)?[list.filter(ep=>ep.startsWith('measurement-a-precision/')),list.filter(ep=>!ep.startsWith('measurement-a-precision/'))]:[list];for(const group of parts.filter(p=>p.length>1)){groups++;const seen=new Set([group[0]]),queue=[group[0]];while(queue.length)for(const v of graph.get(queue.pop())??[])if(!seen.has(v)){seen.add(v);queue.push(v);}check(group.every(ep=>seen.has(ep)),'partial-net-disconnected',{phase,net,missing:group.filter(ep=>!seen.has(ep))});}}
 partial.push({checkpoint:`CP${String(phase).padStart(2,'0')}`,netGroups:groups,unusedPassiveInterfacePins:dormantInterfaces.filter(d=>phase<d.activeFrom)});
}
for(const [net,from,to] of [['SHUNT_P','R_POWER_ANALOG_SHUNT.1','U_POWER_ANALOG_SENSE.3'],['5V_EDU','R_POWER_ANALOG_SHUNT.2','U_POWER_ANALOG_SENSE.4']])check(lowerBoards[0].wires.some(w=>w.net===net&&[w.from,w.to].includes(from)&&[w.from,w.to].includes(to)),'missing-direct-Kelvin-lead',{net,from,to});
const logic=lowerBoards[0].parts.find(p=>p.ref==='U_POWER_INTERLOCK_LOGIC');let logicCases=0;
for(let mask=0;mask<32;mask++){
 const [enable,noFault,alive,reset,preset]=Array.from({length:5},(_,i)=>Boolean(mask&(1<<i)));
 const actual=interlockOutputs(logic,{'EDU_PWR_EN':enable,NOT_FAULT:noFault,'ROUTER_ALIVE':alive,EDU_FAULT_RESET:reset,PRESET_N:preset});
 check(actual.allow===(enable&&noFault&&alive)&&actual.clearN===!(reset&&preset),'interlock-truth-table',{mask,actual});logicCases++;
 check(preset||actual.clearN,'preset-clear-priority',{mask});
}
for(const ref of ['JP_POWER_INPUT_LOGIC','JP_POWER_INPUT_3V3','JP_R7_PASS','JP_R7_ENABLE','JP_R7_ALIVE'])check(!lowerBoards[0].parts.some(p=>p.ref===ref),'removed-power-jumper-remains',{ref});
check(logic.signals[1]==='EDU_PWR_EN'&&logic.signals[13]==='ROUTER_ALIVE','interlock-permanent-input-paths');
const presetSinkMa=(3.38/(10000*.99)+5e-6)*1000;
check(lowerBoards[0].parts.find(p=>p.ref==='U_POWER_INTERLOCK_POR').mpn==='MCP120-300DI/TO'&&presetSinkMa<=.5,'FAULT-sink-budget',{presetSinkMa,guaranteedSinkMa:.5});
const limits=ladders.map(l=>({rail:l.rail,refs:l.refs,valuesOhm:l.values,...ladderBounds(l.values)}));
for(const l of limits){const expected=l.rail==='5V'?{uv:4.53,ov:5.14,normal:5.00,max:5.25}:{uv:2.875,ov:3.45,normal:3.30,max:3.60};check(Math.abs(l.nominal.uv-expected.uv)<.01&&Math.abs(l.nominal.ov-expected.ov)<.01,'guard-nominal-drift',l);check(l.ov[1]<=expected.max&&l.ov[0]>expected.normal&&l.uvRecover[1]<expected.normal,'guard-window',l);}
// Meaningful negative controls: corrupt a wire net, a receiving cable, and a logic input.
const damaged=structuredClone(lowerBoards[0]);damaged.wires[0].net='INVALID';check(validateWires(damaged).includes('wire-net-mismatch'),'negative-wire-test');
const h={...cables.find(h=>/^NODE/.test(h.net)),net:'INVALID'};check(!harnessValid(h),'negative-harness-test');
const wrongLogic=structuredClone(logic);wrongLogic.signals[13]='3V3_SYS';check(interlockOutputs(wrongLogic,{'EDU_PWR_EN':true,NOT_FAULT:true,'ROUTER_ALIVE':false,EDU_FAULT_RESET:false,PRESET_N:true,'3V3_SYS':true}).allow,'negative-logic-test');
// Button bounce, held-at-boot suppression, long hold and repeated presses.
const sample=(initial,sequence)=>{const update=buttonDebouncer(initial);return sequence.filter(([level,time])=>update(level,time)).length;};
check(sample(true,[[true,20],[false,25],[true,28],[false,30],[false,49],[false,50],[false,200],[true,205],[true,225],[false,230],[false,250]])===2,'debounce-bounce-repeat');
check(sample(false,[[false,20],[false,100],[true,110],[true,130],[false,140],[false,160]])===1,'debounce-held-at-boot');
check(sample(true,[[true,20],[false,30],[false,50],[false,500]])===1,'debounce-long-hold');
check(sample(true,[[false,5],[true,10],[true,30]])===0,'debounce-short-pulse');
const native=JSON.parse(readFileSync(new URL('checks.json',out)));
const expectedDigest=createHash('sha256').update(JSON.stringify({boards:lowerBoards,cables,checkpoints})).digest('hex');
check(expectedDigest===native.sourceDigest,'stale-native-build');
const result={revision,softwareStatus:issues.length||native.softwareStatus!=='pass'?'fail':'pass',checks,issues,comparison,protection:{presetSink:{maximumMa:presetSinkMa,guaranteedLTC4365SinkMa:.5,supervisor:'MCP120-300DI/TO',externalPullupOhm:10000,allowanceInputLeakageUa:5},voltageLadders:limits,pullupReview,interlock:{truthTableCases:logicCases,propagationAndPowerRamps:'pending scope qualification',faultPriority:'Boolean equivalence only; PRESET_N low forces CLEAR_N high after propagation. Simultaneous pin transitions still require scope tests.'},trip:'Original INA180/LM393/TL431/shunt network retained; actual >10.6 to <=12mA trip and <=1ms cutoff pending',watchdog:'Original 549k/1uF timing retained; expiry 200–350ms pending'},sources,hardwareStatus:'pending',firmwareStatus:'contract only',counting:'Physical wire runs = insulated leads plus continuous bars; connection segments, endpoint solder joints and component pin joints reported separately. Length is calculated geometry, not measured stock.'};
save('assessment.json',result);save('partial-state-checks.json',{revision,checks:partial,issues:issues.filter(i=>i.code==='partial-net-disconnected')});
save('changes.json',{revision,changes,pullupReview});save('harnesses.csv',csv([['id','net','from board','from pin','to board','to pin','checkpoint'],...cables.map(h=>[h.id,h.net,h.from,h.fromPin,h.to,h.toPin,`CP${String(h.phase).padStart(2,'0')}`])]));
save('bom.csv',csv([['board','ref','component','value','tolerance','checkpoint','adapter','status'],...lowerBoards.flatMap(b=>b.parts.filter(p=>!p.virtual).map(p=>[b.id,p.ref,p.mpn,p.value,p.tolerance,`CP${String(p.phase).padStart(2,'0')}`,p.adapter,p.provisional?'identify purchased interface':'selected part; sourcing and physical envelope pending']))]));
save('comparison.csv',csv([['board','metric','revision7','revision8'],...comparison.flatMap(r=>Object.keys(r.before).map(k=>[r.board,k,r.before[k],r.after[k]]))]));
save('links.csv',csv([['board','ref','net','far net','checkpoint','open means','pull-down'],...lowerBoards.flatMap(b=>b.parts.filter(p=>p.link).map(p=>[b.id,p.ref,p.link.net,p.link.farNet,p.phase,p.link.failSafe,p.link.pulldown]))]));
save('testpoints.csv',csv([['board','net','endpoint','column','row','phase'],...lowerBoards.flatMap(b=>b.testPoints.map(t=>[b.id,t.net,t.endpoint,...t.hole,t.phase]))]));
save('acceptance-template.json',{revision,status:'pending',records:['voltage guard UV/OV and failed-buck transients','trip >10.6 and <=12mA; cutoff <=1ms','PRESET wins against simultaneous reset','watchdog 200–350ms; stale heartbeat','all USB/bench-power combinations; no backfeed','permanent consumer-rail and safety-path continuity; interlock fail-safe behavior','22 independent NODE continuity paths','button bounce/held-at-boot/repeated press','stock grid, sockets, adapters, tray and plug access'].map(test=>({test,status:'pending',equipment:[],measurements:[],waveform:null}))});
console.log(JSON.stringify({status:result.softwareStatus,checks,issues,comparison,limits},null,2));if(result.softwareStatus!=='pass')process.exitCode=1;
