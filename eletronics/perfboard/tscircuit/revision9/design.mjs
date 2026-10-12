// Revision 9: minimal power board on stripboard. Single source of truth for the schematic,
// the stripboard layout and the connectivity check. Strips run along the rows (hole y); a hole is [row, col].
// Hole coordinates are written as [row, col], 1-based, looking at the TOP (component side).
export const revision = 'r9-minimal-power-stripboard';
export const ROWS = 15, COLS = 40;

// Strip net per row; "cuts" split a row after the given column.
export const rowNets = {
  1: 'GND', 2: '3V3_SYS', 3: '12V_SYS', 4: '5V_SYS', 5: 'EDU_SW', 6: 'GATE', 7: 'EDU_PWR_EN', 8: 'MID',
  9: 'ROUTER_ALIVE', 10: 'GND', 11: '5V_EDU', 12: 'EDU_SENSE', 13: 'GND', 14: '12V_IN', 15: '12V_SYS',
};
export const cuts = [
  { row: 2, after: 3, why: 'separates the 3.3 V LED node from the 3V3_SYS strip' },
  { row: 4, after: 2, why: 'separates the 5 V LED node from the 5V_SYS strip' },
  { row: 5, after: 34, why: 'leaves interface pin 5 unconnected' },
  { row: 6, after: 24, why: 'leaves interface pin 6 unconnected' },
  { row: 8, after: 26, why: 'splits MID (Q2/Q3) from the node between R_S and F_EDU' },
  { row: 8, after: 34, why: 'leaves interface pin 8 unconnected' },
  { row: 14, after: 5, why: 'splits 12V_IN from 12V_F around fuse F1' },
];
// Net names of strip segments that differ from the row default (resolved by net of the pins, not by this table).
export const nets = {
  GND: 'Ground', '3V3_SYS': '3.3 V system rail', '12V_SYS': '12 V after fuse and diode', '5V_SYS': '5 V system rail',
  EDU_SW: 'Q1 drain', GATE: 'Q1 gate', EDU_PWR_EN: 'Enable from router', MID: 'Q2/Q3 junction', ROUTER_ALIVE: 'Heartbeat from router',
  '5V_EDU': 'Student rail', EDU_SENSE: 'Student-rail monitor', '12V_IN': '12 V input', '12V_F': '12 V after fuse', EDU_R: 'Between R_S and F_EDU',
  LED3_A: '3.3 V LED node', LED5_A: '5 V LED node',
};

