# Project risks 🎲

Risk register for TedThunder.

> **Status:** template only. The rows below are **placeholders** kept to preserve the format — the
> team still has to identify, score and plan the real risks for this project.

## How to fill this in

- **Impact (I)** and **Probability (P)** are scored from 1 to 5.
- **I × P** is the resulting exposure, from 1 to 25. Sort the table by this column, highest first.
- Write a **risk response plan** for every risk scoring above 8, save it as a PDF under
  `risk_response_plans/`, and link it from the table.
- After the plan is defined, re-score the risk as **Ir** and **Pr** to show the residual exposure
  once the response is in place. Leave these blank until a plan exists.

| Score | Impact | Probability |
| --- | --- | --- |
| 1 | Negligible | Very unlikely |
| 2 | Minor | Unlikely |
| 3 | Moderate | Possible |
| 4 | Major | Likely |
| 5 | Critical | Almost certain |

## Risk register

| ID | Risk Name | Impact (1–5) | Probability (1–5) | I × P (1–25) | Risk Response Plan | Re-evaluated Impact (Ir) | Re-evaluated Probability (Pr) | Ir × Pr (1–25) |
|------|-----------|--------------|--------------------|--------------|---------------------|---------------------------|-------------------------------|----------------|
| R01  | _Placeholder — describe the risk_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | - | - | - |
| R02  | _Placeholder — describe the risk_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | - | - | - |
| R03  | _Placeholder — describe the risk_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | - | - | - |
| R04  | _Placeholder — describe the risk_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | - | - | - |
| R05  | _Placeholder — describe the risk_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | - | - | - |
| R06  | _Placeholder — describe the risk_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | - | - | - |
| R07  | _Placeholder — describe the risk_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | - | - | - |
| R08  | _Placeholder — describe the risk_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | - | - | - |
| R09  | _Placeholder — describe the risk_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | - | - | - |
| R10  | _Placeholder — describe the risk_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | - | - | - |

## Candidate risks to consider

Starting points drawn from the current design, not yet scored or accepted into the register above:

- QR code or color identification failing under classroom lighting or with a low-end camera.
- Raspberry Pi 3 B performance for the vision pipeline, or availability of the board itself
  (see the note in [Budget](./Budget.md)).
- Switch-matrix design error, or a hazard class the safety check fails to catch.
- Capsule mechanics: sockets that do not seat reliably, or capsules a child can insert crookedly.
- Enclosure and camera boom not fitting or aligning as designed; camera wobble.
- Team availability across the semester.
- Component delivery delays.
