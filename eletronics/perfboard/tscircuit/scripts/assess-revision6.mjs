import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {boards,cables,baseline,mapping,checkpoints,evaluation,prototype,permanentIds,revision} from '../design/revision6.mjs';
import {pinAt} from '../design/model.mjs';
import {createHash} from 'node:crypto';
const out='revision6';mkdirSync(out,{recursive:true});
const save=(name,data)=>writeFileSync(`${out}/${name}`,typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');
const csv=rows=>rows.map(row=>row.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n')+'\n';
const issues=[];
const canonical=new Map();
for(const b of boards)for(const n of b.nets)for(const ep of n.pins){const {part,pin}=pinAt(b,ep);if(part.sourceBoard)canonical.set(`${part.sourceBoard}/${part.sourceRef}.${pin.number}`,n.name);}
let comparedPins=0;
for(const b of baseline)for(const n of b.nets)for(const ep of n.pins){
  if(pinAt(b,ep).part.body==='terminal')continue;comparedPins++;
  if(canonical.get(`${b.id}/${ep}`)!==n.name)issues.push({code:'baseline-net-changed',endpoint:`${b.id}/${ep}`,expected:n.name,actual:canonical.get(`${b.id}/${ep}`)});
}
const newParts=boards.flatMap(b=>b.parts.filter(p=>p.sourceBoard));
for(const b of boards.filter(b=>permanentIds.includes(b.id)))for(const [x,y] of b.mounts){
  const r=1.6/2.54;
  for(const p of b.parts.filter(p=>p.body!=='terminal')){
    const o=p.bounds;
    if(x+r>o.xmin&&x-r<o.xmax&&y+r>o.ymin&&y-r<o.ymax)issues.push({code:'mount-body-overlap',board:b.id,ref:p.ref,mount:[x,y]});
  }
}
const oldParts=baseline.flatMap(b=>b.parts.filter(p=>p.body!=='terminal').map(p=>({board:b.id,part:p})));
for(const {board,part} of oldParts){
  const matches=newParts.filter(p=>p.sourceBoard===board&&p.sourceRef===part.ref);
  if(matches.length!==1)issues.push({code:'functional-part-not-preserved',board,ref:part.ref,count:matches.length});
  else if(matches[0].phase!==part.phase)issues.push({code:'install-phase-changed',board,ref:part.ref});
}
save('baseline-crosswalk.csv',csv([['r5 board','r5 ref','r6 board','r6 ref','install checkpoint'],...mapping.map(m=>[m.fromBoard,m.fromRef,m.toBoard,m.toRef,`CP${String(boards.find(b=>b.id===m.toBoard).parts.find(p=>p.ref===m.toRef).phase).padStart(2,'0')}`])]));
const measuredPath=`${out}/measurements.json`;
if(!existsSync(measuredPath))save('measurements.json',{
  revision,verified:false,
  enclosure:{usableWidthMm:null,usableDepthMm:null,usableHeightBelowContactsMm:null,trayExtractionDemonstrated:false},
  boardPlacement:permanentIds.map(board=>({board,xMm:null,yMm:null,rotationDeg:0,layer:board.startsWith('contact')?'contact':'lower'})),
  stock:{pitchMm:null,usableColumns:null,usableRows:null,thicknessMm:null,isolatedPads:null,substrate:null},
  stack:{contactUndersideProtrusionMm:null,lowerTopHeightMm:null,lowerBoardThicknessMm:null,lowerUndersideProtrusionMm:null,insulationAndAssemblyAllowanceMm:null,cableBendEnvelopeMm:null},
  externalModules:[{role:'LM2596 5V',widthMm:null,depthMm:null,heightMm:null,allocated:false},{role:'XL4015 3.3V',widthMm:null,depthMm:null,heightMm:null,allocated:false},{role:'smart PCBs',widthMm:null,depthMm:null,heightMm:null,allocated:false}],
  evidence:[],note:'Fill from actual measurements and mock-up. No inferred dimensions or simulated bench acceptance.'});
const measurements=JSON.parse(readFileSync(measuredPath));
if(!measurements.boardPlacement){
  measurements.boardPlacement=permanentIds.map(board=>({board,xMm:null,yMm:null,rotationDeg:0,layer:board.startsWith('contact')?'contact':'lower'}));
  save('measurements.json',measurements);
}
const stackFields=['contactUndersideProtrusionMm','lowerTopHeightMm','lowerBoardThicknessMm','lowerUndersideProtrusionMm','insulationAndAssemblyAllowanceMm','cableBendEnvelopeMm'];
const heightKnown=stackFields.every(k=>Number.isFinite(measurements.stack[k])&&measurements.stack[k]>=0);
const requiredHeightMm=heightKnown?stackFields.reduce((s,k)=>s+measurements.stack[k],0):null;
const actualHeight=measurements.enclosure.usableHeightBelowContactsMm;
const heightStatus=requiredHeightMm===null||!Number.isFinite(actualHeight)?'pending':requiredHeightMm<=actualHeight?'pass':'fail';
const gridsKnown=['pitchMm','usableColumns','usableRows','thicknessMm'].every(k=>Number.isFinite(measurements.stock[k]));
const stockStatus=!gridsKnown||measurements.stock.isolatedPads===null?'pending':measurements.stock.isolatedPads&&Math.abs(measurements.stock.pitchMm-2.54)<.01&&measurements.stock.usableColumns>=78&&measurements.stock.usableRows>=38?'pass':'fail';
// Explicit mock-up review: calculated packing does not establish soldering or
// extraction access. Keep all human acceptance fields initially pending.
const reviewPath=`${out}/manual-review.json`;
if(!existsSync(reviewPath))save('manual-review.json',{revision,items:[
  'All component/socket/adapter envelopes measured and checked against placement',
  'Both converter bodies allocated with access to adjustment and terminals',
  'Contact-frame stiffness and pogo compression verified',
  'USB connector, all harness plugs and cable exits accessible',
  'Sockets extractable and every solder endpoint reachable at its checkpoint',
  'Insulated crossings and bare column straps inspected without ambiguous joints',
  'Tray removable without desoldering and without transmitting insertion forces',
  'External smart PCB envelopes and mounting allocated',
].map(description=>({description,status:'pending',evidence:null})),note:'Set pass/fail only after physical review; retain evidence.'});
const manual=JSON.parse(readFileSync(reviewPath));
const native=JSON.parse(readFileSync(`${out}/checks.json`));
const digest=createHash('sha256').update(JSON.stringify({boards,cables,checkpoints,prototype})).digest('hex');
if(digest!==native.sourceDigest)issues.push({code:'stale-native-build',expected:digest,actual:native.sourceDigest});
const partial=[];
for(let phase=0;phase<=36;phase++){
  const graph=new Map(),members=new Map();
  const add=(a,b)=>{const aa=graph.get(a)??new Set(),bb=graph.get(b)??new Set();aa.add(b);bb.add(a);graph.set(a,aa);graph.set(b,bb);};
  for(const b of boards){
    for(const n of b.nets)for(const ep of n.pins)if(pinAt(b,ep).part.phase<=phase){const list=members.get(n.name)??[];list.push(`${b.id}/${ep}`);members.set(n.name,list);}
    for(const w of b.wires.filter(w=>w.phase<=phase))add(`${b.id}/${w.from}`,`${b.id}/${w.to}`);
  }
  for(const h of cables.filter(h=>h.phase<=phase))add(`${h.from}/${h.fromPin}`,`${h.to}/${h.toPin}`);
  let count=0;
  for(const [name,list] of members){
    // At CP01–05 the precision inputs deliberately test a separate fixture,
    // rather than their final NODE00/01 harness. This is an explicit contract.
    const isolated=phase>=1&&phase<=5&&['NODE00','NODE01'].includes(name);
    const partitions=isolated?[list.filter(ep=>ep.startsWith('measurement-a-precision/')),list.filter(ep=>!ep.startsWith('measurement-a-precision/'))]:[list];
    for(const group of partitions.filter(p=>p.length>1)){
      count++;const reached=new Set([group[0]]),queue=[group[0]];
      while(queue.length){const current=queue.pop();for(const ep of graph.get(current)??[])if(!reached.has(ep)){reached.add(ep);queue.push(ep);}}
      if(group.some(ep=>!reached.has(ep)))issues.push({code:'global-partial-net-disconnected',phase,net:name,missing:group.filter(ep=>!reached.has(ep))});
    }
  }
  partial.push({checkpoint:`CP${String(phase).padStart(2,'0')}`,netGroupsChecked:count,
    temporaryDiagnosticPartition:phase>=1&&phase<=5,scope:'Permanent wiring/harness connectivity; temporary supplies/probes and powered behavior require their explicit transition/bench records.'});
}
save('partial-state-checks.json',{revision,checks:partial,issues:issues.filter(i=>i.code==='global-partial-net-disconnected')});
const permanent=boards.filter(b=>permanentIds.includes(b.id));
const maxWireAttachments=native.metrics.permanent.maxLocalWireAttachments;
const countCrossings=b=>{
  // Count crossings of wire segments for a congestion review, not copper DRC.
  const segments=b.wires.flatMap(w=>w.path.slice(1).map((c,i)=>({a:w.path[i],c,net:w.net})));
  let crossings=0;
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
    const a=segments[i],b=segments[j];if(a.net===b.net)continue;
    if(cross(a.a,a.c,b.a)*cross(a.a,a.c,b.c)<0&&cross(b.a,b.c,a.a)*cross(b.a,b.c,a.c)<0)crossings++;
  }return crossings;
};
const wiring=permanent.map(b=>({board:b.id,wires:b.wires.length,
  crossings:countCrossings(b),
  lengthMm:b.wires.reduce((s,w)=>s+w.path.slice(1).reduce((v,c,i)=>v+Math.hypot(c[0]-w.path[i][0],c[1]-w.path[i][1])*2.54,0),0),
  sensitiveMaxLengthMm:Math.max(0,...b.wires.filter(w=>/DIV|BUF|SENSE|REF|GATE_DRIVE|WATCH_(CX|RX)/.test(w.net)).map(w=>w.path.slice(1).reduce((v,c,i)=>v+Math.hypot(c[0]-w.path[i][0],c[1]-w.path[i][1])*2.54,0))),
  status:'pending physical access and noise/stability review; crossings require insulated wires'}));
save('wire-congestion.csv',csv([['board','wire segments','proper segment crossings','prescribed length mm','max sensitive path mm'],...wiring.map(w=>[w.board,w.wires,w.crossings,w.lengthMm.toFixed(1),w.sensitiveMaxLengthMm.toFixed(1)])]));
save('component-envelope-review.csv',csv([['assembly','reference','role','width mm','depth mm','height mm','socket extraction clearance mm','verified'],...permanent.flatMap(b=>b.parts.filter(p=>p.body!=='terminal').map(p=>[b.id,p.ref,p.label,'','','','','pending']))]));
save('prototype.json',prototype);
save('prototype-parts.csv',csv([['source board','source ref','role','phase','adapter or module'],...prototype.parts.map(p=>[p.sourceBoard,p.sourceRef,p.label,p.phase,p.adapter??p.externalPart??''])]));
const transitions=[
  [0,'USB bounded source only','Student source 560Ω ±1%; no final rail or matrix'],
  [1,'Fixed diagnostic leads','Student positive OFF; stimulus and return only during continuity'],
  [6,'Permanent first-position sense/service','Remove direct diagnostic/ADC/OLED test leads before buffered service'],
  [9,'Adjust external converters','Both consumer links remain open'],
  [11,'Qualified final rails','Remove USB-to-system prototype supply before final links'],
  [13,'Hardware watchdog only','Remove factory ALIVE link permanently'],
  [15,'ESP2 smart ownership','Remove ESP1 temporary bus/control/supply leads'],
  [24,'Matrix routing','Remove fixed battery positive/return patches; tools and energized circuits mutually exclusive'],
  [27,'Second A position','Tie unused future buffer inputs to GND with removable links'],
  [28,'Third A position','Remove unused-input ties with power OFF before installing dividers'],
  [30,'Second B position','Tie unused future buffer inputs to GND with removable links'],
  [31,'Third B position','Remove unused-input ties with power OFF before installing dividers'],
];
save('transitions.csv',csv([['checkpoint','transition','condition'],...transitions.map(([n,...rest])=>[`CP${String(n).padStart(2,'0')}`,...rest])]));
save('acceptance-template.json',{revision,records:checkpoints.map(c=>({checkpoint:c.id,status:'pending',hardwareSerial:null,firmwareRevision:null,equipment:[],links:[],measurements:[],waveformFiles:[],timestamp:null,tests:c.tests.map(t=>({...t,status:'pending'}))}))});
save('construction-steps.json',{revision,steps:checkpoints.flatMap(c=>[
  ...c.install.flatMap(installation=>{
    const b=boards.find(b=>b.id===installation.board),p=b.parts.find(p=>p.ref===installation.ref);
    return [{id:`${c.id}/${b.id}/${p.ref}/place`,checkpoint:c.id,action:p.body==='pogo'&&p.pins.length===6?'place-node-column':'place-component',board:b.id,ref:p.ref,description:p.label,pins:p.pins},
      {id:`${c.id}/${b.id}/${p.ref}/inspect`,checkpoint:c.id,action:'inspect-placement',board:b.id,ref:p.ref,description:'Check coordinates, polarity, orientation and body clearance separately before wiring.'}];
  }),
  ...c.wires.map(w=>({id:`${c.id}/${w.board}/${w.uid}`,checkpoint:c.id,action:'install-one-wire',...w})),
  ...c.harnesses.map(h=>({id:`${c.id}/${h.id}`,checkpoint:c.id,action:'connect-one-harness',...h})),
  {id:`${c.id}/firmware`,checkpoint:c.id,action:'load-diagnostic-firmware',contract:c.firmware},
  {id:`${c.id}/accept`,checkpoint:c.id,action:'record-measurements',tests:c.tests,win:c.win,requiresMeasuredEvidence:true},
])});
// True-size templates deliberately separate from illustrative assembly SVGs.
// No CAD primitive is treated as a measured component body.
mkdirSync(`${out}/assets`,{recursive:true});
function scaleTemplate(b,bottom){
  const marginX=(b.width-(b.cols-1)*2.54)/2,marginY=(b.height-(b.rows-1)*2.54)/2;
  const pos=([x,y])=>[marginX+((bottom?b.cols+1-x:x)-1)*2.54,marginY+(y-1)*2.54];
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${b.width}mm" height="${b.height}mm" viewBox="0 0 ${b.width} ${b.height}"><rect x=".1" y=".1" width="${b.width-.2}" height="${b.height-.2}" fill="white" stroke="#243746" stroke-width=".2"/>`;
  for(let y=1;y<=b.rows;y++)for(let x=1;x<=b.cols;x++){const [px,py]=pos([x,y]);s+=`<circle cx="${px}" cy="${py}" r=".3" fill="#c8d0c1"/>`;}
  for(const mount of b.mounts){const [x,y]=pos(mount);s+=`<circle cx="${x}" cy="${y}" r="1.6" fill="white" stroke="#537c68" stroke-width=".15"/>`;}
  b.parts.forEach((p,i)=>{
    for(const pin of p.pins){const [x,y]=pos(pin.hole);s+=`<circle cx="${x}" cy="${y}" r=".55" fill="${pin.number===1?'#bd3842':'#243746'}"/>`;}
    if(p.body!=='pogo'&&p.body!=='terminal'){
      const x=(bottom?b.cols+1-p.bounds.xmax:p.bounds.xmin)-1;
      s+=`<rect x="${marginX+x*2.54}" y="${marginY+(p.bounds.ymin-1)*2.54}" width="${(p.bounds.xmax-p.bounds.xmin)*2.54}" height="${(p.bounds.ymax-p.bounds.ymin)*2.54}" fill="none" stroke="#8796a5" stroke-width=".15"/>`;
    }
    const [x,y]=pos(p.pins[0].hole);s+=`<text x="${x+.8}" y="${y-1}" font-family="DejaVu Sans" font-size="1.8" fill="#243746">${i+1}</text>`;
  });return s+'</svg>';
}
for(const b of [...permanent,...(prototype.earlyPlacement?[prototype.earlyPlacement]:[])])for(const bottom of [false,true])save(`assets/${b.id}-scale-${bottom?'underside':'top'}.svg`,scaleTemplate(b,bottom));
const manualFail=manual.items.some(i=>i.status==='fail');
const manualPass=manual.items.every(i=>i.status==='pass'&&i.evidence);
const positions=measurements.boardPlacement??[];
const planarKnown=Number.isFinite(measurements.enclosure.usableWidthMm)&&Number.isFinite(measurements.enclosure.usableDepthMm)&&positions.length===4&&positions.every(p=>Number.isFinite(p.xMm)&&Number.isFinite(p.yMm)&&[0,90,180,270].includes(p.rotationDeg)&&permanentIds.includes(p.board));
let planarStatus='pending';
if(planarKnown){
  const boxes=positions.map(p=>({...p,w:p.rotationDeg%180?100:200,h:p.rotationDeg%180?200:100}));
  const outside=boxes.some(p=>p.xMm<0||p.yMm<0||p.xMm+p.w>measurements.enclosure.usableWidthMm||p.yMm+p.h>measurements.enclosure.usableDepthMm);
  const overlap=boxes.some((p,i)=>boxes.slice(i+1).some(q=>q.layer===p.layer&&p.xMm<q.xMm+q.w&&p.xMm+p.w>q.xMm&&p.yMm<q.yMm+q.h&&p.yMm+p.h>q.yMm));
  const duplicates=new Set(positions.map(p=>p.board)).size!==4;
  planarStatus=outside||overlap||duplicates?'fail':'pass';
}
const mechanical=heightStatus==='fail'||stockStatus==='fail'||planarStatus==='fail'||manualFail?'fail':heightStatus==='pass'&&stockStatus==='pass'&&planarStatus==='pass'&&manualPass&&measurements.verified&&measurements.enclosure.trayExtractionDemonstrated&&measurements.externalModules.every(m=>m.allocated&&[m.widthMm,m.depthMm,m.heightMm].every(Number.isFinite))?'pass':'pending';
const softwareStatus=issues.length||native.softwareStatus!=='pass'?'fail':'pass';
const decision=softwareStatus==='fail'||mechanical==='fail'?'fail':'pending';
const result={revision,decision,softwareStatus,mechanicalStatus:mechanical,electricalStatus:'pending',manufacturingStatus:'pending',
  netPreservation:{comparedPins,issues,functionalPartsCompared:oldParts.length},
  height:{status:heightStatus,requiredHeightMm,availableHeightMm:actualHeight},stockStatus,
  planarStatus,
  metrics:native.metrics,wiring,maxWireAttachments,
  permanentBoardCount:permanent.length,smartReferenceLayoutCount:boards.length-permanent.length,
  prototype:{status:prototype.status,finding:prototype.fitFinding,earlyStatus:prototype.earlyStatus,earlyFinding:prototype.earlyFinding},
  evaluation,reason:decision==='pending'?'Software consistency passes; measured fit, build access, bench qualification and smart PCB fabrication remain open.': 'Review failed findings before construction.',
  buildRelease:false};
save('assessment.json',result);
console.log(JSON.stringify({decision,softwareStatus,mechanical,comparedPins,issues,prototype:result.prototype},null,2));
if(softwareStatus==='fail')process.exitCode=1;
