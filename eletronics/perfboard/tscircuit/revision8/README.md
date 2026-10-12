# Revision 8 — simplification discussion

**Discussion workspace / visualization proposal.** This folder records proposed simplifications raised while reviewing revision 7. The contact-board files are an early preview to support the discussion, not a checked, buildable or soldering-ready design. Revision 7 remains the current generated candidate until revision 8 is deliberately implemented and checked.

## Proposed changes

### 1. Right-size the NODE-to-matrix connectors

Revision 7 has three 2×5 `J_NODE` connectors on each contact board, grouped by position, but uses only four, four and three signal pins. The contact-b board carries 11 distinct NODE signals: four from B1, four from B2 and three from B3. The revision8 proposal uses **three 4-pin NODE connectors per board**, with pins 1–4 carrying each group's adjacent NODE signals; the third connector uses only three pins. The SMART connectors remain separate.

This retains the three grouped cables while reducing unused connector positions from 19 to one. It does not reduce the number of distinct signal conductors: every NODE track must remain electrically independent so the matrix can select and test it separately.

The current preview maps each four-pin connector to its contact group's NODE signals. The connectors sit below their groups at row 36 on both boards; pin columns are 13–16, 41–44 and 65–68. Contact B now uses the same contact-row orientation and connector positions as Contact A, with its NODE identities preserved. The three SMART signal connectors are compact 1×5 headers in row 8, at columns 9–13, 37–41 and 65–69. Pins 1/3/5 carry the group's NODE signals in order; pin 2 carries that position's SCL and pin 4 its SDA. This interleaves the three NODE routes with the two service leads. Repeated GND and 3V3 pins are removed from these connectors. One shared 1×2 GND/3V3 connector per board sits at columns 34–35, row 2, above the SMART signal headers. It feeds the existing service rails; the smart-component power cable branches off-board to all three components. Contact A's layout was shifted down one row; Contact B is aligned to the same row pattern. This changes the SMART cable arrangement; connector family, cable, keying, physical fit and receiving-board changes remain open.

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

The top and mirrored underside SVGs show the perfboard layout and wiring paths. A third guide beneath them lists every component, pin assignment and grid position, then explains the insulated wire runs and summarizes each six-contact column strap as one physical continuous run. Underside wires snap to unoccupied grid holes; the route builder reserves component pins and gold contact buses and avoids sharing a hole along different-net routes. If routing requires a crossover, only shared GND/3V3 wires may cross other nets; those insulated crossings are marked with a bridge. NODE, SDA and SCL wires remain crossing-free. Red is reserved for power and black for ground. Signal wires use blue, white, yellow and green; white wires have a dark outline for visibility. Each SMART signal lead branches from the top pogo of its NODE contact bus; the NODE cable lead leaves from the bottom pogo. The shared GND/3V3 connector also feeds the existing service-rail chain. Power fanout from that connector to the three smart components is an off-board harness and is not shown as three board wire runs. Gold contact-column lines are a visual stand-in for soldered bare conductor, not fabricated board copper. Connector fit, routing clearances and physical wire lengths remain unmeasured.

## Preferred way to describe contact-board wiring effort

Count physical continuous wire runs for the hand-soldering estimate, rather than treating every generated pin-to-pin connection as a separate wire piece. For the NODE-only portion, the user's current mental model is approximately:

- 11 continuous contact-column bus wires per contact board, one per NODE track, soldered to that track's six pogo contacts; and
- 11 lead wires from those 11 NODE tracks to the three grouped NODE connectors.

That is about 22 physical wire runs per board for this portion, before counting branches to SMART connectors and other support wiring. State solder joints separately where useful: a continuous bus still needs a joint at each pogo contact. Keep generated connection-segment counts and computed route-length totals available as model metrics, but do not present them as the number of physical wire pieces or as a direct hand-soldering workload estimate.
