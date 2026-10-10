# CP07: Modules A2 and A3 (complete bank A)

## Goal
Add the other two bank-A modules. They're copies of A1, and their cables plug into
headers that already exist on the matrix and smart boards. **No central board is
touched.** Requirements: EFR31.2 positions 1–2, EFR16.

## Adds
| Module | Columns | Nodes | Smart position | Size | Differences from A1 |
|---|---|---|---|---|---|
| A2 | 5–8 | 04–07 | 1 → 04/05/06 (SDA_1) | 28 holes wide | None; same build sheet with new labels |
| A3 | 9–11 | 08–10 | 2 → 08/09/10 (SDA_2) | **21 holes wide** | 3 columns, 18 + 4 pogo pins; node cable pin 7 not connected |

Follow `cp01-module-a1.md` step by step for each one, replacing the node, position and
SDA names. Service contacts sit at the middle column of the position (column 6 for A2,
column 10 for A3).

## Fritzing steps
Copy `cp06` → `cp07-modules-a2-a3.fzz`. Duplicate the A1 module, rename the nets
(NODE04–07 / NODE08–10, P1S_1…, SDA_1…), and connect them to the existing A2/A3 headers.

## Tests
| # | Test | Pass |
|---|---|---|
| 1 | All CP01 tests on each module | Pass |
| 2 | Both modules side by side with A1 under the bench: a capsule seats evenly across the module joints | No step or gap felt; every pogo pin touches |
| 3 | Plug in the cables; `route 4 5v`, `route 5 gnd` … for each node | Each node routes correctly |
| 4 | Positions 1 and 2: `scan`, `set 1 volt`, `set 2 gate and` | Same results as CP03/CP04 on position 0 |
| 5 | Three positions active at once (0, 1, 2) | Works; a fourth `set` is refused |
| 6 | Circuit spanning A1 and A2 (e.g. columns 3–6), real jumpers across the module joint | Works; `precheck` passes |

## Done
- [ ] Test log per module
- [ ] Bank A complete: 11 nodes, 3 positions
