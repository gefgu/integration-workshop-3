# Tedtronics construction audit — 7×10 cm stock proposal

## Decision and status

Use only intact **70×100 mm, double-sided fiberglass, isolated-pad perfboards**, purchased in ten-board kits. This latest decision supersedes the earlier 5×7-only and mixed-size proposals. The temporary USB source remains a solderless breadboard fixture, not an additional permanent board size.

**This is a separate audit and proposal, not a released replacement hardware catalog.** Current circuits, checkpoint IDs, firmware contracts, generated production drawings and SQLite projects have not been migrated. Firmware implementation belongs to the user's friends. No purchased-part fit or electrical performance has been measured.

Open [the interactive review](index.html) in a browser. It is self-contained and works as a local file: simultaneous TOP/underside, pointer-centered wheel zoom, drag pan, Fit board, component or individual wire selection, coordinate tables, existing native schematic alongside, and checkpoint acceptance/film cards. Its controls review proposals; they do not save construction progress. The existing SQLite app remains the construction record.

For a local browser address, serve only this audit directory:

```sh
python3 -m http.server 8083 --bind 127.0.0.1 --directory construction-audit
```

Then open http://127.0.0.1:8083. The existing assembly app uses a separate port and database.

Reproduce descriptor-derived artifacts from the tscircuit directory:

```sh
node scripts/audit-construction.mjs
```

## Baseline and high-priority findings

See [baseline.md](baseline.md) and [baseline.json](baseline.json). The current permanent design contains **17 boards, 551 component instances, 47 adapter-mounted components, 1,511 prescribed wire segments, and 22 cable assemblies**. The estimated 5,224 solder operations count component leads and wire ends separately; it excludes adapter work, sockets, cable fabrication and external assemblies. Shared joints can combine operations.

| Priority | Finding | Construction consequence | Recommended response |
|---|---|---|---|
| High | Six smart channels account for 324 components and 762 wire segments | Repeated work dominates; combining board outlines alone does not remove it | Validate one complete channel before repeating it; evaluate modules and a three-channel shared-resource architecture |
| High | Most current board outlines exceed 7×10 cm | Existing coordinates are not instructions for the selected kit | Release a separate measured stock template and new hardware revision before assembly |
| High | Grid packing and spreading are based on approximate bodies, not circuit locality | Long wires, shared root terminals and difficult access | Place by function and construction phase; keep decoupling, analog dividers, references and feedback close |
| High | Current per-net wiring often fans many ends into one early terminal | Crowded solder joints; added stages may require heating an existing joint | Add planned distribution points or harness branches; define later attachment points before soldering |
| High | Unknown pogo height, adapter envelopes and DevKit variant | A drawing can pass software checks but fail physical assembly | Identify and measure purchased parts; use socket/body extraction and plug-access reservations |
| High | Simple capacity packing yields 28 stock boards and many cross-board segments | Reduces board size while increasing construction work | Reject this as the final architecture; use it as a quantified comparison only |
| Medium | Continuity fixture repeats voltage divider, buffer and ADC functions | Extra permanent test hardware for early demonstrations | Investigate reusable measurement hardware with keyed removable input selection; do not directly join fixture and final measurement inputs |
| Medium | Existing generic early checkpoint link text mentions OLED before CP04 | Unnecessary early wiring and misleading source instructions | Use the explicit link-state table in the early proposal; correct generic text when a new catalog is implemented |
| Medium | Watchdog documents use different timing limits | Friends may implement a broader timeout than a checkpoint accepts | Resolve CP13 ≤350 ms versus general 200–500 ms expiry before firmware handoff; retain OFF-on-stale behavior |

The 28-board capacity study uses six contact boards, one continuity fixture, four matrix/controller boards, two power boards, two smart-controller boards, twelve smart-channel boards and one integration board. It preserves early candidate placements but is **not a functional partition or optimum**. It moves 413 prescribed segments across board boundaries, including sensitive power/reference wiring. Additional harness endpoints are not included in the baseline count. See [future-capacity.json](future-capacity.json).

## Architecture comparison

