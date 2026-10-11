import {Store} from './store';
import {drawing} from '../scripts/drawing.mjs';
export function handler(store:Store,currentRevision:string){return async(request:Request)=>{
 const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean),json=(v:any,status=200)=>Response.json(v,{status});
 if(request.method!=='GET'&&request.headers.has('origin')&&request.headers.get('origin')!==url.origin)return json({error:'Use this app from its local server'},403);
 try{
  const body=request.method==='GET'?null:await request.json();
  if(url.pathname==='/api/projects'&&request.method==='GET')return json({projects:store.list(),currentRevision});
  if(url.pathname==='/api/projects'&&request.method==='POST')return json(store.create(body.name,currentRevision),201);
  if(url.pathname==='/api/import'&&request.method==='POST')return json(store.import(body),201);
  if(parts[1]==='catalog'&&request.method==='GET')return json(store.catalog(parts[2]));
  if(parts[1]==='asset'&&request.method==='GET'){
   const c=store.catalog(parts[2]),board=c.boards.find((b:any)=>b.id===parts[3]);if(!board)throw new Error('Unknown board');
   if(parts[4]==='top'||parts[4]==='bottom')return new Response(drawing(board,parts[4]==='bottom'),{headers:{'Content-Type':'image/svg+xml'}});
   if(parts[4]==='local'){const asset=store.assets(c.revision)[board.id]?.local?.[url.searchParams.get('section')??board.sections[0]?.name];if(!asset)return json({error:'Local schematic unavailable; run build:local'},404);return new Response(asset,{headers:{'Content-Type':'image/svg+xml'}});}
   const asset=store.assets(c.revision)[board.id]?.[parts[4]];if(!asset)return json({error:'Export unavailable; rebuild the circuit artifacts'},404);
   return new Response(parts[4]==='3d'?Buffer.from(asset,'base64'):asset,{headers:{'Content-Type':parts[4]==='3d'?'image/png':'image/svg+xml'}});
  }
  if(parts[1]==='projects'){
   const id=parts[2];if(parts.length===3&&request.method==='GET')return json(store.project(id));
   if(parts[3]==='cursor'&&request.method==='PATCH')return json(store.cursor(id,body.version,body.step,body.draft));
   if(parts[3]==='presentation'&&request.method==='POST'){if(body.revision!==currentRevision)throw new Error('Select the current drawing revision');return json(store.refreshPresentation(id,body.version,body.revision));}
   if(parts[3]==='step-groups'&&request.method==='POST')return json(store.completeGroup(id,body.version,body));
   if(parts[3]==='steps'&&request.method==='POST')return json(store.completeStep(id,body.version,body));
   if(parts[3]==='progress'&&request.method==='PATCH')return json(store.update(id,body.version,body.changes));
   if(parts[3]==='attempts'&&request.method==='POST')return json(store.record(id,body.version,body));
   if(parts[3]==='accept'&&request.method==='POST')return json(store.accept(id,body.version,body.checkpoint));
   if(parts[3]==='readiness'&&request.method==='GET')return json(store.readiness(id,url.searchParams.get('checkpoint')!));
   if(parts[3]==='export'&&request.method==='GET')return json(store.export(id));
  }
  return json({error:'Not found'},404);
 }catch(e:any){return json({error:e.message},e.message.startsWith('Conflict:')?409:400);}
};}
