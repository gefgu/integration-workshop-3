# Revision6 firmware and checkpoint handoff

Read the revision5 firmware contract first. Its GPIO mapping, protocol generations, ADC/current conventions, fault behavior and RC522 SPI ordering remain authoritative. Revision6 consolidates physical board locations, not the firmware ownership model. `baseline-crosswalk.csv`, `design.json` and the endpoint tables identify the new physical references.

## Permanent build

ESP1 owns routing, student-rail enable/reset and router watchdog. ESP2 owns smart scans, mux selectors, relay registers and its independent watchdog. Keep USB_ROUTER_3V3 and USB_SMART_3V3 distinct. Preserve all per-position TCA9517 B-side buses and independent output/current isolation; an ADC/current-sensor ACK is not capsule presence.

Preserve OFF → clear → configure → precheck → fresh acknowledgements → READY → explicit enable. Reject stale/mismatched sessions, communication loss, a fourth active position and invalid routing. Fault/reset/reconnect never automatically restores power. Keep heartbeat edges at 50 ms only while authorization is fresh; qualify actual expiry at 200–350 ms and communication-loss shutdown within 1 s.

Retain calibrated ±5.25 V differential readings with absolute inputs 0–5.25 V, ≥10 Hz updates, precision continuity ≤20 Ω pass / ≥100 Ω reject with an uncertainty band, external 1 Ω INA226 shunt/Kelvin connections, and source/sink mutual exclusion plus break-before-make. Benchmark three active capsules; prototype timing is not bank timing.

## Standalone early reference profile

This explicit fixture profile is independent of CP acceptance on the permanent build:

| Signal | Connection |
|---|---|
| SDA | ESP GPIO4 → ADS1115/OLED direct SDA |
| SCL | ESP GPIO22 → ADS1115/OLED direct SCL |
| Diagnostic stimulus | GPIO26 → external bounded diagnostic circuit FIX_STIM; LOW at boot/reset |
| ADC AIN0 | P0_1_MUX, after precision buffer and series resistor |
| ADC AIN1 | P0_2_MUX, after precision buffer and series resistor |
| Temporary supply | One removable USB_SMART_3V3 → 3V3_SYS lead; measured supply and common GND |

Use 0x48 ADC and 0x3C OLED. This one-position fixture omits CD4052 and the isolated service bus; test full scanner settling, capsule-presence isolation and partial power again on the final PCB. GPIO26 temporarily controls stimulus instead of the final register latch. Remove that lead before loading the final ESP2 profile. Keep all unused outputs OFF; no student node is driven directly by GPIO.

Continuity stimulus retains the R5 diode, 11 kΩ ±1% source limiter, default-OFF PhotoMOS switch, 270 Ω LED driver resistor and control transistor. Use the external-stimulus schematic/endpoint table. Student positive is unplugged during diagnostics; known short/open/1 kΩ calibration and uncertainty are mandatory. Disconnect probes, stimulus and JP_RETURN before normal voltage operation. An inconclusive result never authorizes power.

Power the early ADC/OLED from verified 3.3 V only. The temporary rail link must be removed before any final regulator is attached; never parallel regulator outputs or USB sources. The early board uses labelled external module interfaces, not bare ADC/OLED footprints. Module pull-ups and VBUS/shunt wiring still require inspection.

Later output/current modes use the complete reference circuits on an external temporary fixture or final smart PCB. The full one-board 7×10 layout failed; do not silently omit its clamp, driver, watchdog or current isolation to make it fit. All output qualification requires the appropriate power/interlock circuitry; no factory bypass survives its prescribed phase.

## Physical transitions and evidence

Use `transitions.csv` for CP06, CP09, CP11, CP13, CP15, CP24 and unused-input ties at CP27/28 and CP30/31. Baseline prose includes legacy reference names; use the crosswalk rather than old hole coordinates.

Record checkpoint, physical serial, profile, firmware revision, supply/link states, equipment, timestamps, values and scope captures. A prototype reading is reference evidence only; re-run it on the final hardware. The team must provide diagnostic firmware for the acceptance sequence; this export does not implement or claim it.
