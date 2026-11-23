"""Reading a push button on a Raspberry Pi GPIO pin (to ground, internal pull-up), whatever GPIO library works.

The bench only needs to *read* the pin (GpioButtons samples it every 10 ms), so every backend here does a plain
input read: no edge alerts, no library debounce, no callbacks. Those are what failed on the bench with
`OSError: [Errno 22] Invalid argument` (gpiozero's Button claims an alert). Backends are tried in order and the
one that worked first is kept for the other pin; when none works, the error lists what each one said.

    lgpio       lgpio.gpio_claim_input + gpio_read        (Raspberry Pi OS Bookworm, kernel GPIO character device)
    RPi.GPIO    GPIO.setup(IN, PUD_UP) + GPIO.input       (older systems and Pi OS with rpi-lgpio)
    gpiozero    DigitalInputDevice (its own pin factories) (last resort)

Every object has `is_pressed` (True while the contact is closed to ground) and `close()`.
"""
from __future__ import annotations

from typing import Callable


class LgpioInput:
    """Plain lgpio input with the Pi's pull-up; tries the Pi's GPIO chips (0, then 4 on a Pi 5)."""

    def __init__(self, pin: int) -> None:
        import lgpio  # type: ignore[import-not-found]

        self._lg, self.pin, self._handle = lgpio, pin, None
        errors = []
        for chip in (0, 4):
            try:
                handle = lgpio.gpiochip_open(chip)
            except Exception as error:
                errors.append(f"chip{chip}: {error}")
                continue
            try:
                lgpio.gpio_claim_input(handle, pin, lgpio.SET_PULL_UP)
                lgpio.gpio_read(handle, pin)
            except Exception as error:
                errors.append(f"chip{chip}: {error}")
                lgpio.gpiochip_close(handle)
                continue
            self._handle = handle
            return
        raise OSError("; ".join(errors))

    @property
    def is_pressed(self) -> bool:
        return self._lg.gpio_read(self._handle, self.pin) == 0

    def close(self) -> None:
        handle, self._handle = self._handle, None
        if handle is not None:
            try:
                self._lg.gpio_free(handle, self.pin)
            finally:
                self._lg.gpiochip_close(handle)


class RpiGpioInput:
    """Plain RPi.GPIO input with pull-up (BCM numbering)."""

    def __init__(self, pin: int) -> None:
        import RPi.GPIO as GPIO  # type: ignore[import-not-found]

        self._gpio, self.pin = GPIO, pin
        GPIO.setwarnings(False)
        GPIO.setmode(GPIO.BCM)
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.input(pin)

    @property
    def is_pressed(self) -> bool:
        return self._gpio.input(self.pin) == 0

    def close(self) -> None:
        self._gpio.cleanup(self.pin)


class GpiozeroInput:
    """gpiozero's DigitalInputDevice (no Button: no debounce thread, our scan does it)."""

    def __init__(self, pin: int) -> None:
        from gpiozero import DigitalInputDevice  # type: ignore[import-not-found]

        self._device = DigitalInputDevice(pin, pull_up=True)

    @property
    def is_pressed(self) -> bool:
        return not self._device.value

    def close(self) -> None:
        self._device.close()


BACKENDS: list[tuple[str, Callable[[int], object]]] = [
    ("lgpio", LgpioInput),
    ("RPi.GPIO", RpiGpioInput),
    ("gpiozero", GpiozeroInput),
]
_preferred: list[str] = []  # the backend that opened the first pin: the other pin uses it too


def open_input(pin: int, backends: list[tuple[str, Callable[[int], object]]] | None = None, **_ignored):
    """Opens `pin` with the first backend that works. Extra keyword arguments (pull_up=...) are ignored."""
    backends = backends if backends is not None else BACKENDS
    ordered = sorted(backends, key=lambda item: item[0] not in _preferred)
    errors = []
    for name, backend in ordered:
        try:
            device = backend(pin)
            device.is_pressed  # a pin that cannot be read is not opened
        except Exception as error:
            errors.append(f"{name}: {type(error).__name__}: {error}")
            continue
        if backends is BACKENDS:
            _preferred[:] = [name]
        device.backend = name  # type: ignore[attr-defined]
        return device
    raise OSError(" | ".join(errors)[:600])
