import{existsSync,readFileSync}from'node:fs';
import{join,resolve}from'node:path';
import{Store}from'./store';import{handler}from'./api';import{makeCatalog}from'../scripts/catalog.mjs';
const root=resolve(import.meta.dir,'..'),catalog=makeCatalog(),assets:any={};
for(const b of catalog.boards){assets[b.id]={};const local=join(root,'dist','boards',b.id,'local.json');if(existsSync(local))assets[b.id].local=JSON.parse(readFileSync(local,'utf8')); for(const [key,file]of [['schematic','schematic.svg'],['3d','3d.png']]){const path=join(root,'dist','boards',b.id,file);if(existsSync(path))assets[b.id][key]=readFileSync(path,key==='3d'?'base64':'utf8');}}
const store=new Store(process.env.ASSEMBLY_DB??join(root,'app/data/assembly.sqlite'),{catalog,assets}),api=handler(store,catalog.revision),web=join(root,'app/dist');
if(!existsSync(join(web,'index.html')))throw Error('Build the web app first: npm run assembly:app:build');
const port=Number(process.env.ASSEMBLY_PORT??8080);
const server=Bun.serve({hostname:'127.0.0.1',port,maxRequestBodySize:64*1024*1024,async fetch(request){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return api(request);const path=resolve(web,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(web+'/')&&path!==web)return new Response('Not found',{status:404});const file=Bun.file(existsSync(path)&&!url.pathname.endsWith('/')?path:join(web,'index.html'));return new Response(file);}});
console.log(`TedTronics assembly app: ${server.url}\nSQLite: ${process.env.ASSEMBLY_DB??join(root,'app/data/assembly.sqlite')}\nFirmware and USB integration are not implemented; measurements are entered manually.`);
