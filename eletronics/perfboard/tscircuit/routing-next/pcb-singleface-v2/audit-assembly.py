"""Independent geometry connectivity audit; ignores logical source traces."""
from pathlib import Path
import json,math,collections
D=Path(__file__).resolve().parent
j=json.loads((D/'copper.circuit.json').read_text());plan=json.loads((D/'final-plan.json').read_text());parts=json.loads((D/'parts.json').read_text())
sc={x['source_component_id']:x['name']for x in j if x['type']=='source_component'};sp={x['source_port_id']:x for x in j if x['type']=='source_port'};pp={x['pcb_port_id']:x for x in j if x['type']=='pcb_port'}
expected={f'{p["ref"]}.{q["pin"]}':q['net']for p in parts for q in p['pins']}
expected.update({a['name']+'.1':a['net']for a in plan['anchors']})
pads=[x for x in j if x['type']=='pcb_plated_hole'];traces=[x for x in j if x['type']=='pcb_trace'];padByName={};nameById={};netById={}
for p in pads:
 source=sp[pp[p['pcb_port_id']]['source_port_id']];name=sc[source['source_component_id']]+'.'+str(source['pin_number']);key=p['pcb_plated_hole_id'];padByName[name]=key;nameById[key]=name;netById[key]=expected[name]or'NC:'+name
xy=lambda p:(p['x'],p['y'])
def pointseg(p,a,b):
 dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy or 1)))
 return math.dist(p,(a[0]+t*dx,a[1]+t*dy))
def intersects(a,b,c,d):
 cr=lambda u,v:u[0]*v[1]-u[1]*v[0];sub=lambda u,v:(u[0]-v[0],u[1]-v[1]);r=sub(b,a);s=sub(d,c);q=sub(c,a);den=cr(r,s)
 if abs(den)<1e-8:return min(pointseg(a,c,d),pointseg(b,c,d),pointseg(c,a,b),pointseg(d,a,b))<1e-8
 t=cr(q,s)/den;u=cr(q,r)/den;return -1e-8<=t<=1+1e-8 and -1e-8<=u<=1+1e-8
def segdistance(a,b,c,d):return 0 if intersects(a,b,c,d)else min(pointseg(a,c,d),pointseg(b,c,d),pointseg(c,a,b),pointseg(d,a,b))
def rectdistance(a,b,p):
 hw=p['rect_pad_width']/2;hh=p['rect_pad_height']/2;x=p['x'];y=p['y'];cs=[(x-hw,y-hh),(x+hw,y-hh),(x+hw,y+hh),(x-hw,y+hh)]
 if any(abs(v[0]-x)<=hw and abs(v[1]-y)<=hh for v in[a,b]):return 0
 return min(segdistance(a,b,cs[i],cs[(i+1)%4])for i in range(4))
uf={}
def find(x):
 if x not in uf:uf[x]=x
 if uf[x]!=x:uf[x]=find(uf[x])
 return uf[x]
def join(a,b):uf[find(a)]=find(b)
segments={t['pcb_trace_id']:[(xy(a),xy(b),a['width'])for a,b in zip(t['route'],t['route'][1:])]for t in traces}
for t in traces:
 tid=t['pcb_trace_id'];find(tid)
 for p in pads:
  pid=p['pcb_plated_hole_id'];find(pid)
  for a,b,w in segments[tid]:
   if p['shape']=='circle':contact=pointseg(xy(p),a,b)<p['outer_diameter']/2+w/2-.005
   else:contact=rectdistance(a,b,p)<w/2-.005
   if contact:join(pid,tid);break
for i,t in enumerate(traces):
 tid=t['pcb_trace_id']
 for v in traces[:i]:
  vid=v['pcb_trace_id']
  if find(tid)==find(vid):continue
  if any(segdistance(a,b,c,d)<(w+z)/2-.005 for a,b,w in segments[tid]for c,d,z in segments[vid]):join(tid,vid)
base=dict(uf)
def assess(bridges):
 global uf
 uf=dict(base)
 for b in bridges:join(padByName[b['a']+'.1'],padByName[b['b']+'.1'])
 roots=collections.defaultdict(set);netroots=collections.defaultdict(set)
 for key,net in netById.items():roots[find(key)].add(net);netroots[net].add(find(key))
 shorts=[sorted(v)for v in roots.values()if len(v)>1];opens={n:len(v)for n,v in netroots.items()if not n.startswith('NC:')and len(v)>1}
 return shorts,opens
shorts,opens=assess(plan['bridges']);assert not shorts,shorts;assert not opens,opens
# A missing essential bridge must be detected; a wire to a different net must short.
essential=None
for b in plan['bridges']:
 _,bad=assess([v for v in plan['bridges']if v['id']!=b['id']])
 if bad:essential=b['id'];break
assert essential,'Could not detect a missing essential bridge'
b=plan['bridges'][0];foreign=next(a for a in plan['anchors']if a['net']!=b['net']);mutated=[{**v,'b':foreign['name']}if v['id']==b['id']else v for v in plan['bridges']];bad,_=assess(mutated);assert bad,'Wrong-net jumper was not detected'
assert all(pt['layer']=='top'for t in traces for pt in t['route'])
assert not any(x['type']=='pcb_via'for x in j)
report={'independentOfSourceTraceMetadata':True,'checkedPthPads':len(pads),'checkedCopperTraces':len(traces),'checkedInsulatedWireBridges':len(plan['bridges']),'unintendedNetMerges':shorts,'openNetsAfterBridges':opens,'oneCopperFaceOnly':True,'pcbVias':0,'missingBridgeMutationDetected':essential,'wrongNetBridgeMutationDetected':True,'hardwareMeasured':False}
(D/'assembly-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
