# Perfboard audit — revision 4

## Status and scope

This revision develops the complete CP00–CP36 hardware sources and assembly instructions. **Physical fit and bench acceptance are pending.** Current software results are generated in `checks/report.json`; a reproducible public summary is exported to `assembly/verification.json`. A clean software check does not establish cutoff timing, transient voltage, leakage, accuracy or thermal behavior.

Read [guidelines.md](guidelines.md), [the assembly guide](assembly/index.html), [requirements traceability](requirements-traceability.md) and [firmware contracts](firmware-contract.md). Build and qualify each assigned functional group before powering it. Later stages add hardware while preserving earlier permanent work.

## Findings and corrections

| Original finding | Correction |
|---|---|
| Only CP00/CP01 circuit sources; later hardware additions contradicted the requested checkpoints | Thirteen complete circuit designs, seventeen permanent perfboards and one temporary breadboard fixture; CP00–CP36 now construct the final hardware cumulatively with fixed earlier placement/wires |
| GPIO-powered educational battery and underspecified protection | Internal protected student rail, input polarity protection, backup PTC, independent comparator/latch cutoff and voltage guards |
| Smart output 470Ω tradeoff did not meet both current and low-level requirements | Separate feedback source/sink regulators with 10Ω sense resistors, isolated PhotoMOS switches and explicit transient tests |
| Smart source currents could bypass the student current monitor | All P3 sources draw from 5V_EDU; relay LEDs and controller supply draw from 5V_SYS |
| INA219 bias violated inactive-port leakage without isolation | Two ammeter PhotoMOS switches disconnect both shunt terminals; buffered 1M/1M voltage inputs remain high impedance |
| Incompatible 3.3-V/5-V control and unpowered bus paths | HCT interfaces, TCA9517 buffers, USB-powered watchdogs and isolated return paths |
| Custom MOSFET footprint aliases silently merged gate and drain | Footprint children ordered by native drain/source/gate ports, physical coordinates retain manufacturer numbering; independent compiled-net/pad validator rejects merging |
| MT reset depended on the delayed 5-V logic rail | Reset pulls up to MT VDD and is released through two series MOSFETs only with GPIO release and ALIVE; reset ignores CS |
| Native section layout ignored manual grouping and replaced lines with labels | Explicit functional boundaries and a fail-fast, version-checked built-in renderer compatibility fix, including finite crossing decoration |
| Dense or overlapping courtyards and grid-hole false overlaps | Body clearance and mounting-hole reservations; individually bounded pogo contacts; unused holes are nonplated drawing substrate |
| PCB autoroutes were presented as hand wiring | Numbered hole drawings, mirrored underside, insulated wire paths and independent assembly validation; no fabricated copper |
| Raw JSCAD solids were accepted by the circuit build but rejected by 3D export | Serializable jscad-planner operations, correct reference pogo height and IC pin-1 markers |
| Construction tables omitted repeated pogo quantities and external interfaces | Board/part quantities, cable mapping, labelled external modules and immutable hardware manifest |

## Accepted scope and deviations

User confirmed the pogo pins are already ordered but their part number is not yet known; adapter selection/dimensions are also unresolved. Keep these recorded as pending, and replace reference envelopes only after identifying and measuring the actual parts.

User decisions: retain isolated-pad 2.54-mm perfboards and contact mechanics; use modules/adapters; include NFC and all smart modes on every position; exclude configurable resistance; three capsules, at most three active across six positions; Pi supply separate; use a DMM, current-limited supply and oscilloscope. The numbered 2D guide is authoritative and 3D accompanies placement. The user confirmed capsules retain the same orientation in both banks and provide service contacts on both edges; P1/P3 and service electrical order therefore remain unchanged.

MT8816 replaces CH446Q (EFR21/22); six positions replace EFR31.2's three positions; Pi is separately powered (EFR24). ENFR6's resistor-only P3 prediction must be replaced with the active limiter's measured compliance and conservative current bound. These deviations are explicitly recorded; the requirements source has not been rewritten.

