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
npm run dev -- cp01-module-a1.circuit.tsx           # live viewer: http://localhost:3020
npx tscircuit-cli snapshot cp01-module-a1.circuit.tsx --update --3d   # refresh __snapshots__
```

## Limits
- Pogo-pin size is a placeholder (1 mm hole, 2 mm pad) until the real part is known.
- tscircuit autoroutes the wires as copper. Use it to check connectivity and placement,
  not as the exact wire paths.

## PCB viewer: WebGPU workers are unavailable

The local CLI is patched by `npm install` and `npm run dev` to start the PCB
viewer with Canvas, even if WebGPU was previously saved in the browser. The
patch is checked against the installed bundle and fails explicitly if a CLI
upgrade changes that code. WebGPU can still be selected from the menu for the
current session. Restart an already-running dev server and reload its page to
load the patched viewer.

If the PCB preview is black and displays `Error: WebGPU workers are unavailable`,
open the PCB toolbar's **View ▼ → Rendering Engine → Canvas**. The viewer saves
this choice for the current browser and site. This is a preview renderer error;
changing the circuit or autorouter is not required.

If the menu is inaccessible, run this in the browser's developer console on the
viewer page, then reload:

```js
localStorage.setItem("pcb_viewer_rendering_engine", JSON.stringify("canvas"));
location.reload();
```

The experimental WebGPU renderer requires `navigator.gpu`, Web Workers, and
`HTMLCanvasElement.transferControlToOffscreen`. Canvas avoids that requirement.
