# Project agent instructions

For electronics work, read and follow [eletronics/perfboard/tscircuit/guidelines.md](eletronics/perfboard/tscircuit/guidelines.md), its audit and firmware contracts before editing. Use the tscircuit skill for circuit changes. Do not treat generated drawings as measured hardware verification. Build hardware incrementally through CP00–CP36; preserve earlier permanent components and wiring.

Never show connector, header or pogo-pin part numbers (e.g. 0906-…, 61201021621, TSW-105-07-G-S) on any tscircuit schematic: the purchased parts are not identified yet. The MPN stays in the circuit data (tscircuit checks require one); `eletronics/perfboard/tscircuit/scripts/strip-connector-mpns.mjs` removes the drawn text and runs from `npm run build` and `build:local`. Keep that hook and regenerate the schematics after changes.

Existing project and Notion instructions are in [CLAUDE.md](CLAUDE.md). Read-only access does not authorize writing to external applications.

For the current independent revision5 circuit/PDF redesign, follow the revision5 section of the perfboard guidelines and revision5/firmware.md. Preserve the legacy app/catalog and saved progress; software checks do not release the hardware for soldering.

For the latest four-perfboard hybrid evaluation, follow the revision6 section of those guidelines and revision6/firmware.md. Keep revision5 as the electrical baseline. Exactly two lower 10×20 cm boards are permitted; measured fit, bench acceptance and smart PCB manufacturing are separate release gates.
