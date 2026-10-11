# Perfboard instructions

Read and follow [guidelines.md](guidelines.md), [AUDIT.md](AUDIT.md) and [firmware-contract.md](firmware-contract.md) before changing circuits or exports. Use the tscircuit skill. Preserve earlier permanent work while adding hardware across CP00–CP36 and regenerate/verify artifacts after edits.

Never show connector, header or pogo-pin part numbers on any schematic: the purchased parts are not identified yet. The MPN stays in the circuit data (checks require it); `scripts/strip-connector-mpns.mjs` removes the drawn text and runs from `npm run build` and `build:local`. Keep that hook.