| Approach | Benefits | Cost / risk | Decision |
|---|---|---|---|
| Keep current electronics, partition onto stock boards | Existing firmware pin maps and modes largely remain recognizable | Capacity study grows to 28 boards; cross-board wiring must be redesigned | Reference comparison; do not build it as shown |
| Keep six independent frontends, use qualified modules and functional placement | Straightforward behavior and interchangeable positions; less adapter work where a module is genuinely suitable | Six repeated analog/output/current paths remain; module body and onboard circuitry can consume space or change behavior | Recommended immediate prototype direction |
| Pool three complete analog/output/current frontends across six positions | Matches the maximum of three active capsules; potentially removes three duplicated frontends | Requires an independently qualified switching network, current/leakage budgets, identity reassignment, simultaneous operation and fresh acknowledgements | Promising research option, not released circuitry; no savings claimed until switch overhead is counted |
| Share only an I2C controller through a multiplexer | May reduce MCU bus-pin complexity | Does not remove six analog frontends; address selection is not equivalent to power-off isolation | Evaluate separately; not a direct replacement for the six TCA9517 isolation interfaces |

**Recommendation:** build one measured channel and the early diagnostic wins first, using four stock-board studies. Prefer a documented ADS1115 breakout to a VSSOP adapter if its exact board is available and appropriate. Keep high-impedance buffering and output/protection hardware. Revisit shared frontends before ordering or constructing six repeated channels. Keep earlier permanent placements fixed after release; removable leads may change by checkpoint.

| Module candidate | Assembly opportunity | Qualification needed |
|---|---|---|
| ADS1115 breakout | Potentially avoids seven VSSOP ADC adapter installations: six channels plus diagnostic fixture | Exact carrier revision, body/pins, pull-up rail/resistance, ADC input labels, address and decoupling |
| INA219 breakout | Potentially avoids six SOIC adapter installations | Existing carrier shunt is not automatically the required calibrated 10Ω shunt; burden, signed accuracy, isolation and operating range must be retained |
| OLED and regulator carriers | Already represented as external subassemblies; keep their real interfaces | Identify purchased modules, physical mounting and actual supply/logic pins |
| Generic op-amp carrier | No substitution approved | A different op-amp can change offset, loading, output swing and loop stability; retain the specified analog behavior |

These are opportunities, not quantified part/wire savings. Module headers and harnesses can consume the saved work. No purchased module is inferred from a generic listing.

## Stock and module evidence

