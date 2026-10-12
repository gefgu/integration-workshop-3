# Revision 8 — simplification discussion

**Discussion workspace / visualization proposal.** This folder records proposed simplifications raised while reviewing revision 7. The contact-board files are an early preview to support the discussion, not a checked, buildable or soldering-ready design. Revision 7 remains the current generated candidate until revision 8 is deliberately implemented and checked.

## Proposed changes

### 1. Consolidate the NODE-to-matrix connectors

Revision 7 has three `J_NODE` connectors on each contact board, grouped by position. The contact-b board carries 11 distinct NODE signals: four from B1, four from B2 and three from B3. The proposed change is to replace those three position-grouped connectors with **one 11-contact NODE connector per contact board**, with contacts numbered 1–11 in NODE order. The SMART connectors are outside this change and remain separate.

This reduces the number of NODE plugs and cable ends. It does not reduce the number of distinct signal conductors: every NODE track must remain electrically independent so the matrix can select and test it separately.

The current discussion preview maps connector pins 1–11 directly to the 11 NODE signals; it has no spare contact. Connector family, cable, keying, physical fit and receiving-board changes are open decisions; no part is selected here.

## Constraints for the discussion

- Preserve all 11 individual NODE nets per contact board; do not join different tracks.
- Keep six pogo contacts for each NODE track electrically common to that track, as in the current design.
- Treat the cable, router/matrix endpoint and installation instructions as part of the interface change.
- Keep revision 5, revision 6 and revision 7 files unchanged.
- Do not treat this proposal or generated drawings as measured fit or hardware verification.

## Later items

Add simplification proposals here as they come up in discussion. Resolve the interface and scope before treating a preview as an implemented design or creating release documents.

## Contact-board preview

The current preview implements one 11-contact NODE connector per contact board, with pins 1–11 mapped to the 11 independent NODE signals. Each SMART connector is moved beside its position's contact group; its wiring remains separate from the NODE bundle. The 6 pogo contacts on each NODE column are drawn as one continuous copper/solder line for visual wire-run planning, while the underlying connectivity still lists the six contact joints individually.

- [Contact board previews and views](contact-boards.html)
- [Revision8 contact model](design/revision8.mjs)
- [Preview generator](build-contact-boards.tsx)

Regenerate the contact preview from the tscircuit directory with `npm exec -- bun revision8/build-contact-boards.tsx`.

The top and mirrored underside SVGs show the perfboard layout and wiring paths. Underside insulated wires use red, black, blue, white, yellow and green; NODE pins 1–11 repeat that color sequence. GND is black, 3V3 is red, and the SMART I2C leads use blue and white. White wires have a dark outline for visibility. Gold contact-column lines are a visual stand-in for soldered bare conductor, not fabricated board copper. Connector fit, routing clearances and physical wire lengths remain unmeasured.

## Preferred way to describe contact-board wiring effort

Count physical continuous wire runs for the hand-soldering estimate, rather than treating every generated pin-to-pin connection as a separate wire piece. For the NODE-only portion, the user's current mental model is approximately:

- 11 continuous contact-column bus wires per contact board, one per NODE track, soldered to that track's six pogo contacts; and
- 11 lead wires from those 11 NODE tracks to the consolidated NODE connector.

That is about 22 physical wire runs per board for this portion, before counting branches to SMART connectors and other support wiring. State solder joints separately where useful: a continuous bus still needs a joint at each pogo contact. Keep generated connection-segment counts and computed route-length totals available as model metrics, but do not present them as the number of physical wire pieces or as a direct hand-soldering workload estimate.
