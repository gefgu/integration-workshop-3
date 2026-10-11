# TedTronics perfboard design rules

These rules govern the electronics sources, exports, assembly instructions and checkpoint contracts. Read [AUDIT.md](AUDIT.md), [firmware-contract.md](firmware-contract.md) and [assembly/index.html](assembly/index.html) together.

## Hardware and checkpoints

- Build incrementally through CP00–CP36. Plan all seventeen permanent board placements before construction; install complete safe functional groups at their assigned checkpoint. Later stages add hardware without moving, replacing or desoldering earlier permanent work. Removable links/test leads and top-side kit arrangements may change. Repair a failed stage and repeat its acceptance before proceeding.
- CP00 lights a real four-piece kit loop using fixed battery patch links; CP01 uses a separate fixed-position diagnostic fixture with no matrix dependency. The USB prototype has a hardware 560Ω current bound; final power construction starts at CP09, and matrix chips first enter at CP24. Breadboard fixtures are allowed. Simulated camera approval is never electrical evidence.
- Six interchangeable smart positions; at most three active capsules. Every position supports voltage, current, gates, pulse and memory. NFC uses a PN532 SPI carrier. The Pi has a separate supply. Configurable resistance is excluded.
- Record the explicitly accepted MT8816/CH446Q and six-position/three-position deviations. Do not silently rewrite the requirements source.
- Bench tests are release gates. A successful build, a drawing or an unchecked checklist is not evidence of measured electrical performance.

## Single source of truth

- `design/boards.mjs` and `design/model.mjs` define actual manufacturer pin numbers, nets, board dimensions, component placement and prescribed hand wiring. `boards/*.circuit.tsx` renders those descriptors.
- Regenerate exports after every change. Never hand-edit generated SVG, CSV or Circuit JSON. Keep board instances and cable pin mappings in sync.
- Use role names such as `R_P1_TOP`, `U_CURRENT`, `5V_EDU`, `HIGH_REQ` and `PRESET_N`. A component's description explains its function and its selected MPN. State polarity, adapter and rating.
- MOSFET footprint children are ordered drain/source/gate to match native symbol ports, while their physical coordinates and assembly numbers follow the manufacturer. Core canonical numbers are not manufacturer lead numbers. Connect by role; validate physical pad transforms and reject merged terminals.
- An SMD adapter must preserve the manufacturer's numbering. Adapters, carrier boards and pigtails have their own physical interfaces; never substitute a bare IC footprint for a module.

## Schematics

- Teaching schematics show continuous wires within the current functional block, supply/ground symbols, and named ports to other blocks. List every port destination and derive membership from the complete electrical model. Keep the complete schematic available separately; never remove a connection from the underlying model to simplify a picture.
- Group related components closely inside clearly titled functional boundaries; label pins by their functions and retain their manufacturer numbers. Place decoupling with its powered IC. Keep symbols, pin labels, section titles and wires clear of each other.
- Prefer native `schematicsheet`/`schematicsection`. Core 0.0.2121 repacks manually assigned sections and labels their boundary connections; this version uses explicit `schematicrect`/`schematictext` boundaries instead. A version-checked compatibility patch uses tscircuit's existing line renderer when `schTraceAutoLabelEnabled=false`. It does not remove diagnostics or implement a custom router.
- Use the default A4 sheet and run schematic-placement checks. Review the SVG visually as well as checking diagnostics. Connections crossing without a junction are separate nets.

## Manual assembly authority

- **The numbered 2D assembly drawing and pin/wire tables are authoritative.** Use the mirrored underside while soldering. Coordinates always retain top-side numbering; never renumber the underside.
- Board pitch is 2.54 mm, isolated pads. Show every hole, mounting hole, cut boundary, pin 1 and mounted side. Node contacts remain 17.78 mm apart horizontally and 10.16 mm vertically. Bank B mirrors the row direction. Capsules retain the same orientation and provide service contacts on both edges (user-confirmed); service pin order remains SCL, SDA, GND, 3V3 and P1/P3 are not exchanged.
- All hook-up wires go underneath. Only node-column straps are bare. Use insulated 24 AWG signal wire, strip only endpoints and sleeve crossings. A bend is not a solder joint; a crossing is not a connection. Do not copy a dense overview without selecting one net and consulting its endpoint table.
- Drill keyed IDC positions to 1.2 mm before assembly; other holes are nominal 1 mm. Check the remaining isolated-pad annulus and the actual stock board.
- No generated PCB copper: `routingDisabled` and drawing annotations describe insulated hand wiring. Copper DRC cannot verify these wires; the assembly validator checks their endpoints and connectivity separately.
- Leave clearance for adapter bodies, socket extraction, cable plugs and strain relief. Cut and drill before soldering. Test continuity after each net.
- The 3D view is a placement companion. Primitive bodies show side, orientation and approximate envelope; pin-1 markers identify IC orientation. Insulated hook-up wires, sockets and off-board modules are not detailed solid models. Exact dimensions of purchased pogo pins, adapters and DevKits must be measured against the drawing before release. The user has ordered pogo pins but does not yet know their part number; keep this and the adapter dimensions marked pending.

