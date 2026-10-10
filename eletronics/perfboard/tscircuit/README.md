# tscircuit drawings of the checkpoints

Code-drawn versions of the perfboard checkpoints, using [tscircuit](https://github.com/tscircuit/tscircuit).
One file per checkpoint: `cpNN-*.circuit.tsx`. Snapshots (schematic, PCB, 3D) are in
`__snapshots__/`, so they can be viewed on GitHub without running anything.

The PCB view stands for the perfboard. Copper traces are the wires you solder by hand, and
the hole grid is 2.54 mm. Positions follow `../00-standards.md` §5.

## Run
Everything is installed locally in this folder (`node_modules/`, git-ignored), including
`bun`, which the CLI needs. Node 20 alone fails in the autorouter (`Map.groupBy`).

```
npm install                         # once (Node 20 is enough to install)
npx tscircuit-cli dev cp01-module-a1.circuit.tsx      # live viewer: http://localhost:3020
npx tscircuit-cli snapshot cp01-module-a1.circuit.tsx --update --3d   # refresh __snapshots__
```

## Limits
- Pogo-pin size is a placeholder (1 mm hole, 2 mm pad) until the real part is known.
- tscircuit autoroutes the wires as copper. Use it to check connectivity and placement,
  not as the exact wire paths.
