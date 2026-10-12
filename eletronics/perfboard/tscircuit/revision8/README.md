# Revision 8 — simplification discussion

**Independent engineering candidate; not released for soldering.** Revision8 now contains the contact-board simplifications and the software-checked power/router-matrix redesign. Revision7 remains the historical baseline. Generated checks do not establish purchased-part fit or powered behavior.

## Complete system electrical schematic

Open [overall-schematic.html](overall-schematic.html) or [overall-schematic.pdf](overall-schematic.pdf). The 16-sheet A2 landscape package covers the four-section system overview, both contact banks, the complete power and router/matrix circuits, smart controller/safety, both measurement banks and all six smart positions. This is an electrical drawing package; it does not regenerate perfboard placement.

Run `npm run build:revision8:schematic` from the tscircuit directory. The build reads the saved revision8 electrical model and the latest earlier EasyEDA smart export, renders native tscircuit circuitry, runs source/pin/netlist/schematic checks and compiles vector sheets with Typst. Bun and Typst must be installed.

The viewer also links the [net and sheet index](schematic/net-index.csv) and [physical pin/reference crosswalk](schematic/reference-crosswalk.json). SCL1–SCL6 and SDA1–SDA6 are drawing aliases for the six position-specific service buses; the controller-side SCL remains shared.

Read [schematic/reconciliation.md](schematic/reconciliation.md), [schematic/interface-changes.json](schematic/interface-changes.json) and [schematic/checks.json](schematic/checks.json). Grouped NODE cables are drawn directly from contacts to matrix receivers; shared contact power and smart-controller power have explicit branches. These documentation corrections preserve the complete source electrical partition. The schematic reference crosswalk retains original board references and physical pin functions. The older EasyEDA output/measurement circuitry is reconciled to the later protected smart circuit, rather than reintroducing its earlier limitations.

Generated checks establish circuit consistency; hardware qualification remains pending.

## Proposed changes

### 1. Right-size the NODE-to-matrix connectors

Revision 7 has three 2×5 `J_NODE` connectors on each contact board, grouped by position, but uses only four, four and three signal pins. The contact-b board carries 11 distinct NODE signals: four from B1, four from B2 and three from B3. The revision8 proposal uses **three 4-pin NODE connectors per board**, with pins 1–4 carrying each group's adjacent NODE signals; the third connector uses only three pins. The SMART connectors remain separate.

This retains the three grouped cables while reducing unused connector positions from 19 to one. It does not reduce the number of distinct signal conductors: every NODE track must remain electrically independent so the matrix can select and test it separately.

The current preview maps each four-pin connector to its contact group's NODE signals. The connectors sit below their groups at row 36 on both boards; pin columns are 13–16, 41–44 and 65–68. Contact B now uses the same contact-row orientation and connector positions as Contact A, with its NODE identities preserved. The three SMART signal connectors are compact 1×5 headers in row 8, at columns 9–13, 37–41 and 65–69. Pins 1/3/5 carry the group's NODE signals in order; pin 2 carries that position's SCL and pin 4 its SDA. This interleaves the three NODE routes with the two service leads. Repeated GND and 3V3 pins are removed from these connectors. One shared 1×2 GND/3V3 connector per board sits at columns 34–35, row 2, above the SMART signal headers. Its 3V3 pin branches directly to each position's service 3V3 contact rather than daisy-chaining through those contacts; the smart-component power cable branches off-board to all three components. Contact A's layout was shifted down one row; Contact B is aligned to the same row pattern. This changes the SMART cable arrangement; connector family, cable, keying, physical fit and receiving-board changes remain open.

## Constraints for the discussion

- Preserve all 11 individual NODE nets per contact board; do not join different tracks.
- Keep six pogo contacts for each NODE track electrically common to that track, as in the current design.
- Treat the cable, router/matrix endpoint and installation instructions as part of the interface change.
- Keep revision 5, revision 6 and revision 7 files unchanged.
- Do not treat this proposal or generated drawings as measured fit or hardware verification.

## Later items

Add simplification proposals here as they come up in discussion. Resolve the interface and scope before treating a preview as an implemented design or creating release documents.

## Contact-board preview

