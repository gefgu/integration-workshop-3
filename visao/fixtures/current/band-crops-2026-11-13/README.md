# Pale-yellow 470 Ω band regression (saved picture only)

`470-pale-yellow.png` is a 540×144 rectified crop of the upper-bank
470 Ω holder in the saved camera recording `sweep-02`, frame 47.
Original MJPEG SHA-256:
`d67ff5ad4ad0ee2fe52143b5257e7fa20e0ef31fae667e4320105f7fc692d4df`.
The original picture is also saved as
`../full-board-fixed-2026-11-13/frame-00.jpg`.

Commanded controls: exposure 1600, gain 4, white balance 4500 K,
brightness 0, contrast 256, saturation 256, gamma 20, sharpness 128,
backlight compensation 0, power-line frequency 2. Readbacks are not
independent measurements of exposure. Source format MJPEG, 1280×720.

Observed bands are yellow, violet, brown. The yellow is pale under this
illumination (HSV saturation around 45); it must still have positive hue
and brightness evidence. Erased or clipped bands must remain unreadable.
This is software regression evidence, not electrical or Raspberry Pi
hardware verification.
