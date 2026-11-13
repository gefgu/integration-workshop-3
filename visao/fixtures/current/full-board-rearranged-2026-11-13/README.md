# Held-out rearrangement, November 13

Original MJPEG packet 40 from the third 65-second PC recording, at 1280×720.
Commanded controls match the fixed-board fixture README: exposure1600, gain4,
WB4500, brightness0, contrast256, saturation256, gamma20, powerline2,
sharpness128, backlight0. Readbacks do not prove physical exposure.

Pieces were moved by the user; do not copy the earlier inventory/positions
into ground truth. The red-lens LED is now at physical bank B row5 columns0–1.
Its lens at canonical x79 was rounded outside the board by the old fixed
20-pixel lateral correction, despite strong pale PCB evidence on both sides.
The raw positive/negative images test the optical evidence, not electrical seating.

The initial reader missed the moved smart housing, buzzer and capacitor. The
follow-up regressions cover those positive features and the edge LED.
expected.json contains visual annotations; capacitor/body uncertainty and the
unconfirmed backup value are explicit. This is not electrical seating or Pi
hardware verification.

`frame-01.jpg` is original packet15 of the same recording. It captures the
darker illumination state: the unchanged grey smart housing has HSV S≈123,
V≈26 versus S≈78,V≈53 in packet40. Frame filenames are fixture identifiers,
not an assertion that these two packets are consecutive or chronological.
This is the held-out regression for using Lab chroma, housing geometry and
aperture contrast instead of rejecting grey plastic by raw HSV saturation.
