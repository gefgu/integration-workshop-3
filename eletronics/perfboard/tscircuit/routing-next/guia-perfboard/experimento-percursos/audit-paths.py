from pathlib import Path
import json,math,collections,sys,csv
D=Path(__file__).resolve().parent
EPS=1e-6
cross=lambda a,b:a[0]*b[1]-a[1]*b[0]
sub=lambda a,b:(a[0]-b[0],a[1]-b[1])
def intersect(a,b,c,d):
 r=sub(b,a);s=sub(d,c);q=sub(c,a);den=cross(r,s)
 if abs(den)<EPS:
  if abs(cross(q,r))>EPS:return None
  rr=sum(x*x for x in r)
  if rr<EPS:return None
  vals=sorted([sum(q[i]*r[i]for i in [0,1])/rr,sum((d[i]-a[i])*r[i]for i in [0,1])/rr]);lo=max(0,vals[0]);hi=min(1,vals[1])
  if hi-lo>EPS:return ('overlap',(a[0]+lo*r[0],a[1]+lo*r[1]),(a[0]+hi*r[0],a[1]+hi*r[1]))
  return None
 t=cross(q,s)/den;u=cross(q,r)/den
 if -EPS<=t<=1+EPS and -EPS<=u<=1+EPS:return('cross',(a[0]+t*r[0],a[1]+t*r[1]))
 return None
def xy(e,pins):return(pins[e]['c']*2.54,pins[e]['r']*2.54)
def segs(w):
 ps=[(p['x'],p['y'])for p in w['route']if p['route_type']=='wire']
 return[(a,b)for a,b in zip(ps,ps[1:])if math.dist(a,b)>EPS]
def inspect(wires,pins):
 events=[];overlaps=[]
 for i,w in enumerate(wires):
  for v in wires[:i]:
   shared=set([w['from'],w['to']])&set([v['from'],v['to']]);seen=set()
   for a,b in segs(w):
    for c,d in segs(v):
     hit=intersect(a,b,c,d)
     if not hit:continue
     if any(max(math.dist(pt,xy(e,pins))for pt in hit[1:])<1.91 for e in shared):continue
     key=(hit[0],*(round(x,5)for pt in hit[1:]for x in pt))
     if key in seen:continue
     seen.add(key)
     item={'wireA':v['id'],'wireB':w['id'],'netA':v['net'],'netB':w['net'],'sameNet':w['net']==v['net'],'xyMm':hit[1:]}
     (events if hit[0]=='cross'else overlaps).append(item)
 return events,overlaps
if __name__=='__main__':
 pins=json.loads((D/'layout-input.json').read_text())['pins']
 for name in sys.argv[1:]:
  data=json.loads(Path(name).read_text());wires=data['wires'];events,overlaps=inspect(wires,pins)
  print(name,'cross different nets',sum(not q['sameNet']for q in events),'overlap diff',sum(not q['sameNet']for q in overlaps),'length',round(sum(math.dist(a,b)for w in wires for a,b in segs(w))/1000,2))
  if 'original'in data:
   original=[{**w,'route':[{'route_type':'wire','x':xy(e,pins)[0],'y':xy(e,pins)[1]}for e in [w['from'],w['to']]]}for w in data['original']]
   orig,ov=inspect(original,pins);print('original straight cross diff',sum(not q['sameNet']for q in orig),'overlap',sum(not q['sameNet']for q in ov))

def distance_to_segment(p,a,b):
 v=sub(b,a);vv=sum(q*q for q in v)
 t=max(0,min(1,sum((p[i]-a[i])*v[i]for i in [0,1])/vv))if vv>EPS else 0
 return math.dist(p,(a[0]+t*v[0],a[1]+t*v[1]))
