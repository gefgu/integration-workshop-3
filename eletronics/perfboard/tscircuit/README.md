# TedTronics guided assembly

```sh
cd eletronics/perfboard/tscircuit
npm ci
npm run assembly:app
```

Open **http://127.0.0.1:8080** and create a new guided build. The guide gives one highlighted construction or inspection action per screen, its expected result, and a saved place to resume. TOP and MIRRORED UNDERSIDE stay together. Temporary breadboard steps include a separate top view with connected rows.

## The journey

Thirty-seven checkpoints are grouped into chapters: LED → continuity → screen → voltage → final power → output → logic/memory → current → matrix → expansion → Pi/NFC/integration. The first checkpoint requires USB, a multimeter, the first four bank columns and a small current-limited breadboard switch. **The complete protected power board is not required until the later power chapter (CP09–14).** Matrix chips first enter at CP24.

Choose “Show local schematic” for the current functional circuit and mapped external ports. “Explore full boards” opens the detailed workspace, complete schematics and approximate3D placement companions. Drawings are construction instructions; purchased-part fit and actual electrical behavior must be measured.

Click “Done — next step” after doing the action and checking its result. Measurement actions require an actual recorded pass. Firmware actions require the compatible external firmware revision; **firmware is not supplied by this app**. Without it, leave the action pending. Final timing/transient tests also remain pending until the required oscilloscope and supply are available.

SQLite stores construction, inspections, current step, unfinished notes, measured attempts and history at `app/data/assembly.sqlite`. Set `ASSEMBLY_DB` or `ASSEMBLY_PORT` to override these. Export/import transfers the pinned design, drawings and progress into a separate build. Existing fourteen-checkpoint builds keep their original catalog and workspace; create a new build for this redesigned sequence.

## Build and verify

```sh
npm run build
npm run verify
npm run assembly:app:test
npm run assembly
npm run assembly:app:build
```

`build` creates all thirteen circuit exports and native local schematics. `verify` checks local schematics, cumulative construction states, full circuits, copper diagnostics and independent manual-wire/breadboard-row connectivity. Run `assembly` after verification to refresh the public report. Read [guidelines.md](guidelines.md), [AUDIT.md](AUDIT.md), [firmware-contract.md](firmware-contract.md) and the checkpoint instructions linked from [the static reference](assembly/index.html).

Prototype positive and temporary3V3 links must be removed before the qualified final source connects. Removable fixture changes preserve earlier permanent soldering. Bank B keeps the same capsule orientation. Pogo identity, adapter dimensions and actual kit fit remain pending identification/measurement tasks.

For UI development, run the app server and `npm run assembly:app:dev` in another terminal. The server listens only on localhost. It does not communicate with or energize hardware; simulated camera approval never counts as measured evidence.

Contacts in one node column are placed together, then inspected separately. Next step saves construction without a checkbox. The board starts fitted in both orientations; use the mouse wheel to zoom at the pointer, drag to pan, or Fit board to restore context. Older guided builds can explicitly use refreshed drawings when the hardware/checkpoint model is identical; existing progress stays saved.
