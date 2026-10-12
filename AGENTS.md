# Project agent instructions

For electronics work, read and follow [eletronics/perfboard/tscircuit/guidelines.md](eletronics/perfboard/tscircuit/guidelines.md), its audit and firmware contracts before editing. Use the tscircuit skill for circuit changes. Do not treat generated drawings as measured hardware verification. Build hardware incrementally through CP00–CP36; preserve earlier permanent components and wiring.

For the latest testable-perfboard candidate, follow the revision7 section of the perfboard guidelines and eletronics/perfboard/tscircuit/revision7/README.md and selftest.md. It keeps revision6's boards and netlist and changes wiring and test aids only: ground bus bars, a standard probe header, status LEDs, designated test pads and fail-safe removable links. Do not edit revision5/revision6 or the shared design/model.mjs and design/boards.mjs; extend model7.mjs, place7.mjs, testaids7.mjs and links7.mjs. Software checks and generated PDFs are not measured evidence.

Never show connector, header or pogo-pin part numbers (e.g. 0906-…, 61201021621, TSW-105-07-G-S) on any tscircuit schematic: the purchased parts are not identified yet. The MPN stays in the circuit data (tscircuit checks require one); `eletronics/perfboard/tscircuit/scripts/strip-connector-mpns.mjs` removes the drawn text and runs from `npm run build` and `build:local`. Keep that hook and regenerate the schematics after changes.

Existing project and Notion instructions are in [CLAUDE.md](CLAUDE.md). Read-only access does not authorize writing to external applications.

For the current independent revision5 circuit/PDF redesign, follow the revision5 section of the perfboard guidelines and revision5/firmware.md. Preserve the legacy app/catalog and saved progress; software checks do not release the hardware for soldering.

For the latest four-perfboard hybrid evaluation, follow the revision6 section of those guidelines and revision6/firmware.md. Keep revision5 as the electrical baseline. Exactly two lower 10×20 cm boards are permitted; measured fit, bench acceptance and smart PCB manufacturing are separate release gates.
