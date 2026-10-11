// Proposal artifacts only. Never writes production circuits, catalogs or SQLite.
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {boards,instances} from '../design/boards.mjs';
import {cables} from '../design/cables.mjs';
import {checkpoints} from '../design/checkpoints.mjs';
import {netDescription,partDescription} from '../design/descriptions.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'construction-audit');mkdirSync(out,{recursive:true});
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const sum=(xs,f)=>xs.reduce((n,x)=>n+f(x),0);
const stock={id:'kit-7x10',width:70,height:100,pitch:2.54,cols:26,rows:38,
 status:'UNVERIFIED: illustrative 26×38 grid with approximately 3 mm edge margins; not a seller-confirmed pattern',
 source:'User-selected Kit 10un Pcb Placa Fibra Perfurada 7x10 Cm Dupla Face Full',
 padTopology:'Isolated pads required; through-plating and edge-terminal connectivity unverified'};
const manifestFiles=['design/boards.mjs','design/model.mjs','design/stages.mjs','design/cables.mjs','design/checkpoints.mjs'];
const hashes=Object.fromEntries(manifestFiles.map(f=>[f,createHash('sha256').update(readFileSync(resolve(root,f))).digest('hex')]));
const metrics=boards.map(b=>{
 const q=instances.find(i=>i.board===b.id).quantity;
 const wireEnds={};b.wires.forEach(w=>[w.from,w.to].forEach(e=>wireEnds[e]=(wireEnds[e]??0)+1));
 return {id:b.id,quantity:q,temporary:b.kind==='breadboard',outlineMm:[b.width,b.height],parts:b.parts.length,
  installedPins:sum(b.parts,p=>p.pins.length),adapterParts:b.parts.filter(p=>p.adapter).length,
  connectorPins:sum(b.parts.filter(p=>p.kind==='header'||p.body==='idc'),p=>p.pins.length),
  wireSegments:b.wires.filter(w=>!w.breadboardTie).length,wireEndpoints:2*b.wires.filter(w=>!w.breadboardTie).length,
  bareSegments:b.wires.filter(w=>!w.insulated&&!w.breadboardTie).length,
  estimatedSolderOperations:b.kind==='breadboard'?0:sum(b.parts,p=>p.pins.length)+2*b.wires.length,
  maxWireAttachmentsAtPin:Math.max(0,...Object.values(wireEnds)),
  wireLengthMm:sum(b.wires.filter(w=>!w.breadboardTie),w=>w.path.slice(1).reduce((n,p,k)=>n+Math.hypot(p[0]-w.path[k][0],p[1]-w.path[k][1])*2.54,0)),
  sections:b.sections.map(s=>({name:s.name,parts:b.parts.filter(p=>p.section===s.name).length})),
  originalOutlineFitsStock:(b.width<=70&&b.height<=100)||(b.width<=100&&b.height<=70)};
});
const permanent=metrics.filter(m=>!m.temporary);
const totals=Object.fromEntries(['quantity','parts','installedPins','adapterParts','connectorPins','wireSegments','wireEndpoints','bareSegments','estimatedSolderOperations'].map(k=>[k,sum(permanent,m=>k==='quantity'?m.quantity:m[k]*m.quantity)]));
totals.cables=cables.length;totals.cableConductors=sum(cables,c=>c.pins.length);
const proposed=[];
let destination=proposed;
// Geometric placement study, NOT a wire router or released physical layout.
// Preserve each part's pin spacing and use the existing provisional body bounds.
function packageParts(id,source,parts,seed=[]) {
 const pages=structuredClone(seed);let page=pages.at(-1);
 const newPage=()=>{page={id:`${id}-${pages.length+1}`,source,stock,parts:[],reservations:[]};pages.push(page);};
 if(!page)newPage();
 for(const original of parts){
  const minX=Math.min(...original.pins.map(p=>p.hole[0])),minY=Math.min(...original.pins.map(p=>p.hole[1]));
  const offsets=original.pins.map(p=>({...p,hole:[p.hole[0]-minX,p.hole[1]-minY]}));
  const body=original.bounds;
  const ext={l:minX-body.xmin,r:body.xmax-minX,t:minY-body.ymin,b:body.ymax-minY};
  let found;
  const find=()=>{for(let y=2;y<=stock.rows-1;y++)for(let x=2;x<=stock.cols-1;x++){
   const rect={xmin:x-ext.l,xmax:x+ext.r,ymin:y-ext.t,ymax:y+ext.b};
   if(rect.xmin<1.5||rect.ymin<1.5||rect.xmax>stock.cols-.5||rect.ymax>stock.rows-.5)continue;
   if(page.reservations.some(o=>rect.xmin<o.xmax+1&&rect.xmax>o.xmin-1&&rect.ymin<o.ymax+1&&rect.ymax>o.ymin-1))continue;
   return {x,y,rect};
  }};
  found=find();if(!found){newPage();found=find();}
  if(!found)throw Error(`${source}.${original.ref} cannot fit the assumed 7×10 template`);
  page.reservations.push(found.rect);page.parts.push({...original,sourceRef:`${source}.${original.ref}`,bounds:found.rect,pins:offsets.map(p=>({...p,hole:[p.hole[0]+found.x,p.hole[1]+found.y]}))});
 }
 destination.push(...pages);return pages;
}
const matrix=boards.find(b=>b.id==='matrix'),fixture=boards.find(b=>b.id==='continuity-fixture'),smart=boards.find(b=>b.id==='smart-channel');
packageParts('esp1-carrier','matrix',matrix.parts.filter(p=>p.phase===0));
packageParts('continuity','continuity-fixture',fixture.parts);
packageParts('voltage','smart-channel',smart.parts.filter(p=>p.phase<=8));
// Preserve all educational AND service-contact coordinates; move underside headers only.
const a1=boards.find(b=>b.id==='a1');
const contactParts=a1.parts.map(p=>{const dx=p.ref==='J_NODE'?1:p.ref==='J_SMART'?-2:0;return {...p,sourceRef:`a1.${p.ref}`,bounds:{xmin:p.bounds.xmin+dx,xmax:p.bounds.xmax+dx,ymin:p.bounds.ymin,ymax:p.bounds.ymax},pins:p.pins.map(pin=>({...pin,hole:[pin.hole[0]+dx,pin.hole[1]]}))};});
proposed.unshift({id:'contacts-a1',source:'a1',stock,parts:contactParts,reservations:contactParts.map(p=>p.bounds),mounts:[[2,6],[25,6]],note:'Educational and service contacts preserve relative coordinates. J_NODE shifts one column right; J_SMART shifts two columns left. Right mounting hole shifts left. Actual pad size, connector body and mounting clearance remain pending.'});
for(const b of proposed)for(const p of b.parts)p.description=partDescription(boards.find(source=>source.id===b.source),p);
// Future capacity studies preserve the earlier permanent placements. These are
// geometric comparisons, not approved partitions of sensitive analog circuits.
const future=[];destination=future;
packageParts('esp1-carrier','matrix',matrix.parts.filter(p=>p.phase>0).sort((a,b)=>a.phase-b.phase),proposed.filter(b=>b.source==='matrix'));
packageParts('voltage','smart-channel',smart.parts.filter(p=>p.phase>8).sort((a,b)=>a.phase-b.phase),proposed.filter(b=>b.source==='smart-channel'));
for(const id of ['power','smart-controller','integration']){const b=boards.find(b=>b.id===id);packageParts(id,id,[...b.parts].sort((a,b)=>a.phase-b.phase));}
const futureLocations=new Map(future.flatMap(b=>b.parts.flatMap(p=>p.pins.map(pin=>[`${p.sourceRef}.${pin.number}`,b.id]))));
const futureCapacity=['matrix','smart-channel','power','smart-controller','integration'].map(id=>{
 const b=boards.find(b=>b.id===id),pages=future.filter(b=>b.source===id);
 const crossBoard=b.wires.filter(w=>futureLocations.get(`${id}.${w.from}`)!==futureLocations.get(`${id}.${w.to}`));
 return {source:id,stockBoardsPerInstance:pages.length,instances:id==='smart-channel'?6:1,crossBoardSegmentsPerInstance:crossBoard.length,
  sensitiveCrossings:crossBoard.filter(w=>/DIV|BUF|ADC|SENSE|REF|GATE|SHUNT/.test(w.net)).map(w=>w.uid),
  status:'CAPACITY_STUDY_ONLY: section boundaries and analog feedback must be redesigned before using this partition'};
});
writeFileSync(resolve(out,'future-capacity.json'),JSON.stringify({stock,boards:future,allocation:futureCapacity,stockBoards:7+sum(futureCapacity,p=>p.stockBoardsPerInstance*p.instances),note:'Six reference contact boards + continuity fixture + capacity study. No new cable interfaces or wiring routes are released.'},null,2)+'\n');
const location=new Map(proposed.flatMap(b=>b.parts.flatMap(p=>p.pins.map(pin=>[`${p.sourceRef}.${pin.number}`,{board:b.id,ref:p.ref,pin:pin.number,role:pin.label,hole:pin.hole}]))));
const endpoints=[];
for(const source of [a1,matrix,fixture,smart])for(const w of source.wires){
 const from=location.get(`${source.id}.${w.from}`),to=location.get(`${source.id}.${w.to}`);
 if(from&&to)endpoints.push({id:`${source.id}:${w.uid}`,source:source.id,net:w.net,phase:w.phase,from,to,color:w.color,
  bare:!w.insulated,description:w.insulated?`Connect ${from.ref} ${from.role} to ${to.ref} ${to.role}. ${netDescription(w.net)}`:'Bare underside strap joins adjacent contacts of the same educational node; never bridge columns.',crossBoard:from.board!==to.board});
}
const native={};for(const id of ['a1','matrix','continuity-fixture','smart-channel','usb-prototype']){
 const f=resolve(root,`dist/boards/${id}/local.json`);if(existsSync(f))native[id]=JSON.parse(readFileSync(f,'utf8'));
}
const data={schemaVersion:1,status:'PROPOSAL_ONLY_NOT_RELEASED',sourceHashes:hashes,stock,metrics,totals,futureCapacity,boards:proposed,wires:endpoints,checkpoints:checkpoints.slice(0,9),native,
 serviceSupport:{status:'REFERENCE_FIT_ONLY',reason:'Service and educational contacts retain their relative placement and fit the assumed 26×38 grid. Purchased pogo height, contact reach and mounting require measurement.'},
 checks:{stockGeometry:'pending actual board',pogoGeometry:'pending measured purchased pins',pinOffsets:'preserved by translation',circuitChanges:'none; studies preserve source pin identities',nativeChecks:'not rerun: no circuit source changes',wireRoutes:'endpoint studies only; not prescribed soldering paths',physicalAcceptance:'pending',cutting:'none specified; all proposed supports use intact 7×10 stock'}};
