# Firmware and bench contracts

> New construction uses [revision5/firmware.md](revision5/firmware.md). Its measured-carrier interfaces, 11kΩ stimulus, shared bank scanners, RC522 and tighter watchdog timing supersede the legacy mappings below. Existing app/catalog builds remain on their original revision.


Earlier soldered hardware is immutable across construction checkpoints; later functional groups are added without rework. Early checkpoint firmware is an explicit supervised factory-test mode with bounded fixtures and no production lesson/session authorization. CP36 implements the complete interlock contract. This document specifies interfaces; it does not implement checkpoint firmware.

## Power and state machine

Boot, reset, fault, invalid graph, missing capsule, stale session, stale routing generation and communication loss all start/return to **OFF**. Sequence: OFF → clear all MT crosspoints → configure → measure/precheck → verify routing readback/continuity → acknowledge every active smart position → READY → explicit Energizar request → ON. Any failed condition clears READY and disables power; clearing a fault never energizes by itself.

Only ESP1 owns rail enable and fault reset. Assert reset only while power enable is low. Release it before enabling. Hardware PRESET has priority over reset; an overload must remain latched. Watchdog heartbeat edges every 50 ms are allowed only while the owning controller's configuration/session acknowledgement is fresh (maximum 250 ms). A frozen/stale controller stops the heartbeat. Measure HC123 expiry: target 200–500 ms, overall communication-loss shutdown ≤1 s. Static GPIO high is not a heartbeat.

Messages include protocol revision 2, command, board revision, session ID, routing generation, sequence number, deadline and CRC. Responses echo these and include status/fault, configured mode and generation. Reject duplicates, expired or mismatched acknowledgements. An acknowledgement for an earlier configuration cannot authorize the next one. No autonomous power restoration on USB reconnect.

## ESP1 / MT8816

GPIO23 serial DATA, 18 SRCLK, 22 latch; 19 bank-A strobe, 21 bank-B strobe, 27 RESET_RELEASE; 33 watchdog heartbeat; 32 rail enable; 17 fault reset; 35 isolated fault input, 34 isolated current input, 36 buffered diagnostic ADC. ESP DevKit is USB-powered; its USB 5-V pin feeds only the temporary bounded test fixture. It never connects to the final external 5-V rail.

HCT595 QA…QH = AX0, AX1, AX2, AX3, AY0, AY1, AY2, DATA. Physical X0…X15 address codes are **0,1,2,3,4,5,8,9,10,11,12,13,6,7,14,15**. CS and RESET at the MT pins are active high. GPIO27 is inverted: LOW asserts hardware reset; HIGH releases it only while ALIVE. The RESET pull-up uses MT VDD, so reset remains asserted before the 5-V logic supply starts. Write DATA on the falling edge of STROBE. Keep the other bank's strobe low. Node X0…X10 maps NODE00…NODE10 in A and NODE11…NODE21 in B. Y0=ground, Y1=student supply, Y2…Y7=shared buses. Test every address, not only the first row. Clear and configure within 50 ms, measured at physical strobe pins.

Test-tool X11…X15 exists on A only: low-current source, stronger source, diagnostic sense, discharge and 1kΩ calibration load. Never enable student power or smart outputs during tool use. Estimate and bound current through **each** X and Y analog pin, including currents from multiple sources sharing one bus. Model P3 as a 5.25-V source with a worst-case 10.63-mA active clamp and measured compliance/drop; do not model its 10-Ω sense resistor as the sole limiter. This is an explicit deviation from ENFR6’s resistor-output model. Keep aggregate below the conservative 80 mA IC budget and every pin ≤12 mA. The device's absolute maximum is not an operating target. Calibrate ADC gain, offset and switch resistance at 0, 2.5 and 5 V.

## ESP2 / smart positions

GPIO25 SRCLK, 26 latch, 27 serial DATA, 13 watchdog; 22 shared A-side SCL. Position 0…5 A-side SDA = GPIO4,21,19,18,17,16. Each position has its own TCA9517 B-side bus. OLED 0x3C, ADS1115 0x48 and INA219 0x40 may repeat across positions; never tie the six SDA channels or buffer B sides together.

18 register bits: position n HIGH=3n, LOW=3n+1, AMMETER=3n+2. Register QA is bit 0; send the final register's byte first, MSB first within each byte. All unused bits are zero. HIGH and LOW must never both be set. OFF and invalid configuration set all three bits zero. Switch break-before-make: turn off, wait ≥5 ms, then select a new output. Hardware OE also requires watchdog ALIVE and actual EDU_ON.

Voltage: ADS1115 continuous differential AIN0−AIN1, ±4.096 V range; buffered 1M/1M dividers mean physical V(P1)−V(P2) is twice the calibrated ADC difference. Both pins are physically 0…5.25 V; signed differential readings do not permit negative absolute node voltages. ≥10 Hz updates; error ≤0.10 V + 5% absolute reading; input ≥1 MΩ. P3 disconnected.

Current: only AMMETER switches close. INA219 ±160 mV shunt range, 10 Ω calibrated shunt, signed ±10 mA; error ≤0.20 mA + 5% absolute reading; ≥10 Hz. Include relay resistance in burden-voltage characterization. Both terminals disconnect in OFF and other modes.

Gates: P1/P2 ≤1 V low, ≥3 V high; between thresholds retain previous state. Require 20 ms stability; output response ≤100 ms. Open inputs pull low through the divider. Pulse: 0.5…10 Hz, duty 25…75%; frequency ±5%, duty ±5 percentage points. Memory: SR reset wins; initial, reset and rail-off state zero. Hardware P3 source/sink limits must pass ≤12 mA shorts and 2 mA high/low levels before firmware modes are accepted.

