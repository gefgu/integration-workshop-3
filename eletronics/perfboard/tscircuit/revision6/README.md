# Four-perfboard hybrid evaluation

**Candidate, not released for soldering.** Four permanent 10×20 cm isolated-pad boards: CONTACT_A, CONTACT_B, POWER and ROUTER_MATRIX. Smart electronics move to custom PCBs; the inherited twelve smart layouts are electrical contracts, not twelve proposed PCBs. The lower-board count is fixed at two. Both mount on a removable tray.

Start with [assessment.pdf](assessment.pdf), then [checkpoint-guide.pdf](checkpoint-guide.pdf), [schematics-and-placement.pdf](schematics-and-placement.pdf), [checkpoint-wiring.pdf](checkpoint-wiring.pdf) and [scale-templates.pdf](scale-templates.pdf). The first two PDFs are A4 landscape; detailed drawings/wiring and actual-size templates use A3 landscape. Actual-size printing requires 100% scaling and checking the 100 mm calibration line.

## Results and limits

- All 457 functional components and their installation phases are retained; 1,659 original connected functional pins are compared against their original net identities.
- Four permanent boards retain 167 functional components, nine SMD adapters and 580 local wire segments. The comparable R5 retained groups used 15 boards and 597 wires. Estimated permanent board solder operations: 2,023, excluding harness ends, sockets, adapters and carrier preparation.
- The boundary model has 210 harness conductors / 420 ends versus R5's 279 / 558. Smart reference seams remain in this model, so this is not the final PCB harness count.
- Node spacing remains 17.78 mm × 10.16 mm; each bank's column span is 177.80 mm. Both capsule orientations and service polarity are retained. The assumed 78×38 stock grid remains unmeasured.
- Provisional footprint geometry fits the four boards. Real component/module envelopes, tray height, extraction, analogue wire effects and soldering access remain pending. `wire-congestion.csv` reports crossings and lengths; no hand-wire clearance is inferred from copper checks.
- The complete inherited one-position support circuitry fails the 7×10 cm prototype packing. A reduced ESP32/direct precision-voltage fixture fits provisionally. Continuity stimulus is a separate removable fixture; late output/current work requires an external temporary fixture or final smart PCB. The reduced fixture omits the bank mux and service isolation and does not qualify them.
- No smart PCB copper, Gerbers, manufacturing release or order is produced by this evaluation. No physical measurements or firmware implementation are claimed.

## Evaluation gates

`assessment.json` separates software, mechanics, electrical qualification and PCB manufacturing. An unknown is **pending**, not pass. A fit/access failure does not authorize a third lower board: report the minimum circuitry requiring PCB consolidation.

Fill `measurements.json`, `component-envelope-review.csv` and `manual-review.json` using actual hardware and a scale mock-up. Rebuilding preserves measurements/manual review. Use a separate copy of `acceptance-template.json` for bench records; the template itself is regenerated and contains no accepted results.

The clearance model conservatively adds contact underside protrusion, tallest lower-board body, board thickness, underside joints, insulation/assembly allowance and cable bend envelope. Actual module allocation and extraction must also be demonstrated; height alone is not fit.

Contact insertion force belongs to a separate support frame. Fenolite versus fiberglass and actual thickness remain unidentified; do not assume the board can carry repeated insertion loads. Inventory has 150 pogo pins against 156 contact positions, before spares, unless a different verified contact implementation is selected.

## Checkpoints and compatibility

CP00–CP36 retain their identifiers, requirements and installation phases. CP00 needs no final power or matrix; CP01–03 use fixed diagnostics; power starts at CP09 and matrix operation at CP24. Existing permanent work must not be relocated after soldering. The new placement is for a new build, not a retrofit of accepted hardware.

Use `baseline-crosswalk.csv` for original references, `construction-steps.json` for one component/node-column placement followed by separate inspection and one wire per action, and `transitions.csv` for temporary-link removal. Prototype acceptance never automatically qualifies the final board. Firmware belongs to the team; see [firmware.md](firmware.md).

The legacy application, SQLite progress and revision5 artifacts remain separate. No catalog migration is performed.

## Regeneration

From the tscircuit folder: `npm run build:revision6`.

The build generates native complete-board/functional checks, checks pad copper/style, compares the functional netlist and phases to revision5, checks every local partial-state connection, and exports SVG/CSV/JSON/PDF. Connector MPNs remain in circuit data and are removed from schematic text. No custom copper router is used; perfboard wires are manual assembly annotations.

Actual construction release requires measured fit/access, applicable powered checkpoint acceptance, final smart PCB review and compatible firmware. October 22 prototype work should proceed independently of delivery; the October 29 electronics milestone is not met by this PDF evaluation alone.
