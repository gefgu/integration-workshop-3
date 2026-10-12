// Proves the stripboard check can fail: each mutation must be reported.
import { cuts, links, parts } from './design.mjs';
import { checkDesign } from './stripboard.mjs';

const expect = (name, fn, code) => {
  const undo = fn();
  const codes = checkDesign().issues.map((i) => i.code);
  undo();
  const ok = codes.includes(code);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} -> ${codes.join(',') || 'nothing reported'}`);
  if (!ok) process.exitCode = 1;
};

expect('remove cut on row 4 (LED5 node shorts to 5V)', () => { const i = cuts.findIndex((c) => c.row === 4); const [c] = cuts.splice(i, 1); return () => cuts.splice(i, 0, c); }, 'short');
expect('remove cut on row 6 (interface pin 6 connected)', () => { const i = cuts.findIndex((c) => c.row === 6); const [c] = cuts.splice(i, 1); return () => cuts.splice(i, 0, c); }, 'nc-pin-connected');
expect('remove link L1 (ground strips split)', () => { const i = links.findIndex((l) => l.id === 'L1'); const [l] = links.splice(i, 1); return () => links.splice(i, 0, l); }, 'open');
expect('move Q3 gate one row (wrong strip)', () => { const q = parts.find((p) => p.ref === 'Q3'); const pin = q.pins[1]; const old = pin[2]; pin[2] = [old[0] + 1, old[1]]; return () => { pin[2] = old; }; }, 'short');
expect('two leads in one hole', () => { const q = parts.find((p) => p.ref === 'Q2'); const pin = q.pins[0]; const old = pin[2]; pin[2] = [...parts.find((p) => p.ref === 'Q3').pins[2][2]]; return () => { pin[2] = old; }; }, 'hole-used-twice');
