// Revision 7 model. Re-exports the shared primitives unchanged and replaces finish().
// Do not edit design/model.mjs: revision 5 and 6 share it and their source digests must not change.
//
// Differences from revision 6 (wire tree only; part list, nets and install phases are identical):
//  1. Every net is chained in board order (nearest already-installed pin), not in phase/alphabet order.
//  2. Boards with `b.buses` replace the point-to-point wires of the big supply rails by bare bus bars:
//     one bare wire laid along a free row of the underside, each pin joined to its nearest bar by one
//     short insulated stub. Any insulated wire that crosses a bar is flagged `sleeves`.
//  3. The phase rule is unchanged: a wire only ever joins pins that are already installed.
import {PITCH,COLORS,colorFor,pinAt,finish as finishR6} from './model.mjs';
export * from './model.mjs';
export {finish7 as finish};

// Max wires soldered to one pin (revision 6 never exceeded 2). A bar counts as one wire at its pads.
export const MAX_ATTACH=Number(process.env.R7_MAX_ATTACH??2);
// Rails that may use bus bars. Default: ground only. A sweep (power/router crossings 436/1347 with plain
// spatial chains; 450/1385 with 4 GND bars; 537/1399 with every rail) showed bars do not cut crossings
// or length in this placement. Ground bars are kept for debugging: each pin has its own stub, so one
// cold joint cannot open ground downstream. Student rail, buck outputs and the Pi supply never use bars.
export const BUS_NETS=(process.env.R7_BUS_NETS??'GND').split(',').filter(Boolean);
export const BUS_MIN_TAPS=6;          // fewer pins than this: plain chain
export const BUS_MIN_GAIN=Number(process.env.R7_BUS_GAIN??10);         // an extra bar must save at least this many holes of stub
export const BUS_MAX_BARS={GND:Number(process.env.R7_BUS_GND??4),default:Number(process.env.R7_BUS_OTHER??3)};
export const BUS_MIN_RUN=5;           // shortest free row segment worth a bar (holes)
export const BUS_STUBS_PER_PAD=2;     // stubs soldered to one bar pad; a tie may add one more
const SENSITIVE=/DIV|BUF|ADC|SENSE|REF|GATE|SHUNT/;

const manhattan=(a,c)=>Math.abs(a[0]-c[0])+Math.abs(a[1]-c[1]);

// ---------- spatial chain ----------
// Order a net's pins so that each pin's wire goes to the nearest pin installed at the same or an
// earlier phase. Returns [{to, from}] in install order.
export function spatialTree(b,n,staged,cap=MAX_ATTACH,pins=n.pins){
  const hole=ep=>pinAt(b,ep).pin.hole;
  const byPhase=[...pins].sort((a,c)=>staged(a)-staged(c)||a.localeCompare(c,undefined,{numeric:true}));
  const placed=[byPhase[0]],edges=[],deg=new Map([[byPhase[0],0]]);
  const phases=[...new Set(byPhase.map(staged))].sort((a,c)=>a-c);
  for(const ph of phases){
    let group=byPhase.slice(1).filter(ep=>staged(ep)===ph);
    while(group.length){
      let best=null;
      for(const ep of group)for(const q of placed){
        if((deg.get(q)??0)>=cap)continue;
        const d=manhattan(hole(ep),hole(q));
        if(!best||d<best.d||(d===best.d&&(ep+q).localeCompare(best.ep+best.q,undefined,{numeric:true})<0))best={ep,q,d};
      }
      if(!best)throw Error(`${b.id}: ${n.name} cannot attach ${group[0]} within ${cap} wires per pin`);
      edges.push({to:best.ep,from:best.q});placed.push(best.ep);
      deg.set(best.q,(deg.get(best.q)??0)+1);deg.set(best.ep,1);group=group.filter(ep=>ep!==best.ep);
    }
  }
  return edges;
}

