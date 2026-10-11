# Perfboard standards — revision 3

The authoritative rules are [tscircuit/guidelines.md](tscircuit/guidelines.md). Pin-level construction instructions are generated in [tscircuit/assembly](tscircuit/assembly/index.html); cable mapping is [cables.csv](tscircuit/assembly/cables.csv).

## Completed hardware

| Design | Quantity | Outline |
|---|---:|---|
| A1/A2/B1/B2 contact modules | 4 | 71.1 × 100 mm |
| A3/B3 contact modules | 2 | 53.34 × 100 mm |
| Power / smart controller | 2 | 100 × 200 mm |
| Smart channel | 6 | 100 × 150 mm |
| Matrix | 1 | 150 × 150 mm |
| Pi/PN532 harness | 1 | 100 × 100 mm |
| Manual continuity fixture | 1 | 100 × 100 mm |

All isolated-pad boards use 2.54 mm pitch. Actual stock-board margins, connector bodies and adapter sizes must fit the documented hole coordinates. Contact pitch remains 17.78 mm horizontally and 10.16 mm vertically. Only pogo contacts face the bench on contact modules; wiring and keyed headers are underneath. Bank B reflects the rows and header/service edges; capsules keep the same orientation and support both service edges (user-confirmed). Service electrical order remains SCL/SDA/GND/3V3, with no P1/P3 reversal.

## Interfaces

NODE ribbons use odd pins 1/3/5/7 for the corresponding educational nodes; other pins are unconnected. SMART_RAW v2 pins 1/3/5 are raw P1/P2/P3, 2/4/6 ground, 7 SDA_B, 8 3V3_SYS, 9 SCL_B, 10 unconnected. Do not fit the old 10kΩ/470Ω module frontend.

CTRL v2: 1 HIGH_REQ, 2 LOW_REQ, 3 AMM_REQ, 4 GND, 5 5V_SYS, 6 3V3_SYS, 7 SDA_A, 8 USB_3V3, 9 SCL_A, 10 5V_EDU. P3 sources current from 5V_EDU; relay LEDs and logic consume 5V_SYS. POWER_MATRIX v2 pin9 carries router ALIVE; pin10 is 12V_SYS.

Do not connect bench 5V to Pi/ESP USB 5V. Share ground. Each smart position has a separate buffered B-side I2C bus; never join those buses. Use labelled external-module pigtails and verify pin1-to-pin1 continuity before plugging them in. Install cables and external modules at the assigned checkpoint.

Firmware pin maps, register ordering, MT addresses, power sequencing and mode specifications are in [firmware-contract.md](tscircuit/firmware-contract.md). CP00–CP36 documents describe construction groups, acceptance and filmed wins. Earlier permanent wiring stays fixed.

## Early fixed interfaces

Power J_FIXED_BATTERY pin1=5V_EDU to A1 J_NODE pin3 (C2 positive), pin2=GND to J_NODE pin1 (C1). These are removable patch leads; unplug before matrix routing. Never tie a fixed source to a matrix-selected source.

Router J_FIXTURE and fixture J_CONTROL: 1 USB_3V3, 2 GND, 3 FIX_SDA (GPIO4), 4 FIX_SCL (GPIO16), 5 FIX_STIM (GPIO25). TEST_A=C4 / J_NODE pin7; TEST_B=C1 / pin1. JP_RETURN joins TEST_B to GND only during supervised testing. All diagnostic leads are removed before normal operation.

A1 first demonstration uses the actual battery, 1kΩ resistor, LED and three-gap kit jumper. Choose measured-fit rows; the four-column electrical loop is specified in CP00. Later top-side kit arrangements may change.

## Temporary USB fixture

The USB breadboard is a400-tie reference with isolated five-hole rows, not a solderable perfboard. Confirm actual row ties and rail breaks with a DMM. Seventeen permanent perfboards retain their construction outlines; the extra breadboard is a removable fixture. Its54×82mm reference envelope is not measured stock-board verification.
