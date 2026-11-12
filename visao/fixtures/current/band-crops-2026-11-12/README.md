# Lesson band regressions

Seven lossless 3x rectified crops from the user-authorized November 12 live
recording at 1280×720, commanded exposure 1600. Only the resistor windows are
stored here; the full recording remains ignored in `hidden/live-diagnosis`.
`expected.json` records source JPEG hashes and zero-based C-bank positions.

Ground truth: 220 Ω at C2:3–4, 470 Ω at C2:6–7 and 1 kΩ at C3:8–9.
Values were confirmed by the user; position never supplies a decoded value.

The old single sampling strip lost/split warm bands in frames 9, 12 and 27;
frame 31 fragments the 470 Ω brown band. Tests require complete patterns from
multiple body strips and refuse a removed middle band. These crops test decoding,
not camera calibration or live stability.