// ---------- bus bars ----------
const mountNear=(b,x,y)=>b.mounts.some(([mx,my])=>Math.hypot(mx-x,my-y)<1.6);
function occupiedHoles(b){
  const occ=new Set();
  for(const p of b.parts)for(const pin of p.pins)occ.add(pin.hole.join(','));
  return occ;
}
function freeRuns(b,occ){
  const runs=[];
  for(let y=3;y<=b.rows-2;y++){ // rows 1-2 and rows-1..rows belong to the test aids
    let x=1;
    while(x<=b.cols){
      if(occ.has(`${x},${y}`)||mountNear(b,x,y)){x++;continue;}
      const x0=x;while(x<=b.cols&&!occ.has(`${x},${y}`)&&!mountNear(b,x,y))x++;
      if(x-x0>=BUS_MIN_RUN)runs.push({y,x0,x1:x-1});
    }
  }
  return runs;
}
const stubCost=(tap,run)=>{const dx=tap[0]<run.x0?run.x0-tap[0]:tap[0]>run.x1?tap[0]-run.x1:0;return dx+Math.abs(tap[1]-run.y);};

// Choose bars for one rail. Returns [{y,x0,x1,taps:[ep]}] or [] when no bar is worthwhile.
export function planBars(b,netName,taps,occ){
  const hole=ep=>pinAt(b,ep).pin.hole;
  const candidates=freeRuns(b,occ);
  const chosen=[],max=BUS_MAX_BARS[netName]??BUS_MAX_BARS.default;
  const total=set=>taps.reduce((s,ep)=>s+Math.min(...set.map(r=>stubCost(hole(ep),r))),0);
  while(chosen.length<max){
    let best=null;
    for(const c of candidates){
      if(chosen.includes(c))continue;
      const t=total([...chosen,c]);
      if(!best||t<best.t)best={c,t};
    }
    if(!best)break;
    if(chosen.length&&total(chosen)-best.t<BUS_MIN_GAIN)break;
    chosen.push(best.c);
  }
  // Assign each tap to its nearest bar; drop bars that serve fewer than two pins and repeat.
  for(let pass=0;pass<4;pass++){
    for(const r of chosen)r.taps=[];
    for(const ep of taps){const r=chosen.reduce((m,r)=>stubCost(hole(ep),r)<stubCost(hole(ep),m)?r:m);r.taps.push(ep);}
    const keep=chosen.filter(r=>r.taps.length>=2);
    if(keep.length===chosen.length)break;
    chosen.length=0;chosen.push(...keep);
    if(!chosen.length)break;
  }
  return chosen;
}

// Add bar pseudo-parts (virtual: no BOM line, no component) and the wires of the bar rails.
function addBars(b,staged){
  const occ=occupiedHoles(b),bars=[],byNet=new Map();
  for(const name of BUS_NETS){
    const n=b.nets.find(n=>n.name===name);
    if(!n||n.pins.length<BUS_MIN_TAPS)continue;
    const plan=planBars(b,name,[...n.pins],occ);
    if(!plan.length)continue;
    const list=[];
    plan.forEach((r,k)=>{
      // One pad per column used on the bar row. A tap takes the pad nearest its own column; a pad
      // holds at most BUS_STUBS_PER_PAD stubs, so crowded taps spread to the next free hole.
      const load=new Map(),tapX=new Map();
      for(const ep of [...r.taps].sort((a,c)=>pinAt(b,a).pin.hole[0]-pinAt(b,c).pin.hole[0]||a.localeCompare(c,undefined,{numeric:true}))){
        const want=Math.min(r.x1,Math.max(r.x0,pinAt(b,ep).pin.hole[0]));
        let x=null;
        for(let d=0;d<=r.x1-r.x0&&x===null;d++)for(const cand of d?[want-d,want+d]:[want])if(cand>=r.x0&&cand<=r.x1&&(load.get(cand)??0)<BUS_STUBS_PER_PAD){x=cand;break;}
        if(x===null)throw Error(`${b.id}: bar for ${name} has no free pad`);
        load.set(x,(load.get(x)??0)+1);tapX.set(ep,x);
      }
      const xs=[...new Set(tapX.values())].sort((a,c)=>a-c);
      const ref=`BAR_${name}_${k+1}`;
      const phase=Math.min(...r.taps.map(staged));
      const part={ref,label:`Bare bus bar ${name}`,kind:'bar',body:'bar',side:'bottom',section:'Bus',phase,virtual:true,locked:true,
        function:`Bus bar for ${name}`,signals:Object.fromEntries(xs.map((x,i)=>[i+1,name])),
        pins:xs.map((x,i)=>({number:i+1,label:`T${i+1}`,hole:[x,r.y]})),
        bounds:{xmin:xs[0]-.4,xmax:xs.at(-1)+.4,ymin:r.y-.4,ymax:r.y+.4}};
      b.parts.push(part);
      n.pins.push(...part.pins.map(pin=>`${ref}.${pin.number}`));
      // Keep other rails off this bar and one hole away on each side.
      for(let x=xs[0]-1;x<=xs.at(-1)+1;x++)for(const dy of [-1,0,1])occ.add(`${x},${r.y+dy}`);
      list.push({ref,part,run:r,tapX,xs,phase});
    });
    byNet.set(name,list);bars.push(...list);
  }
  if(bars.length&&!b.sections.some(s=>s.name==='Bus'))b.sections.push({name:'Bus',label:'Rail bus bars'});
  return byNet;
}

