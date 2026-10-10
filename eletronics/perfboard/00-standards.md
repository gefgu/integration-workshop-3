# CP00: Standards (read before soldering anything)

Everything here is fixed for the whole build. Later checkpoints refer to it instead of
repeating it. If something here changes, every board that already exists must still match.

## 1. Net names
Use the PCBv2 net names everywhere (Fritzing labels, wire tags, test logs), so the
perfboard can be diffed against the EasyEDA netlist (`eletronics/.analysis/main-pcbv2.txt`).

| Group | Names |
|---|---|
| Nodes | `NODE00` … `NODE21` |
| Smart taps (after the module resistors) | `P1S_n`, `P2S_n` (sense, after 10 kΩ), `P3D_n` (drive, before 470 Ω), n = position 0–5 |
| I²C | `SCL`, `SDA_0` … `SDA_5` |
| Shift registers | `SR_SER`, `SR_SRCLK`, `SR_RCLK`, `SR_OE_N`, `SR_CHAIN`, `DRV1`…`DRV6`, `OE_N1`…`OE_N6` |
| Mux | `MUX_S0`, `MUX_S1`, `MUX_S2`, `MUX_P1`, `MUX_P2`, `ADC_P1`, `ADC_P2` |
| Rails | `12V_SYS`, `5V_SYS`, `3V3_SYS`, `5V_EDU`, `GND` (one ground everywhere, EFR27) |
| Student power | `EDU_PWR_EN`, `EDU_FAULT`, `EDU_FAULT_RESET`, `EDU_CURRENT_ADC`, `EDU_ON` |
| Matrix | `XBAR_DAT`, `XBAR_CLK`, `XBAR_LATCH`, `XBAR_STB_A`, `XBAR_STB_B`, `XBAR_RST`, `XBAR_ENABLE`, `XBAR_DIAG_ADC`, `BUS2`…`BUS7` |

## 2. ESP32 pin maps (same as PCBv2)
These assume a **38-pin ESP32 DevKitC** (2 × 19 pins). If your boards differ, fix this
table first, because everything else follows from it.

**ESP2 (smart board):**

| GPIO | Net | GPIO | Net |
|---|---|---|---|
| 34 | ADC_P1 | 22 | SCL |
| 35 | ADC_P2 | 4 | SDA_0 |
| 32 | MUX_S0 | 21 | SDA_1 |
| 33 | MUX_S1 | 19 | SDA_2 |
| 14 | MUX_S2 | 18 | SDA_3 |
| 25 | SR_SRCLK | 17 | SDA_4 |
| 26 | SR_RCLK | 16 | SDA_5 |
| 27 | SR_SER | 5V pin | not connected (see below) |
| 13 | P3_ENABLE (high = outputs on) | GND | GND |

Both ESP32s are **powered over USB** (a laptop while testing, the Pi from CP09). Their 5 V
pins stay unconnected, so a USB cable can never back-feed the board's 5 V rail. This is a
small deviation from the PCB, where ESP2 takes 5 V from the board. Only GND is shared.

**ESP1 (matrix board).** The PCB's names are kept; only the meaning of a few changes for the MT8816:

| GPIO | Net | Use on the perfboard |
|---|---|---|
| 23 | XBAR_DAT | Serial data into the address register (74HCT595) |
| 18 | XBAR_CLK | Shift clock of the address register |
| 22 | XBAR_LATCH (PCB: STB_C) | Latch of the address register |
| 19 | XBAR_STB_A | STROBE of MT8816 A (bank A) |
| 21 | XBAR_STB_B | STROBE of MT8816 B (bank B) |
| 27 | XBAR_RST | RESET of both MT8816 |
| 33 | XBAR_ENABLE | Enables the control buffer (default off) |
| 36 | XBAR_DIAG_ADC | SENSE tool reading |
| 32 | EDU_PWR_EN | Student-rail enable request |
| 35 | EDU_FAULT | eFuse latch tripped (input) |
| 17 | EDU_FAULT_RESET | Clears the eFuse latch |
| 34 | EDU_CURRENT_ADC | Student-rail current |
| 25, 26, 13, 14 | spare (PCB: STB_D, STB_E, fans) | Keep free |

Avoid the strapping pins (0, 2, 5, 12, 15) and the flash pins (6–11) on both boards.

## 3. Wire colours (solid-core 22–24 AWG)
| Colour | Use |
|---|---|
| Red | 5 V (5V_SYS, 5V_EDU) |
| Orange | 3V3_SYS |
| Brown | 12V_SYS |
| Black | GND |
| Blue | Node lines (NODExx) and buses |
| Yellow | Digital control (shift registers, matrix control, enables) |
| Green | Analog (ADC lines, P1S/P2S sense) |
| White | I²C (SCL, SDA_n) |
| Bare tinned wire | Straps between the 6 pogo pins of the same node (module back side only) |

Use the same colours in Fritzing (right-click a wire → colour).