// Audit consistency checks: identities, translation, bounds and endpoint membership.
// These do not verify module envelopes, electrical performance or soldering paths.
const checks=[];
const check=(name,ok,detail)=>{checks.push({name,status:ok?'pass':'fail',detail});};
for(const b of proposed){
 const source=boards.find(s=>s.id===b.source),holes=new Set();
 for(const p of b.parts){
  const original=source.parts.find(o=>o.ref===p.ref),dx=p.pins[0].hole[0]-original.pins[0].hole[0],dy=p.pins[0].hole[1]-original.pins[0].hole[1];
  check(`${b.id}.${p.ref}: translated source pins`,p.pins.every((pin,i)=>pin.number===original.pins[i].number&&pin.label===original.pins[i].label&&pin.hole[0]-original.pins[i].hole[0]===dx&&pin.hole[1]-original.pins[i].hole[1]===dy),'Manufacturer numbering and relative lead coordinates preserved.');
  check(`${b.id}.${p.ref}: reference body bounds`,p.bounds.xmin>=.5&&p.bounds.xmax<=stock.cols+.5&&p.bounds.ymin>=.5&&p.bounds.ymax<=stock.rows+.5,'Uses original provisional envelope; not purchased-part verification.');
  for(const pin of p.pins){const key=pin.hole.join(',');check(`${b.id}.${p.ref}.${pin.number}: unique stock hole`,!holes.has(key)&&pin.hole[0]>=1&&pin.hole[0]<=stock.cols&&pin.hole[1]>=1&&pin.hole[1]<=stock.rows,'Assumed grid only.');holes.add(key);}
 }
 for(let i=0;i<b.parts.length;i++)for(let j=i+1;j<b.parts.length;j++){const a=b.parts[i].bounds,c=b.parts[j].bounds;check(`${b.id}: ${b.parts[i].ref}/${b.parts[j].ref} envelopes`,!(a.xmin<c.xmax&&a.xmax>c.xmin&&a.ymin<c.ymax&&a.ymax>c.ymin),'No overlapping source-reference envelopes.');}
}
for(const w of endpoints){const source=boards.find(b=>b.id===w.source),net=source.nets.find(n=>n.name===w.net);check(`${w.id}: source net membership`,net?.pins.includes(`${w.from.ref}.${w.from.pin}`)&&net?.pins.includes(`${w.to.ref}.${w.to.pin}`),'Both endpoints belong to the same original electrical net.');}
for(const b of proposed.filter(b=>b.source!=='a1'&&b.source!=='continuity-fixture'))for(const p of b.parts){const later=future.flatMap(b=>b.parts).find(q=>q.sourceRef===p.sourceRef);check(`${p.sourceRef}: future placement preserved`,JSON.stringify(later?.pins)===JSON.stringify(p.pins),'Capacity study never relocates earlier permanent pins.');}
const connectorMpns=[...new Set(boards.flatMap(b=>b.parts).filter(p=>p.kind==='header'||p.body==='idc'||p.body==='pogo').map(p=>p.mpn).filter(Boolean))];
for(const [id,sections] of Object.entries(native))for(const [section,svg] of Object.entries(sections)){const texts=typeof svg==='string'?[...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(m=>m[1].replace(/<[^>]+>/g,'')):[];check(`${id}/${section}: hidden connector MPN`,!texts.some(t=>connectorMpns.some(mpn=>t.includes(mpn))),'Existing native schematic text only.');}
writeFileSync(resolve(out,'consistency-checks.json'),JSON.stringify({status:checks.every(c=>c.status==='pass')?'pass':'fail',scope:'Proposal geometry and source identity only; no electrical or physical acceptance',checks},null,2)+'\n');
if(checks.some(c=>c.status==='fail'))throw Error(JSON.stringify(checks.filter(c=>c.status==='fail')));
// Standalone drawings provide printable placement studies without app state.
for(const b of proposed)for(const underside of [false,true]){
 const point=([col,row])=>{const x=(stock.width-(stock.cols-1)*stock.pitch)/2+(col-1)*stock.pitch;return [underside?stock.width-x:x,(stock.height-(stock.rows-1)*stock.pitch)/2+(row-1)*stock.pitch];};
 let art=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -12 150 124" width="900" height="744"><rect x="-8" y="-12" width="150" height="124" fill="white"/><text x="0" y="-7" font-size="3">${esc(b.id)} · ${underside?'MIRRORED UNDERSIDE':'TOP'} · 7×10 cm</text><text x="0" y="-2" font-size="2.2">PROPOSAL — reference grid only; wire routes pending</text><rect width="70" height="100" fill="#dcebe2" stroke="#48705d" stroke-width=".3"/>`;
 for(let row=1;row<=stock.rows;row++)for(let col=1;col<=stock.cols;col++){const [x,y]=point([col,row]);art+=`<circle cx="${x}" cy="${y}" r=".45" fill="white" stroke="#819986" stroke-width=".15"/>`;}
 b.parts.forEach((p,i)=>{const [x,y]=point([p.bounds.xmin,p.bounds.ymin]),[z,q]=point([p.bounds.xmax,p.bounds.ymax]);art+=`<rect x="${Math.min(x,z)}" y="${y}" width="${Math.abs(z-x)}" height="${q-y}" fill="#d3e3f7" fill-opacity=".75" stroke="#64809a" stroke-width=".3"/><text x="${(x+z)/2}" y="${y-.25}" text-anchor="middle" font-size="1.8">${i+1}</text><text x="75" y="${5+i*3.5}" font-size="2.2">${i+1}. ${esc(p.ref)} · CP${String(p.phase).padStart(2,'0')}</text>`;p.pins.forEach((pin,k)=>{const [x,y]=point(pin.hole);art+=`<circle cx="${x}" cy="${y}" r=".65" fill="${k===0?'#b63225':'#24597c'}"/>`;});});
 for(let col=1;col<=stock.cols;col++)if(col===1||col===stock.cols||(col%5===0&&stock.cols-col>1)){const [x]=point([col,1]);art+=`<text x="${x}" y="104" text-anchor="middle" font-size="2">${col}</text>`;}
 for(let row=1;row<=stock.rows;row++)if(row===1||row===stock.rows||row%5===0){const [,y]=point([1,row]);art+=`<text x="-2" y="${y+.7}" text-anchor="end" font-size="2">${row}</text>`;}
 art+='<text x="0" y="109" font-size="2.2">Coordinates retain TOP numbering. Red pad = manufacturer pin 1.</text></svg>';
 writeFileSync(resolve(out,`${b.id}-${underside?'underside':'top'}.svg`),art);
}
writeFileSync(resolve(out,'baseline.json'),JSON.stringify({sourceHashes:hashes,metrics,totals},null,2)+'\n');
writeFileSync(resolve(out,'proposal.json'),JSON.stringify(data,null,2)+'\n');
const rows=metrics.map(m=>`| ${m.id} | ${m.quantity} | ${m.outlineMm.join('×')} | ${m.parts} | ${m.installedPins} | ${m.adapterParts} | ${m.wireSegments} | ${m.estimatedSolderOperations} | ${m.maxWireAttachmentsAtPin} |`).join('\n');
writeFileSync(resolve(out,'baseline.md'),`# Construction baseline\n\nDerived from current circuit descriptors. Permanent quantities include six smart-channel copies. No physical work has been verified.\n\n| Design | Quantity | Outline mm | Parts each | Pins each | Adapters each | Wires each | Solder operations estimate each | Max wire attachments at one pin |\n|---|---:|---|---:|---:|---:|---:|---:|---:|\n${rows}\n\n## Permanent totals\n\n${Object.entries(totals).map(([k,v])=>`- ${k}: ${v}`).join('\n')}\n\nSolder-operation estimate = installed part pins + two ends per prescribed wire segment. Several ends may share a joint; this is work accounting, not an exact count of unique solder joints. Excludes adapter soldering, socket pins, external modules, cable termination and strain relief; cable conductors include reserved NC conductors. Breadboard ties are excluded from wire-segment counts. No time estimate is inferred from these counts.\n\nMost original permanent outlines exceed the selected 70×100 mm stock; the original A3/B3 outlines fit nominally. Component fit still needs review. Merely repacking does not prove a reduction in construction work.\n`);
writeFileSync(resolve(out,'endpoints.csv'),'id,net,phase,from_board,from_part,from_pin,from_role,from_col,from_row,to_board,to_part,to_pin,to_role,to_col,to_row,cross_board\n'+endpoints.map(w=>[w.id,w.net,w.phase,w.from.board,w.from.ref,w.from.pin,w.from.role,...w.from.hole,w.to.board,w.to.ref,w.to.pin,w.to.role,...w.to.hole,w.crossBoard].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n')+'\n');
const template=readFileSync(resolve(root,'scripts/construction-review.html'),'utf8');
writeFileSync(resolve(out,'index.html'),template.replace('/*PROPOSAL_DATA*/',JSON.stringify(data).replaceAll('<','\\u003c')));
console.log(JSON.stringify({output:out,permanent:totals,earlyStudyBoards:proposed.map(b=>({id:b.id,parts:b.parts.length})),crossBoardSegments:endpoints.filter(w=>w.crossBoard).length,status:data.status},null,2));
