# One-edge ESP32 LED/pogo voltage test

## Component test completed — 2026-10-21

**Done: user-reported functional test.** Gustavo reported that the LED/pogo voltage test worked very well after resolving the unreadable serial output. The setup uses a fixed 1 kΩ current limiter, a second 1 kΩ resistor contacted by the pogo pins, an LED, and a 10 kΩ/10 kΩ divider feeding ESP32 GPIO4. Readings are displayed over USB serial at 115200 baud.

No numerical readings, multimeter comparison, contact-state log or independent verification were captured. This records completion of the standalone component experiment only; ADC accuracy, final smart-voltmeter compliance, and CP00–CP36 acceptance remain unqualified.

Temporary standalone breadboard experiment: a test 1 kΩ resistor sits between two loose pogo contacts, in series with a real LED and a separate fixed 1 kΩ current limiter. GPIO4 reads node A through a 10 kΩ/10 kΩ divider. This is not the CP01 continuity fixture or the released smart-voltmeter frontend. It does not replace the project's buffered high-impedance differential ADC or qualify any checkpoint. Do not connect the matrix, educational supply, Pi, joystick, OLEDs, or other peripherals for this experiment.

## Parts and accessible edge

- Classic ESP32-WROOM DevKit, powered by USB only.
- LED (red is preferable for an easily visible result from 3.3 V).
- Two **1 kΩ** resistors: one fixed limiter and one between the pogo tips (brown-black-red for four-band parts).
- Two **10 kΩ** resistors (brown-black-orange for four-band parts).
- Two pogo pins, breadboard, and jumper leads. An optional 100 nF ceramic capacitor from S to GND can reduce noise.

Expose the **bottom edge of the ESP32 in the user's original photo**, with the ESP32 USB socket on the left:

```text
3V3   GND   D15   D2   D4   RX2   TX2   ...
 1     2     3    4     5     ← positions counted from the left
```

Use the actual printed labels first. Only **3V3, GND and D4** are needed. Do not use VIN/5 V or a GPIO output as the LED power source. GPIO4 is an ADC2 input: the sketch deliberately does not start Wi-Fi. This is a temporary pin assignment; GPIO4 belongs to SDA0 in the integrated smart-controller contract.

## Circuit

```text
ESP32 3V3 ── fixed 1 kΩ ── A ── pogo 1 tip
                                    │
                              test 1 kΩ resistor
                                    │
                                pogo 2 tip ── LED anode (+)
                                             LED cathode (−) ── GND

A ── 10 kΩ ── S ── 10 kΩ ── ESP32 GND
              │
          ESP32 D4
```

The wires attach to the pogo pins' **fixed electrical tails**, while their **spring tips** touch one leg each of the test resistor. There must be an electrical connection through each complete pogo pin. The 1 kΩ resistor stays permanently between 3V3 and A, before the pogo contacts. Even a short from A to GND is then limited to approximately 3.3 mA at a nominal 3.3 V, ignoring tolerances. Do not deliberately short the supply itself.

S is half of A with equal resistors. A can rise towards 3.3 V if the LED is disconnected; the divider keeps S near or below half the local rail. The sketch reports `node_A = 2 × ADC voltage`. A is measured relative to ESP32 ground: it includes the test resistor, pogo contacts, LED and return wiring. It is not the voltage across just the LED or just the test resistor. This is not a floating or signed differential measurement.

## Build with USB disconnected

