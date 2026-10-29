import {Resvg} from '@resvg/resvg-js';
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
const dir=new URL('./assets/',import.meta.url);
for(const file of readdirSync(dir).filter(f=>f.endsWith('.svg'))){
 const url=new URL(file,dir);let svg=readFileSync(url,'utf8');const b=new Resvg(svg,{font:{loadSystemFonts:true}}).getBBox();
 if(!b)throw Error(file);const p=30,w=b.width+2*p,h=b.height+2*p;
 svg=svg.replace(/\sviewBox="[^"]*"/,'').replace(/\swidth="[^"]*"/,'').replace(/\sheight="[^"]*"/,'').replace('<svg ',`<svg viewBox="${b.x-p} ${b.y-p} ${w} ${h}" width="${w}" height="${h}" `);writeFileSync(url,svg);
}
