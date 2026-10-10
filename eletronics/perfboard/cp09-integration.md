# CP09: Integration (Pi, camera, screen, controller)

## Goal
Run the full chain on the perfboard bench: the student places parts → the camera sees
them → the Pi validates → Energizar → the circuit works, with the smart capsules showing
their values. This is the D6 gate (Nov 12). Requirements: MFR3, MFR4, MFR5 (controller
with Energizar and Back), EFR18 (energize only after every check), ENFR8 (rail off if
communication is lost), SFR5 (step approval), EFR24 (12 V input).

## Adds
| Part | Notes |
|---|---|
| Raspberry Pi + screen + camera | Mounted on the printed bench |
| XL4015 5 V / 5 A module on the power board's reserved terminal, or a separate Pi supply | Pi 4/5 + screen can draw 3 A or more at 5 V. See the CP02 reality check about the 12 V / 2 A adapter. |
| Controller: Energizar + Back buttons (+ joystick) | Wired to Pi GPIOs, with pull-ups and a 100 nF debounce capacitor each. They're requests: the Pi decides, ESP1 switches. |
| 2 USB cables | Pi → ESP1 and Pi → ESP2 (power + serial) |

## Software pieces needed
| Piece | Where | Status |
|---|---|---|
| Graph validation + feedback | `graph_validator/` | Exists |
| Electrical checks (predicted current ≤ 12 mA per switch, shorts, capacitor needs a series resistor) | `graph_validator/` | To do (ENFR6, EFR18) |
| Routing: battery capsule position → `route` commands | Pi service | To do |
| Router firmware: matrix, rail, precheck, heartbeat | `firmware/esp32/router/` | CP05/CP06 |
| Smart firmware: modes from the Pi, values back to the Pi | `firmware/esp32/smart_components/` | Serial console exists; Pi protocol to do |
| Energizar flow: button → validate → route → precheck → `rail on` | Pi | To do |

## Energizar sequence (EFR18)
1. Graph validation passes, and every component is recognised.
2. The predicted current is within the limits (ENFR6).
3. Every active smart capsule acknowledges its configuration.
4. ESP1: `clear` → `route` → `precheck`.
5. ESP1: `rail on`. Pressing Energizar again switches the rail off (MFR5).
6. While on: a heartbeat from the Pi every 500 ms, otherwise ESP1 drops the rail (ENFR8).

## Tests (the D6 rehearsal)
| # | Scenario | Pass |
|---|---|---|
| 1 | Guided lesson: battery + resistor + LED | Steps approved; Energizar lights the LED |
| 2 | Same circuit built in another place on the bench | Approved (SFR8); the battery is routed where it sits |
| 3 | Student adds a short | Feedback shown; precheck blocks Energizar; the eFuse never needs to trip |
| 4 | Voltmeter capsule across the LED, at any position | OLED and the screen show the voltage |
| 5 | Gate capsule driving an LED, inputs from push-buttons | Works per the truth table |
| 6 | Unplug the Pi's USB to ESP1 while energized | Rail off within about 1 s |
| 7 | Power-cycle the whole bench | Everything starts OFF |
| 8 | 30-minute run with repeated lessons | No resets, no false trips |

## Done
- [ ] Demo script written and rehearsed
- [ ] Video of the full chain (for the presentation and backup)
