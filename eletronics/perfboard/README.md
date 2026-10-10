# Perfboard bench: build plan and checkpoints

A hand-built, modular version of the full 22-node TedTronics bench. It is the fallback if
the MAIN PCBv2 (`eletronics/1-Schematic_Oficinas 3 - MAIN PCBv2.json`) arrives late or with
bugs. The EasyEDA schematic stays the reference for net names and circuits. Each checkpoint
is drawn in Fritzing first, then soldered, then tested.

## The no-rework rule
1. **A board is soldered complete the first time it appears**: every resistor, connector
   and IC **socket**. Later checkpoints only plug in chips and cables, add new boards, or
   change firmware.
2. **Uncertain circuits go on plug-in daughterboards** (on pin headers): the discrete eFuse
   and the matrix control. If one turns out wrong, you rebuild a small daughterboard, not
   the board under it.
3. **Every board has an acceptance test.** A board that passed its test is not opened again.

## Architecture
```
              ┌──────────── printed bench (pogo holes) ────────────┐
              │  [A1] [A2] [A3]   bank A, columns 1-4 / 5-8 / 9-11  │
              │  [B1] [B2] [B3]   bank B, same columns, mirrored    │
              └──┬───┬─────────────────────────────────────────────┘
       node cable│   │smart cable        (IDC 2x5 ribbon, one of each per module)
                 ▼   ▼
  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │ MATRIX BOARD     │  │ SMART BOARD      │  │ POWER BOARD      │
  │ ESP1             │  │ ESP2             │  │ 12 V in, bucks   │
  │ 2 x MT8816 (A,B) │  │ 595 x2, 125 x2,  │  │ discrete eFuse   │
  │ control daughter-│  │ 4051 x2,         │  │ (daughterboard)  │
  │ board, test tools│  │ dividers         │  │ PTC, current out │
  └────────▲─────────┘  └────────▲─────────┘  └───┬──────────┬───┘
           └──── power/control cable ─────────────┘          │
                                 └──── power cable ──────────┘
  Raspberry Pi + camera + screen + controller (Energizar / Back): checkpoint 09
```
- **Jumpers are real conductors.** The matrix only connects the battery capsule's two
  nodes to GND and 5V_EDU. The 6 bus lines are still wired, because the test tools reach
  a node through a bus.
- **Two ESP32s with the PCBv2 pin map** (ESP1 = matrix/power, ESP2 = smart capsules). The
  firmware is shared with the PCB, except the matrix back-end (MT8816 instead of CH446Q).

## Node, column and position map
Node number = bank × 11 + (column − 1), with bank A = 0 and bank B = 1. This matches the
PCBv2 netlist.

| Module | Bank | Columns | Nodes | Smart position (P1/P2/P3) | Free node | OLED line |
|---|---|---|---|---|---|---|
| A1 | A | 1–4 | 00–03 | 0 → 00/01/02 | 03 | SDA_0 (ESP2 IO4) |
| A2 | A | 5–8 | 04–07 | 1 → 04/05/06 | 07 | SDA_1 (IO21) |
| A3 | A | 9–11 | 08–10 | 2 → 08/09/10 | — | SDA_2 (IO19) |
| B1 | B | 1–4 | 11–14 | 3 → 11/12/13 | 14 | SDA_3 (IO18) |
| B2 | B | 5–8 | 15–18 | 4 → 15/16/17 | 18 | SDA_4 (IO17) |
| B3 | B | 9–11 | 19–21 | 5 → 19/20/21 | — | SDA_5 (IO16) |

At most 3 positions are active at a time (firmware rule).

## Boards and perfboard sizes
| Board | Qty | Cut from | Notes |
|---|---|---|---|
| Node module, 4 columns | 4 (A1, A2, B1, B2) | 100 × 100 mm | Width **≤ 71.1 mm (28 holes)** so neighbours fit |
| Node module, 3 columns | 2 (A3, B3) | 100 × 100 mm | Width **≤ 53.3 mm (21 holes)** |
| Power board | 1 | 100 × 150 mm | Discrete eFuse on a daughterboard |
| Smart board | 1 | 100 × 200 mm | 6 DIP sockets, ESP2 sockets, 6 smart IDC headers |
| Matrix board | 1 | 150 × 150 mm | 2 DIP-40 sockets, ESP1, control daughterboard, 6 node IDC headers |
| Fixed-battery dongle | 1 | scrap | Temporary, CP02 to CP05 only |

