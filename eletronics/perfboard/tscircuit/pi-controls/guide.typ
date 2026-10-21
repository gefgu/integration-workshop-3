#set page(paper: "a4", flipped: true, margin: 10mm)
#set text(size: 10pt)
= Pi controls and ESP32 joystick
Electrical proposal — standalone interface. Not a verified assembly drawing.
#image("assets/schematic.svg", width: 100%, height: 155mm, fit: "contain")
Pi GPIO usage: 7. ESP32 GPIO usage: 3. Wi-Fi requires no GPIO connection.
#pagebreak()
= Wiring table
Pi numbers are physical 40-pin header positions. ESP32 numbers are GPIO identities.
RC522 and KY-023: connect by printed labels; module header order remains unconfirmed.
#include "wiring.typ"
Keep PI_3V3 and ESP2_3V3 separate. Common GND is required by this interface. The Pi has its own supply; do not connect its 5 V header to the bench supply. IRQ and unused Pi pins remain unconnected. Other Pi ground and supply pins retain their internal board connections even when unused in this harness.
#pagebreak()
= Interface notes and bench checklist
- RC522 uses SPI mode 0, MSB first; start at no more than 1 MHz. Its SDA label means SPI chip select. No external joystick ADC is needed.
- KY-023 VCC is ESP32 \#2 3.3 V. GPIO36 and GPIO39 are ADC1 inputs; GPIO35 requires the external 10 kΩ pull-up. Sample axes; calibrate center and dead zone for menu navigation. Readings may clip near travel limits.
- Energize and Back close to GND with external 10 kΩ pull-ups to PI_3V3. Joystick SW closes to GND with a pull-up to ESP2_3V3. All switches are active low.
- Firmware debounce: sample at intervals ≤5 ms; require 20 ms stable press and release; no repeat while held. A held-at-boot button must release before a new press is accepted. No hardware debounce capacitors are fitted.
- Energize is a request subject to existing READY, session, NFC, watchdog and fault checks. RFID alone never enables power. No firmware or new Wi-Fi protocol is implemented here.

Before wiring: confirm DevKit GPIO35/36/39 header positions and printed module labels. Module symbol port numbers are logical identifiers only. Check actual switch contact pairs with a meter; four-leg tactile switches may have internally joined pairs.

Record bench checks with equipment, supply, board and firmware versions:
+ Unpowered: compare every endpoint with wiring.csv; confirm the two 3.3 V rails are not joined by the harness.
+ Confirm polarity and local 3.3 V rails before attaching modules. Check each actual carrier's local decoupling.
+ Check joystick center, four directions, dead zone, click and release with Wi-Fi and normal controller tasks active.
+ Check button bounce, pulses shorter than 20 ms, long hold, held-at-boot and simultaneous presses. Energize must be rejected outside READY.
+ Check known/unknown/absent tags, tag removal and reader communication failure. None may bypass authorization or restore power automatically.

Software checks do not establish powered behavior, fit or soldering release. No PCB copper or perfboard placement is included.