def audit(data,pins,write=True):
 wires=data['wires'];by={w['id']:w for w in wires}
 events,overlaps=inspect(wires,pins)
 diffs=[q for q in events if not q['sameNet']];same=[q for q in events if q['sameNet']]
 difov=[q for q in overlaps if not q['sameNet']];sameov=[q for q in overlaps if q['sameNet']]
 allitems=[]
 for kind,items in [('X',diffs),('P',difov)]:
  for i,q in enumerate(items):
   a,b=q['wireA'],q['wireB'];under,over=sorted([a,b],key=lambda key:by[key]['installOrder'])
   allitems.append({**q,'id':f'{kind}{i+1:03}','type':'crossing'if kind=='X'else'parallel overlap','under':under,'over':over,'grid':[[round(v/2.54,4)for v in p]for p in q['xyMm']]})
 original=[{**w,'route':[{'route_type':'wire','x':xy(e,pins)[0],'y':xy(e,pins)[1]}for e in[w['from'],w['to']]]}for w in data['original']]
 basecross,baseov=inspect(original,pins)
 base=sum(not q['sameNet']for q in basecross)
 badpads=[];out=[];degree=collections.Counter()
 for w in wires:
  degree.update([w['from'],w['to']]);ps=[p for p in w['route']if p['route_type']=='wire']
  assert math.dist((ps[0]['x'],ps[0]['y']),xy(w['from'],pins))<.001,w['id']
  assert math.dist((ps[-1]['x'],ps[-1]['y']),xy(w['to'],pins))<.001,w['id']
  for p in ps:
   assert 1.27-EPS<=p['x']<=95.25+EPS and 1.27-EPS<=p['y']<=191.77+EPS
  for e,p in pins.items():
   if e in[w['from'],w['to']]:continue
   mind=min(distance_to_segment(xy(e,pins),a,b)for a,b in segs(w))
   if mind<1.19:badpads.append({'wire':w['id'],'pad':e,'centerDistanceMm':round(mind,4)})
  w['planLengthMm']=round(sum(math.dist(a,b)for a,b in segs(w)),1)
  w['bendsGrid']=[[round(p['x']/2.54,4),round(p['y']/2.54,4)]for p in ps]
  w['crossingIDs']=[q['id']for q in allitems if q['over']==w['id']]
  w['underCrossingIDs']=[q['id']for q in allitems if q['under']==w['id']]
 clusters=collections.defaultdict(set)
 for q in diffs:
  clusters[tuple(round(v,4)for v in q['xyMm'][0])].update([q['wireA'],q['wireB']])
 report={'paths':len(wires),'differentNetCrossingEvents':len(diffs),'differentNetCrossingLocations':len(clusters),'differentNetParallelOverlapRuns':len(difov),'sameNetCrossingEvents':len(same),'sameNetParallelRuns':len(sameov),'maxWiresAtCrossingLocation':max(map(len,clusters.values()),default=0),'baselineStraightStarCrossings':base,'baselineStraightStarIsBuildable':False,'reductionOfGraphicalCrossingsPercent':round(100*(base-len(diffs))/base,1),'totalPlanLengthM':round(sum(w['planLengthMm']for w in wires)/1000,2),'baselineStraightLengthM':round(sum(math.dist(a,b)for w in original for a,b in segs(w))/1000,2),'maxWiresAtTerminal':max(degree.values()),'otherPadKeepoutConflicts':badpads,'endpointGeometryVerified':True,'boardBoundsVerified':True,'outerJacketAssumedMm':.8,'padDiameterAssumedMm':1.6,'physicalMeasurementsVerified':False,'wirePaths3dClearanceVerified':False,'crossingsRequireInsulation':True}
 if write:
  (D/'crossing-report.json').write_text(json.dumps(report,indent=2)+'\n')
  (D/'crossings.json').write_text(json.dumps(allitems,indent=2)+'\n')
  (D/'paths-audited.json').write_text(json.dumps({'report':report,'wires':wires},indent=2)+'\n')
  with(D/'crossings.csv').open('w',newline='')as f:
   wr=csv.writer(f);wr.writerow(['ID','Tipo','Por_baixo','Por_cima','Coordenadas_TOP','Acao'])
   for q in allitems:wr.writerow([q['id'],q['type'],q['under'],q['over'],' → '.join(f'C{p[0]:g}/R{p[1]:g}'for p in q['grid']),'Manter isolado; não soldar no cruzamento'])
 return report,allitems,wires
