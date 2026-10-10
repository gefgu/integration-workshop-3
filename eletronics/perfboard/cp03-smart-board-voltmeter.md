# CP03: Smart board, voltmeter on position 0

## Goal
Build the smart board **complete**: every socket, passive and connector for all 6
positions. Then plug in only ESP2 and the two multiplexers, and make position 0 work as a
voltmeter with its OLED. Requirements: EFR32.3 (voltmeter: ±5.25 V, ≥ 1 MΩ input,
error ≤ ±(0.10 V + 5 %)), SFR10 (≥ 10 readings/s), EFR16 (service contacts carry the OLED).

This is the DIP version of PCBv2 sheet `10_ESP2_SMART`. The 10 kΩ / 470 Ω node resistors
already sit on the modules (CP01).

## Adds (all soldered now)
| Part | Qty | Ref (PCBv2) | Notes |
|---|---|---|---|
| Perfboard 100 × 200 mm | 1 | — | |
| 2 × 19 female headers for ESP2 | 2 | P1, P2 | 5 V pin left unconnected |
| DIP-16 sockets | 4 | U1, U15 (595), U16, U20 (4051) | |
| DIP-14 sockets | 2 | U18, U19 (125) | |
| IDC 2×5 headers | 6 + 1 | smart cables pos 0–5, power cable | |
| Divider resistors | 2 × 560 kΩ, 2 × 680 kΩ | (R55–R58 on the PCB: 100k/150k) | Gives ≥ 1 MΩ input (EFR32.3) |
| ADC capacitors | 2 × 4.7 nF | (C35, C36 on the PCB: 100 nF) | Faster settling, see below |
| Mux reference | Y6 → GND; Y7 → 10 kΩ → 3V3_SYS | — | Y6 = auto-zero, Y7 = gain check |
| I²C pull-ups | 7 × 4.7 kΩ to 3V3_SYS | R37–R43 | SCL + SDA_0…5 |
| OE_N pull-ups | 6 × 10 kΩ to 5V_SYS | R60–R65 | Every P3 high-Z by default |
| DRV pull-downs | 6 × 100 kΩ | R66–R71 | |
| SR_OE_N pull-up | 10 kΩ to 5V_SYS | R59 | Outputs off by default |
| Output enable "AND" | 2 × BC547 in series, 10 kΩ base resistors, 100 kΩ base pull-downs | Q3 (one 2N7002 on the PCB) | Pulls SR_OE_N low only if P3_ENABLE (IO13) **and** EDU_ON are high |
| Decoupling | 6 × 100 nF (one per chip), 1 × 100 µF on 5V_SYS | | |
| Unused 125 buffers | U19 3A, 4A → GND; 3OE#, 4OE# → 5V | | |

Because of the BC547 pair, P3 can't drive anything while the student rail is off, even if
the firmware tries. That covers EFR28 in hardware, and fixes the weak spot found in the
PCBv2 review.

## Wiring table (main nets)
| Net | Connects |
|---|---|
| P1S_n (n = 0–5) | smart cable n pin 1 → U16 Yn |
| P2S_n | smart cable n pin 3 → U20 Yn |
| P3D_n | U18/U19 output n → smart cable n pin 5 (CP04 uses it) |
| MUX_S0 / S1 / S2 | ESP2 IO32 / IO33 / IO14 → U16 and U20 S0 / S1 / S2 |
| MUX_P1 | U16 Z → 560 kΩ → ADC_P1 (IO34); ADC_P1 → 680 kΩ → GND; 4.7 nF to GND |
| MUX_P2 | U20 Z → 560 kΩ → ADC_P2 (IO35); same divider |
| U16/U20 power | VCC = 5V_SYS, VEE = GND, E# = GND |
| SDA_n | ESP2 pin (table in `00-standards.md`) → smart cable n pin 7, with 4.7 kΩ pull-up |
| SCL | IO22 → pin 9 of all 6 smart cables, with 4.7 kΩ pull-up |
| 3V3_SYS, GND | smart cable pins 8 and 2/4/6, from the power cable |
| Shift chain (used in CP04) | IO27 → U1 DS; U1 Q7S → U15 DS; IO25 → both SHCP; IO26 → both STCP; U1 Q0–Q5 = DRV1–6 → 125 A inputs; U15 Q0–Q5 = OE_N1–6 → 125 OE# |

