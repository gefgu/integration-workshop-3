# Revision 9 — minimal power board on stripboard

**Candidate, not released.** A drastic simplification of the revision 8 power board for hand building: one 12 V input, two buck modules, and one switched, current-limited student rail on a stripboard. Revisions 5–8 are untouched. Open [simple-power.html](simple-power.html) for the schematic, top and underside drawings, build order with checks, cut and link tables, and open issues.

## What it is

```
12V_IN → F1 (2 A) → D1 → 12V_SYS ─┬─ buck module → 5V_SYS  (LED)
                                  └─ buck module → 3V3_SYS (LED)
5V_SYS → Q1 (P-MOSFET) → R_S 470 Ω → F_EDU (PTC) → 5V_EDU
Q1 gate: pulled to 5V_SYS by R_GP (rail OFF by default); pulled low only when
EDU_PWR_EN AND ROUTER_ALIVE are both high (Q2 and Q3 in series)
5V_EDU → 47 k / 47 k divider + 100 nF → EDU_SENSE (ESP32 ADC, firmware monitoring)
```

23 parts (two are buck modules), 64 solder joints, 7 strip cuts, 3 short link wires, no wire crossings. The revision 8 power board needs 167 wire runs and about 570 joints (figures from `revision8/lower/comparison.csv` at build time).

## What it gives up (requirement review needed)

- No over-/under-voltage guards (ENFR2 ceiling of 5.25 V now depends on the buck setting; measure it).
- No precise 12 mA trip or fault latch: `R_S` limits a short to at most 11.2 mA at 5.25 V (`5.25 / 470`); the PTC is the backup. EFR3/ENFR6/EFR9 and CP10–CP15 no longer apply as written.
- No fault or current-sense outputs; the firmware watches `EDU_SENSE`.
- The 12-pin `J_OUT` map is new and does not match the revision 8 ten-pin cable.
- Voltage sag: about 1 V at 2 mA through `R_S`.

## Checks (software only, not bench evidence)

`npm run build:revision9` runs:

1. `build-schematic.tsx` — tscircuit schematic; netlist and pin checks; every drawn net compared pin by pin with the stripboard design.
2. `check.mjs` — strips + cuts + links + component holes must give exactly the schematic nets (no shorts, no open nets, no unconnected-pin contact, no hole used twice).
3. `mutation-test.mjs` — five injected faults must each be reported.
4. `build-html.mjs` — writes the page and `bom.csv`, `cuts.csv`, `links.csv`, `solder-joints.csv`.

`design.mjs` is the single source of truth for parts, nets, hole positions, cuts and links. Connector and module part numbers are not shown or claimed (the purchased parts are not identified).

Schematic checks drop three warning families: connector reference-prefix, under-specified pins, and missing power/ground pin flags on headers and buck modules. They are modelled as passive connectors, not ICs.

## Open points

Bench-check the 2N7000 turn-on at a 3.3 V enable; confirm the fuse holder pitch (9 holes), buck-module common ground, C1 clearance, and that the student circuits tolerate the voltage sag. Nothing here has been built or measured.