The current preview implements three 4-pin NODE connectors per contact board, grouped by adjacent NODE signals (4, 4 and 3), three 1×5 SMART signal connectors, and one shared 1×2 GND/3V3 connector. SMART signal pins carry three NODE signals, local SDA and local SCL; GND and 3V3 are distributed through the shared power connection. The 6 pogo contacts on each NODE column are drawn as one continuous copper/solder line for visual wire-run planning, while the underlying connectivity still lists the six contact joints individually.

- [Contact board previews and views](contact-boards.html)
- [Revision8 contact model](design/revision8.mjs)
- [Preview generator](build-contact-boards.tsx)

Regenerate the contact preview from the tscircuit directory with `npm exec -- bun revision8/build-contact-boards.tsx`.

The top and mirrored underside SVGs show the perfboard layout and wiring paths. Two additional SVGs beneath them keep the explanation concise: component labels use short role names, and the wire guide labels each net with its short name (for example, GND, 3V3, SCL 0 and NODE1). Underside wires snap to unoccupied grid holes; the route builder reserves component pins and gold contact buses and avoids sharing a hole along different-net routes. If routing requires a crossover, only shared GND/3V3 wires may cross other nets; those insulated crossings are marked with a bridge. NODE, SDA and SCL wires remain crossing-free. Red is reserved for power and black for ground. Signal wires use blue, white, yellow and green; white wires have a dark outline for visibility. Each SMART signal lead branches from the top pogo of its NODE contact bus; the NODE cable lead leaves from the bottom pogo. The shared GND/3V3 connector feeds every service 3V3 contact directly. Power fanout from that connector to the three smart components is an off-board harness and is not shown as three board wire runs. Gold contact-column lines are a visual stand-in for soldered bare conductor, not fabricated board copper. Connector fit, routing clearances and physical wire lengths remain unmeasured.

## Preferred way to describe contact-board wiring effort

Count physical continuous wire runs for the hand-soldering estimate, rather than treating every generated pin-to-pin connection as a separate wire piece. For the NODE-only portion, the user's current mental model is approximately:

- 11 continuous contact-column bus wires per contact board, one per NODE track, soldered to that track's six pogo contacts; and
- 11 lead wires from those 11 NODE tracks to the three grouped NODE connectors.

That is about 22 physical wire runs per board for this portion, before counting branches to SMART connectors and other support wiring. State solder joints separately where useful: a continuous bus still needs a joint at each pogo contact. Keep generated connection-segment counts and computed route-length totals available as model metrics, but do not present them as the number of physical wire pieces or as a direct hand-soldering workload estimate.

## Simplified power and router-matrix boards

Open [power-schematic.html](power-schematic.html) for the complete power-only electrical sheet, arranged from input to protected outputs with control circuitry below. Supply rails use continuous wires; ground uses symbols and external connections use labels. Wires are red for power, black for ground, green for analog sensing and yellow for control. Native tscircuit routing remains responsible for wire geometry; nearby endpoint connections reduce long runs, but the full sheet can still contain crossings.

Open [power-matrix.html](power-matrix.html) for top, mirrored underside, component labels, wire labels, individual net selection and electrical schematics. All lower-board drawings now come from revision8’s own model. [simplification.md](simplification.md) explains the changes, guard calculations, wiring comparison and retained parts. [firmware.md](firmware.md) specifies button debounce and the changed passive interfaces.

Run `npm run build:revision8` from the tscircuit directory to regenerate and check both contact previews and the lower boards. The generator writes models, native checks, BOM, pin/wire/harness tables and the before/after assessment under `lower/`. Read `lower/checks.json`, `lower/copper-checks.json` and `lower/assessment.json` together; physical and bench acceptance remain pending.

The lower boards have 71 passives versus 81 in revision7, plus one fewer logic IC. The power wired-OR supervisor uses MCP120 with its external pull-up; router MCP130 retains its external pull-up. Consumer rails and power safety-control paths are permanently wired; router enable, reset and matrix strobe bring-up jumpers are also replaced by permanent paths. The keyed 10-pin power/control cable and six 4-pin NODE receivers have explicit endpoint mappings.

Contact connector geometry remains the preview arrangement. Installation phases now match each original NODE group; the shared power connector arrives with the first service group and feeds the first service contact so early checkpoints do not depend on a later position.


The power-board `J_PROBE` header was removed at the user's choice: the buck outputs can be measured at the converter connectors, while enable/fault control signals have no dedicated indicators and do not need a permanent probe header. The router-matrix probe header is unchanged.