## Electrical and verification rules

- During USB-only supervised prototype checkpoints, student LED current comes through the 560Ω ±1% test-source limiter, with USB voltage measured ≤5.25V and source current ≤9.5mA. This is not the final regulated rail. Final student current comes from the monitored `5V_EDU` rail. Relay LEDs and controller logic use `5V_SYS`; they must not consume the student current budget. Hardware limits are independent of firmware commands.
- Never join I2C buffer B sides. Six A-side SDA channels share SCL; each buffer's B side is local to one capsule position. Power-off leakage must be measured in every USB/bench-power combination.
- Observe the **MT8816 analog-pin** current limit, including shared Y buses. Reserve margin below its absolute maximum; summed currents matter. Tools and student operation are mutually exclusive. Never use a bare GPIO as an educational battery.
- Re-run source, pin specification, netlist, schematic placement, PCB placement, shorts and PCB style checks, then assembly validation. Fix actionable findings; record tool limitations explicitly. Do not suppress or delete warnings to claim a pass.
- Preserve measured results with equipment, supply, fixture, firmware revision, board revision, waveform and pass/fail. Run negative tests for stale acknowledgements, invalid topology, communication loss, reset, overload and disconnected power.

## Wire colours

| Colour | Use |
|---|---|
| Red | 5 V |
| Orange | 3.3 V / USB 3.3 V |
| Brown | 12 V |
| Black | Ground |
| Blue | Educational nodes / buses |
| Green | Analog sense / reference |
| Yellow | Digital control |
| White, drawn grey | I2C |
| Light grey | Bare node straps |

## Assembly app and revisions

Use `npm run assembly:app` and http://127.0.0.1:8080. SQLite saves separate projects and physical board instances; never use browser checkboxes as authoritative progress. Keep explicit stable part/wire IDs, install phases and endpoint dependencies. Freeze each project's catalog and drawings; regeneration creates a new revision and does not upgrade a build silently. Each checkpoint needs a filmable win, actual manual acceptance readings, and a firmware contract. Reworking inspected hardware invalidates dependent checkpoint acceptance and requires fresh measurements; notes alone do not. Unused signal terminals remain open until their internal consumers arrive; factory firmware holds future outputs LOW. Partial-state checks must list these terminals. Never exempt an IC supply or ground requirement. No firmware or live USB is delivered by the assembly app.

Component identifiers are shown in numbered, evenly spaced legend gutters rather than overlapping body labels. Prescribed insulated wire fanouts use half-hole bends, not extra solder joints. Sensitive measurement/feedback paths remain direct. Follow the listed physical paths and endpoints; crossings can still require stacked insulated wire. Use the selected group/wire view when assembling.

## Guided construction

The default app is an English, one-component-or-wire-per-screen guide with thirty-seven checkpoints in chapters. Every action specifies its materials, physical endpoints, reason, expected result and notes. Installation, inspection, firmware availability and measured acceptance are distinct states. Keep TOP and MIRRORED UNDERSIDE visible together; highlight the current component/wire while fitting the full board by default. Mouse-wheel zoom follows the pointer; drag pans and Fit board restores context. Place all contacts of one node column together with a coordinate table; keep inspection separate. Next step saves construction without a confirmation checkbox; measured results and checkpoint acceptance remain independently gated. A temporary breadboard has a separate TOP drawing showing actual five-hole row ties; do not call its backside a soldering guide.

Save the current step and unfinished notes in SQLite. New builds use catalog schema2; existing schema1 builds retain their original catalog and workspace. Renumbering checkpoints never migrates their acceptance. Reworking inspected hardware invalidates dependent guided actions and measurements. Firmware remains a contract only; unavailable firmware or measurement equipment leaves the corresponding step pending.

USB test-source and temporary smart-card power links must be disconnected before final regulated supplies connect. The temporary factory ALIVE link is only for isolated CP11/12 load qualification and is removed permanently at CP13. Matrix mode requires fixed source leads removed. Never parallel the prototype and final educational sources.

Node-column schematic symbols show all six contacts on a single side, matching the physical column. Keep wire paths outside component reference labels and pin text.

Grouping contacts is a presentation change: retain original step IDs and save the entire placement group in one SQLite transaction. Existing builds may explicitly adopt refreshed drawings only when the catalog matches after excluding rendering hashes and schematic positions; preserve measured records and log the revision change. Hardware, pin, net, phase or checkpoint changes require a separate build.
