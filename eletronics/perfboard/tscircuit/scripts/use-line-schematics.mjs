import {readFileSync,writeFileSync} from 'node:fs';
// core 0.0.2121's MSP renderer replaces named wires with labels even when
// schTraceAutoLabelEnabled=false. Use its existing built-in trace renderer,
// honoring that option in both label fallbacks. No router or diagnostic filter.
const path=new URL('../node_modules/@tscircuit/core/dist/index.js',import.meta.url);
let source=readFileSync(path,'utf8');
const patches=[
 ['if (trace.root?._featureMspSchematicTraceRouting) return;', 'if (trace.root?._featureMspSchematicTraceRouting && trace.getSubcircuit()._parsedProps.schTraceAutoLabelEnabled !== false) return; /* tedtronics line schematics */'],
 ['if (!group.root?._featureMspSchematicTraceRouting) return;', 'if (!group.root?._featureMspSchematicTraceRouting || group._parsedProps.schTraceAutoLabelEnabled === false) return; /* tedtronics line schematics */'],
 ['if (schematicNetLabelText && !hasSheetLocalSchematicPortRepresentation) {','if (schematicNetLabelText && !hasSheetLocalSchematicPortRepresentation && trace.getSubcircuit()._parsedProps.schTraceAutoLabelEnabled !== false) { /* tedtronics explicit wires */'],
 ['if (!hasSheetLocalSchematicPortRepresentation && (trace._isSymbolToChipConnection() || trace._isSymbolToSymbolConnection() || trace._isChipToChipConnection())) {','if (!hasSheetLocalSchematicPortRepresentation && trace.getSubcircuit()._parsedProps.schTraceAutoLabelEnabled !== false && (trace._isSymbolToChipConnection() || trace._isSymbolToSymbolConnection() || trace._isChipToChipConnection())) { /* tedtronics explicit wires */']
];
for(const [before,after] of patches){if(source.includes(after))continue;if(source.split(before).length!==2)throw Error('Core changed: review line schematic compatibility.');source=source.replace(before,after);}
source=source.replace('if (group._parsedProps.schTraceAutoLabelEnabled !== false) applyInlineNetLabelEligibility({','applyInlineNetLabelEligibility({');
writeFileSync(path,source);console.log('Built-in line renderer honors automatic labels off.');
// Crossing decoration must make forward progress. The built-in intersection
// tolerance admits points at/just beyond segment ends; repeatedly splitting
// there creates backwards residual segments and can loop forever.
source=readFileSync(path,'utf8');
const crossingBefore='const crossingPoint2 = { x: intersectX, y: intersectY };\n        otherEdgesIntersections.push({';
const crossingAfter='const crossingPoint2 = { x: intersectX, y: intersectY };\n        if (distance2(edge.from, crossingPoint2) < 0.037501 || distance2(edge.to, crossingPoint2) < 0.037501) continue; /* tedtronics finite crossing decoration */\n        otherEdgesIntersections.push({';
if(!source.includes(crossingAfter)){if(source.split(crossingBefore).length!==2)throw Error('Core crossing decoration changed; review compatibility fix.');source=source.replace(crossingBefore,crossingAfter);writeFileSync(path,source);}
