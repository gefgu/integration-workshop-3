# TedThunder requirements

Requirements for the TedThunder interactive electronics workbench. See
[TedThunder.md](../TedThunder.md) for the project description the requirements below refer to, and
[modules.md](./modules_plan/modules.md) for the content they must support.

Requirement IDs are grouped by area:

| Prefix | Area |
| --- | --- |
| `FR-VIS` | Vision and component identification |
| `FR-GRAPH` | Circuit graph model and step validation |
| `FR-PWR` | Power, energization and safety |
| `FR-UI` | Local interface |
| `FR-TUT` | Tutor and scaffolding |
| `FR-CNT` | Content |
| `FR-MET` | Multimeter probes |
| `FR-CLOUD` | Web app and sync |
| `FR-HW` | Bench hardware |

**Priority:** `Must` — required for delivery · `Should` — planned, first to be cut under pressure ·
`Could` — desirable, only if time allows.

**Status:** `Not started` · `In progress` · `Done`.

---

## Functional requirements

### Vision and component identification

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-VIS-01 | Each component capsule shall be identified by a QR code printed on its top face. | Must | Not started |
| FR-VIS-02 | When the QR code cannot be read, the system shall fall back to identification by the capsule's color coding. | Must | Not started |
| FR-VIS-03 | The system shall determine the orientation of polarized capsules (LED, battery, capacitor) from their marker. | Must | Not started |
| FR-VIS-04 | The system shall resolve which sockets of the 11 × 6 grid each capsule occupies. | Must | Not started |
| FR-VIS-05 | A capsule that cannot be identified by either method shall be reported on screen as unrecognized; the system shall not guess its type. | Must | Not started |
| FR-VIS-06 | Identification shall rely on the bench's own controlled lighting and shall not depend on classroom lighting conditions. | Should | Not started |
| FR-VIS-07 | The system shall detect a capsule that is not seated in a valid socket and report it as a placement error. | Should | Not started |
| FR-VIS-08 | For the color-code resistor capsule, the system shall read the selected quadrant of each of its three discs from the capsule's top face. | Should | Not started |
| FR-VIS-09 | Disc reading shall only be required to discriminate the colors actually used by the discs (brown, yellow, black, violet, red). | Should | Not started |

### Circuit graph model and step validation

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-GRAPH-01 | Each step of a guided module shall be defined by a target graph. | Must | Not started |
| FR-GRAPH-02 | The graph shall distinguish electrical nodes, component terminals, internal component edges, and contact edges. | Must | Not started |
| FR-GRAPH-03 | Each step shall introduce exactly one type of change: node placement, edge placement, or attribute change. | Must | Not started |
| FR-GRAPH-04 | A step shall be approved when the assembled graph contains the target graph by subgraph isomorphism. | Must | Not started |
| FR-GRAPH-05 | Component attributes (button state, resistor value, potentiometer position) shall be part of the graph and shall be targetable by a step. | Must | Not started |
| FR-GRAPH-06 | Each step shall declare its expected electrical diagnosis, allowing intermediate steps in which the circuit already operates. | Must | Not started |
| FR-GRAPH-07 | On every board change, the system shall compute the difference between the assembled graph and the current step's target graph. | Must | Not started |
| FR-GRAPH-08 | Elements present on the board but absent from the target graph shall be tolerated unless they change the electrical diagnosis. | Must | Not started |
| FR-GRAPH-09 | After approving a step, the system shall re-evaluate subsequent steps in cascade, without requiring the student to redo what is already satisfied. | Must | Not started |
| FR-GRAPH-10 | The assembled graph shall be derived from vision alone: capsule type and orientation from the marker, connectivity from socket occupancy and grid geometry. | Must | Not started |
| FR-GRAPH-11 | Sockets sharing a column within the same bank shall form one electrical node; each power rail shall form one electrical node. | Must | Not started |
| FR-GRAPH-12 | A jumper capsule shall contribute a single internal edge between the two sockets it spans, in length 2 or length 3. | Must | Not started |
| FR-GRAPH-13 | The value dialed on the color-code capsule shall be carried as the resistance attribute of its internal edge, derived from the three disc colors. | Should | Not started |

### Power, energization and safety

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-PWR-01 | The circuit shall be energized only when the student presses the Energizar button. | Must | Not started |
| FR-PWR-02 | Before energizing, the system shall classify the assembled circuit as safe or hazardous. | Must | Not started |
| FR-PWR-03 | For a circuit classified as safe, the switch matrix shall close the traces of the detected path so that real current flows through the real components inside the capsules. | Must | Not started |
| FR-PWR-04 | For a circuit classified as hazardous, the switch matrix shall remain open and the consequence shall be presented on screen as a simulation. | Must | Not started |
| FR-PWR-05 | The system shall recognize at least these hazard classes: short circuit between rails, current not limited through a load, and reversed or unseated capsule in a powered path. | Must | Not started |
| FR-PWR-06 | While the circuit is energized, the system shall observe live attribute state (button pressed, potentiometer position) by measuring the live circuit. | Must | Not started |
| FR-PWR-07 | The system shall cut power automatically when a fault is detected during energization, or when a capsule is added to or removed from the board. | Must | Not started |
| FR-PWR-08 | The circuit shall be de-energized when the student leaves the current step or presses Energizar a second time. | Should | Not started |
| FR-PWR-09 | The board's status LED shall indicate that the bench is powered, independently of the student's circuit. | Must | Not started |
| FR-PWR-10 | When an energized path contains the color-code capsule, the switch matrix shall bypass the capsule and route through the internal resistor bank value matching the dialed value. | Should | Not started |
| FR-PWR-11 | The substitution performed for the color-code capsule shall not be disclosed to the student in any interface state. | Should | Not started |