// kind: header | fuse | diode | resistor | capacitor | led | pmos | nmos | module | ptc
// pins: [label, net, [row, col]]. mount: lying | standing | vertical (for the drawing and notes).
export const parts = [
  { ref: 'J_IN', kind: 'header', value: '1×2 header', role: '12 V input', mount: 'vertical',
    pins: [['12V', '12V_IN', [14, 2]], ['GND', 'GND', [13, 2]]] },
  { ref: 'F1', kind: 'fuse', value: '2 A slow fuse + holder', role: 'Input fuse', mount: 'horizontal on row 14',
    pins: [['1', '12V_IN', [14, 3]], ['2', '12V_F', [14, 12]]] },
  { ref: 'D1', kind: 'diode', value: '1N5822', role: 'Reverse-polarity diode', mount: 'vertical',
    pins: [['A', '12V_F', [14, 18]], ['K', '12V_SYS', [15, 18]]] },
  { ref: 'C1', kind: 'capacitor', value: '470 µF', polarized: true, role: '12 V bulk', mount: 'vertical',
    pins: [['+', '12V_SYS', [3, 16]], ['-', 'GND', [1, 16]]] },
  { ref: 'C2', kind: 'capacitor', value: '100 nF', role: '12 V bypass', mount: 'vertical',
    pins: [['1', '12V_SYS', [3, 13]], ['2', 'GND', [1, 13]]] },
  { ref: 'M_BUCK5', kind: 'module', value: '5 V buck module', role: '5 V supply', mount: 'flying leads',
    pins: [['IN+', '12V_SYS', [3, 8]], ['GND', 'GND', [1, 8]], ['OUT+', '5V_SYS', [4, 8]]] },
  { ref: 'M_BUCK3', kind: 'module', value: '3.3 V buck module', role: '3.3 V supply', mount: 'flying leads',
    pins: [['IN+', '12V_SYS', [3, 11]], ['GND', 'GND', [1, 11]], ['OUT+', '3V3_SYS', [2, 11]]] },
  { ref: 'R_LED3', kind: 'resistor', value: '1 kΩ', role: '3.3 V LED resistor', mount: 'lying on row 2',
    pins: [['1', '3V3_SYS', [2, 5]], ['2', 'LED3_A', [2, 2]]] },
  { ref: 'LED3', kind: 'led', value: 'red LED', role: '3.3 V present', mount: 'vertical',
    pins: [['A', 'LED3_A', [2, 3]], ['K', 'GND', [1, 3]]] },
  { ref: 'R_LED5', kind: 'resistor', value: '2.2 kΩ', role: '5 V LED resistor', mount: 'lying on row 4',
    pins: [['1', '5V_SYS', [4, 5]], ['2', 'LED5_A', [4, 2]]] },
  { ref: 'LED5', kind: 'led', value: 'red LED', role: '5 V present', mount: 'vertical',
    pins: [['A', 'LED5_A', [4, 1]], ['K', 'GND', [1, 1]]] },
  { ref: 'Q1', kind: 'pmos', value: 'NDP6020P', role: 'Student-rail switch', mount: 'vertical',
    pins: [['S', '5V_SYS', [4, 19]], ['D', 'EDU_SW', [5, 19]], ['G', 'GATE', [6, 19]]] },
  { ref: 'R_GP', kind: 'resistor', value: '100 kΩ', role: 'Gate pull-up (rail OFF by default)', mount: 'standing',
    pins: [['1', '5V_SYS', [4, 21]], ['2', 'GATE', [6, 21]]] },
  { ref: 'Q2', kind: 'nmos', value: '2N7000', role: 'AND: enable', mount: 'vertical',
    pins: [['S', 'MID', [8, 23]], ['G', 'EDU_PWR_EN', [7, 23]], ['D', 'GATE', [6, 23]]] },
  { ref: 'Q3', kind: 'nmos', value: '2N7000', role: 'AND: heartbeat', mount: 'vertical',
    pins: [['S', 'GND', [10, 25]], ['G', 'ROUTER_ALIVE', [9, 25]], ['D', 'MID', [8, 25]]] },
  { ref: 'R_PD_EN', kind: 'resistor', value: '100 kΩ', role: 'Enable pull-down', mount: 'lying',
    pins: [['1', 'EDU_PWR_EN', [7, 27]], ['2', 'GND', [10, 27]]] },
  { ref: 'R_S', kind: 'resistor', value: '470 Ω', role: 'Student-rail current limit', mount: 'lying',
    pins: [['1', 'EDU_SW', [5, 29]], ['2', 'EDU_R', [8, 29]]] },
  { ref: 'R_PD_RA', kind: 'resistor', value: '100 kΩ', role: 'Heartbeat pull-down', mount: 'standing',
    pins: [['1', 'ROUTER_ALIVE', [9, 31]], ['2', 'GND', [10, 31]]] },
  { ref: 'F_EDU', kind: 'ptc', value: 'MF-R050 PTC', role: 'Backup limit', mount: 'lying',
    pins: [['1', 'EDU_R', [8, 33]], ['2', '5V_EDU', [11, 33]]] },
  { ref: 'R_DT', kind: 'resistor', value: '47 kΩ', role: 'Monitor divider top', mount: 'standing',
    pins: [['1', '5V_EDU', [11, 35]], ['2', 'EDU_SENSE', [12, 35]]] },
  { ref: 'R_DB', kind: 'resistor', value: '47 kΩ', role: 'Monitor divider bottom', mount: 'standing',
    pins: [['1', 'EDU_SENSE', [12, 37]], ['2', 'GND', [13, 37]]] },
  { ref: 'C_SENSE', kind: 'capacitor', value: '100 nF', role: 'Monitor filter', mount: 'vertical',
    pins: [['1', 'EDU_SENSE', [12, 22]], ['2', 'GND', [10, 22]]] },
  // 12 interface pins down col 39; pins 5, 6 and 8 land on cut strips and stay unconnected. Pull those header pins out (keying).
  { ref: 'J_OUT', kind: 'header', value: '1×12 header (pins 5, 6, 8 pulled)', role: 'Power and control interface', mount: 'vertical',
    pins: [['1 GND', 'GND', [1, 39]], ['2 3V3_SYS', '3V3_SYS', [2, 39]], ['3 12V_SYS', '12V_SYS', [3, 39]], ['4 5V_SYS', '5V_SYS', [4, 39]],
      ['7 EDU_PWR_EN', 'EDU_PWR_EN', [7, 39]], ['9 ROUTER_ALIVE', 'ROUTER_ALIVE', [9, 39]], ['10 GND', 'GND', [10, 39]],
      ['11 5V_EDU', '5V_EDU', [11, 39]], ['12 EDU_SENSE', 'EDU_SENSE', [12, 39]]],
    unconnected: [[5, 39], [6, 39], [8, 39]] },
];
// Top-side link wires: insulated, ends soldered under the board.
export const links = [
  { id: 'L1', net: 'GND', from: [1, 6], to: [10, 6], why: 'joins the two ground strips' },
  { id: 'L2', net: 'GND', from: [13, 4], to: [10, 4], why: 'joins the input ground strip' },
  { id: 'L3', net: '12V_SYS', from: [15, 20], to: [3, 20], why: 'diode cathode to the 12 V system strip' },
];
// Net equivalences created by the strips: a net is the union of the listed strip names.
export const alias = { '12V_F': '12V_F' };
export const expectedNets = (() => {
  const m = new Map();
  for (const p of parts) for (const [, net, hole] of p.pins) {
    const n = net === '12V_F' ? '12V_F' : net;
    (m.get(n) ?? m.set(n, []).get(n)).push({ ref: p.ref, hole });
  }
  return m;
})();

// Manufacturer part numbers for the BOM and tscircuit checks. Headers and modules are intentionally absent:
// the purchased connectors and buck modules are not identified yet, so no number is claimed or drawn.
export const mpnFor = (p) => {
  const r = { '1 kΩ': '1K', '2.2 kΩ': '2K2', '100 kΩ': '100K', '470 Ω': '470R', '47 kΩ': '47K' };
  if (p.kind === 'resistor') return `MFR-25FBF52-${r[p.value]}`;
  return { D1: '1N5822', C1: 'EEU-FR1E471', C2: 'C315C104K5R5TA', C_SENSE: 'C315C104K5R5TA', Q1: 'NDP6020P', Q2: '2N7000', Q3: '2N7000',
    F1: '0218002.MXP', F_EDU: 'MF-R050', LED3: 'WP7113ID', LED5: 'WP7113ID' }[p.ref];
};
