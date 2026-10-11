import {PITCH} from '../design/model.mjs';
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function drawing(b,back=false) {
 if(b.kind==='breadboard')return breadboardDrawing(b);
 const scale=12,pad=65,legend=265,X=i=>pad+(back?b.cols+1-i:i)*scale,Y=j=>pad+j*scale;
 const BW=(b.cols+1)*scale+pad*2,W=BW+legend,H=Math.max((b.rows+1)*scale+pad*2,b.parts.length*16+125);
 const text=(x,y,t,size=8,anchor='middle')=>`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}">${esc(t)}</text>`;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><style>text{font-family:Arial;fill:#17232b}.wire{fill:none;stroke-linejoin:round;stroke-linecap:round}.connection{pointer-events:stroke}.part{cursor:pointer}</style><rect width="100%" height="100%" fill="#fff"/>`;
 svg+=text(BW/2,20,`${b.title} — ${back?'MIRRORED UNDERSIDE':'TOP / POGO SIDE'}`,12)+text(BW/2,38,`${b.width.toFixed(2)} × ${b.height.toFixed(2)} mm · 2.54 mm isolated pads`,9);
 const centerX=pad+(b.cols+1)*scale/2,centerY=pad+(b.rows+1)*scale/2;
 svg+=`<rect x="${centerX-b.width/PITCH*scale/2}" y="${centerY-b.height/PITCH*scale/2}" width="${b.width/PITCH*scale}" height="${b.height/PITCH*scale}" fill="#f1ddba" stroke="#a34" stroke-dasharray="5 3"/>`;
 for(let i=1;i<=b.cols;i++){svg+=text(X(i),pad-11,i,8);for(let j=1;j<=b.rows;j++)svg+=`<circle cx="${X(i)}" cy="${Y(j)}" r="1.9" fill="#b2874e"/><circle cx="${X(i)}" cy="${Y(j)}" r="1" fill="white"/>`;}
 for(let j=1;j<=b.rows;j++)svg+=text(pad-18,Y(j)+3,j,8);
 for(const [i,j]of b.mounts)svg+=`<circle cx="${X(i)}" cy="${Y(j)}" r="${3.2/PITCH*scale/2}" fill="white" stroke="#333"/>`;
 b.parts.forEach((p,k)=>{
  const visible=back?p.side==='bottom':p.side==='top',x=Math.min(X(p.bounds.xmin),X(p.bounds.xmax)),y=Y(p.bounds.ymin),w=(p.bounds.xmax-p.bounds.xmin)*scale,h=(p.bounds.ymax-p.bounds.ymin)*scale;
  svg+=`<g class="part" data-part="${esc(p.ref)}" data-phase="${p.phase}" opacity="${visible?1:.45}"><title>${esc(p.ref+' '+p.label+' · '+p.side)}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${visible?'#d4e8ee':'none'}" stroke="#456" stroke-dasharray="${visible?'none':'3 2'}"/>`;
  for(const pin of p.pins)svg+=`<circle cx="${X(pin.hole[0])}" cy="${Y(pin.hole[1])}" r="2.8" data-pin="${esc(p.ref)}.${pin.number}" fill="${pin.number===1?'#d33':'#174b69'}"><title>${esc(`${p.ref}.${pin.number} ${pin.label} · (${pin.hole})`)}</title></circle>`;
  svg+='</g>';
  svg+=`<g class="part legend" data-part="${esc(p.ref)}" data-phase="${p.phase}">${text(BW+5,70+k*16,`${k+1}. ${p.ref} · CP${String(p.phase).padStart(2,'0')}`,9,'start')}<title>${esc(p.label)}</title></g>`;
 });
 for(const w of b.wires)svg+=`<g class="connection" data-wire="${w.id}" data-uid="${esc(w.uid)}" data-net="${esc(w.net)}" data-phase="${w.phase}"><title>${esc(`${w.id} ${w.net}: ${w.from} → ${w.to}`)}</title><polyline class="wire" points="${w.path.map(([i,j])=>`${X(i)},${Y(j)}`).join(' ')}" stroke="${w.color}" stroke-width="${w.insulated?1.4:2.6}" opacity="${back?.7:.28}"/>${[w.path[0],w.path.at(-1)].map(([i,j])=>`<circle cx="${X(i)}" cy="${Y(j)}" r="2" fill="${w.color}"/>`).join('')}</g>`;
 // Paint number badges above wires so a route never cuts through their text.
 b.parts.forEach((p,k)=>{const x=(X(p.bounds.xmin)+X(p.bounds.xmax))/2,y=(Y(p.bounds.ymin)+Y(p.bounds.ymax))/2;svg+=`<g class="part badge" data-part="${esc(p.ref)}" data-phase="${p.phase}"><rect x="${x-7}" y="${y-5}" width="14" height="11" rx="2" fill="white"/>${text(x,y+3,k+1,8)}</g>`;});
 for(const item of b.kit??[]){const pin=ep=>{const [ref,num]=ep.split('.');return b.parts.find(p=>p.ref===ref).pins.find(p=>p.number===Number(num)).hole;},a=pin(item.from),z=pin(item.to),x=Math.min(X(a[0]),X(z[0])),y=Y(a[1]),width=Math.abs(X(a[0])-X(z[0]));svg+=`<g class="part kit" data-item="${esc(item.id)}" opacity="${back?.2:.7}"><title>Proposed TOP kit arrangement; measure actual fit. ${esc(item.from+' → '+item.to)}</title><rect x="${x+4}" y="${y-10}" width="${width-8}" height="20" rx="3" fill="${back?'none':'#fff5da'}" stroke="#3e6b57" stroke-dasharray="${back?'3 2':'none'}"/>${text(x+width/2,y+3,item.label,8)}<circle cx="${X(a[0])}" cy="${y}" r="3" fill="#3e6b57"/><circle cx="${X(z[0])}" cy="${Y(z[1])}" r="3" fill="#3e6b57"/></g>`;}
 svg+=text(BW/2,H-27,'Red pad = pin 1 · component numbers refer to the legend · strip wire endpoints only',9)+text(BW/2,H-13,'Crossings are insulated; bends are not solder joints. Coordinates retain TOP numbering.',9)+'</svg>';
 return svg;
}

export function breadboardDrawing(b){
 const X=x=>30+x*20,Y=y=>55+y*20,W=650,H=700;
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><style>text{font-family:Arial;fill:#172b37;font-size:11px}.wire{fill:none;stroke-width:3}</style><rect width="100%" height="100%" fill="#fff"/><text x="30" y="20">400-tie breadboard reference — TOP, no soldering</text><text x="30" y="39">Confirm your actual row connections. Supply rails are not used.</text>`;
 const xs=[2,3,4,5,6,9,10,11,12,13],labels='abcdefghij';
 xs.forEach((x,i)=>{s+=`<text x="${X(x)-3}" y="${Y(1)-15}">${labels[i]}</text>`;});
 for(let row=1;row<=30;row++){s+=`<text x="40" y="${Y(row)+3}">${row}</text>`;for(const [a,z]of [[2,6],[9,13]])s+=`<line x1="${X(a)}" y1="${Y(row)}" x2="${X(z)}" y2="${Y(row)}" stroke="#ddd" stroke-width="5"/>`;for(const x of xs)s+=`<circle cx="${X(x)}" cy="${Y(row)}" r="3" fill="#86979f"/>`;}
 b.parts.forEach((p,k)=>{s+=`<g class="part" data-part="${esc(p.ref)}"><title>${esc(p.label)}</title>`;for(const pin of p.pins)s+=`<circle cx="${X(pin.hole[0])}" cy="${Y(pin.hole[1])}" r="5" fill="${pin.number===1?'#b84425':'#194f64'}"><title>${esc(`${p.ref}.${pin.number} ${pin.label}`)}</title></circle>`;const [x,y]=p.pins[0].hole;s+=`<text x="${X(x)+9}" y="${Y(y)-8}">${k+1}</text></g><g class="part legend" data-part="${esc(p.ref)}"><text x="350" y="${90+k*34}">${k+1}. ${esc(p.ref)}</text><text x="350" y="${105+k*34}" style="font-size:9px">${esc(p.mpn??p.value??'flying leads')}</text></g>`;});
 for(const w of b.wires){if(w.breadboardTie)continue;const a=w.path[0],z=w.path.at(-1);s+=`<g class="connection" data-uid="${esc(w.uid)}" data-net="${esc(w.net)}"><title>${esc(`${w.from} → ${w.to}`)}</title><polyline class="wire" points="${X(a[0])},${Y(a[1])} ${X(a[0])+8},${Y(a[1])-8} ${X(z[0])+8},${Y(z[1])-8} ${X(z[0])},${Y(z[1])}" stroke="${w.color}"/></g>`;}
 return s+'</svg>';
}
