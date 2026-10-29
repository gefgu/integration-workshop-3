// Crop native schematic exports to their visible content for readable PDF pages.
// Does not change connectivity, symbols or routes.
import{Resvg}from'@resvg/resvg-js';import{readFileSync,writeFileSync}from'node:fs';import{sections}from'./model.mjs';
for(const s of sections){const f=new URL(`assets/${s}-content.svg`,import.meta.url);let svg=readFileSync(f,'utf8');const b=new Resvg(svg,{font:{loadSystemFonts:true}}).getBBox();if(!b)throw Error('Empty schematic '+s);const pad=35,x=b.x-pad,y=b.y-pad,w=b.width+2*pad,h=b.height+2*pad;svg=svg.replace(/\sviewBox="[^"]*"/,'').replace(/\swidth="[^"]*"/,'').replace(/\sheight="[^"]*"/,'').replace('<svg ',`<svg viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}" `);writeFileSync(f,svg);}