### Local interface

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-UI-01 | The 7″ screen shall display the current module, the current step, the active hint, and the electrical diagnosis. | Must | Not started |
| FR-UI-02 | The joystick shall navigate the interface and the four buttons shall select options and answer quiz questions. | Must | Not started |
| FR-UI-03 | Energizar shall be a dedicated physical button, distinct from the four interface buttons and the joystick. | Must | Not started |
| FR-UI-04 | The guided curriculum shall be fully usable with no network connection. | Must | Not started |
| FR-UI-05 | The bench shall give audio feedback through its speaker for step approval, faults and hints. | Should | Not started |
| FR-UI-06 | While energized, the interface shall display the current and voltage of the student's circuit. | Should | Not started |
| FR-UI-07 | A mascot shall react on screen to approvals and to hazard events. | Could | Not started |

### Tutor and scaffolding

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-TUT-01 | Each missing element shall generate a task associated with the step in which it was first introduced. | Must | Not started |
| FR-TUT-02 | The tutor shall address the task with the lowest step index, handling regressions before advancing. | Must | Not started |
| FR-TUT-03 | Hints shall be pre-authored per step and per missing graph element, and selected deterministically from the graph difference; they shall not be generated at runtime. | Must | Not started |
| FR-TUT-04 | Hints shall be progressive: a reflective question first, then increasingly explicit guidance, never the finished answer on the first intervention. | Must | Not started |
| FR-TUT-05 | The tutor shall intervene on its own only after two consecutive failed attempts at the same step. | Should | Not started |
| FR-TUT-06 | The tutor shall run entirely on the bench, with no network dependency. | Must | Not started |

### Content

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-CNT-01 | The system shall ship the ten guided modules specified in `modules_plan/modules.md`. | Must | Not started |
| FR-CNT-02 | Each guided module shall have a challenge version with the same target circuit and no step-by-step instructions. | Must | Not started |
| FR-CNT-03 | Challenge mode shall validate only the final target graph and the inventory constraints, with no intermediate steps. | Must | Not started |
| FR-CNT-04 | The system shall present conceptual multiple-choice questions answered with the four interface buttons. | Should | Not started |
| FR-CNT-05 | The system shall record each student's progress across modules. | Should | Not started |
| FR-CNT-06 | The system shall ship the bonus module on the resistor color code, in guided and challenge versions. | Should | Not started |
| FR-CNT-07 | The challenge version of the bonus module shall hide the on-screen color reference. | Could | Not started |

### Multimeter probes

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-MET-01 | The bench shall provide two integrated probes and shall detect which socket each probe is inserted into. | Should | Not started |
| FR-MET-02 | The interface shall display the reading for the point measured by the probes. | Should | Not started |
| FR-MET-03 | Probe measurement shall be available in the modules that teach it (03 and 09). | Could | Not started |

### Web app and sync

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-CLOUD-01 | The bench shall pair with the companion web app over Wi-Fi. | Should | Not started |
| FR-CLOUD-02 | Student progress shall sync between the bench and the web app when a connection is available. | Should | Not started |
| FR-CLOUD-03 | Students shall be able to build their own challenges and share them with each other. | Should | Not started |
| FR-CLOUD-04 | The web app shall run in a browser with no software installation on school machines. | Should | Not started |
| FR-CLOUD-05 | A challenge authored in the web app shall be validated by the same graph rules as the built-in modules. | Should | Not started |

### Bench hardware

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-HW-01 | Topology scanning shall produce a complete graph on every cycle, with no state carried between cycles; attribute state shall likewise be re-read on every cycle while the circuit is energized. | Must | Not started |
| FR-HW-02 | The connection table shall provide an 11 × 6 socket grid within 18 × 16 cm, as two banks of three rows separated by a center channel, plus two power rails. | Must | Not started |
| FR-HW-03 | The camera shall be mounted on a fixed boom approximately 30 cm above the table, covering the whole grid. | Must | Not started |
| FR-HW-04 | Vision, graph matching, tutor and interface shall run on a Raspberry Pi 3 B. | Must | Not started |
| FR-HW-05 | Every component shall be enclosed in a capsule holding the real component; jumpers shall exist in length 2 and length 3 only. | Must | Not started |
| FR-HW-06 | The switch matrix shall route the 9 V supply between the rails and the detected circuit path. | Must | Not started |
| FR-HW-07 | The color-code capsule shall contain no resistor; internally it shall be a pass-through between its two terminals. | Should | Not started |
| FR-HW-08 | The bench shall hold an internal resistor bank with the eight values reachable by the discs: 100 Ω, 170 Ω, 400 Ω, 470 Ω, 1 kΩ, 1.7 kΩ, 4 kΩ and 4.7 kΩ. | Should | Not started |
| FR-HW-09 | Each disc of the color-code capsule shall have four detents with alternating colors, so that every quarter turn changes the digit. | Should | Not started |

