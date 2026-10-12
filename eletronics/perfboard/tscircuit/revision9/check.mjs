// Connectivity check for the revision 9 stripboard: strips + cuts + links must give exactly the schematic nets.
import { mkdirSync, writeFileSync } from 'node:fs';
import { checkDesign, topSvg, undersideSvg } from './stripboard.mjs';
import { parts, cuts, links } from './design.mjs';

const out = new URL('./assets/', import.meta.url);
mkdirSync(out, { recursive: true });
const result = checkDesign();
writeFileSync(new URL('stripboard-top.svg', out), topSvg());
writeFileSync(new URL('stripboard-underside.svg', out), undersideSvg());
const summary = {
  status: result.issues.length ? 'fail' : 'pass',
  issues: result.issues,
  parts: parts.length,
  solderedPins: result.pinCount,
  cuts: cuts.length,
  links: links.length,
  nets: result.nets.length,
};
writeFileSync(new URL('checks.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
console.log(`revision9 stripboard: ${summary.status}; ${summary.parts} parts, ${summary.solderedPins} pins, ${summary.cuts} cuts, ${summary.links} links, ${summary.nets} nets`);
if (result.issues.length) { console.log(JSON.stringify(result.issues, null, 1)); process.exit(1); }