1. Remove the previous joystick/UART wiring. Position the ESP32 so the 3V3/GND/D4 edge has accessible breadboard holes.
2. Choose four separate connected five-hole groups named **P**, **G**, **A** and **S**. Keep each group electrically separate. Use free groups beyond the ESP32 if necessary. Do not assume a power rail is continuous across its midpoint.
3. Connect ESP32 **3V3 to P**, and ESP32 **GND to G**.
4. Insert the **1 kΩ resistor between P and A**. Its two ends must not occupy the same connected group.
5. Insert one **10 kΩ resistor between A and S**.
6. Insert the second **10 kΩ resistor between S and G**.
7. Connect **S to D4**. Optionally put 100 nF between S and G. Verify the second 10 kΩ really returns to ground before applying power.
8. Connect a jumper from **A to pogo 1's fixed tail**. Connect **pogo 2's fixed tail to the LED anode**, and the **LED cathode to G**. Use separate breadboard groups for the LED legs. If needed, clamp the fixed tails with insulated test clips.
9. Hold the **second 1 kΩ resistor** separately, with each leg accessible to a pogo tip. Touch pogo 1 to one resistor leg and pogo 2 to the other. Do not add a breadboard/wire connection bypassing either pogo. Resistors have no polarity. For an untrimmed ordinary LED, the longer leg is normally the anode and the flat package side marks the cathode; confirm the actual part.
10. Secure the pogo bodies in an insulating holder or use controlled probe contact. Do not force oversized barrels into the breadboard, insert the spring tips into its sockets, or rely on a loose body making electrical contact with a hole. Prevent the pins from slipping into adjacent supply contacts. Insulate the tails except at the connection.
11. Inspect the complete loop and divider, then connect USB and upload `voltage_pogo_test.ino` as **ESP32 Dev Module**. Open Serial Monitor at **115200 baud**.

If the pogo pins have no suitable tail/clip connection or cannot be held securely, stop before powering and identify a proper holder/contact arrangement. Do not solder on a powered or breadboard-mounted ESP32.

## Test in stages

1. **ADC zero:** initially leave pogo tips away from the test resistor. With USB unplugged, temporarily connect A to G (downstream of the 1 kΩ). Power up: `node_A` should be near zero. Unplug before removing this temporary wire. Near-zero readings are limited by the ADC's low-end behavior.
2. **Open LED path:** reconnect USB with A no longer grounded and pogo tips away from the test resistor. The 20 kΩ divider loads the 1 kΩ source: nominal A is `3.3 × 20/21 ≈ 3.14 V`, so S is about 1.57 V. The sketch should report roughly 3.14 V, not necessarily exactly 3.3 V.
3. **Resistor contact:** establish both pogo-to-resistor contacts. A red LED should light, possibly dimly. With two 1 kΩ series resistors, A includes the test resistor and LED; roughly 2.4–2.7 V is a useful illustration for a red LED at nominal 3.3 V, not an acceptance limit. Actual voltage depends on LED/current, supply, resistors and contacts. Blue/white LEDs may be dim or not light at this supply.
4. **Lift a contact:** lift either pogo tip. The LED goes off and A should return towards the open-path value. This only demonstrates the load/contact effect; it is not a resistance measurement or the project's short/open/1 kΩ continuity acceptance.
5. **Compare with a meter:** place the meter's black lead on G and red lead on A. Compare to `node_A`. Record actual supply, resistor values/tolerances, readings, contact state and LED type. No precision or numerical pass is claimed without this comparison/calibration.

The 20 kΩ divider draws up to roughly 0.165 mA at 3.3 V and loads the circuit. Its low source impedance makes this a useful buffer-free local experiment; it does not meet the full design's ≥1 MΩ measurement-input requirement. Use only this local 3.3 V source—no external 5 V signals or negative inputs. Firmware warnings are diagnostic, not overvoltage protection. GPIO4 cannot be used for ADC measurement with Wi-Fi running on the classic ESP32.

## Software checks and references

The code uses Arduino-ESP32 `analogReadMilliVolts()` rather than treating 4095 as exactly 3.3 V. Reported voltages remain estimates and resistor tolerance is not calibrated. No physical wiring, pogo fit, ADC accuracy or powered result has been verified by software.

Compile from `firmware/esp32` with the existing toolchain:

```sh
.toolchain/arduino-cli --config-file .toolchain/cli.yaml compile --build-path /tmp/voltage-pogo-test-build -b esp32:esp32:esp32 ../component_testing/voltage_pogo_test
```

References: [Arduino-ESP32 ADC API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html), [ESP32 ADC2/Wi-Fi restrictions](https://docs.espressif.com/projects/esp-idf/en/v4.4.4/esp32/api-reference/peripherals/adc.html), [project firmware contract](../../../eletronics/perfboard/tscircuit/revision5/firmware.md).
