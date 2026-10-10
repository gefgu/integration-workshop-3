# CP00: First light (one ESP32, 4 breadboard columns)

## Goal
The earliest hardware: one 100 × 100 mm perfboard with 4 bench columns of pogo pins that
behave like breadboard columns, and **one ESP32** that powers a fixed battery position
through **Dupont jumpers**. It proves the pogo pins, the capsule pads, the grid alignment
and the first real circuit, before any other electronics exist.

Drawing: [tscircuit/cp00-first-light.circuit.tsx](tscircuit/cp00-first-light.circuit.tsx)
(snapshots in `tscircuit/__snapshots__/`). Rules: [../guidelines.md](../guidelines.md).

## The board: one 100 × 100 mm perfboard, cut in two before soldering
| Piece | Holes | Becomes | Contents |
|---|---|---|---|
| Left, 28 holes wide | columns 1–28 | **Module A1** (final) | 4 node columns × 6 pogo pins, bare-wire straps, `J_NODE` (IDC 2×5) |
| Right, 11 holes wide | columns 29–39 | **ESP32 carrier** | 2 × 19 female headers (ESP32 DevKitC), 150 Ω resistor, 2-pin `J_BAT` header |

- **Cut** between hole columns 28 and 29 (red dashed line), and sand the left edge to
  half a hole, so the module is exactly 71.1 mm wide.
- **The ESP32 header rows are 10 holes (25.4 mm) apart**, at columns 29 and 39, right at
  the strip's edges. Measure your ESP32 first. If its rows are 22.86 mm apart (9 holes),
  use columns 30 and 39.
- Module A1 is built with its final parts. CP01 only **adds** the service pogo pins, the
  resistors and `J_SMART` in the grey reserved areas.

## Wiring
| From | To | Colour | Where |
|---|---|---|---|
| 6 pogo pins of each column | joined together = NODE00…NODE03 | bare | module |
| NODE00 / 01 / 02 / 03 (bottom pogo pin) | J_NODE pins 1 / 3 / 5 / 7 | blue | module |
| ESP32 IO32 | 150 Ω → J_BAT pin 1 (BAT+) | red | carrier |
| ESP32 GND (right header, pin 7) | J_BAT pin 2 (BAT−) | black | carrier |
| J_BAT pin 1 (BAT+) | J_NODE pin 1 = NODE00 = bench column 1 | **red Dupont jumper** | between pieces |
| J_BAT pin 2 (BAT−) | J_NODE pin 3 = NODE01 = bench column 2 | **black Dupont jumper** | between pieces |

The **battery capsule sits on columns 1–2, with + on column 1**. IO32 is the same pin that
later drives `EDU_PWR_EN`, so "Energizar" is already a GPIO.

The 150 Ω resistor limits a short circuit to 3.3 V / 150 Ω ≈ 22 mA, which the GPIO can
supply safely.

## Firmware (minimal)
```cpp
const int BAT = 32;
void setup() { Serial.begin(115200); pinMode(BAT, OUTPUT); digitalWrite(BAT, LOW); }
void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c == '1') digitalWrite(BAT, HIGH);  // energize
    if (c == '0') digitalWrite(BAT, LOW);   // off
  }
}
```

## What you can build on 4 columns (important)
Every capsule spans 2 adjacent columns (short jumpers too); long jumpers span 3. With
those lengths, **no series circuit (battery → resistor → LED → back) fits in one bank**:
- Parts of length 1 always join columns of opposite parity (odd ↔ even). Long jumpers
  always join columns of the same parity.
- A series loop needs a middle node next to both battery terminals. On a single line of
  columns, that's impossible.
- The `loop()` circuit in the validator tests is drawn this way, but no current flows
  through it.

So CP00 tests **parallel circuits across the battery** only:

| # | Circuit on the bench | Expected |
|---|---|---|
| 1 | LED on columns 1–2 (anode on column 1) | Lights with `1`, off with `0`, about 9 mA |
| 2 | LED reversed | Stays off |
| 3 | 1 kΩ capsule on columns 1–2, multimeter across columns 1 and 2 | About 2.9 V (the 150 Ω drops the rest) |
| 4 | Short jumper across columns 1–2 | About 22 mA; nothing gets hot; the ESP32 keeps running |
| 5 | Long jumper from column 1 to 3, LED on columns 3–4 | Off: column 4 isn't connected to anything |

This geometry limit is a product question for the team (see the README).

## Build steps
1. Count the holes on your board; it should be 39 × 39. Cut it, and sand the edge.
2. Module A1: pogo pins through the printed bench as a jig (see CP01), then straps,
   `J_NODE`, and the blue wires.
3. Carrier: female headers, resistor, `J_BAT`, red and black wires.
4. Tests below, then plug in the ESP32 and the two Dupont jumpers.

## Tests
| # | Power | Test | Pass |
|---|---|---|---|
| 1 | Off | Continuity within each node (6 pogo pins) | < 1 Ω |
| 2 | Off | Between nodes | Open |
| 3 | Off | J_NODE pins 1/3/5/7 to columns 1–4 | < 1 Ω, in order |
| 4 | Off | IO32 header pin to J_BAT pin 1 | 150 Ω |
| 5 | USB | `1` / `0` over serial, meter on J_BAT | 3.3 V / 0 V |
| 6 | USB | Circuits 1–5 above | As expected |

## Done
- [ ] Test log, photo of both pieces
- [ ] Notes for the team: did the capsule pads reach every pogo pin?