**Divider numbers.** Counting the module's 10 kΩ, K = 680 / (10 + 560 + 680) = **0.544**.
So 5.25 V reads as 2.86 V at the ADC, safely inside its range. The input resistance is
1.25 MΩ. The ADC node sees about 310 kΩ, so with 4.7 nF the time constant is about 1.5 ms:
**wait about 8 ms after switching the mux**. With 3 active positions that's still more than
10 readings per second (SFR10).

## Fritzing steps
1. 100 × 200 mm perfboard; sockets as generic DIP ICs labelled with the part numbers.
2. Place all parts now, including CP04's chips (shown in their sockets, marked "plug in at CP04").
3. Wire by the table, using the colours from `00-standards.md`.
4. Export the XML netlist. Claude diffs it against this table and PCBv2 sheet 10.

## Build steps
1. Sockets, headers, IDC headers first; then passives; then wires, net by net.
2. **Power test with empty sockets** (test 2) before plugging in any chip.
3. Plug in **ESP2, U16, U20 only**. U1, U15, U18 and U19 stay empty until CP04.

## Firmware changes (`firmware/esp32/smart_components/config.h`)
| Setting | Today | Perfboard |
|---|---|---|
| `PIN_MUX_A0 / A1 / A2` | 14 / 33 / 32 | **32 / 33 / 14** (S0 / S1 / S2, as on the PCBv2) |
| `MUX_CH` | {5, 0, 1, 2, 3, 4} | **{0, 1, 2, 3, 4, 5}** |
| `MUX_CH_GND` | 6 | 6 (now really GND) |
| `DIV_K`, `DIV_Z_MV` | 0.3705, 261.7 | **0.544, 0** (auto-zero still measures the offset) |
| `MUX_SETTLE_US_DEFAULT` | 2000 | **8000** |
| `PIN_SR_OE_N` (IO13) | active low | **active high** (now "P3_ENABLE"); needs an inversion in `outputs.cpp` |
| `AMMETER_POS` | 2 | none (no ammeter on the perfboard) |

## Tests
| # | Condition | Test | Pass |
|---|---|---|---|
| 1 | Power off | 5V_SYS, 3V3_SYS to GND; adjacent IDC pins | No shorts |
| 2 | Power on, all sockets empty | VCC/GND pins of every socket; SR_OE_N | 5 V / 0 V at the right pins; SR_OE_N = 5 V |
| 3 | ESP2 + U16 + U20 in, firmware flashed, capsule with OLED on position 0 | `scan` | OLED found at position 0 |
| 4 | Dongle on (rail = NODE00 − NODE01), rail on, `set 0 volt` | OLED and `stream on` vs multimeter | Within ±(0.10 V + 5 %) |
| 5 | Dongle off; test leads with an AA battery or bench supply between P1 and P2 at 0, 1.5, 3.3, 5.0 V, then reversed | Readings, including the sign | Within ±(0.10 V + 5 %) |
| 6 | `stats` | Voltmeter publish rate | ≥ 10 per second |
| 7 | Mux channel Y7 (3.3 V reference) | Reading | 3.3 V ± 2 %, otherwise adjust the gain with `cal` |
| 8 | Input resistance: meter between NODE00 and GND, position 0 selected | Resistance | ≥ 1 MΩ |

## Done
- [ ] Test log 1–8
- [ ] config.h changes committed
- [ ] `fritzing/cp03-smart-board-voltmeter.fzz` + netlist XML
- [ ] Photo
