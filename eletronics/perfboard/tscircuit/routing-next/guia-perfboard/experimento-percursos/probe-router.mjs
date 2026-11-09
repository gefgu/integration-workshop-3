import {KiCadRoutingToolsAutorouter} from '@tscircuit/krt-wasm';
const r = new KiCadRoutingToolsAutorouter({layerCount:2,minTraceWidth:.8,bounds:{minX:0,maxX:20,minY:0,maxY:20},obstacles:[],connections:[{name:'a',pointsToConnect:[{x:2,y:2,layer:'top'},{x:15,y:15,layer:'top'}]}]}, {gridStep:1.27,clearance:.2,maxIterations:300000,viaCost:100000,turnCost:500});
console.log(JSON.stringify(r.solveSync()));
