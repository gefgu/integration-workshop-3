# Revision 5 firmware handoff

This revision is independent of the legacy app/catalog. Firmware is implemented by the team, not by this export. Use `design.json` for actual board, pin, net, wire and phase membership. Carrier connector numbering describes a labelled pigtail interface, never bare-IC pin numbers.

## Ownership and pins

ESP1 retains GPIO23 DATA, 18 SRCLK, 22 latch, 19 bank-A strobe, 21 bank-B strobe, 27 RESET_RELEASE, 33 heartbeat, 32 rail enable, 17 fault reset, 35 isolated fault, 34 isolated current, 36 diagnostic ADC. Fixed tests retain GPIO4 SDA, 16 SCL, 25 stimulus. Its USB3V3 domain is `USB_ROUTER_3V3`; watchdog output is `ROUTER_ALIVE`.

ESP2 retains GPIO25 register clock, 26 latch, 27 data, 13 heartbeat, 22 common A-side SCL. Position SDA0…5 are GPIO4,21,19,18,17,16. Bank A mux A/B uses GPIO32/33; bank B uses GPIO14/23. Joystick X/Y uses ADC1 GPIO36/39; its switch uses GPIO35 with the external pull-up. Its USB3V3 domain is `USB_SMART_3V3`; watchdog/reset/timing nets are independently prefixed `SMART_`.

Confirm the purchased DevKit pinout before using this mapping. GPIO numbers and physical header numbers are different.

## Measurement and capsule detection

- Bank A ADS1115 is on position0's isolated B-side bus; bank B ADC is on position3's bus. Both use address0x48. Each position's INA226 uses0x40; OLED uses0x3C. Keep every TCA9517 B-side separate.
- **An ADC or current-sensor ACK is not capsule presence.** Those modules remain in the bench. Probe the actual OLED at0x3C and reject failed, absent or stale capsule acknowledgements.
- Select bank channel0/1/2; selector bits A/B are binary00/01/10. Channel3 grounds both ADC inputs and is available as a zero check.
- ADS1115 reads differential AIN0−AIN1 at860SPS. Use ±4.096V range for ordinary voltage. Wait ≥1ms after selection; start/poll and discard a conversion, then obtain a fresh conversion. Budget ≤20ms for all three bank positions; measure actual timing. Store a timestamp and validity for every reading. A timed-out or saturated conversion is invalid.
- Each local buffer group uses an approximately 0.5V divider-bottom bias, placing zero-input buffers around 0.25V. Convert the buffered nominal half-voltage with per-position gain/offset calibration. Input range is signed differential±5.25V; each absolute input remains0…5.25V. The first pair uses OPA2333; the other four bank inputs use MCP6004. Do not silently use the general-purpose buffers for CP01 diagnostics.
- Fixed continuity uses precision channel0, disconnected educational positive, known stimulus, short/open/1k calibration and a quantified uncertainty band. Select a lower ADS gain range only when the differential voltage permits it. ≤20Ω passes; ≥100Ω rejects; intermediate, unstable, stale or uncertain results cannot enable. Both test probes and JP_RETURN are removable.
- Revision5 stimulus resistance is11kΩ±1%, bounding current below0.34mA even without credit for diode drop. Resistance inference uses its measured value, not the legacy10k constant.
- INA226 modules use an external1Ω±1% shunt, with the onboard shunt removed. Use signed shunt readings; 2.5µV/LSB corresponds to2.5µA/LSB. Gain/offset calibration, module loading and switch/wire burden are measured. Bus-voltage conversion is unused; inspect the carrier's factory VBUS routing and never ground a VBUS pad tied to IN+/IN−. Complete samples and displays at least every100ms.
- Use verified400kHz service timing and dirty-region OLED updates (≤128bytes per ordinary reading). Full-screen redraws must not block scanning, heartbeat, pulse edges or fault handling. Show static mode labels once; update only changed values. Measure the combined schedule with three active positions.

## Safe mode sequencing

The previous session/generation/CRC/deadline protocol and OFF→clear→configure→precheck→fresh acknowledgements→READY→explicit enable sequence remain mandatory. Reject a fourth active capsule. Every position supports every mode.

Register bits remain HIGH=3n, LOW=3n+1, AMMETER=3n+2. HIGH and LOW are mutually exclusive; voltage/current modes leave P3 off. Both ammeter relays disconnect outside current mode. ULN2003 driver arrays share LED support only, never the switched student paths.

Both controllers send heartbeat edges every50ms only while their authorization is fresh. Qualify HC123 expiry at200–350ms; static HIGH is not a heartbeat. ESP1 owns rail enable/reset. ESP2 expiry independently disables relay requests; missing smart acknowledgements stop router authorization too. Communication loss shuts down within1s and never restores power automatically.

Pulse generation must include the ≥5ms break-before-make interval and measured PhotoMOS delays in its schedule. Scope actual0.5–10Hz/25–75% output; commanded timing alone does not establish frequency/duty compliance. Gates require20ms stable inputs and ≤100ms response; use ≤1V/≥3V hysteresis thresholds. SR reset wins and rail OFF clears memory.

## Temporary connections and phases

