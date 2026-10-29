# Firmware handoff — simplified smart perfboard candidate

Hardware source: `design.mjs`; authoritative pin list: `gpio.csv`. This is a separate profile, not an update to existing smart_components firmware. Firmware implementation is not included in the perfboard export.

## Required mapping changes

- Six OLED SDA pins remain `[4,21,19,18,17,16]`, shared SCL=22. One hardware I²C interface is reassigned to one SDA at a time, others released/high. Never issue six independent concurrent bus transactions or tie SDAs. Same OLED address (typically 0x3C) can repeat on separate SDA lines.
- Voltage inputs: ADC1 GPIO34=P1, GPIO35=P2 after 1:2 divider and RC filter. Use 12-bit ADC and appropriate attenuation, preferably calibrated millivolt readings; determine offset/gain per channel with the actual hardware. Do not use ADC2 GPIO4 from the earlier breadboard test: it is now SDA0.
- Joystick axes: ADC1 GPIO36/39, center/dead-zone calibration; four directions only. Omit SW read/debounce/pull-up on GPIO35. Keep physical orientation mapping configurable.
- GPIO UART: `HardwareSerial.begin(115200, SERIAL_8N1, 32, 33)` for RX/TX; USB Serial is a separate debug channel. The old 16/17 test pin constants must change. Cross Pi pin8/TX to GPIO32/RX and GPIO33/TX to Pi pin10/RX; common ground; no power conductor.
- GPIO13/14/23/25/26/27 are reserved at J_EXP. Keep as inputs/high-impedance until a reviewed future circuit defines their use. No pulse/current-driver implementation or educational output is present.

## Measurement transaction

1. Request the selected P1/P2 matrix routes through the existing owner; retain position, route generation and session identity. This board does not control the main matrix directly.
2. Wait for a matching fresh acknowledgement, then initially allow ≥10 ms settling; reject timeout/stale acknowledgements. The maximum passive-filter time constant with a high-impedance source is approximately 1.1 ms; actual matrix/cable settling must be measured.
3. Read both ADC channels while the routing generation is stable. They are sequential conversions, not simultaneous sampling; invalidate the pair if routing changes. Average a bounded number of samples without blocking bus/UART scheduling.
4. Estimate each raw voltage as twice its calibrated ADC voltage; derive signed difference P1−P2. Both absolute raw inputs remain 0–5.25 V. Saturation, missing route acknowledgement or timing errors invalidate the result.
5. Timestamp validity and update only the intended screen. A voltage reading is not capsule-presence evidence; use a fresh actual OLED acknowledgement. An open/divider-grounded input can read zero even when a capsule/contact is absent.

Start OLED bus tests at 100 kHz. Benchmark actual 400 kHz operation and dirty/partial display writes separately. Target ≥10 fresh readings/s per active position only after three-position integrated acquisition/UI/UART timing is measured. At most three positions are active; physically powered screen count still determines supply/bus loading.

## Safety and compatibility

The 20 kΩ unbuffered sensing loads the circuit and does not claim the baseline ≥1 MΩ input impedance or precision/continuity accuracy. This board has no automatic input-power-off isolation. Follow the removable sense-link and external/USB power procedure in README.md; a firmware flag cannot isolate a wire.

Retain the project's authorization/fault/stale-session behavior whenever integrating with its controllers. Plain UART test PING/PONG/JOY messages are only diagnostic and are not an energization protocol. No reconnect, ADC reading, display ACK or joystick direction enables educational power by itself. Do not use the breadboard LED experiment as final-board acceptance evidence.

OLED SDA/SCL pull-ups are supplied by the modules only; there are no external pull-ups on this perfboard. Release inactive SDA pins, tolerate floating disconnected lines, and qualify module presence through a fresh response. Confirm module SCL pull-ups and combined bus loading before integration.
