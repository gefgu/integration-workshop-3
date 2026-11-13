# Independent raw capture for the populated-board reader

`frame-00.jpg` is the original MJPEG packet of frame 47 from the second
November 13 exposure sweep, captured at 1280×720. It is held out from the
foreground templates, which use the earlier `full-board-2026-11-13` photograph.
The camera framing differs between these two picture sets; do not alternate
them as if they were a stationary consecutive recording.

Commanded settings: exposure 1600 (V4L2 units), gain 4, brightness 0,
contrast 256, saturation 256, gamma 20, white balance 4500 K, power line
menu 2, sharpness 128 and backlight compensation 0. Readback is diagnostic,
not proof of the physical sensor exposure. These are PC captures only.

The backup resistor at the upper bank's right-hand side has an unconfirmed
value. Do not assign it a kit value from the inventory or its position.
The small pale-yellow 470 band crop is also saved separately under
`band-crops-2026-11-13` to reproduce the positive-colour evidence and the
missing/clipped-band negative tests.
