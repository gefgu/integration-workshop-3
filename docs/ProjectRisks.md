# Project risks 🎲

Risk register for TedThunder.

> **Status:** the electronics risks below come from the electronics team's own analysis. Risks for
> the other areas — vision, software, mechanics, project management — are still to be identified.

## How to fill this in

- **Impact (I)** and **Probability (P)** are scored from 1 to 5.
- **I × P** is the resulting exposure, from 1 to 25. Sort the table by this column, highest first.
- The **Mitigation / Response** column carries the planned response. Where a response needs more
  than a line, write it up as a PDF under `risk_response_plans/` and link it from the table.
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

| ID | Risk | Impact (1–5) | Probability (1–5) | I × P (1–25) | Mitigation / Response | Re-evaluated Impact (Ir) | Re-evaluated Probability (Pr) | Ir × Pr (1–25) |
|------|-----------|--------------|--------------------|--------------|---------------------|---------------------------|-------------------------------|----------------|
| R01  | Excessive switching-matrix resistance changes the expected behavior of educational circuits | 5 | 3 | 15 | Characterize the complete routing path resistance, restrict lesson component values and validate every circuit electrically before final integration | 3 | 2 | 6 |
| R02  | Crosspoint switch overcurrent or overheating | 5 | 3 | 15 | Restrict operating current, select low-current educational components and implement independent hardware current limiting | 3 | 1 | 3 |
| R03  | Poor electrical contact between educational modules and bench nodes | 4 | 3 | 12 | Use redundant contacts per node, mechanically guided modules and perform continuity testing during prototype validation | 3 | 2 | 6 |
| R04  | Incorrect resistor value is selected by the modular resistor mechanism | 4 | 3 | 12 | Use a predefined resistor bank, mechanically indexed positions and electrical verification of each available configuration | 2 | 1 | 2 |
| R05  | Buzzer consumes more current than the programmable switching path supports | 4 | 3 | 12 | Use only validated low-current piezo or active buzzers and verify current consumption before inclusion in the educational kit | 2 | 1 | 2 |
| R06  | Electrostatic discharge damages the switching matrix, controller or sensing electronics | 4 | 3 | 12 | Add ESD/TVS protection to exposed contacts and implement appropriate PCB grounding and protection practices | 2 | 2 | 4 |
| R07  | Crosspoint IC availability, cost or PCB assembly difficulty delays the project | 4 | 3 | 12 | Select components early, purchase spare ICs, evaluate alternative switching ICs and produce a reduced prototype PCB before the final board | 3 | 1 | 3 |
| R08  | Incorrect routing command creates a short circuit between power and ground | 5 | 2 | 10 | Validate the netlist before routing, use default-open switches and implement hardware current limiting and automatic power shutdown | 3 | 1 | 3 |
| R09  | Power regulator failure causes excessive voltage on the student circuit | 5 | 2 | 10 | Use regulated and protected power stages, appropriate fusing, overvoltage protection and separated student-circuit power control | 3 | 1 | 3 |
| R10  | Student-accessible contacts are accidentally connected to an external power source | 5 | 2 | 10 | Use proprietary mechanically guided educational modules, protect accessible nodes and clearly prohibit external power sources | 3 | 1 | 3 |
| R11  | Capacitor charging current exceeds the intended circuit current | 3 | 3 | 9 | Restrict capacitance values, require suitable series resistance and validate supported RC circuits before use | 2 | 1 | 2 |
| R12  | Capacitor remains charged after a lesson and affects the following activity | 3 | 3 | 9 | Provide a controlled discharge path and verify capacitor discharge before enabling another circuit | 2 | 1 | 2 |
| R13  | Camera image quality becomes insufficient because of shadows, reflections or poor lighting | 3 | 3 | 9 | Use a rigid camera mount, fixed imaging geometry and controlled diffuse illumination | 2 | 1 | 2 |
| R14  | Microcontroller resets or firmware freezes while the circuit is energized | 4 | 2 | 8 | Use watchdog protection, hardware power-enable control and switching hardware that returns to an open state on reset | 2 | 1 | 2 |
| R15  | Student circuit requires more simultaneous electrical nets than the switching architecture supports | 4 | 2 | 8 | Define the maximum topology complexity of the 10 educational modules and verify every target netlist before release | 2 | 1 | 2 |
| R16  | Current measurement is inaccurate and the system fails to correctly identify abnormal consumption | 3 | 2 | 6 | Calibrate the current-sensing circuit using reference loads and verify operation across the complete expected current range | 2 | 1 | 2 |
| R17  | Display, camera or lighting causes instability on the student-circuit power rail | 3 | 2 | 6 | Separate peripheral and student-circuit supply rails and dimension regulators and power supply with adequate margin | 2 | 1 | 2 |
| R18  | A switching channel remains unintentionally closed after a previous activity | 5 | 2 | 10 | Clear the entire switching matrix before loading every new netlist and verify the commanded state before applying power | 3 | 1 | 3 |
| R19  | Hardware implementation differs from the netlist mapping used by the routing software | 4 | 2 | 8 | Maintain a single documented node-to-switch mapping, perform automated electrical mapping tests and version hardware configuration data | 2 | 1 | 2 |
| R20  | Repeated student use causes degradation or mechanical damage to electrical contacts | 4 | 3 | 12 | Select durable replaceable contacts, use mechanically guided modules and design node contacts as serviceable components | 2 | 2 | 4 |

## Candidate risks to consider

Non-electronics starting points, not yet scored or accepted into the register above:

- QR code or color identification failing under classroom lighting.
- Raspberry Pi 3 B performance for the vision pipeline, or availability of the board itself
  (see the note in [Budget](./Budget.md)).
- A hazard class the safety check fails to recognize before energizing.
- Enclosure and camera boom not fitting or aligning as designed; camera wobble.
- Team availability across the semester.
- Component delivery delays.
