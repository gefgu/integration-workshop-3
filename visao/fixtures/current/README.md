# Current camera captures

Five captures taken from camera index 1 during the camera investigation.
The [saved-frame assessment](assessment.md) records the positions and the
results of processing each image independently.
The assembled grid holding pieces is logical half C (rows 0–5, columns 0–10).
The unfinished section above it is outside the active grid.

Approximate corner socket centers in frame-00.jpg, in TL/TR/BR/BL order:
(260,375), (1035,406), (1050,670), (237,631).
These are image annotations, not physical measurements or portable camera calibration.
`sem-grade.jpg` is a later capture with the board disassembled; it is a
negative registration example.

The white banded piece occupies C2, columns 4–5. Its configured identity is
resistor_1k, according to the user's available inventory; resistance has not
been measured by vision. Other visible pieces have not been independently labeled.
The older single-stripe reader returns no recognized stripe for the five blue
pieces in these captures, so their physical identity cannot be recovered from
that historical mapping alone.

Additional captures from November 10, 2026, are available for detector and
performance work:

- `kit-test-2026-11-10.jpg`: the four-piece test circuit.
- `kit-test-moved-2026-11-10.jpg` and `kit-test-locked-2026-11-10.jpg`:
  the battery and resistor after moving the pieces, under two camera settings.
- `kit-test-overlap-2026-11-10.jpg` and `kit-test-overlap-locked-2026-11-10.jpg`:
  the four pieces with reflections joining the apparent LED and jumper shapes.
- `reference-completed.jpg`: the later board configuration with the four-piece
  circuit; the first column of the active lower bank is unpopulated.

These are camera images, not measured electrical verification. Resistor value
and polarity were provided for the test rather than measured by the camera.

The current profile is the default and attempts automatic calibration when
the entire active grid has enough visible edge sockets. An ambiguous crop is
rejected; it does not infer a grid origin. Manual calibration is available:

```
.venv/bin/python -m visao visao/fixtures/current/frame-00.jpg \
  --calibrate /tmp/current-calibration.json
```

Select the four extreme socket centers in logical TL/TR/BR/BL order, then
press Enter. Review the numbered grid and press Enter again to save; `r` resets
the selection and Escape cancels. To calibrate from the live camera, replace
the image path with `--camera 1`. Choose a new file path: calibration will not
overwrite an existing file. The experimental `current` profile accepts the
saved calibration:

```
.venv/bin/python -m visao visao/fixtures/current/frame-00.jpg --json
.venv/bin/python -m visao --camera 1 --profile current \
  --calibration /tmp/current-calibration.json --mostrar --json /tmp/circuito-atual.json
```

This profile identifies the white three-mark resistor and locates blue bodies
without guessing their electrical identity. Their positions appear under
`pecas_sem_tipo`, not in the circuit graph. Openings with sufficient evidence
are reported empty; the remaining positions are unknown. `completo` is false
while positions are stale or unknown or electrical identities remain unresolved;
a single image is never considered complete. It must not be used
to conclude that the full circuit is empty or complete. The original reader
remains available as `--profile legacy`.
Positions also require nearby registered sockets: a component-colored region
with insufficient local grid support remains unknown, even when the grid fit is
valid elsewhere in the image.
The JSON `atualidade` array distinguishes `fresh`, `stale` and `unknown`
observations. A previously confirmed footprint remains stale for up to two
seconds after it cannot be read, but is removed from the circuit graph at once.
Consumers must inspect both `valido` and `completo` on the outer JSON object
before making whole-board validation decisions. Passing only its nested
`circuito` object to a validator discards the coverage information and can
mistake a partial circuit for a complete one.

With `--json -`, camera mode emits JSON objects on stdout when the state changes
and at least once per second while frames are being processed; status messages
go to stderr. Each object has a `gerado_em_unix` timestamp in seconds. A lost
registration is emitted as a state change.
It also emits an invalid state before opening the camera and when the stream
ends. File output is replaced atomically so readers do not see partial JSON.
These notifications depend on a normal shutdown or handled read failure; a
consumer must still apply its own timeout for abrupt process termination.
Tests also use rotated copies of frame-00 (−3°, 0°, +3°), dimmed copies and a
simulated local occlusion. These transformed copies do not replace live testing
of different camera angles, lighting, pieces and board arrangements.