At most three active capsules across six positions. All six implement every mode; identity follows position configuration, not a fixed capsule specialization. Moving/removing a capsule disables power before reconfiguration. Configure within 1 s. OLED labels and errors are pt-BR (e.g. `Tensão`, `Corrente`, `Pulso`, `Memória`, `Desligado`, `Falha`, `Configuração inválida`).

## Pi / NFC

Pi has its own rated USB supply; share GND only. PN532 Adafruit 364 labelled carrier harness uses 3.3-V supply/logic, SPI mode 0, LSB first; begin ≤1 MHz. GPIO5 physical pin29=Energizar, GPIO6 physical pin31=Back, active-low dry contacts. NFC known/unknown/absent/error cases participate in session approval; NFC failure never authorizes power.

## Measurement records

Copy CP00–CP36 specifications from `assembly/checkpoints.json`. Record board/firmware revision, serial number, link states, DMM/scope/supply models, load, actual values, timestamps, screenshots and outcome. A failure blocks that checkpoint and all later checkpoints. Prototype loop compensation, reverse/backfeed behavior, overvoltage transients and pogo/adapter fit require physical evidence.

## Incremental factory checkpoints

The authoritative sequence is [checkpoints.json](assembly/checkpoints.json). Firmware is not implemented in this change. Existing firmware under `firmware/esp32` targets a previous schematic/pin map and must not be assumed compatible.

Legacy CP00 (fourteen-checkpoint catalog only): router core and protection are installed, MT chips absent. Fixed battery positive is C2, negative C1. Explicit factory enable requires the bounded inspected kit fixture and fresh heartbeat; no fake camera authorization exists yet. GPIOs reserved for future routing stay LOW. Fixed patch leads replace matrix-selected connections only in this supervised mode.

CP01: fixture SDA GPIO4, SCL GPIO16, stimulus GPIO25, USB_3V3 supply. ADS1115 address0x48 and OPA2333 1M/1M divider buffers; readings are twice ADC differential voltage. A default-off AQY212 switch, BAT85 and 10kΩ limit the source to <0.34mA. TEST_A=C4, TEST_B=C1. Fit JP_RETURN only for the unpowered test. Calibrate known short/open/1kΩ and verify alternate component paths do not pass as a jumper. ≤20Ω passes, ≥100Ω rejects, 20–100Ω/unstable/saturated results are inconclusive and cannot enable. Normal OFF leakage tests require fixture probes and stimulus disconnected. Never energize during test, and turn stimulus OFF and remove diagnostic links before an explicit subsequent enable request.

Future device result contract: `{protocol:3,checkpoint,fixture,boardRevision,firmwareRevision,sequence,measuredVoltageV,estimatedResistanceOhm,outcome,stimulusOff,studentRailOff}`. `outcome` is pass/fail/inconclusive; it expires on link change, reconnection or a new request. The app currently records manual results and has no USB transport. Simulated camera approval is a separate UI input and never a measurement or enable command.

Legacy sequence only: CP02 shows greeting/identity/OFF only. CP03 enables calibrated voltage. CP04 pulse, CP05 logic and CP06 memory share the already qualified output hardware. CP07 adds isolated current sensing. CP08 adds matrix routing and removes only fixed patch links. CP09/10 expand positions, CP11 adds supervised Pi control, CP12 NFC, CP13 the full production interlock with no factory bypass.

## Guided factory sequence (revision4)

The new CP00–CP36 definitions supersede the fourteen legacy checkpoints for new builds. No firmware is implemented by this guide. Existing code must be audited against these interfaces before a firmware step can be completed.

- CP00: ESP1 GPIO32 controls the USB high-side test switch. LOW, reset and disabled states are OFF. GPIO25 stimulus is LOW; future matrix outputs are LOW. USB5V is the source through 560Ω ±1%, never a GPIO. Measure supply ≤5.25V and short current ≤9.5mA. Loaded voltage is not regulated to5V.
- CP01–03: GPIO4 SDA /16 SCL /25 stimulus, ADS1115 0x48 buffered fixed-pair fixture. Calibration and thresholds remain as described above. Positive educational source unplugged during measurement; fixture disconnected before enable. Inconclusive results stay OFF; correction needs a fresh test and separate enable request.
- CP04–05: ESP1 operates one OLED 0x3C through removable3.3V leads. Report identity and actual OFF/ready state. Simulated camera input never supplies electrical evidence.
- CP06–08: ESP1 drives the first card's TCA9517 A-side (J_CONTROL7 SDA /9 SCL,8 USB3V3,6 temporary3V3_SYS,4 GND). Remove direct OLED leads; OLED and ADC are local B-side devices. Remove diagnostic fixture to avoid address0x48 collision. P3/ammeter circuits are absent and their control pins isolated.
- CP09–14: final regulators/guards/latch are qualified in isolated blocks. CP11/12 factory ALIVE link is USB3V3→matrix J_POWER9 only under supervision; LOW/open for startup/reset tests. Remove it permanently when the watchdog is completed at CP13. USB prototype positive and temporary3V3 bridges are removed before final supplies connect. Scope tests remain pending without an oscilloscope.
- CP15: migrate service to ESP2 position0, attach qualified POWER_SMART and CTRL_0, remove ESP1 temporary links. Subsequent smart, matrix and production modes use the complete interlock contract above. CP24 removes fixed educational-source patch leads before matrix operation.

Manual measurement metadata and the app's guided-step confirmations are records of user actions, not USB telemetry or automatic validation.
