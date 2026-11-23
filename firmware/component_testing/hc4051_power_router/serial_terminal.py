#!/usr/bin/env python3
"""Send router commands from a Linux terminal at 115200 baud."""

import argparse
import os
import select
import sys
import termios
import tty
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("port", nargs="?", help="e.g. /dev/ttyUSB0")
    args = parser.parse_args()

    ports = sorted(Path("/dev").glob("ttyUSB*")) + sorted(Path("/dev").glob("ttyACM*"))
    if not args.port and len(ports) != 1:
        parser.exit(1, f"Connect the ESP32 or specify its port. Detected: {', '.join(map(str, ports)) or 'none'}\n")

    port = args.port or ports[0]
    try:
        with open(port, "r+b", buffering=0) as link:
            fd = link.fileno()
            previous = termios.tcgetattr(fd)
            try:
                tty.setraw(fd)
                settings = termios.tcgetattr(fd)
                settings[4] = settings[5] = termios.B115200
                settings[2] |= termios.CLOCAL
                settings[2] &= ~termios.CRTSCTS
                termios.tcsetattr(fd, termios.TCSANOW, settings)

                print(f"{port} at 115200 baud. Type PING, POWER 0 1, or OFF, then Enter. Ctrl+C exits.", flush=True)
                while True:
                    ready, _, _ = select.select([fd, sys.stdin], [], [])
                    if fd in ready:
                        data = os.read(fd, 4096)
                        if not data:
                            parser.exit(1, "Serial device disconnected.\n")
                        print(data.decode("ascii", errors="replace"), end="", flush=True)
                    if sys.stdin in ready:
                        command = sys.stdin.readline()
                        if not command:
                            return
                        link.write((command.rstrip("\r\n") + "\n").encode("utf-8"))
            finally:
                termios.tcsetattr(fd, termios.TCSANOW, previous)
    except KeyboardInterrupt:
        print()
    except (OSError, termios.error) as error:
        parser.exit(1, f"{port}: {error}\n")


if __name__ == "__main__":
    main()
