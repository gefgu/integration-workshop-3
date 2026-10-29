# ESP32 ↔ Raspberry Pi 3B GPIO UART test

Standalone temporary test: simulated LEFT, RIGHT, UP and DOWN events go from the ESP32 to the Pi. The Pi acknowledges them and sends numbered PING requests; the ESP32 returns matching PONG replies. No joystick, Wi-Fi, broker, or smart-component hardware is needed. This verifies communication only, not the production command/authorization protocol.

## 1. Upload the ESP32 sketch

Disconnect other peripherals and the Pi wires first. Open `uart_pi_test.ino` in Arduino IDE, select **ESP32 Dev Module**, select the detected USB serial port, and upload. Serial Monitor at **115200** will show debug messages. This replaces the joystick-test sketch.

This mapping is for the photographed classic ESP32-WROOM DevKit. Its lower edge has adjacent **RX2 / TX2** pins. GPIO16/17 are used as SDA lines by the full smart-controller design: this test cannot coexist with that wiring. It replaces the earlier suggested GPIO5/23 connection; GPIO23 is already allocated and GPIO5 is a boot-strapping pin.

## 2. Enable the Raspberry Pi GPIO serial port

On the Pi, run:

```sh
sudo raspi-config
```

Choose **Interface Options → Serial Port** (menu wording can vary):

- Login shell accessible over serial? **No**.
- Serial port hardware enabled? **Yes**.

Reboot:

```sh
sudo reboot
```

After reboot, check the GPIO serial device:

```sh
ls -l /dev/serial0
```

Use `/dev/serial0`, not the ESP32 USB port (`/dev/ttyUSB0` or `/dev/ttyACM0`). Raspberry Pi OS maps `/dev/serial0` to the appropriate GPIO UART; do not assume it is always `ttyAMA0`. On the Pi 3B it may be the mini UART (`ttyS0`); enabling UART through raspi-config sets the relevant boot configuration. Do not disable Bluetooth or change overlays unless troubleshooting establishes a need.

## 3. Connect THREE wires

Shut down the Pi (`sudo poweroff`), remove its power, and unplug ESP32 USB before wiring.

### Pi orientation: USB ports on the LEFT

Keep the **component side facing you** and rotate the Pi flat on the table so its **USB/Ethernet ports are on the left** and the **40-pin GPIO header is along the bottom**. This is a 180° rotation of the original photo, not a view of the underside. Physical pin numbers do not change when the board rotates.

Use the **outer/bottom row**, closest to the board/case edge. Count **from the RIGHT end** of that row:

| Count from the right | Physical pin | Connection |
| --- | --- | --- |
| 1st | 2 — 5 V | Leave unconnected |
| 2nd | 4 — 5 V | Leave unconnected |
| **3rd** | **6 — GND** | ESP32 **GND** |
| **4th** | **8 — TXD** | ESP32 **RX2 / GPIO16** |
| **5th** | **10 — RXD** | ESP32 **TX2 / GPIO17** |

The right-hand end of the header looks like this in that orientation:

```text
                 Pi components / heatsinks above

Inner/top row:   ...   9      7      5      3      1
Outer/bottom:    ...  10      8      6      4      2  ← right end
                     RXD    TXD    GND    5 V    5 V
                      │      │      │
ESP32 labels:        TX2    RX2     GND
```

Both pins marked 5 V stay unconnected. If the header is not at the bottom with the component side visible, reorient the Pi before using these counting instructions.

| Pi 3B physical header pin | Pi function | ESP32 board label |
| --- | --- | --- |
| **8** | GPIO14 / TXD | **RX2 / GPIO16** |
| **10** | GPIO15 / RXD | **TX2 / GPIO17** |
| **6** | GND | **GND** |

**TX goes to RX in each direction.** These are 3.3 V TTL UART signals; no level converter or RS-232 adapter is required. Do not connect either board's 5 V, VIN, or 3.3 V power pin to the other. Power the Pi through its normal supply and the ESP32 through USB. Keep both powered during testing; remove power from both before changing wiring. Use short jumper wires for the first test.

On the pictured ESP32, with USB on the left, RX2 and TX2 are on the **bottom edge**, sixth and seventh pins from the left. Follow the printed labels first. A GND pin is on that same edge. Pi numbers here are **physical pins**, not BCM GPIO numbers; confirm pin 1 before counting.

## 4. Run the Pi program

Install pyserial on the Pi:

```sh
sudo apt update
sudo apt install python3-serial
```

Copy `pi_uart_test.py` to the Pi (for example with a USB drive). On the Pi, open a terminal in the directory containing that file and run:

```sh
python3 pi_uart_test.py
```

If permission is denied, add your actual Pi account to `dialout`, then log out and back in:

```sh
sudo usermod -aG dialout "$USER"
```

Do not leave another terminal, service, or serial monitor attached to `/dev/serial0`. The ESP32's USB Serial Monitor on a separate computer is fine: the sketch uses UART2 for the Pi and UART0 for USB debug.

## 5. What a successful test looks like

On the Pi:

```text
Pi -> ESP32: PING 1
ESP32 -> Pi: PONG 1
PASS: PING/PONG round trip ... ms.
ESP32 -> Pi: JOY 1 LEFT
Pi -> ESP32: ACK 1
PASS: simulated direction received and acknowledged.
```

The directions cycle LEFT → RIGHT → UP → DOWN once per second. On the ESP32 USB monitor, expect:

```text
Pi -> ESP32: PING 1
ESP32 -> Pi: PONG 1
Pi -> ESP32: ACK 1
Pi acknowledged simulated joystick event 1
```

Both matching PONG replies and acknowledged direction events demonstrate the two directions of communication. The test uses **115200 baud, 8 data bits, no parity, 1 stop bit, no flow control**, with ASCII messages terminated by newline. Each endpoint discards invalid or oversized lines until the next newline. IDs correlate replies; no real output commands are accepted. Stop the Pi program with Ctrl+C.

## Troubleshooting and validation limits

- No `/dev/serial0`: enable serial hardware, reboot, and check the Pi UART configuration.
- Only PING timeouts: check both crossed TX/RX wires, common GND, and the uploaded sketch.
- JOY arrives but no PONG: ESP32→Pi works; check Pi pin 8→ESP32 RX2 and the disabled serial login console.
- ESP32 USB monitor receives PING but Pi sees nothing: check ESP32 TX2→Pi pin 10.
- Gibberish: check 115200 on both ends, common GND, loose wiring, and disabled serial console. On Pi 3B, check the documented mini-UART clock requirements if configuration was edited manually.
- Port busy: stop the other process using the GPIO UART.

Actual two-board communication remains unverified until you run this test. Do not reuse this pin allocation or plain-text demo as the integrated hardware's safety/session protocol. Final firmware requires its existing freshness, authorization, watchdog and communication-loss behavior.

Optional local compile, from `firmware/esp32`:

```sh
.toolchain/arduino-cli --config-file .toolchain/cli.yaml compile --build-path /tmp/uart-pi-test-build -b esp32:esp32:esp32 ../component_testing/uart_pi_test
```

References: [Raspberry Pi UART configuration](https://www.raspberrypi.com/documentation/computers/configuration.html), [Espressif Arduino UART API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/serial.html).