---

## Non-functional requirements

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| NFR-PERF-01 | Isomorphism matching, for guided mode, shall complete within 100 ms for graphs of up to 12 components. | Must | Not started |
| NFR-PERF-02 | A full scan cycle, from camera frame to assembled graph, shall complete within 1 s on the Raspberry Pi 3 B. | Must | Not started |
| NFR-PERF-03 | Pressing Energizar shall produce either an energized circuit or a refusal within 500 ms. | Must | Not started |
| NFR-PERF-04 | A hint shall be displayed within 1 s of the graph difference being computed. | Should | Not started |
| NFR-SAFE-01 | A fault detected during energization shall cut power within 100 ms. | Must | Not started |
| NFR-SAFE-02 | No part accessible to the student shall carry more than 9 V, and no mains voltage shall be present in the enclosure. | Must | Not started |
| NFR-REL-01 | Capsule identification shall be correct in at least 98% of scans under the bench's controlled lighting. | Must | Not started |
| NFR-REL-02 | The bench shall boot to a usable module screen within 60 s. | Should | Not started |
| NFR-REL-03 | Disc color reading shall be correct in at least 98% of scans under the bench's controlled lighting. | Should | Not started |
| NFR-USE-01 | Screen content shall be legible at arm's length by a seated student of 11 to 13 years old. | Must | Not started |
| NFR-USE-02 | A student shall be able to complete Module 01 without adult assistance. | Must | Not started |
| NFR-OPS-01 | The guided curriculum shall run fully offline; cloud connectivity shall be optional. | Must | Not started |
| NFR-MAINT-01 | Modules, steps, target graphs and hints shall be authored as data; adding a module shall not require a code change. | Should | Not started |

---

## Anti-requirements

| ID | Constraint | Status |
| --- | --- | --- |
| AR-01 | The workbench will not accept components outside the provided kit. | Not started |
| AR-02 | The system will not evaluate circuits outside the planned modules. | Not started |
| AR-03 | The kit will not involve soldering. | Not started |
| AR-04 | The kit will not involve voltages above 9 V. | Not started |
| AR-05 | The system will not generate pedagogical content in real time using generative AI. | Not started |
| AR-06 | Steps will not be expressed as arbitrary functions; only the three graph operations are admitted. | Not started |
| AR-07 | The system will not require the student to use specific matrix positions, only the correct structure. | Not started |
| AR-08 | The system will not evaluate circuits whose target graph is not declared in a module. | Not started |
| AR-09 | This delivery will not include a teacher dashboard. | Not started |
| AR-10 | The system will never energize a path it has classified as hazardous. | Not started |
| AR-11 | The system will not identify a component without a readable marker; nothing is inferred from shape alone. | Not started |
| AR-12 | The system will not attempt to read live attribute state (button pressed, potentiometer position) while the circuit is unpowered. This does not cover the color-code discs, which are read by vision. | Not started |
| AR-13 | The color-code capsule will not reach values outside the eight defined by its discs. | Not started |
| AR-14 | The discs will not use the full ten-color resistor code, only the five colors listed in FR-VIS-09. | Not started |

---

## Traceability

Mapping from the IDs used in the first exported requirements table to the current ones.

| Previous ID | Current ID | Note |
| --- | --- | --- |
| FR-01 | FR-CLOUD-03 | Authoring and sharing moved to the web app area |
| FR-02 | FR-GRAPH-01 | |
| FR-03 | FR-GRAPH-02 | |
| FR-04 | FR-GRAPH-04 | |
| FR-05 | FR-GRAPH-03 | |
| FR-06 | FR-GRAPH-05 | Live state is now observed only while energized, see FR-PWR-06 |
| FR-07 | FR-GRAPH-06 | |
| FR-08 | FR-GRAPH-07 | |
| FR-09 | FR-TUT-01 | |
| FR-10 | FR-TUT-02 | |
| FR-11 | FR-GRAPH-08 | |
| FR-12 | FR-GRAPH-09 | |
| FR-13 | FR-CNT-03 | |
| FR-14 | FR-HW-01 | Amended: attribute re-reading applies to the energized state |
| NFR-01 | NFR-PERF-01 | |
| AR-01 … AR-08 | unchanged | AR-04 amended from 5 V to 9 V to match the modules |