## Checkpoint ladder
| CP | File | Builds / plugs in | Closing test |
|---|---|---|---|
| — | [00-standards.md](00-standards.md) + [../guidelines.md](../guidelines.md) | Standards and drawing rules (read first) | — |
| 00 | [cp00-first-light.md](cp00-first-light.md) | One 100 × 100 mm board cut in two: module A1 columns + ESP32 carrier; the ESP32 powers the battery columns through Dupont jumpers | LED across the battery lights on command |
| 01 | [cp01-module-a1.md](cp01-module-a1.md) | Module A1, complete | Continuity and isolation of the 4 nodes |
| 02 | [cp02-power-board.md](cp02-power-board.md) | Power board + fixed-battery dongle | LED circuit on A1 lights; a short latches off in < 1 ms |
| 03 | [cp03-smart-board-voltmeter.md](cp03-smart-board-voltmeter.md) | Smart board, complete; plug in ESP2 + 4051 ×2 | Position 0 voltmeter matches a multimeter; OLED shows it |
| 04 | [cp04-smart-outputs.md](cp04-smart-outputs.md) | Plug in 595 ×2 + 125 ×2 | Gate, pulse and memory on position 0; P3 high-Z when off |
| 05 | [cp05-matrix-board.md](cp05-matrix-board.md) | Matrix board, complete; plug in ESP1 + MT8816 A | ESP1 powers the battery nodes; switches open at boot |
| 06 | [cp06-test-tools.md](cp06-test-tools.md) | Test-tool firmware | A short blocks Energizar before power is applied |
| 07 | [cp07-modules-a2-a3.md](cp07-modules-a2-a3.md) | Modules A2, A3 | Positions 1–2 work; bank A complete |
| 08 | [cp08-bank-b.md](cp08-bank-b.md) | Plug in MT8816 B; modules B1–B3 | All 22 nodes, all 6 positions |
| 09 | [cp09-integration.md](cp09-integration.md) | Pi, camera, screen, controller, 12 V supply | Place → validate → Energizar → circuit works (D6 gate) |

Fritzing files: see [fritzing/README.md](fritzing/README.md).

## Open product question: series circuits don't fit the geometry
Every capsule spans 2 adjacent columns, and long jumpers span 3. With these lengths, a
series loop (battery → resistor → LED → back) **cannot be built inside one bank**, with
or without the matrix. Parts of length 1 always join odd ↔ even columns, and long jumpers
join columns of the same parity, so no middle node can touch both battery terminals.
Only parallel circuits across the battery work. Details and a test in
[cp00-first-light.md](cp00-first-light.md). The team has to decide how the bench allows
series circuits.

## Requirement deviations to discuss with the team
These are **not** changed in Notion. They're listed so the team can decide.

| Req. | Today | Perfboard does |
|---|---|---|
| EFR21 | Routing by CH446Q | MT8816AE (same 16 × 8 crosspoint idea, DIP package) |
| EFR22 | Serial DAT/CLK/STB to the matrix | Serial into a 74HCT595, which drives the MT8816's parallel address. Still 3 wires plus strobes. |
| EFR31.2 | 3 smart positions, bank A only | 6 positions (max 3 active), like the PCB |
| SFR1 / validator | A column is one net across both banks | Banks are separate nodes (22), like the PCB |
| EFR32 | P3 low ≤ 0.5 V with a **2 mA** load | With 470 Ω (needed for EFR30's 12 mA limit) the low level is about 0.94 V at 2 mA. It passes at 1 mA, the pending proposed change. |
| EFR32.3 | Voltmeter input ≥ 1 MΩ | Met by the higher-value divider in CP03. The PCBv2's 250 kΩ divider does not meet it. |
