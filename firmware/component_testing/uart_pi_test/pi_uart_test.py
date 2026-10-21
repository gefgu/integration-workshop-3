#!/usr/bin/env python3
"""GPIO UART demo: acknowledge simulated joystick events and check PING/PONG."""

import argparse
import sys
import time

try:
    import serial
except ImportError:
    sys.exit("Install pyserial on the Pi: sudo apt install python3-serial")

DIRECTIONS = {"LEFT", "RIGHT", "UP", "DOWN"}
MAX_LINE = 95


def run(port):
    # USB ttyUSB*/ttyACM* is not used: this opens the Pi's GPIO UART.
    with serial.Serial(port, 115200, timeout=0.1, write_timeout=1,
                       xonxoff=False, rtscts=False, dsrdtr=False,
                       exclusive=True) as link:
        print(f"Opened {port}: 115200 baud, 8N1. Ctrl+C to stop.", flush=True)
        buffer = bytearray()
        discarding = False
        pending = {}
        ping_id = 0
        next_ping = time.monotonic()

        def send(message):
            link.write((message + "\n").encode("ascii"))
            print(f"Pi -> ESP32: {message}", flush=True)

        def receive(message):
            print(f"ESP32 -> Pi: {message}", flush=True)
            fields = message.split()
            if (len(fields) == 3 and fields[0] == "JOY"
                    and fields[1].isascii() and fields[1].isdigit()
                    and fields[2] in DIRECTIONS):
                send(f"ACK {fields[1]}")
                print("PASS: simulated direction received and acknowledged.", flush=True)
            elif (len(fields) == 2 and fields[0] == "PONG"
                    and fields[1] in pending):
                elapsed = (time.monotonic() - pending.pop(fields[1])) * 1000
                print(f"PASS: PING/PONG round trip {elapsed:.1f} ms.", flush=True)
            else:
                print("Ignoring unexpected or unmatched message.", flush=True)

        while True:
            now = time.monotonic()
            if now >= next_ping:
                ping_id += 1
                key = str(ping_id)
                pending[key] = now
                send(f"PING {key}")
                next_ping = now + 2
            for key, sent_at in list(pending.items()):
                if now - sent_at >= 5:
                    pending.pop(key)
                    print(f"TIMEOUT: no PONG {key}; check wiring and ESP32 sketch.",
                          flush=True)

            for value in link.read(min(link.in_waiting or 1, 256)):
                if value == 13:
                    continue
                if value == 10:
                    if buffer and not discarding:
                        receive(buffer.decode("ascii"))
                    buffer.clear()
                    discarding = False
                elif not discarding:
                    if value < 32 or value > 126 or len(buffer) >= MAX_LINE:
                        print("Discarding invalid/overlong UART line.", flush=True)
                        buffer.clear()
                        discarding = True
                    else:
                        buffer.append(value)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", default="/dev/serial0")
    args = parser.parse_args()
    try:
        run(args.port)
    except KeyboardInterrupt:
        print("\nStopped.")
    except (serial.SerialException, OSError) as error:
        sys.exit(f"UART error: {error}\nCheck the port, serial-console settings, "
                 "dialout permissions, and whether another program has it open.")


if __name__ == "__main__":
    main()
