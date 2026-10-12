// Functional placement for hand-wired perfboards. No copper router.
const gap=.35;
const collide=(a,b)=>a.xmin<b.xmax+gap&&a.xmax>b.xmin-gap&&a.ymin<b.ymax+gap&&a.ymax>b.ymin-gap;
const move=(p,x,y)=>{const dx=x-p.pins[0].hole[0],dy=y-p.pins[0].hole[1];p.pins=p.pins.map(q=>({...q,hole:[q.hole[0]+dx,q.hole[1]+dy]}));p.bounds={xmin:p.bounds.xmin+dx,xmax:p.bounds.xmax+dx,ymin:p.bounds.ymin+dy,ymax:p.bounds.ymax+dy};};
export function placeLowerBoard(b){
 const fixed=b.id==='power'?{
  J_POWER_INPUT_INPUT:[4,5],U_POWER_GUARDS_OV_5V:[20,8],U_POWER_GUARDS_OV_3V3:[20,23],U_POWER_ANALOG_TRIP:[41,9],U_POWER_INTERLOCK_FAULT:[57,9],U_POWER_INTERLOCK_LOGIC:[65,9],J_POWER_INTERLOCK_MATRIX:[64,26],J_POWER_INTERLOCK_SMART:[64,32],
 }:{
  J_PROBE:[4,1],U_ROUTER_CORE_ESP1:[5,5],U_ROUTER_SAFETY_WATCH:[21,5],U_MATRIX_CONTROL_ADDR:[34,5],U_MATRIX_CONTROL_BUFFER:[34,18],U_MATRIX_SWITCHES_MT_A:[47,5],U_MATRIX_SWITCHES_MT_B:[62,5],J_INTEGRATION_PI:[75,5],U_MATRIX_CONTROL_DIAG:[20,26],J_ROUTER_POWER_CONTROL:[5,31],
 };
 const placed=[];
 const legal=(p)=>p.bounds.xmin>=1&&p.bounds.xmax<=b.cols&&p.bounds.ymin>=.5&&p.bounds.ymax<=b.rows+.5&&!placed.some(q=>collide(p.bounds,q.bounds))&&!b.mounts.some(([x,y])=>collide(p.bounds,{xmin:x-.8,xmax:x+.8,ymin:y-.8,ymax:y+.8}));
 for(const [ref,xy] of Object.entries(fixed)){const p=b.parts.find(p=>p.ref===ref);if(!p)throw Error(`anchor ${ref}`);move(p,...xy);if(!legal(p))throw Error(`anchor overlap ${b.id}/${ref}`);placed.push(p);}
 const target=p=>{
  if(b.id==='power'){
   if(p.ref.includes('OV_5V')||p.ref.includes('LADDER_5V'))return [23,11];
   if(p.ref.includes('OV_3V3')||p.ref.includes('LADDER_3V3'))return [23,26];
   if(p.ref.includes('INPUT')||p.ref.includes('BUCK'))return [8,18];
   if(p.ref.includes('ANALOG'))return [43,19];
   return [62,18];
  }
  if(p.ref.includes('NODE_A'))return [47,28];if(p.ref.includes('NODE_B'))return [62,28];
  if(p.ref.includes('MT0'))return [47,24];if(p.ref.includes('MT1'))return [62,24];
  if(p.ref.includes('SAFETY'))return [23,15];
  if(p.ref.includes('CONTROL'))return /DIAG|SOURCE|DISCHARGE|CAL/.test(p.ref)?[23,29]:[37,14];
  if(p.ref.includes('SWITCHES'))return [57,27];
  if(p.ref.includes('INTEGRATION'))return [72,29];return [10,28];
 };
 // Capacitor placement prefers its own powered IC; subsequent optimization
 // cannot exchange its power domain or signal identity.
 const capOwners={C_POWER_INTERLOCK_FAULT:'U_POWER_INTERLOCK_FAULT',C_POWER_INTERLOCK_LOGIC:'U_POWER_INTERLOCK_LOGIC',C_POWER_ANALOG_TRIP:'U_POWER_ANALOG_TRIP',C_POWER_ANALOG_SENSE:'U_POWER_ANALOG_SENSE',C_POWER_GUARDS_OV_5V_IN:'U_POWER_GUARDS_OV_5V',C_POWER_GUARDS_OV_3V3_IN:'U_POWER_GUARDS_OV_3V3',C_MATRIX_CONTROL_ADDR:'U_MATRIX_CONTROL_ADDR',C_MATRIX_CONTROL_BUFFER:'U_MATRIX_CONTROL_BUFFER',C_MATRIX_CONTROL_DIAG_VCC:'U_MATRIX_CONTROL_DIAG',C_ROUTER_SAFETY_RETURN:'U_ROUTER_SAFETY_FAULT_RETURN',C_ROUTER_SAFETY_WATCH_VCC:'U_ROUTER_SAFETY_WATCH',C_MATRIX_SWITCHES_MT0:'U_MATRIX_SWITCHES_MT_A',C_MATRIX_SWITCHES_MT1:'U_MATRIX_SWITCHES_MT_B'};
 b.capacitorOwners=capOwners;
 b.schematicCapacitorOwners={...capOwners,C_POWER_ANALOG_EDU:'J_POWER_INTERLOCK_MATRIX',C_POWER_GUARDS_OV_5V_OUT:'Q_POWER_GUARDS_OV_5V_OUT',C_POWER_GUARDS_OV_3V3_OUT:'Q_POWER_GUARDS_OV_3V3_OUT',C_POWER_INPUT_INPUT:'D_POWER_INPUT_REVERSE',C_POWER_INPUT_INPUT_HF:'D_POWER_INPUT_REVERSE',C_MATRIX_CONTROL_DIAG:'U_MATRIX_CONTROL_DIAG',C_ROUTER_SAFETY_WATCH:'U_ROUTER_SAFETY_WATCH',C_MATRIX_SWITCHES_MT0_BULK:'U_MATRIX_SWITCHES_MT_A',C_MATRIX_SWITCHES_MT1_BULK:'U_MATRIX_SWITCHES_MT_B'};
 const remaining=b.parts.filter(p=>!placed.includes(p)).sort((a,c)=>Number(!capOwners[a.ref])-Number(!capOwners[c.ref])||((c.bounds.xmax-c.bounds.xmin)*(c.bounds.ymax-c.bounds.ymin)-(a.bounds.xmax-a.bounds.xmin)*(a.bounds.ymax-a.bounds.ymin))||a.ref.localeCompare(c.ref));
 for(const p of remaining){
  let desired=target(p);const owner=placed.find(q=>q.ref===capOwners[p.ref]);
  if(owner){const v=owner.pins.find(q=>/VCC|VDD|VIN|VS$/.test(q.label));desired=v?.hole??owner.pins[0].hole;}
  const base={pins:structuredClone(p.pins),bounds:{...p.bounds}};
  let best=null;
  for(let y=3;y<=b.rows-1;y++)for(let x=2;x<=b.cols-1;x++){
   move(p,x,y);if(!legal(p))continue;
   const score=Math.abs(x-desired[0])+Math.abs(y-desired[1]);if(!best||score<best.score)best={x,y,score};
  }
  p.pins=base.pins;p.bounds=base.bounds;
  if(!best)throw Error(`${b.id}/${p.ref}: no room`);move(p,best.x,best.y);placed.push(p);
 }
 // Improve local connection distances while keeping anchors, envelopes and
 // bypass capacitors fixed. Deterministic coordinate descent, not routing.
 const cost=p=>{
  let sum=0;for(const [n,net] of Object.entries(p.signals??{})){
   if(net==='GND'||/^(12V|[35]V|USB_|PI_|SAFE_|BUCK_)/.test(net))continue;
   const a=p.pins.find(q=>q.number===Number(n)).hole;
   for(const q of b.parts)if(q!==p)for(const [m,name] of Object.entries(q.signals??{}))if(name===net){const c=q.pins.find(pin=>pin.number===Number(m)).hole;sum+=Math.abs(a[0]-c[0])+Math.abs(a[1]-c[1]);}
  }return sum;
 };
 for(let pass=0;pass<3;pass++)for(const p of remaining.filter(p=>!capOwners[p.ref])){
  const index=placed.indexOf(p);placed.splice(index,1);let best={x:p.pins[0].hole[0],y:p.pins[0].hole[1],score:cost(p)};
  const start=[...p.pins[0].hole];
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
   move(p,start[0]+dx,start[1]+dy);if(!legal(p))continue;const score=cost(p);if(score<best.score)best={x:p.pins[0].hole[0],y:p.pins[0].hole[1],score};
  }move(p,best.x,best.y);placed.splice(index,0,p);
 }
}
