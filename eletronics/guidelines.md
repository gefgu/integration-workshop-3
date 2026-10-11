# Electronics guidelines

The authoritative perfboard rules are [perfboard/tscircuit/guidelines.md](perfboard/tscircuit/guidelines.md).

The latest evaluation is the [revision6 four-board hybrid](perfboard/tscircuit/revision6/README.md): four permanent 10×20 cm isolated-pad boards, two lower boards on a removable tray, and smart electronics on PCB contracts. Read its firmware handoff. Revision5 remains the electrical baseline; physical fit, solder access, bench qualification and PCB manufacturing are pending release gates.

Build incrementally through CP00–CP36. Later checkpoints add hardware without relocating earlier permanent work; removable test leads and jumpers may change. New construction uses the [revision5 bank-module prototype](perfboard/tscircuit/revision5/README.md) on7×10cm stock, with A4-landscape TOP/mirrored-underside PDFs. Follow its firmware handoff and measured release gates. See [the audit](perfboard/tscircuit/AUDIT.md) for design limits and verification status.
