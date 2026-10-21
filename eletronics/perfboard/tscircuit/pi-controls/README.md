# Pi controls and ESP32 joystick

Independent **schematic-only proposal**, not an assembly release. Joystick stays on ESP32 #2; the Pi 3B owns RC522, Energize and Back. The MCP3008 is unnecessary. This does not revise the existing hardware catalog, CP00–CP36 sequence, firmware implementation, or saved progress.

## Open and regenerate

- [PDF](interface.pdf): A4 landscape schematic, wiring table, notes and bench checklist.
- [SVG](assets/schematic.svg): scalable native tscircuit schematic.
- [Wiring table](wiring.csv) and [parts list](bom.csv).
- [Native source](interface.circuit.tsx), driven by [electrical model](design.mjs).
- [Checks](checks.json), [schematic placement](schematic-placement.txt), and [PCB placement applicability](placement.txt).

From the tscircuit directory run `npm run build:pi-controls`. The repository-local Bun is also usable directly: `./node_modules/.bin/bun pi-controls/build.tsx`. Typst must be installed for PDF generation. The source uses the pinned core and the existing documented line-renderer compatibility patch. There is no custom router.

## Electrical contract

Pi header physical pins: 1 supplies PI_3V3, 6 is common GND, 19 MOSI, 21 MISO, 23 SCLK, 24 RC522 SDA/SS (CE0), 22 reader reset (GPIO25), 29 Energize (GPIO5), 31 Back (GPIO6). IRQ is open. Enable SPI0, mode 0, MSB first, initially no faster than 1 MHz. **Seven Pi GPIOs** are used.

ESP32 #2 GPIO36/VP and GPIO39/VN receive KY-023 VRx/VRy. GPIO35 receives SW. Power the joystick from that DevKit's 3.3 V and ground. These ADC1 inputs avoid the classic ESP32 ADC2/Wi-Fi conflict. **Three ESP32 GPIOs** are used. The classic DevKit's actual header positions must be confirmed; GPIO labels are not physical pin numbers. Navigation requires center calibration and a dead zone; direct ADC readings may clip near travel limits.

Energize and Back each use a normally open dry contact to GND and an external 10 kΩ pull-up to PI_3V3. Joystick SW has a 10 kΩ pull-up to ESP2_3V3. All three are active low. Energize/Back follow revision8's firmware contract: poll at intervals ≤5 ms, require 20 ms stable press/release, no auto-repeat, release before accepting a button held at startup. Button and RFID events never bypass the existing READY/session/fault/watchdog checks or directly authorize rail power.

The Pi retains its separate power supply. PI_3V3 and ESP2_3V3 are distinct; only ground is common. No Pi 5 V header pin is connected in this harness. Wi-Fi messaging is a note, not a physical electrical link or a newly implemented protocol.

## What is verified and what remains unknown

The generator checks native source diagnostics, pin specifications, netlist and every pair of modeled ports: shared nets must connect; different nets and unused pins must stay separate. It invokes the native schematic-placement check and fails on findings even if the CLI exits zero. PCB generation is disabled explicitly: PCB placement checks have no physical geometry to qualify, and copper/routing checks are inapplicable.

The Pi symbol uses actual header numbers. **RC522, KY-023 and ESP32 interface symbol numbers are logical ports**, not verified connector numbering. RC522 header order is unconfirmed. `_NC` marks unused harness connections, not internal electrical isolation within the Pi. Other Pi supply/ground pins remain internally connected on the Pi.

Interface symbols carry a data-only connector MPN placeholder because the tool requires one. It is not a purchased-part identification and is excluded from the BOM. The SVG renderer applies the same text-only stripping policy as `scripts/strip-connector-mpns.mjs`, without executing its legacy export writes. Existing `build` and `build:local` hooks remain intact. No connector/header/pogo MPN may appear in drawings.

No footprints, carrier internals, perfboard dimensions, physical header ordering, or measured decoupling are inferred. Verify the purchased module labels, polarity, DevKit variant and switch contact pairs before wiring. Check actual carrier decoupling. Refer to the PDF for powered and negative-test scenarios; all are **pending**, not measured passes.

References: [revision5 firmware](../revision5/firmware.md), [revision8 button contract](../revision8/firmware.md), [Pi GPIO/SPI documentation](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html), [NXP MFRC522 datasheet](https://www.nxp.com/docs/en/data-sheet/MFRC522.pdf), [Espressif GPIO restrictions](https://documentation.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/gpio.html).
