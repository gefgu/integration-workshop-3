"""Drive the smart_components firmware over serial and print what it answers.

Usage: .venv/bin/python tools/run_tests.py [/dev/ttyACM0]
Close the Arduino IDE Serial Monitor first (it holds the port).
"""

import sys
import time

import serial

PORT = sys.argv[1] if len(sys.argv) > 1 else "/dev/ttyACM0"

# (command, seconds to wait after sending it)
STEPS = [
    ("status", 1),
    ("scan", 1),
    ("sim on", 0.5),
    ("demo mix", 2),
    ("stream on", 1.2),
    ("stream off", 0.5),
    ("stats reset", 10),  # let pulse + voltmeter + ammeter run for 10 s
    ("stats", 1),
    ("bench", 8),
    ("stats reset", 0.2),
    ("demo gate", 10),
    ("stats", 1),
    ("set 4 volt", 1),  # 4th active position must be refused
    ("set 1 amm", 0.5),  # ammeter only at 2
    ("set 0 pulse 20 50", 0.5),  # out of range
    ("rail off", 0.5),
    ("status", 1),
    ("rail on", 0.5),
    ("demo off", 0.5),
    ("status", 1),
]


def drain(port, seconds):
    end = time.time() + seconds
    while time.time() < end:
        data = port.read(4096)
        if data:
            sys.stdout.write(data.decode("utf-8", "replace"))
            sys.stdout.flush()


def main():
    with serial.Serial(PORT, 115200, timeout=0.1) as port:
        # Opening the port toggles DTR/RTS; make sure the chip runs (not in bootloader).
        port.dtr = False
        port.rts = True
        time.sleep(0.1)
        port.rts = False
        drain(port, 2.5)  # boot banner
        for cmd, wait in STEPS:
            print(f"\n>>> {cmd}")
            port.write((cmd + "\n").encode())
            drain(port, wait)


if __name__ == "__main__":
    main()
