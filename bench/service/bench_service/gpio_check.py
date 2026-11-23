"""Bench GPIO self-test, to run on the Raspberry Pi when the Energizar / Voltar buttons do nothing.

    sudo systemctl stop tedtronics-bancada        # the service holds the pins while it runs
    cd /opt/tedtronics-bancada/app/bench_service && ../../venv/bin/python -m bench_service.gpio_check [17 27]
    sudo systemctl start tedtronics-bancada

Step 1 tries each GPIO library on its own (opened, read, closed before the next: they must not overlap, one
library's cleanup breaks another's pins). Step 2 opens the pins the way the service does and prints each press and
release for 20 seconds (Ctrl+C to stop). Press the buttons while it runs.
"""
from __future__ import annotations

import sys
import time

from .controls import DEFAULT_BUTTON_PINS
from .gpio_inputs import BACKENDS, open_input


def main() -> int:
    pins = tuple(int(arg) for arg in sys.argv[1:3]) or DEFAULT_BUTTON_PINS
    names = ("Energizar", "Voltar")
    print("1) Cada biblioteca, sozinha (solto = 1 no pino com pull-up, apertado = ligado ao GND)")
    for pin, name in zip(pins, names):
        print(f"GPIO{pin} ({name})")
        for backend, opener in BACKENDS:
            try:
                device = opener(pin)
            except Exception as error:
                print(f"   {backend:9} FALHOU  {type(error).__name__}: {error}")
                continue
            try:
                print(f"   {backend:9} ok      lendo agora: {'pressionado' if device.is_pressed else 'solto'}")
            except Exception as error:
                print(f"   {backend:9} FALHOU ao ler  {type(error).__name__}: {error}")
            finally:
                try:
                    device.close()
                except Exception:
                    pass

    print("\n2) Como o serviço abre os pinos")
    devices = []
    try:
        for pin in pins:
            device = open_input(pin)
            devices.append((pin, device))
            print(f"   GPIO{pin}: aberto com {device.backend}")
    except Exception as error:
        print(f"   FALHOU: {error}")
        for _, device in devices:
            device.close()
        return 1
    print("\nAperte os botões (20 s)...")
    last = {pin: device.is_pressed for pin, device in devices}
    end = time.time() + 20
    try:
        while time.time() < end:
            for pin, device in devices:
                now = device.is_pressed
                if now != last[pin]:
                    last[pin] = now
                    print(f"   GPIO{pin}: {'APERTADO' if now else 'solto'}")
            time.sleep(0.01)
    except KeyboardInterrupt:
        pass
    finally:
        for _, device in devices:
            device.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
