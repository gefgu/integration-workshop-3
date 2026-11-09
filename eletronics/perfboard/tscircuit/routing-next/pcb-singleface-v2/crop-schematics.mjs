import {Resvg} from '@resvg/resvg-js';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const D=new URL('./assets/',import.meta.url);
for(const file of readdirSync(D).filter(f=>f.endsWith('-cropped.svg'))){const url=new URL(file,D);let svg=readFileSync(url,'utf8');const b=new Resvg(svg,{font:{loadSystemFonts:true}}).getBBox();if(!b)throw Error(file);const p=30,w=b.width+2*p,h=b.height+2*p;svg=svg.replace(/\sviewBox="[^"]*"/,'').replace(/\swidth="[^"]*"/,'').replace(/\sheight="[^"]*"/,'').replace('<svg ',`<svg viewBox="${b.x-p} ${b.y-p} ${w} ${h}" width="${w}" height="${h}" `);writeFileSync(url,svg);}