The completed board outlines are in [00-standards.md](../00-standards.md). Electronics daughterboards are sized to accommodate the complete hardware; node contact geometry is retained. Qualified adapter envelopes and stock-board edge margins must be checked before cutting. Buck modules, PN532 and OLED capsules are external subassemblies installed at their assigned checkpoints, not fictitious bare IC footprints.

## Static checks and their limits

Calculated P3 worst-case steady limit uses 5.25 V, 1% divider/sense resistors and 10µV offset: approximately 10.63 mA. P1/P2 inactive loading estimate is 5.25 V/(2MΩ×0.99)+1µA relay leakage ≈3.66µA. Those are static component estimates, not measured transient or temperature results.

LTC4365 5-V overvoltage threshold uses 92.8kΩ/10kΩ 0.1% resistors and the 507.5mV upper comparator bound: <5.23 V including input leakage allowance. **This does not prove contact peaks stay below 5.25 V during a fast failed-buck step.** Gate delay, upstream stored energy and output capacitance must be included in the waveform test. Qualify the regulator's normal output below the minimum guard threshold. Never bypass a failed guard to make a checkpoint pass.

The primary trip target is approximately 11.24 mA from TL431, 5.11kΩ/46.4kΩ divider, gain-20 INA180 and 10Ω shunt. Measure its actual tolerance/temperature window (>10.6 and ≤12 mA), including rail drop. Scope cutoff ≤1 ms directly. Keep reference/analog return wiring short and separated from relay-current returns; verify loop compensation before installing student loads.

MT8816 current limits apply to analog **pins**, including a shared Y bus. Do not transpose CH446Q per-crosspoint limits to this device. Tools and student operation must be mutually exclusive. Calibrate switch resistance at actual 0–5-V signal levels; the headline Ron test condition is not a guarantee at every node voltage.

Copper shorts/style checks cover tscircuit copper geometry only. Every hand wire is an annotation, so the independent assembly check also compares compiled net membership, actual pad coordinates (including bottom mirroring), intended endpoints, NC pins, bare straps and cable aliases. Negative controls intentionally corrupt a pad and a cable to prove failures are detected. Air-line suggestions about rotating a passive do not represent an insulated underside wire route; inspect the actual numbered path.

## Release gates — all pending physical evidence

1. **Fit:** measure actual pogo free/working height, capsule/service alignment, DevKit row spacing, adapter pin numbering/envelope, IDC plug access, mounting holes and board margins. Reference pogo CAD is Mill-Max 0906-0, not a claim about an unidentified ordered pin.
2. **Power:** qualify regulator outputs with consumer links open. Test polarity, each independent voltage guard, capacitor discharge and a bounded failed-buck step with the matrix/consumers isolated. Record contact-voltage peaks; strict 0–5.25 V is the acceptance criterion.
3. **Protection:** measure primary trip threshold, latched reset interlock and ≤1-ms cutoff with the controller stopped. Measure smart output short current, edge transients, 2-mA voltage levels and loop stability before connecting MT analog paths. A transient exceeding a datasheet limit blocks release.
4. **Isolation:** all four USB/bench-power combinations; no supply backfeed, every P1/P2/P3 ≤10µA when off/invalid/stale, ammeter path open, watchdog expires and no automatic restart.
5. **Function:** every X address, shared bus, six positions and every mode; calibrated signed voltage/current readings, pulse/gate/memory timing, three simultaneous capsules and rejected fourth request.
6. **Integration:** PN532 identity, pt-BR OLED states, movement shutdown, invalid/stale acknowledgements, 30-minute lesson run and enclosure inaccessibility. Use removable test leads for lessons whose physical capsule/jumper geometry cannot form the required series path; later stages add their specified functional groups while preserving earlier permanent work.

Resolve fit or electrical failures during the affected construction stage, then regenerate drawings and repeat acceptance. The checkpoint schedule is not permission to conceal an unresolved prototype failure.

