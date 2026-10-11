# Bank-module redesign — revision 5

**Engineering prototype; not released for soldering.** Physical stock, purchased modules, stability/transients and firmware remain unverified. This is a new circuit revision; it does not change existing app builds or SQLite progress.

Start with [architecture.pdf](architecture.pdf), then [CP00–CP08](cp00-cp08.pdf). The complete [schematics and placement](schematics-and-placement.pdf) and [checkpoint wiring](checkpoint-wiring.pdf) are separate A4-landscape references. TOP and mirrored underside are shown together. Their coordinates retain TOP numbering; numbered badges refer to component tables. All final positions are planned before construction; install only the current checkpoint's parts/wires.

The actual model is [`../design/revision5.mjs`](../design/revision5.mjs), exported as [design.json](design.json). Native circuit JSON and [checks.json](checks.json) retain diagnostics. [bom.csv](bom.csv), [harnesses.csv](harnesses.csv) and board-specific pin/wire CSVs specify physical endpoints. Every cross-board net has an actual header/post endpoint, not merely a shared label. One-pole distribution terminals are provisional connector selections; socket and harness clearances still need measured fit.

## What improves, and what remains expensive

- 457 functional parts rather than551; 23 adapter assemblies rather than47.
- Two ADS1115 modules instead of six bare ADC/adapter circuits; precision first pairs also serve continuity testing. Local divider bias keeps every buffer away from the ground rail.
- Six INA226 modules with external1Ω shunts replace six bare INA219 assemblies. Four DIP driver arrays replace24 transistor/24 gate-pull-down parts.
- Feedback, input buffers, decoupling and watchdog timing components stay on their own boards. Shared support remains grouped by bank.
- Distribution chains reduce local wire attachments at an individual joint to two; harness junctions add attachments and require strain relief.
- **27 stock boards, 341 distribution posts and279 harness conductors remain substantial hand work.** The old17-board count used larger outlines. The new4946 board-solder estimate excludes558 harness terminations, sockets, carrier internals and adapter preparation. Do not sell this as a minimum-work optimum or a guaranteed time saving.

Existing native checks verify the circuit model and drawing geometry, not hardware behavior. Copper checks inspect pad geometry only; no copper is routed. Insulated manual wires are checked for endpoints, net membership and connectivity at every phase separately.

See [purchasing and inventory](sourcing.md) before ordering. Supplier discovery is incomplete for precision/protection parts; delivery to Curitiba is not confirmed.

## Release gates

1. Measure the actual7×10cm kit grid/plating, DevKit, pogo and socket bodies. Place adjacent contact-board origins71.12mm apart using contact centres, not board edges. Purchased150 pogos are six short of the156 bench contacts before spares.
2. Identify actual ADS/INA/OLED/buck carriers and their labelled connectors. Inspect shunt removal, address straps and pull-ups.
3. Prototype voltage scanning, continuity classification, one source/sink clamp, one current channel and power protection before duplicating/committing permanent hardware.
4. Scope current limit and loaded output levels, cutoff≤1ms, watchdog200–350ms, pulse duty, startup/USB combinations and contact peaks≤5.25V. Verify OFF leakage≤10µA per contact.
5. Implement and qualify [firmware.md](firmware.md) against CP00–CP36. October22 priority is LED + bad-jumper rejection + live voltage. October29 is the full electronics planning target, not a promised completion date.

Regenerate from this directory's parent with `npm run build:revision5` (requires local Bun and Typst). It preserves the legacy `build`/`build:local` connector-MPN stripping hooks. Revision5 also strips its own carrier/connector MPNs from native schematics while retaining them in circuit data.
