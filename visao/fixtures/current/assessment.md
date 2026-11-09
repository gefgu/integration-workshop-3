# Saved camera captures — current profile

The five `frame-00.jpg` through `frame-04.jpg` images are consecutive captures
of the same scene, so they do not represent five independent board arrangements.
They show the assembled upper logical bank C in the lower part of the images.
Coordinates below are zero-based, as in the JSON output.

The five files in [annotated](annotated/) show the detector's output on each
frame: the resistor and blue bodies are labeled with row and columns; `?` means
the body type is unknown. The circles show the observation status, not
independent ground truth. These are single-image readings without the live
three-frame filter.

The visible white, banded piece spans C row 2, columns 4–5. Its reported type
is `resistor_1k` because that is the configured available resistor, not because
its resistance was measured from the image. Five blue bodies are visible at
row 0 columns 1–2 and 7–8, and row 4 columns 2–3, 6–7 and 9–10. Their current
physical identities have not been established.

Each saved frame was processed independently with automatic calibration and
`PipelineAtual(temporal=False)`. Each registered successfully with 47 matched
socket candidates and median reprojection error between 1.69 and 1.72 pixels.
Each returned the white resistor and the five blue positions listed above. Each
reported 12 occupied, 38–40 empty and 14–16 unknown positions in C. These are software
outputs checked against the visible component locations, not a ground-truth
annotation of every opening. A single-frame result is not complete.

`sem-grade.jpg` is a later image of the disassembled area; automatic registration
rejects it. Automated tests also exercise darkened, rotated and perspective-warped derivatives,
local occlusion and loss of tracking. A rectified sample of the resistor is also
placed synthetically at each of the 60 horizontal two-socket footprints; this
checks the band reader only. A separate synthetic test reprojects that sample
into the camera image at all 60 positions, including grid edges, and runs the full
automatic registration and recognition pipeline. Another synthesized image
checks that three adjacent blue bodies remain separate. A synthetic empty grid
also checks that complete status is withdrawn when an unknown colored or white object
appears and restored only after the openings are observed again. These do not replace live tests of the
reassembled board, removal and insertion, different component placements, or
changes in illumination and camera position. The blue-body mapping remains a
user-supplied physical identification task.
