// CP01: node module A1 (bank A, columns 1-4) — see ../cp01-module-a1.md
// Perfboard grid: 2.54 mm. Board = 28 x 38 holes. Origin = board centre, +y = away from
// the centre channel (toward the service contacts).

const P = 2.54
// hole (i, j), 1-based: i = column of holes (1..28), j = row of holes (1..38, top = 1)
const hx = (i: number) => (i - 14.5) * P
const hy = (j: number) => (19.5 - j) * P

const NODE_HOLE_COLS = [4, 11, 18, 25] // bench columns 1-4 (17.78 mm = 7 holes apart)
const NODE_HOLE_ROWS = [9, 13, 17, 21, 25, 29] // bench rows 1-6 (10.16 mm = 4 holes apart)
const SERVICE_HOLE_ROW = 3 // 15.24 mm (6 holes) outside row 1
const SERVICE_HOLE_COLS = [10, 11, 12, 13] // middle column of position 0 (bench column 2)
const ROW_CENTER_Y = (hy(NODE_HOLE_ROWS[0]) + hy(NODE_HOLE_ROWS[5])) / 2

const POGO = { holeDiameter: "1mm", outerDiameter: "2mm" } // placeholder until the pogo size is known

// One bench column = one node = 6 pogo pins strapped together
const NodeColumn = ({ name, col, schY }: { name: string; col: number; schY: number }) => (
  <chip
    name={name}
    pcbX={hx(col)}
    pcbY={ROW_CENTER_Y}
    schX={-5}
    schY={schY}
    pinLabels={{ pin1: "R1", pin2: "R2", pin3: "R3", pin4: "R4", pin5: "R5", pin6: "R6" }}
    footprint={
      <footprint>
        {NODE_HOLE_ROWS.map((j, k) => (
          <platedhole
            key={k}
            portHints={[`pin${k + 1}`]}
            pcbX={0}
            pcbY={hy(j) - ROW_CENTER_Y}
            shape="circle"
            {...POGO}
          />
        ))}
      </footprint>
    }
  />
)

const SERVICE_CENTER_X = (hx(SERVICE_HOLE_COLS[0]) + hx(SERVICE_HOLE_COLS[3])) / 2

export default () => (
  <board width={`${28 * P}mm`} height={`${38 * P}mm`}>
    {/* 4 nodes: NODE00..NODE03 */}
    <NodeColumn name="N00" col={NODE_HOLE_COLS[0]} schY={4.5} />
    <NodeColumn name="N01" col={NODE_HOLE_COLS[1]} schY={2} />
    <NodeColumn name="N02" col={NODE_HOLE_COLS[2]} schY={-0.5} />
    <NodeColumn name="N03" col={NODE_HOLE_COLS[3]} schY={-3} />

    {/* straps: bare wire joining the 6 pins of each node (module back side) */}
    {["N00", "N01", "N02", "N03"].map((n) =>
      [1, 2, 3, 4, 5].map((k) => (
        <trace key={`${n}-${k}`} from={`.${n} > .pin${k}`} to={`.${n} > .pin${k + 1}`} />
      )),
    )}

    {/* capsule service contacts (4 pogo pins): same order as the PCBv2 SC header */}
    <chip
      name="SVC0"
      pcbX={SERVICE_CENTER_X}
      pcbY={hy(SERVICE_HOLE_ROW)}
      schX={-1}
      schY={-5.5}
      pinLabels={{ pin1: "SCL", pin2: "SDA", pin3: "GND", pin4: "V3V3" }}
      footprint={
        <footprint>
          {SERVICE_HOLE_COLS.map((i, k) => (
            <platedhole
              key={k}
              portHints={[`pin${k + 1}`]}
              pcbX={hx(i) - SERVICE_CENTER_X}
              pcbY={0}
              shape="circle"
              {...POGO}
            />
          ))}
        </footprint>
      }
    />

    {/* smart-position front-end, close to the nodes (underside) */}
    <resistor name="R_P1" resistance="10k" footprint="axial_p0.4in" pcbX={hx(6)} pcbY={hy(32)} schX={0} schY={4.5} />
    <resistor name="R_P2" resistance="10k" footprint="axial_p0.4in" pcbX={hx(13)} pcbY={hy(32)} schX={0} schY={2} />
    <resistor name="R_P3" resistance="470" footprint="axial_p0.4in" pcbX={hx(20)} pcbY={hy(32)} schX={0} schY={-0.5} />

    {/* cable headers (IDC 2x5), toward the centre channel */}
    <pinheader name="J_NODE" pinCount={10} doubleRow pitch="2.54mm" gender="male" pcbX={hx(8)} pcbY={hy(36)} schX={5} schY={-3} />
    <pinheader name="J_SMART" pinCount={10} doubleRow pitch="2.54mm" gender="male" pcbX={hx(21)} pcbY={hy(36)} schX={5} schY={2.5} />

    {/* node cable: odd pins = nodes, even pins unused */}
    <trace from=".N00 > .pin6" to=".J_NODE > .pin1" />
    <trace from=".N01 > .pin6" to=".J_NODE > .pin3" />
    <trace from=".N02 > .pin6" to=".J_NODE > .pin5" />
    <trace from=".N03 > .pin6" to=".J_NODE > .pin7" />

    {/* smart cable */}
    <trace from=".N00 > .pin6" to=".R_P1 > .pin1" />
    <trace from=".R_P1 > .pin2" to=".J_SMART > .pin1" />
    <trace from=".N01 > .pin6" to=".R_P2 > .pin1" />
    <trace from=".R_P2 > .pin2" to=".J_SMART > .pin3" />
    <trace from=".N02 > .pin6" to=".R_P3 > .pin1" />
    <trace from=".R_P3 > .pin2" to=".J_SMART > .pin5" />
    <trace from=".SVC0 > .pin3" to=".J_SMART > .pin2" />
    <trace from=".J_SMART > .pin2" to=".J_SMART > .pin4" />
    <trace from=".J_SMART > .pin4" to=".J_SMART > .pin6" />
    <trace from=".SVC0 > .pin2" to=".J_SMART > .pin7" />
    <trace from=".SVC0 > .pin4" to=".J_SMART > .pin8" />
    <trace from=".SVC0 > .pin1" to=".J_SMART > .pin9" />
  </board>
)
