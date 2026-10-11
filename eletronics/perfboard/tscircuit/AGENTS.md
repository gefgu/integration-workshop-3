# Perfboard instructions

Read and follow [guidelines.md](guidelines.md), [AUDIT.md](AUDIT.md) and [firmware-contract.md](firmware-contract.md) before changing circuits or exports. Use the tscircuit skill. Preserve earlier permanent work while adding hardware across CP00–CP36 and regenerate/verify artifacts after edits.

The latest candidate is revision6: four permanent 10×20 cm isolated-pad perfboards, two lower boards on a removable tray, smart electronics on PCB contracts. Follow its section of guidelines.md and revision6/firmware.md. Keep evaluation artifacts separate from released catalogs and saved builds; revision5 is the electrical baseline.

Revision5 is the current independent circuit redesign. Read the revision5 section of guidelines.md and revision5/firmware.md before changing its model or PDF exports. Keep the legacy web app and saved catalog separate. Do not claim that software checks or calculated bounds verify purchased hardware.

Never show connector, header or pogo-pin part numbers on any schematic: the purchased parts are not identified yet. The MPN stays in the circuit data (checks require it); `scripts/strip-connector-mpns.mjs` removes the drawn text and runs from `npm run build` and `build:local`. Keep that hook.