- CP00: external USB breadboard source remains the legacy NDP6020P/2N7000/560Ω±1% bounded fixture. Install only A1 node contacts/header and ESP1 prototype interface. No final protection board or matrix is needed.
- CP01–03: feed only bank-A precision electronics from one removable ESP1 USB3V3→3V3_SYS link. Connect its ADC SDA/SCL directly to GPIO4/16 via removable leads; selector pull-downs select0. ADC/buffer P1 probe→C4, P2 probe→C1; stimulus TEST_A→C4, TEST_B→C1; JP_RETURN only during test. The permanent NODE00/NODE01 sense harness is absent untilCP06. P3 and current hardware are absent.
- CP04–05: one OLED at0x3C shares the temporary direct3.3V bus; measurements remain unpowered or explicitly isolated when not used. Do not treat an OLED state as an enable command.
- CP06–08: remove diagnostic probes/return/stimulus leads. Attach permanent NODE00/NODE01 sense harness. Reuse the ADC; add position0 service buffer and contacts. For temporary ESP1 ownership, connect its GPIO4/16/USB3V3 only to position0's A-side bus/supply. Remove direct ADC/OLED leads before using the buffer. Other A-side channels remain unpowered/unconnected. Default zero selector remains sufficient.
- CP09–10: adjust the LM2596 to5V and XL4015 to3.3V with both JP_LOGIC/JP_3V3 consumer links open. Qualify guards with adjustable supply and bounded loads before connecting consumers.
- CP11: remove the USB-router→3V3_SYS prototype feed before fitting the qualified final consumer links. Final rails now supply measurement/service electronics. Never parallel regulator outputs with USB3V3 or the USB LED source. Supervised ALIVE fixture remains limited toCP11/12 load qualification.
- CP13: remove the factory ALIVE link permanently and use the qualified hardware watchdog.
- CP15: remove temporary ESP1 bus/A-side supply leads before ESP2 takes ownership. ESP2 reads both bank scanners and controls mux selects; relay requests remain off until qualified.
- CP24: remove fixed battery positive/return patch leads before matrix routing. Test tools and energized student circuits are mutually exclusive.
- CP27/30: when installing the quad bank buffer, ground its unused future-position noninverting inputs pin10/pin12 with removable links. Remove these with power OFF atCP28/31 before connecting the final input dividers. Never leave unused op-amp inputs floating.

## Pi and RC522

Pi physical pins1=3V3,6=GND,19=MOSI,21=MISO,23=SCLK,24=CE0,22=GPIO25 reader RST,29=GPIO5 Energizar,31=GPIO6 Back. RC522 carrier labels SDA/SS, SCK, MOSI, MISO, RST are verified against the actual board; IRQ remains open. SPI mode0, MSB first, initially≤1MHz. This replaces the legacy PN532 LSB-first contract. Known/unknown/absent/error tag cases gate sessions; RFID alone never energizes.

Pi, LCD, camera and speakers have a separate rated supply budget. No positive Pi supply is connected to the bench supply; share ground only. Verify the actual purchased LCD interface before assuming HDMI.

## Supply guard qualification

The LTC4365 data sheet specifies a 492.5–507.5mV UV/OV threshold over temperature (±1.5%), not ±0.6%. With 0.1% 92.8k/10k dividers and 10nA leakage, the 5V guard static trip is approximately 5.053–5.227V. The upper trip leaves only approximately 23mV below the 5.25V contact ceiling. Set and qualify normal loaded 5V output below the lower threshold, including ripple. The 59k/10k 3.3V divider gives approximately 3.392–3.508V static trip.

These bounds do not qualify fast faults. The manufacturer’s 2µs maximum comparator delay uses 50mV overdrive; its 4µs maximum gate turn-off uses 2.2nF gate capacitance. Actual MOSFETs, stored energy and gate/wire capacitance differ. The 36ms typical delay is recovery, not fault cutoff. Prototype the guard without sensitive consumers, measure input, output and gate simultaneously, and record the bounded fault source/current and capacitance. Failure to keep actual contact peaks ≤5.25V blocks connection to the student circuit. A slower or higher-threshold protection module is not an equivalent substitution.

Source: [LTC4365 manufacturer data sheet](https://www.analog.com/media/en/technical-documentation/data-sheets/4365fa.pdf).

## PhotoMOS drive

Bank LED resistors are 390Ω±1%, not the inherited 560Ω. Allowing 1.5V LED drop and 1.1V ULN2003 saturation at a 4.75V system supply gives at least 5.46mA. The diagnostic switch uses 270Ω±1% from 3.3V; at 3.20V and a 0.10V transistor-drop budget it supplies at least 5.87mA. Verify those driver-drop budgets on the bench. Each ammeter request drives two separate resistor/LED branches. These currents come from system/control rails, not the student current budget.

[Panasonic AQY212EH specifications](https://industry.panasonic.com/ap/en/products/control/relay/photomos/number/aqy212eh) recommend 5–30mA LED current; switching and on-resistance specifications cannot be assumed from a barely reached turn-on threshold.

## Near-ground measurement

Local 5.62kΩ/1kΩ±1% dividers and 100nF capacitors bias the bottoms of the input dividers at approximately 0.5V. Each precision/quad-buffer board has its own reference; no reference harness is needed. At zero contact voltage, the buffers operate around 0.25V. At the 5.25V input ceiling they remain below 3V. This avoids relying on an op-amp’s output behavior a few millivolts above ground for continuity classification.

Nominal differential conversion is still twice AIN0−AIN1: the common bias cancels. Calibrate divider-ratio mismatch, differential offset and temperature/supply drift; do not simply subtract a fixed 0.25V from the differential reading. Include the small bias current through the 2MΩ input paths in OFF-leakage and continuity-loading tests. Scan channel3 still grounds both ADC inputs as an ADC zero test, not a full buffer calibration.

Source: [TI OPA333/OPA2333 data sheet](https://www.ti.com/lit/ds/symlink/opa333.pdf).
