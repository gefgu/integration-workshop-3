// Revision 7 placement. Same shelf-free first-fit packing as design/boards.mjs place(), with the
// side effect of generating the wire tree with the revision 7 finish() from model7.mjs.
// Do not edit design/boards.mjs: revision 5 and 6 share it.
import {net,finish} from './model7.mjs';
const N=(b,name,...ends)=>net(b,name,ends.map(s=>s.split('.')));
// Same side effect as design/boards.mjs collect(): build nets from each part's signal map, then wires.
function collect(b){
  for(const p of b.parts)for(const [label,name] of Object.entries(p.signals??{}))N(b,name,`${p.ref}.${label}`);
  return finish(b);
}
function bound(p){
  const xs=p.pins.map(p=>p.hole[0]),ys=p.pins.map(p=>p.hole[1]);
  const extra=p.body==='idc'?2.5:p.body==='dip'?0.65:0.6,ey=p.body==='esp'?2.3:p.body==='idc'?1.6:extra;
  return {xmin:Math.min(...xs)-extra,xmax:Math.max(...xs)+extra,ymin:Math.min(...ys)-ey,ymax:Math.max(...ys)+ey};
}
export function place(b){
  const occupied=[...b.parts.filter(p=>p.locked).map(bound),...(b.keepouts??[]),...b.mounts.map(([x,y])=>({xmin:x-.85,xmax:x+.85,ymin:y-.85,ymax:y+.85}))];
  for(const p of b.parts.filter(p=>!p.locked)){
    const old=bound(p),w=old.xmax-old.xmin,h=old.ymax-old.ymin;let found=false;
    for(let j=4;j<b.rows-2&&!found;j++)for(let i=4;i<b.cols-2&&!found;i++){
      const dx=i-Math.min(...p.pins.map(x=>x.hole[0])),dy=j-Math.min(...p.pins.map(x=>x.hole[1]));
      const rect={xmin:old.xmin+dx,xmax:old.xmax+dx,ymin:old.ymin+dy,ymax:old.ymax+dy};
      if(rect.xmax>b.cols-2||rect.ymax>b.rows-2)continue;
      if(occupied.some(o=>rect.xmin<o.xmax+1&&rect.xmax>o.xmin-1&&rect.ymin<o.ymax+1&&rect.ymax>o.ymin-1))continue;
      p.pins=p.pins.map(x=>({...x,hole:[x.hole[0]+dx,x.hole[1]+dy]}));occupied.push(bound(p));found=true;
    }
    if(!found)throw Error(`${b.id}: ${p.ref} does not fit ${b.cols}x${b.rows}`);
  }
  // Expand the original placements over the available board; lead pitch stays fixed.
  if(!b.parts.some(p=>p.locked))for(const axis of [0,1]){
    const lo=axis===0?'xmin':'ymin',hi=axis===0?'xmax':'ymax',limit=axis===0?b.cols:b.rows;
    const oldBounds=b.parts.map(bound),origin=(Math.min(...oldBounds.map(o=>o[lo]))+Math.max(...oldBounds.map(o=>o[hi])))/2,target=(limit+1)/2;
    let spread=axis===0?1.5:3;
    for(const o of oldBounds){const c=(o[lo]+o[hi])/2,h=(o[hi]-o[lo])/2,d=c-origin;if(d>0)spread=Math.min(spread,(limit-2.5-target-h)/d);if(d<0)spread=Math.min(spread,(target-2.5-h)/(-d));}
    spread=Math.max(1,spread);
    b.parts.forEach((p,k)=>{const o=oldBounds[k],c=(o[lo]+o[hi])/2;const delta=Math.round(target+(c-origin)*spread-c);p.pins=p.pins.map(pin=>({...pin,hole:pin.hole.map((v,i)=>i===axis?v+delta:v)}));});
  }
  b.parts.forEach(p=>p.bounds=bound(p));
  return collect(b);
}
export {bound};
