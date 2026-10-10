// CP00 "first light": one 100 x 100 mm perfboard, cut in two before soldering:
//   holes 1-28  -> module A1: 4 bench columns of pogo pins, strapped like breadboard columns,
//                  plus the node header J_NODE (all final parts of module A1)
//   holes 29-39 -> ESP32 carrier: one ESP32 DevKitC (38-pin), a 150 ohm resistor and the
//                  2-pin BAT header that powers the fixed battery position.
// The two pieces are joined only by 2 Dupont jumpers (BAT+ -> J_NODE pin 1, BAT- -> pin 3).
// See ../cp00-first-light.md and ../../guidelines.md.
import { Dashed, Hole, Idc2x5, Note, NodeColumn, PerfboardHoles, WIRE, Wire, hx, hy, key } from "./lib/perfboard"

const NODE_COLS = [4, 11, 18, 25] // bench columns 1-4, 7 holes (17.78 mm) apart
const NODE_ROWS = [9, 13, 17, 21, 25, 29] // bench rows 1-6, 4 holes (10.16 mm) apart

// ESP32 DevKitC 38-pin, USB end at the bottom. Left header = J2, right header = J3.
const ESP_LEFT = ["3V3", "EN", "IO36", "IO39", "IO34", "IO35", "IO32", "IO33", "IO25", "IO26", "IO27", "IO14", "IO12", "GND_L", "IO13", "SD2", "SD3", "CMD", "V5"]
const ESP_RIGHT = ["GND_R1", "IO23", "IO22", "TX0", "RX0", "IO21", "GND_R2", "IO19", "IO18", "IO5", "IO17", "IO16", "IO4", "IO0", "IO2", "IO15", "SD1", "SD0", "CLK"]
const ESP_I = [29, 39] // header columns, 10 holes = 25.4 mm apart (measure your board!)
const ESP_J0 = 10 // first pin row
const espHole = (side: 0 | 1, n: number): Hole => [ESP_I[side], ESP_J0 + n]
const ESP_CX = (hx(ESP_I[0]) + hx(ESP_I[1])) / 2
const ESP_CY = (hy(ESP_J0) + hy(ESP_J0 + 18)) / 2

const IO32 = espHole(0, 6)
const GND = espHole(1, 6) // right-header GND (pin 7 of J3)

// Strip parts
const R_TOP: Hole = [31, 33]
const R_BOT: Hole = [31, 37]
const BAT_P: Hole = [33, 37]
const BAT_N: Hole = [34, 37]

// Module A1 node header (IDC 2x5): odd pins row 34, even pins row 35, pin 1 at column 12
const J_NODE = { i0: 12, j0: 34 }
const nodePin = (p: number): Hole => [J_NODE.i0 + Math.floor((p - 1) / 2), p % 2 ? J_NODE.j0 : J_NODE.j0 + 1]

const used = new Set<string>([
  ...NODE_COLS.flatMap((i) => NODE_ROWS.map((j) => key([i, j]))),
  ...Array.from({ length: 10 }, (_, n) => key(nodePin(n + 1))),
  ...Array.from({ length: 19 }, (_, n) => [key(espHole(0, n)), key(espHole(1, n))]).flat(),
  key(R_TOP),
  key(R_BOT),
  key(BAT_P),
  key(BAT_N),
])

