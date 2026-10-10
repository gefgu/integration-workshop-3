# CP01: Module A1 (bank A, columns 1–4)

## Goal
Build the first node module **complete**, so it never has to be touched again: 4 nodes
with 6 pogo pins each, the smart-position resistors, the capsule service contacts and both
cable headers. Requirements: EFR16 (3 circuit contacts + separate service contacts),
EFR27 (shared ground on the service contacts).

## Adds
| Part | Qty | Value / type | Notes |
|---|---|---|---|
| Perfboard | 1 | cut to 28 × ~32 holes from 100 × 100 mm | Edges cut midway between holes |
| Pogo pins (node contacts) | 24 | per your order | 4 columns × 6 rows |
| Pogo pins (service contacts) | 4 | same type | SCL, SDA, GND, 3V3 above row 1, at column 2 |
| Resistor | 2 | 10 kΩ 1/4 W | P1 sense (NODE00), P2 sense (NODE01) |
| Resistor | 1 | 470 Ω 1/4 W | P3 drive (NODE02) |
| IDC 2×5 box header | 2 | — | Node cable and smart cable |
| Bare tinned wire | — | — | Straps between the 6 pins of each node |

**Nothing is left for later.** The module is final after this checkpoint.

## Wiring table
| From | To | Colour |
|---|---|---|
| All 6 pogo pins of column 1 | strapped together = NODE00 | bare |
| All 6 pogo pins of column 2 | NODE01 | bare |
| All 6 pogo pins of column 3 | NODE02 | bare |
| All 6 pogo pins of column 4 | NODE03 | bare |
| NODE00, NODE01, NODE02, NODE03 | node cable pins 1, 3, 5, 7 | blue |
| NODE00 → 10 kΩ → | smart cable pin 1 (P1S_0) | green |
| NODE01 → 10 kΩ → | smart cable pin 3 (P2S_0) | green |
| NODE02 → 470 Ω → | smart cable pin 5 (P3D_0) | yellow |
| Service pogo GND | smart cable pins 2, 4, 6 | black |
| Service pogo 3V3 | smart cable pin 8 | orange |
| Service pogo SDA | smart cable pin 7 (SDA_0) | white |
| Service pogo SCL | smart cable pin 9 | white |

Put the resistors **close to the node**. Then a damaged cable is still current-limited.

## Fritzing steps
1. Perfboard sized 28 holes wide. Mark the 4 pogo columns at holes 4, 11, 18, 25, with rows
   4 holes apart (see `00-standards.md` §5).
2. Place 28 `POGO` parts, the 3 resistors, and the 2 IDC headers (on the underside edge
   toward the bench's centre channel).
3. Draw the straps and the wiring table above, with the colours shown.
4. Export the XML netlist, and have Claude diff it against the wiring table.

## Build steps
1. **Grid check:** lay the bare perfboard on the printed bench and check that the holes line up.
2. **Pogo pins, using the bench as a jig:** put the pogo pins into the bench holes, lay the
   board on them, and solder one pin per corner first. Lift it off, check it's square, then
   solder the rest.
3. Straps on the back, one per node. Don't bridge two columns.
4. Resistors and IDC headers on the underside.
5. Clean the flux and inspect for bridges between columns.

## Tests (all power off)
| # | Test | Pass |
|---|---|---|
| 1 | Continuity between all 6 pins of each node | Beep, < 1 Ω |
| 2 | Resistance between every pair of different nodes (6 pairs) | Open (> 10 MΩ) |
| 3 | NODE00 to smart pin 1, NODE01 to smart pin 3 | 10 kΩ ± 1 % |
| 4 | NODE02 to smart pin 5 | 470 Ω ± 1 % |
| 5 | Node cable pins 1/3/5/7 to the pogo pins of columns 1–4 | < 1 Ω, in that order |
| 6 | Service pogo pins to smart pins 7, 8, 9 and 2/4/6 | < 1 Ω, in the order of the wiring table |
| 7 | Every node to every service pin | Open |
| 8 | Press a test capsule onto the bench: every pogo pin touches its pad | Continuity through the capsule |

## Firmware/software
None.

## Done
- [ ] Photo of both sides
- [ ] Test log (all 8 tests)
- [ ] `fritzing/cp01-module-a1.fzz` + netlist XML saved
- [ ] Label "A1" on the board