// ---------- wires ----------
function pathBetween(a,c,{bare=false,name,netIndex,cols}){
  const bend=[a[0],c[1]];let path=[a];
  if(bend[0]!==a[0]||bend[1]!==a[1])path.push(bend);
  if(c[0]!==bend[0]||c[1]!==bend[1])path.push(c);
  if(path.length===1)throw Error(`duplicate hole ${a}`);
  if(!bare&&!SENSITIVE.test(name)){
    const lane=Math.max(1.5,Math.min(cols-.5,Math.round((a[0]+c[0])/2)+(netIndex%3-1)*.5));
    path=[a,[a[0],a[1]-.5],[lane,a[1]-.5],[lane,c[1]+.5],[c[0],c[1]+.5],c].filter((h,i,all)=>!i||h[0]!==all[i-1][0]||h[1]!==all[i-1][1]);
  }
  return path;
}
const stubPath=(a,pad)=>{
  if(a[0]===pad[0])return [a,pad];
  const s=a[1]>=pad[1]?.5:-.5;
  return [a,[a[0],pad[1]+s],[pad[0],pad[1]+s],pad];
};

export function finish7(b){
  // Reuse revision 6's schematic card layout, then replace the wire tree.
  finishR6(b);
  const staged=ep=>pinAt(b,ep).part.phase;
  b.wires=[];
  if(b.buses&&!b._barsDone){b._barsDone=true;b._bars=addBars(b,staged);}
  const bars=b._bars??new Map();
  const add=(n,netIndex,from,to,{bare=false,path,bar=false}={})=>{
    const a=pinAt(b,from).pin.hole,c=pinAt(b,to).pin.hole;
    path??=pathBetween(a,c,{bare,name:n.name,netIndex,cols:b.cols});
    const key=[from,to].sort().join('~');
    b.wires.push({id:`W${b.wires.length+1}`,uid:`wire:${n.name}:${key}`,net:n.name,from,to,path,color:bare?COLORS.bare:colorFor(n.name),side:'bottom',insulated:!bare,bar,phase:Math.max(staged(from),staged(to))});
  };
  for(const [netIndex,n] of b.nets.entries()){
    const barePins=[...n.pins].filter(ep=>pinAt(b,ep).part.body==='pogo');
    const list=bars.get(n.name);
    if(list?.length){
      // Bar rail: bare chain between the pads of each bar, one stub per pin, ties between bars.
      const padOf=new Map(),loadOf=new Map();
      for(const bar of list){
        bar.part.pins.forEach(pin=>padOf.set(`${bar.ref}:${pin.hole[0]}`,`${bar.ref}.${pin.number}`));
        for(let i=1;i<bar.part.pins.length;i++)add(n,netIndex,`${bar.ref}.${bar.part.pins[i-1].number}`,`${bar.ref}.${bar.part.pins[i].number}`,{bare:true,bar:true});
      }
      for(const bar of list)for(const ep of bar.run.taps){
        const pad=padOf.get(`${bar.ref}:${bar.tapX.get(ep)}`),a=pinAt(b,ep).pin.hole,c=pinAt(b,pad).pin.hole;
        add(n,netIndex,ep,pad,{path:stubPath(a,c)});loadOf.set(pad,(loadOf.get(pad)??0)+1);
      }
      // Join the bars of one rail with the shortest ties (Prim over bars, nearest pads).
      // Ties follow install order: a bar joins the nearest bar installed at the same or an earlier phase,
      // and prefers pads that still have room.
      const order=[...list].sort((a,c)=>a.phase-c.phase||a.ref.localeCompare(c.ref,undefined,{numeric:true}));
      const joined=[order[0]],rest=order.slice(1);
      while(rest.length){
        const ph=Math.min(...rest.map(r=>r.phase));
        let best=null;
        for(const r of rest.filter(r=>r.phase===ph))for(const j of joined)for(const p of r.part.pins)for(const q of j.part.pins){
          const lp=loadOf.get(`${r.ref}.${p.number}`)??0,lq=loadOf.get(`${j.ref}.${q.number}`)??0;
          const d=manhattan(p.hole,q.hole)+(lp>=BUS_STUBS_PER_PAD?50:0)+(lq>=BUS_STUBS_PER_PAD?50:0);
          if(!best||d<best.d)best={r,p,q,j,d};
        }
        const from=`${best.j.ref}.${best.q.number}`,to=`${best.r.ref}.${best.p.number}`;
        add(n,netIndex,from,to);loadOf.set(from,(loadOf.get(from)??0)+1);loadOf.set(to,(loadOf.get(to)??0)+1);
        joined.push(best.r);rest.splice(rest.indexOf(best.r),1);
      }
      continue;
    }
    let edges;
    if(n.bare&&barePins.length>1){
      // Contact-board node straps keep their column chain (pogo pins are already in column order).
      const ordered=[...n.pins].sort((a,c)=>staged(a)-staged(c)||(Number(pinAt(b,c).part.body==='pogo')-Number(pinAt(b,a).part.body==='pogo'))||a.localeCompare(c,undefined,{numeric:true}));
      edges=ordered.slice(1).map((to,k)=>{const bare=barePins.includes(to)&&barePins.includes(ordered[0]);return {to,from:bare?barePins[barePins.indexOf(to)-1]:b.distributionChain&&!n.starRoot?ordered[k]:ordered[0]};});
    } else if(n.starRoot){
      const ordered=[...n.pins].sort((a,c)=>staged(a)-staged(c)||a.localeCompare(c,undefined,{numeric:true}));
      const index=ordered.indexOf(n.starRoot);
      if(index<0||staged(n.starRoot)>staged(ordered[0]))throw Error(`${b.id}: invalid early star root for ${n.name}`);
      ordered.splice(index,1);ordered.unshift(n.starRoot);
      edges=ordered.slice(1).map(to=>({to,from:ordered[0]}));
    } else edges=spatialTree(b,n,staged);
    for(const {to,from} of edges)add(n,netIndex,from,to,{bare:n.bare&&barePins.includes(to)&&barePins.includes(from)});
  }
  flagSleeves(b);
  return b;
}

// An insulated wire that crosses a bare bar needs a sleeve there. Report which bars it crosses.
export function flagSleeves(b){
  const bare=b.wires.filter(w=>!w.insulated);
  const seg=w=>w.path.slice(1).map((c,i)=>[w.path[i],c]);
  const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const cross=(p,q)=>orient(p[0],p[1],q[0])*orient(p[0],p[1],q[1])<0&&orient(q[0],q[1],p[0])*orient(q[0],q[1],p[1])<0;
  for(const w of b.wires){
    delete w.sleeves;
    if(!w.insulated)continue;
    const hits=[];
    for(const r of bare){
      if(r.net===w.net)continue;
      if(seg(w).some(s=>seg(r).some(t=>cross(s,t))))hits.push(r.id);
    }
    if(hits.length)w.sleeves=hits;
  }
}
