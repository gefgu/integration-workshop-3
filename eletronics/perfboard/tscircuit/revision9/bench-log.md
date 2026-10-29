# Revision 9 bench log

## Buck module voltage setup — 2026-10-13

Reported by the builder after testing the modules separately with a multimeter:

| Physical module | Assigned output | Bench status |
|---|---:|---|
| Red PCB, HW-155 / LM2596 | 3.3 V | Adjusted and measured at 3.3 V |
| Blue PCB, XL4015 | 5.0 V | Adjusted and measured at 5.0 V |

This records the builder's bench result; it is not an independent measurement. No load test, Raspberry Pi test, or ESP32/OLED test from these regulated outputs has been recorded. Keep the modules' outputs disconnected from the Pi and ESP32 until polarity is confirmed and each rail is checked under load.

The physical module dimensions and terminal arrangements have not been measured. Identify `IN+`, `IN−`, `OUT+`, and `OUT−` from the actual board markings before wiring the perfboard.