- User selected “Kit 10un Pcb Placa Fibra Perfurada 7x10 Cm Dupla Face Full.” A [RoboBuilders storefront](https://www.mercadolivre.com.br/loja/robobuilders?category_id=MLB380658&client=recoview-selleritems&item_id=MLB5056777528&official_store_id=81376&recos_listing=true) lists that title. This establishes a kit candidate, not exact hole count, plating, thickness or a guaranteed delivered price. Checked 2026-10-11.
- The study assumes a **26-column × 38-row, 2.54 mm grid** centered in 70×100 mm stock: first-hole offsets 3.25 and 3.01 mm. This is a geometric assumption, not a seller specification. Count the actual holes and measure the first-hole offsets before using any coordinate table.
- The earlier RFC 5×7 listing had conflicting 240/432-hole and 1/1.5-mm figures. It is excluded from this proposal. The 3×7 and 7×9 alternatives are also excluded.
- [Adafruit ADS1115 carrier pinouts](https://learn.adafruit.com/adafruit-4-channel-adc-breakouts/pinouts) identify power, ADC inputs and bus pull-ups. The documented carrier has SDA/SCL pull-ups to VIN; a carrier substitution must account for its existing components and exact hardware revision. Do not connect 5 V logic pull-ups to the ESP32. No generic clone footprint is released.
- [TI ADS1115 datasheet](https://www.ti.com/lit/ds/symlink/ads1115.pdf) is the electrical reference. Differential full-scale configuration does not permit inputs outside their absolute voltage limits; retain the existing dividers/buffers.
- [TI TCA9548A datasheet](https://www.ti.com/lit/ds/symlink/tca9548a.pdf) and [carrier pinouts](https://learn.adafruit.com/adafruit-tca9548a-1-to-8-i2c-multiplexer-breakout/pinouts) establish a channel-selection candidate. Power-domain leakage and fault behavior need separate verification. Preserve the current rule against joining buffer B sides until an alternative is qualified.

## Detailed early fit and later construction

The [early guide](early-checkpoints.md), [proposal.json](proposal.json) and [endpoint table](endpoints.csv) contain CP00–CP08 studies. Four stock boards occupy 280 cm² of nominal substrate; one ten-board kit provides four study boards and six unallocated/spare boards. This is **not a full-system shopping quantity**.

Printable placement SVGs are generated for each early board in TOP and mirrored-underside orientations. Numeric identifiers sit above reference envelopes, away from pin marks; the legend is outside the board. The interactive view shows one selected wire's endpoints rather than drawing every wire over every label. One selected endpoint line is illustrative, not an insulation/clearance-qualified route.

### Proposed interface changes

The early placement study retains manufacturer pin numbers, ESP1 GPIO assignments, ADC/OLED addresses, node identities and existing cable pin ordering. A1's educational/service contacts retain their relative positions; only underside headers and one mounting hole move. Board-instance IDs and TOP coordinates change, so firmware/build revision identifiers and physical construction references require explicit review. No API/schema changes or saved-progress migration are needed for this separate audit viewer. A later shared-resource architecture would need new routing allocation, acknowledgements and physical cable maps; those are not implemented here.

For CP09–CP36:

- Power: keep shunt, comparator/reference, latch and analog returns local; the capacity split crosses seven sensitive segments and is unsuitable as a soldering instruction. Qualify guards and cutoff before consumers connect.
- Smart output/current: reserve source/sink compensation and current-shunt blocks as complete groups. CP15 output qualification and CP22 current qualification remain independent bench gates.
- Matrix: separate physical node distribution from MCU/digital control only with explicit connectors and timing/current analysis; four-board packing is a capacity result, not a recommendation.
- Expansion: copy only a physically qualified channel. Six positions keep all modes; reject a fourth active capsule. Later installation must not move earlier permanent work.
- Pi/NFC: evaluate direct labelled harnesses and existing modules before committing a dedicated perfboard; retain separate Pi supply and the current common-ground contract.

## Release requirements and compatibility

1. Record actual board grid, thickness, plating, connected edge pads, usable area and mounting holes. Check isolation with a DMM; double-sided does not establish through-plating.
2. Measure actual components, adapters, pogo free/working heights, connector mating space, DevKit USB clearance and board margins. Validate capsule fit with a physical frame.
3. Replace capacity packing with deliberate functional placement and explicit wire paths; avoid multiple wire ends on fragile component leads. Complete all harness pin mappings and future connection points.
4. Compile candidate tscircuit sources and run source, pin, netlist, schematic/physical placement and applicable copper checks, plus independent hand-wire and partial-state checks. Native schematics must retain the connector-MPN stripping hook. Copper checks do not verify insulated hand wiring.
5. Record positive and negative bench evidence with supply, equipment, fixture, firmware/board revision and link state. Failed or inconclusive measurements block advancement.
6. Hardware/pin/phase changes create a separate catalog/build revision; never reinterpret current SQLite completion or checkpoint acceptance. Friends review changed physical pin maps, supply ownership, module addresses and messages before implementation.

No firmware code, device transport, production circuit migration or external application write is included in this audit. The embedded native schematics are existing generated references, not a new native verification pass.

## Verification performed for this proposal

The artifact generator passed **974 consistency checks** covering translated pin identities, unique assumed-grid holes, reference envelope bounds/overlap, source net membership, preserved early placement in future capacity studies, and absence of drawn connector MPNs in embedded native schematics. See [consistency-checks.json](consistency-checks.json). Generator and embedded browser JavaScript syntax checks passed. TOP contact and voltage SVGs were rasterized and visually inspected; pin/number and terminal-coordinate crowding found during inspection was corrected.

No new unit or browser interaction tests were run. Native circuit builds were not rerun because production electrical sources were not edited. Physical dimensions, hand-wire clearance, electrical behavior and browser interactions are not established by the consistency report.