## 4. Connectors: IDC 2 × 5 box headers (keyed) + ribbon
One connector type for everything, so cables are interchangeable. Pin 1 is marked with a
triangle on the header and a red stripe on the ribbon.

**Node cable** (module → matrix board). The even pins are left unused, so no two node lines sit next to each other in the ribbon.

| Pin | Signal | Pin | Signal |
|---|---|---|---|
| 1 | first node of the module | 2 | NC |
| 3 | second node | 4 | NC |
| 5 | third node | 6 | NC |
| 7 | fourth node (NC on A3/B3) | 8 | NC |
| 9 | NC | 10 | NC |

**Smart cable** (module → smart board):

| Pin | Signal | Pin | Signal |
|---|---|---|---|
| 1 | P1S_n | 2 | GND |
| 3 | P2S_n | 4 | GND |
| 5 | P3D_n | 6 | GND |
| 7 | SDA_n | 8 | 3V3_SYS |
| 9 | SCL | 10 | reserved (ammeter, EFR32.4 optional) |

**Power/control cable** (power board → matrix board):

| Pin | Signal | Pin | Signal |
|---|---|---|---|
| 1 | 5V_EDU | 2 | GND |
| 3 | 3V3_SYS | 4 | 5V_SYS |
| 5 | EDU_PWR_EN | 6 | EDU_FAULT |
| 7 | EDU_FAULT_RESET | 8 | EDU_CURRENT_ADC |
| 9 | GND | 10 | 12V_SYS (MT8816 supply input) |

**Power cable** (power board → smart board):

| Pin | Signal | Pin | Signal |
|---|---|---|---|
| 1 | 5V_SYS | 2 | GND |
| 3 | 5V_SYS | 4 | GND |
| 5 | 3V3_SYS | 6 | GND |
| 7 | EDU_ON | 8 | NC |
| 9 | NC | 10 | NC |

`EDU_ON` is high only while the student rail is really on (eFuse closed). The smart board
uses it to force every P3 to high-Z when the rail is off (EFR28), in hardware.

Label both ends of every cable, e.g. `A2-NODE`, `A2-SMART`, `PWR-MATRIX`, `PWR-SMART`.

## 5. Module geometry
- Grid: **17.78 mm between columns (7 holes)**, **10.16 mm between rows (4 holes)**, from
  `eletronics/connection-board-mechanical-plan.md`.
- 4-column module: **28 holes wide**, pogo columns at holes 4, 11, 18, 25 (counting from 1).
  3-column module: **21 holes wide**, columns at 4, 11, 18. Cut the board edges midway
  between hole rows, so that modules butt together at exactly 17.78 mm.
- Rows: 6 pogo rows, 4 holes apart (holes r, r+4, …, r+20).
- **Service contacts** (OLED power + I²C for the capsule): 4 pogo pins at the position's
  middle column, **6 holes (15.24 mm) outside the bank** (above row 1 on bank A, below on
  bank B). Pin order is the same as the PCBv2 service header: **SCL, SDA, GND, 3V3**.
  Match them to the holes actually printed in the bench.
- **The top side faces the bench**, and only pogo pins go there. Resistors, wires and the
  IDC headers go on the **underside**. Keep solder joints on the top flat.
- Bank B modules are mirror images: the service contacts are below the bank, and the IDC
  headers on the other edge.
- Two M3 mounting holes per module, in positions the printed bench allows.

## 6. Sockets and daughterboards
- Every DIP chip goes in a socket (turned-pin preferred). The ESP32s go in female headers.
- The **discrete eFuse** (CP02) and the **MT8816 control circuit** (CP05) are daughterboards
  on 2.54 mm pin headers, because their values are the least certain.

## 7. Datasheet checks before buying or soldering
| Part | Check | Needed by |
|---|---|---|
| MT8816AE | Maximum VDD; logic-high threshold at the VDD you choose; X address table (as I remember, it isn't in order: X6–X11 and X12–X13 are swapped around); CS polarity; current per switch | CP05 |
| P-MOSFET for the eFuse | Fully on at Vgs = −5 V (logic-level) | CP02 |
| 74HCT595 / 74HCT125 / 74HCT4051 | Available in DIP (N suffix) | CP03 |
| Pogo pins | Diameter, length and travel vs the printed holes | CP01 |

## 8. Test kit
- Multimeter with continuity, resistance and a 200 mV range.
- Bench supply with a current limit (or a 12 V adapter plus the first-power-on limit resistor).
- A known load board: LED + 470 Ω, 1 kΩ, and a 100 Ω "short" resistor.
- An oscilloscope or logic analyser if available (for the EFR9 < 1 ms check). If not, use
  an LED on EDU_FAULT and the ESP1 log timestamps.
- A test log per checkpoint (`cpNN-log.md` next to the checkpoint file, or a notebook photo).

## 9. Fritzing conventions
See [fritzing/README.md](fritzing/README.md). Briefly: one sketch per checkpoint; each
copies the previous one and only adds parts; export the XML netlist and ask Claude to
diff it against the checkpoint's wiring table before soldering.