## Manufacturer references

- [MT8816 manufacturer datasheet](https://www.mouser.com/datasheet/2/268/Microchip_06182024_MT8816AE1-3459976.pdf): DIP40 mapping, X address codes, reset/strobe behavior and analog-pin limits.
- [LTC4365](https://www.analog.com/media/en/technical-documentation/data-sheets/ltc4365.pdf): guard pinout, thresholds, delay and back-to-back MOSFET topology.
- [IRLML6344](https://www.infineon.com/assets/row/public/documents/24/49/infineon-irlml6344-datasheet-en.pdf), [BSS84](https://assets.nexperia.com/documents/data-sheet/BSS84.pdf), [NDP6020P](https://www.onsemi.com/pdf/datasheet/ndp6020p-d.pdf), [2N7000](https://www.onsemi.com/download/data-sheet/pdf/2n7000ta-d.pdf): physical terminal order and ratings.
- [OPA2333](https://www.ti.com/lit/ds/symlink/opa2333.pdf), [INA180](https://www.ti.com/lit/ds/symlink/ina180.pdf), [INA219](https://www.ti.com/lit/ds/symlink/ina219.pdf), [ADS1115](https://www.ti.com/lit/ds/symlink/ads1115.pdf): measurement and current-limit bounds.
- [TCA9517](https://www.ti.com/lit/ds/symlink/tca9517.pdf), [MCP130](https://ww1.microchip.com/downloads/en/DeviceDoc/11184d.pdf): power-domain isolation and package-specific reset pinout.
- [AQY212EH](https://industry.panasonic.eu/pd-379914/relays/relays/photomos/photomos-ge-dip4-1-form-a/aqy212eh): load-switch isolation, leakage and LED drive.
- [Pololu 5V](https://www.pololu.com/product/2858), [Pololu 3.3V](https://www.pololu.com/product/2857): fixed regulator modules and their interfaces.
- [WR-BHD 61201021621](https://www.we-online.com/components/products/datasheet/61201021621.pdf): 20.36×9.1-mm body and recommended hole pattern.
- [Vishay PTF](https://www.vishay.com/docs/31019/ptf.pdf), [Vishay CPF](https://www.vishay.com/docs/31021/cpf.pdf): actual precision/power resistor families.
- [PN532 carrier wiring](https://learn.adafruit.com/adafruit-pn532-rfid-nfc/breakout-wiring), [PN532 user guide](https://www.nxp.com/docs/en/user-guide/141520.pdf): carrier supply and SPI behavior.

## Incremental construction and local app

The user clarified that construction checkpoints should add hardware without reworking earlier soldered connections. The former pre-CP00 assembly rule is superseded. Each item now has a stable identifier, installation phase and dependencies; per-net branches attach to the earliest installed terminal so an early powered net never depends on a later component. Parts are spread over available space without changing lead pitch or pogo geometry. Insulated fanouts avoid common pin-column paths; analog feedback wiring stays direct.

CP00 uses fixed removable battery patch leads and the actual four-piece kit. CP01 uses a separate USB-powered continuity fixture (ADS1115/OPA2333, default-off PhotoMOS, BAT85 and 10kΩ source) with removable C4/C1 probes; matrix chips first enter CP24 in guided builds (CP08 in the legacy catalog). The maximum ideal stimulus is 3.3V/10kΩ=0.33mA; this is diagnostic mode, not normal inactive leakage. Measure stimulus and inferred resistance, calibrate known short/open/1kΩ, and reject false continuity through LED/resistor paths. Only a fresh verified configuration can subsequently energize, with stimulus/probes disconnected.

The local assembly app saves SQLite projects, independent board copies, test attempts, notes and checkpoint acceptance. It has no USB connection and delivers no firmware. Camera approval can be simulated only as a clearly labelled separate demo input. Measured tests are manually entered and may not be inferred from app checkboxes. Each build freezes its design/catalog/drawings; exports carry these into a separate imported project.

## Software verification of the assembly app

- Full designs: all thirteen pass source, pin specification, netlist, schematic placement, physical placement, copper shorts/style and independent manual-wire checks.
- Cumulative construction: Every distinct cumulative native circuit state passes; all thirty-seven guided checkpoint dependency graphs pass. Unused passive connector terminals are explicitly reserved and left open until their internal consumers arrive. IC power pins are never exempted. The partial-state report lists every reserved terminal.
- SQLite/API: fifteen automated tests cover restart persistence, separate projects and card copies, prerequisite rejection, acceptance gates, failed results, rework requiring fresh measurements, portable backups/history and rejected malformed imports. Manual notes alone preserve acceptance.
- Generated checks are software evidence only. Firmware implementation, purchased-part measurements and physical acceptance remain pending.
- Chrome browser checks passed for simultaneous views, schematic loading, installed-wire persistence after reload, measurement entry, all seventeen board instances, simulated-camera gating and filming cards. Numeric SVG label bounds were checked for overlap on every board in both orientations. Desktop and mobile views were reviewed; the preview database was isolated from the real assembly database.

## Guided redesign

The former 331-item first checkpoint is replaced by a USB-only first-light milestone with fewer than 80 tracked assembly items. Final power construction begins at CP09; matrix begins at CP24. Thirty-seven checkpoints separate visible behaviors and contain persistent installation, inspection, firmware, measurement and filming actions. Breadboard fixtures are permitted; permanent bank soldering stays fixed.

Teaching schematics are native tscircuit renders of individual functional sections. Internal nets are re-rooted locally without changing membership; supply symbols and explicitly mapped external ports replace cross-board line clutter. Native net names beginning with a digit receive a renderer-only V_ prefix, removed from displayed labels; original electrical identities and destination tables are retained.

Prototype USB source: NDP6020P high-side switch, 2N7000 gate control,10k OFF bias,100k enable pulldown and560Ω ±1% limiter. At5.25V and−1% resistance, short current is9.47mA and resistor dissipation<50mW; specify≥0.25W. USB source voltage, loaded voltage, OFF behavior and current must be measured. This fixture does not replace final regulated supply/protection acceptance. Generic flying jumper leads and purchased board/adapter envelopes remain identification/fit tasks.

Schema2 adds guided actions, saved cursor and draft notes. Existing schema1 builds and assets remain pinned, with their legacy workspace; new checkpoint numbers never reinterpret old acceptance. No firmware or live USB integration is provided. Early tools are USB and DMM; final timing/transient qualification requires the additional equipment listed in those checkpoints.

### Guided browser and migration checks

The saved scripts in `app/scripts/` verify the guided UI against a disposable SQLite database: two simultaneous board views, saved cursor/drafts after reload, focused contact actions, local schematic assets, breadboard focus, blocked future actions, returning from the full explorer, and mobile page width. Chrome reported no JavaScript errors. Numeric text bounds do not overlap in any of the twenty-six generated TOP/underside views. Teaching SVGs omit the sheet frame for readability while their original native sheets remain checked; schematic zoom and a full-size link are available.

Before migrating the existing app database, a consistent SQLite backup was created. Project IDs, pinned revisions and progress row counts were compared after startup and preserved. Schema version2 adds guide tables without renumbering legacy checkpoint acceptance. These software checks do not establish actual firmware compatibility or measured hardware performance.

## Contact grouping and drawing presentation

The app fits the full board by default and supports pointer-centred wheel zoom, drag panning and Fit board. A node column is one placement action with all six TOP coordinates, followed by separate inspection. Next step saves construction without a checkbox; measured-test and checkpoint gates remain independent. Group completion saves original step IDs in one SQLite transaction, retaining old progress. Node schematic pins now occupy one side; updated symbol height, row spacing and named-port placement keep wiring clear of text. Perfboard number badges are drawn above wires. Existing guided builds can explicitly adopt these presentation changes only after the hardware and checkpoint catalogs match.
