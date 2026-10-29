import{Resvg}from'@resvg/resvg-js';import{readFileSync,writeFileSync}from'node:fs';
const d=new URL('./',import.meta.url);const r=new Resvg(readFileSync(new URL('comparativo.svg',d)),{font:{loadSystemFonts:true}});writeFileSync(new URL('comparativo.png',d),r.render().asPng());