export default () => (
  <board
    width="100mm"
    height="100mm"
    routingDisabled
    schTraceAutoLabelEnabled={false}
    schMaxTraceDistance={1000}
    solderMaskColor="#c9a25e"
    silkscreenColor="white"
  >
    <PerfboardHoles used={used} />

    {/* ---------- module A1 (holes 1-28) ---------- */}
    {NODE_COLS.map((i, c) => (
      <NodeColumn key={c} name={`N0${c}`} i={i} rows={NODE_ROWS} schX={-10} schY={7 - c * 4.5} />
    ))}
    {/* straps: each column of 6 pogo pins is one node, like a breadboard column */}
    {["N00", "N01", "N02", "N03"].map((n) =>
      [1, 2, 3, 4, 5].map((k) => <trace key={`${n}${k}`} from={`.${n} > .pin${k}`} to={`.${n} > .pin${k + 1}`} schStroke={WIRE.bare} />),
    )}
    {NODE_COLS.map((i, c) => (
      <Wire key={c} color={WIRE.bare} path={[[i, NODE_ROWS[0]], [i, NODE_ROWS[5]]]} />
    ))}

    <Idc2x5 name="J_NODE" i0={J_NODE.i0} j0={J_NODE.j0} schX={-3} schY={1} />
    <trace from=".N00 > .pin6" to=".J_NODE > .pin1" schStroke={WIRE.node} />
    <trace from=".N01 > .pin6" to=".J_NODE > .pin3" schStroke={WIRE.node} />
    <trace from=".N02 > .pin6" to=".J_NODE > .pin5" schStroke={WIRE.node} />
    <trace from=".N03 > .pin6" to=".J_NODE > .pin7" schStroke={WIRE.node} />
    <Wire color={WIRE.node} path={[[4, 29], [4, 33], [12, 33], nodePin(1)]} />
    <Wire color={WIRE.node} path={[[11, 29], [11, 31], [13, 31], nodePin(3)]} />
    <Wire color={WIRE.node} path={[[18, 29], [18, 31], [14, 31], nodePin(5)]} />
    <Wire color={WIRE.node} path={[[25, 29], [25, 33], [15, 33], nodePin(7)]} />

    {/* ---------- ESP32 carrier (holes 29-39) ---------- */}
    <chip
      name="ESP32"
      pcbX={ESP_CX}
      pcbY={ESP_CY}
      schX={12}
      schY={0}
      pinLabels={Object.fromEntries([
        ...ESP_LEFT.map((l, n) => [`pin${n + 1}`, l]),
        ...ESP_RIGHT.map((l, n) => [`pin${n + 20}`, l]),
      ])}
      footprint={
        <footprint>
          {Array.from({ length: 38 }, (_, n) => {
            const [i, j] = n < 19 ? espHole(0, n) : espHole(1, n - 19)
            return (
              <platedhole
                key={n}
                portHints={[`pin${n + 1}`]}
                pcbX={hx(i) - ESP_CX}
                pcbY={hy(j) - ESP_CY}
                shape="circle"
                holeDiameter="1mm"
                outerDiameter="1.9mm"
              />
            )
          })}
        </footprint>
      }
    />
    <pcbnoterect pcbX={ESP_CX} pcbY={ESP_CY} width={28} height={55} color="#1565c0" strokeWidth={0.3} />

    <resistor
      name="R_BAT"
      resistance="150"
      footprint="axial_p0.4in"
      pcbX={hx(R_TOP[0])}
      pcbY={(hy(R_TOP[1]) + hy(R_BOT[1])) / 2}
      pcbRotation={90}
      schX={6}
      schY={-1}
      schRotation={90}
    />
    <pinheader name="J_BAT" pinCount={2} pitch="2.54mm" gender="male" pcbX={(hx(BAT_P[0]) + hx(BAT_N[0])) / 2} pcbY={hy(BAT_P[1])} schX={6} schY={-5} />

    <trace from=".ESP32 > .IO32" to=".R_BAT > .pin1" schStroke={WIRE.v5} />
    <trace from=".R_BAT > .pin2" to=".J_BAT > .pin1" schStroke={WIRE.v5} />
    <trace from=".ESP32 > .GND_R2" to=".J_BAT > .pin2" schStroke={WIRE.gnd} />
    <Wire color={WIRE.v5} path={[IO32, [30, IO32[1]], [30, R_TOP[1]], R_TOP]} />
    <Wire color={WIRE.v5} path={[R_BOT, BAT_P]} />
    <Wire color={WIRE.gnd} path={[GND, [38, GND[1]], [38, 35], [BAT_N[0], 35], BAT_N]} />

    {/* ---------- between the two pieces: 2 Dupont jumpers (labels, not soldered) ---------- */}
    <trace from=".J_BAT > .pin1" to=".J_NODE > .pin1" schDisplayLabel="BAT+ (jumper)" />
    <trace from=".J_BAT > .pin2" to=".J_NODE > .pin3" schDisplayLabel="BAT- (jumper)" />
    <Dashed from={BAT_P} to={nodePin(1)} color={WIRE.v5} />
    <Dashed from={BAT_N} to={nodePin(3)} color={WIRE.gnd} />

    {/* ---------- drawing notes ---------- */}
    <Dashed from={[28.5, 0.5]} to={[28.5, 39.5]} />
    <Dashed from={[0.5, 0.5]} to={[0.5, 39.5]} />
    <Note at={[28.5, 0.9]} text="CUT" color="#e53935" />
    <Note at={[14.5, 1.5]} text="MODULE A1 (bench columns 1-4, bank A)" />
    <Note at={[34, 1.5]} text="ESP32 CARRIER" />
    {["C1", "C2", "C3", "C4"].map((t, c) => (
      <Note key={t} at={[NODE_COLS[c], 7]} text={t} />
    ))}
    <Note at={[34, 39]} text="USB" />
    <Note at={[33.5, 38.4]} text="+  -" size={1.2} />
    <pcbnoterect pcbX={hx(11.5)} pcbY={hy(3)} width={12} height={4} color="#9e9e9e" strokeWidth={0.2} isStrokeDashed />
    <Note at={[11.5, 4.6]} text="CP01: service pogo pins" size={1.2} color="#757575" />
    <pcbnoterect pcbX={hx(22)} pcbY={hy(36.5)} width={16} height={8} color="#9e9e9e" strokeWidth={0.2} isStrokeDashed />
    <Note at={[22, 39]} text="CP01: resistors + J_SMART" size={1.2} color="#757575" />
  </board>
)
