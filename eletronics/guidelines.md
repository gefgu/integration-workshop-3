# Electronics guidelines

Rules for every hand-built board and every drawing in `eletronics/`. The perfboard plan
(`perfboard/README.md`) and its standards (`perfboard/00-standards.md`) build on these.

## 1. Boards
- **The default board is a 100 × 100 mm perfboard**: 39 × 39 holes at 2.54 mm. Use it
  unless a checkpoint says otherwise.
- **Cut before soldering, never after.** If a board must be smaller (a node module has to
  be ≤ 71.1 mm wide so its neighbour fits), the drawing shows the cut line in red. Cut
  first, sand the edge, then solder.
- **Off-cuts are reused** (e.g. the 11-hole strip next to module A1 becomes the ESP32
  carrier), so each 100 × 100 mm board is used completely.

## 2. No rework
- A board that passed its tests is never re-soldered. Later checkpoints only **add**
  parts in free holes, plug in chips and cables, or change firmware.
- Areas reserved for a later checkpoint are drawn as **grey dashed boxes**. Keep those
  holes free.
- Connections that will change later are made with **Dupont jumpers or plug-in cables**,
  never soldered wires.

## 3. Schematics
- **Draw every connection inside one perfboard as a line (wire).** No net labels or net
  ports inside a board.
- **Labels only for connections between perfboards**: Dupont jumpers and ribbon cables.
  Name them after the signal and the link, e.g. `BAT+ (jumper)`.
- Schematic wires use the same colours as the real wires (below).

## 4. Board drawings (the "PCB" view)
The PCB view must look like the real perfboard, so it can be copied hole by hole:
- **Every hole is shown**, in its real position on the 2.54 mm grid.
- **Every wire is drawn hole to hole** in straight horizontal and vertical segments, in
  its real colour. Avoid crossings; when two wires must cross, one goes on the other side
  of the board.
- **Jumpers and cables between boards are dashed lines**, in the colour of the signal.
- Cut lines are red and dashed. Notes and labels are drawing-only text.
- No copper autorouting: the board has `routingDisabled`, and wires are drawn with the
  `Wire` helper in `perfboard/tscircuit/lib/perfboard.tsx`.

## 5. Wire colours
| Colour | Signal |
|---|---|
| Red | 5 V supply / battery + |
| Orange | 3V3 |
| Brown | 12 V |
| Black | GND / battery − |
| Blue | Node lines and buses |
| Yellow | Digital control |
| Green | Analog (ADC) |
| White (drawn grey) | I²C |
| Bare tinned (drawn light grey) | Straps joining the pogo pins of one node |

## 6. Before soldering
1. Draw the checkpoint (tscircuit or Fritzing) following these rules.
2. Check the netlist against the checkpoint's wiring table (Claude can diff it).
3. Solder, then run the checkpoint's tests before moving on.
