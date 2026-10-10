// Shared helpers that make a tscircuit board look like a 100 x 100 mm perfboard.
// Rules: ../../../guidelines.md. Wire colours: ../../00-standards.md §3.
//
// Coordinates are holes, not millimetres: (i, j) with i = column 1..39 (left -> right)
// and j = row 1..39 (top -> bottom). Every part and wire sits on a hole.

export const P = 2.54
export const HOLES = 39 // 39 x 2.54 = 99.06 mm: a 100 x 100 mm perfboard
export const BOARD_MM = 100

export const hx = (i: number) => (i - 20) * P
export const hy = (j: number) => (20 - j) * P

export const WIRE = {
  v5: "#d32f2f", // red: 5 V
  v3v3: "#fb8c00", // orange: 3V3
  v12: "#6d4c41", // brown: 12 V
  gnd: "#212121", // black: GND
  node: "#1e88e5", // blue: node lines and buses
  digital: "#fdd835", // yellow: digital control
  analog: "#43a047", // green: analog / ADC
  i2c: "#9e9e9e", // white wire, drawn grey so it shows on the board
  bare: "#b0bec5", // bare tinned wire (node straps)
} as const

export type Hole = [number, number]
export const key = ([i, j]: Hole) => `${i},${j}`

/** A hand-soldered wire: straight segments from hole to hole, in the standard colour. */
export const Wire = ({ path, color }: { path: Hole[]; color: string }) => (
  <>
    {path.slice(1).map((to, k) => {
      const from = path[k]
      return (
        <pcbnoteline
          key={k}
          x1={hx(from[0])}
          y1={hy(from[1])}
          x2={hx(to[0])}
          y2={hy(to[1])}
          strokeWidth={0.7}
          color={color}
        />
      )
    })}
  </>
)

/** The empty holes of the perfboard (copper rings), except the ones parts use. */
export const PerfboardHoles = ({ used }: { used: Set<string> }) => (
  <>
    {Array.from({ length: HOLES * HOLES }, (_, n) => {
      const i = (n % HOLES) + 1
      const j = Math.floor(n / HOLES) + 1
      if (used.has(key([i, j]))) return null
      return (
        <platedhole
          key={n}
          pcbX={hx(i)}
          pcbY={hy(j)}
          shape="circle"
          holeDiameter="1mm"
          outerDiameter="1.4mm"
        />
      )
    })}
  </>
)

/** Text written on the drawing (not on the real board). */
export const Note = ({ at, text, size = 1.6, color = "#37474f" }: { at: [number, number]; text: string; size?: number; color?: string }) => (
  <pcbnotetext pcbX={hx(at[0])} pcbY={hy(at[1])} text={text} fontSize={size} color={color} anchorAlignment="center" />
)

/** Dashed line in mm-free hole coordinates; half holes allowed (e.g. a cut between two holes). */
export const Dashed = ({ from, to, color = "#e53935" }: { from: [number, number]; to: [number, number]; color?: string }) => (
  <pcbnoteline x1={hx(from[0])} y1={hy(from[1])} x2={hx(to[0])} y2={hy(to[1])} strokeWidth={0.4} color={color} isDashed />
)

/** IDC 2x5 box header, keyed. Odd pins on row j0, even pins on row j0 + 1, pin 1 at column i0. */
export const Idc2x5 = ({ name, i0, j0, schX, schY }: { name: string; i0: number; j0: number; schX?: number; schY?: number }) => {
  const cx = hx(i0 + 2)
  const cy = (hy(j0) + hy(j0 + 1)) / 2
  const pins = Array.from({ length: 10 }, (_, n) => n + 1)
  return (
    <>
      <chip
        name={name}
        pcbX={cx}
        pcbY={cy}
        schX={schX}
        schY={schY}
        pinLabels={Object.fromEntries(pins.map((p) => [`pin${p}`, `P${p}`]))}
        schPinArrangement={{
          leftSide: { direction: "top-to-bottom", pins: [1, 3, 5, 7, 9] },
          rightSide: { direction: "top-to-bottom", pins: [2, 4, 6, 8, 10] },
        }}
        footprint={
          <footprint>
            {pins.map((p) => {
              const k = Math.floor((p - 1) / 2)
              const even = p % 2 === 0
              return (
                <platedhole
                  key={p}
                  portHints={[`pin${p}`]}
                  pcbX={hx(i0 + k) - cx}
                  pcbY={(even ? hy(j0 + 1) : hy(j0)) - cy}
                  shape="circle"
                  holeDiameter="1mm"
                  outerDiameter="1.9mm"
                />
              )
            })}
          </footprint>
        }
      />
      <pcbnoterect pcbX={cx} pcbY={cy} width={5 * P + 3} height={2 * P + 3.5} color="#455a64" strokeWidth={0.3} />
      <pcbnotetext pcbX={hx(i0) - 2.2} pcbY={hy(j0)} text="1" fontSize={1.4} color="#455a64" anchorAlignment="center" />
    </>
  )
}

/** One bench node: a column of 6 pogo pins (strapped together by a bare wire). */
export const NodeColumn = ({ name, i, rows, schX, schY }: { name: string; i: number; rows: number[]; schX?: number; schY?: number }) => {
  const cy = (hy(rows[0]) + hy(rows[rows.length - 1])) / 2
  return (
    <chip
      name={name}
      pcbX={hx(i)}
      pcbY={cy}
      schX={schX}
      schY={schY}
      pinLabels={Object.fromEntries(rows.map((_, k) => [`pin${k + 1}`, `ROW${k + 1}`]))}
      schPinArrangement={{ rightSide: { direction: "top-to-bottom", pins: rows.map((_, k) => k + 1) } }}
      footprint={
        <footprint>
          {rows.map((j, k) => (
            <platedhole
              key={k}
              portHints={[`pin${k + 1}`]}
              pcbX={0}
              pcbY={hy(j) - cy}
              shape="circle"
              holeDiameter="1mm"
              outerDiameter="2.2mm"
            />
          ))}
        </footprint>
      }
    />
  )
}
