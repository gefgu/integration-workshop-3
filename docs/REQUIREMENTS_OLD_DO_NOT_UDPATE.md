# TedThunder requirements (OLD - DO NOT UPDATE)

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
| `FR-CLOUD` | Companion mobile web app and sync |
| `FR-HW` | Bench hardware |
| `FR-ELEC` | Electronics and routing |

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
| FR-VIS-09 | Disc reading shall only be required to discriminate the colors actually used by the discs (red, yellow, violet, brown). | Should | Not started |

### Circuit graph model and step validation

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-GRAPH-01 | Each step of a guided module shall be defined by a target graph. | Must | Not started |
| FR-GRAPH-02 | The graph shall distinguish electrical nodes, component terminals, internal component edges, and contact edges. | Must | Not started |
| FR-GRAPH-03 | Each step shall introduce exactly one type of change: node placement, edge placement, or attribute change. | Must | Not started |
| FR-GRAPH-04 | A step shall be approved when the assembled graph contains the target graph by subgraph isomorphism. | Must | Not started |
| FR-GRAPH-05 | Component attributes visible to the camera (resistor value, capacitor value, the value dialed on the color-code capsule) shall be part of the graph and shall be targetable by a step. | Must | Not started |
| FR-GRAPH-06 | Each step shall declare its expected electrical diagnosis, allowing intermediate steps in which the circuit already operates. | Must | Not started |
| FR-GRAPH-07 | On every board change, the system shall compute the difference between the assembled graph and the current step's target graph. | Must | Not started |
| FR-GRAPH-08 | Elements present on the board but absent from the target graph shall be tolerated unless they change the electrical diagnosis. | Must | Not started |
| FR-GRAPH-09 | After approving a step, the system shall re-evaluate subsequent steps in cascade, without requiring the student to redo what is already satisfied. | Must | Not started |
| FR-GRAPH-10 | The assembled graph shall be derived from vision alone: capsule type and orientation from the marker, connectivity from socket occupancy and grid geometry. | Must | Not started |
| FR-GRAPH-11 | Sockets sharing a column shall form one electrical node, across both banks; the center channel separates the banks mechanically, not electrically. | Must | Not started |
| FR-GRAPH-12 | A jumper capsule shall contribute a single internal edge between the two sockets it spans, in length 2 or length 3. | Must | Not started |
| FR-GRAPH-13 | The value dialed on the color-code capsule shall be carried as the resistance attribute of its internal edge, derived from the three disc colors. | Should | Not started |
| FR-GRAPH-14 | Actions performed on an energized circuit (button pressed, potentiometer turned) shall not be represented as graph state. A step targeting one shall be approved by the student's answer to a confirmation question presented when the interaction window ends, not by graph comparison. | Must | Not started |

### Power, energization and safety

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-PWR-01 | The circuit shall be energized only when the student presses the Energizar button. | Must | Not started |
| FR-PWR-02 | Before energizing, the system shall classify the assembled circuit as safe or hazardous. | Must | Not started |
| FR-PWR-03 | For a circuit classified as safe, the switch matrix shall close the traces of the detected path so that real current flows through the real components inside the capsules. | Must | Not started |
| FR-PWR-04 | For a circuit classified as hazardous, the switch matrix shall remain open and the consequence shall be presented on screen as a simulation. | Must | Not started |
| FR-PWR-05 | The system shall recognize at least these hazard classes: a path connecting the battery capsule's two terminals with no load, current not limited through a load, and reversed or unseated capsule in a powered path. | Must | Not started |
| FR-PWR-06 | An attribute action performed by the student on an energized circuit (pressing the button, turning the potentiometer) shall take effect physically in the real circuit. The system shall not sense it. | Must | Not started |
| FR-PWR-07 | The system shall cut power automatically on an overcurrent or short-circuit condition, and when a scan cycle detects that the board changed while energized — a capsule added, removed or moved. | Must | Not started |
| FR-PWR-08 | The circuit shall be de-energized when the student leaves the current step or presses Energizar a second time. | Should | Not started |
| FR-PWR-09 | The board's status LED shall indicate that the bench is powered, independently of the student's circuit. | Must | Not started |
| FR-PWR-10 | When an energized path contains the color-code capsule, the switch matrix shall bypass the capsule and route through the internal resistor bank value matching the dialed value. | Should | Not started |
| FR-PWR-11 | The substitution performed for the color-code capsule shall not be disclosed to the student in any interface state. | Should | Not started |
| FR-PWR-12 | A step targeting an attribute shall open an interaction window while the circuit is energized, during which the student performs the action. The window shall last as long as the step's animation or narration. | Must | Not started |
| FR-PWR-13 | The supply shall be current-limited by hardware independent of the microcontroller and supervisory software, sized so that a short circuit cannot damage any component, with a trip threshold not exceeding 75 mA for the complete student circuit. The limiter shall be always active and shall require no detection. | Must | Not started |
| FR-PWR-14 | The series resistance of FR-PWR-13 shall be subtracted from the values computed for display, so the student sees the circuit they built. | Should | Not started |

### Local interface

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-UI-01 | The 7″ screen shall display the current module, the current step, the active hint, and the electrical diagnosis. | Must | Not started |
| FR-UI-02 | The joystick shall navigate the interface and the four buttons shall select options and answer quiz questions. | Must | Not started |
| FR-UI-03 | Energizar shall be a dedicated physical button, distinct from the four interface buttons and the joystick. | Must | Not started |
| FR-UI-04 | The guided curriculum shall be fully usable with no network connection. | Must | Not started |
| FR-UI-05 | The bench shall give audio feedback through its speaker for step approval, faults and hints. | Should | Not started |
| FR-UI-06 | While energized, the interface shall display the current and voltage of the student's circuit, computed from the known topology and component values rather than measured. | Should | Not started |
| FR-UI-07 | A mascot shall react on screen to approvals and to hazard events. | Could | Not started |
| FR-UI-08 | The bench shall provide a main physical On/Off control. | Must | Not started |

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
| FR-MET-02 | The interface shall display the value for the point the probes touch, computed from the known circuit rather than measured. | Should | Not started |
| FR-MET-03 | Probe readings shall be available in the modules that teach measurement (03 and 09). | Could | Not started |

### Companion mobile web app and sync

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-CLOUD-01 | The bench shall pair with the companion mobile web app over Wi-Fi. | Should | Not started |
| FR-CLOUD-02 | Student progress shall sync between the bench and the companion app when a connection is available. | Should | Not started |
| FR-CLOUD-03 | Students shall be able to build their own challenges and share them with each other. | Should | Not started |
| FR-CLOUD-04 | The companion app shall be a mobile web app, laid out for a phone screen first, so the teacher can use it from the phone already in their pocket. | Should | Not started |
| FR-CLOUD-05 | A challenge authored in the companion app shall be validated by the same graph rules as the built-in modules. | Should | Not started |
| FR-CLOUD-06 | The same app shall also run on a desktop browser, adapting its layout to the larger screen; phone and desktop shall be the same application, not two builds. | Should | Not started |
| FR-CLOUD-07 | The app shall run in the browser with no installation, no app store and no account on the school's machines. | Should | Not started |

### Bench hardware

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-HW-01 | Topology scanning shall produce a complete graph on every cycle, with no state carried between cycles. | Must | Not started |
| FR-HW-02 | The connection table shall provide an 11 × 6 socket grid within 18 × 16 cm, as two banks of three rows separated by a center channel. There are no power rails; the battery capsule sits on the grid like any other component. | Must | Not started |
| FR-HW-03 | The camera shall be mounted on a fixed boom approximately 30 cm above the table, covering the whole grid. | Must | Not started |
| FR-HW-04 | Vision, graph matching, tutor and interface shall run on a Raspberry Pi 3 B, which acts as the supervisory system. The routing electronics shall have its own embedded controller. | Must | Not started |
| FR-HW-05 | Every component shall be enclosed in a capsule holding the real component; jumpers shall exist in length 2 and length 3 only. | Must | Not started |
| FR-HW-06 | The switch matrix shall route the 5 V supply between the nodes occupied by the battery capsule and the detected circuit path. | Must | Not started |
| FR-HW-07 | The color-code capsule shall contain no resistor; internally it shall be a pass-through between its two terminals. | Should | Not started |
| FR-HW-08 | The bench shall hold an internal resistor bank with the eight values reachable by the discs: 220 Ω, 270 Ω, 420 Ω, 470 Ω, 2.2 kΩ, 2.7 kΩ, 4.2 kΩ and 4.7 kΩ. | Should | Not started |
| FR-HW-09 | Each disc of the color-code capsule shall have four detents with alternating colors, so that every quarter turn changes the digit. | Should | Not started |

### Electronics and routing

Contributed by the electronics team. Requirements already covered elsewhere in this document are
not repeated here: energize-on-validated-netlist is FR-PWR-01 to FR-PWR-03, the button behaving as
a real switch is FR-PWR-06, the modular resistor is FR-HW-07 to FR-HW-09 and FR-PWR-10, the camera
is FR-HW-03, and controlled illumination is FR-VIS-06.

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| FR-ELEC-01 | The system shall provide 11 independently programmable electrical nodes, served by at least 12 internal routing buses. | Must | Not started |
| FR-ELEC-02 | Each programmable node shall provide two sets of three physical contacts — one set in each bank of the same column — with all six contacts electrically belonging to the same node. | Must | Not started |
| FR-ELEC-03 | The system shall be able to electronically connect any programmable node to an available internal routing bus. | Must | Not started |
| FR-ELEC-04 | The routing system shall support up to 11 independent electrical nets simultaneously, one per node. | Must | Not started |
| FR-ELEC-05 | The system shall be able to connect routed nets to protected 5 V, 3.3 V and GND references. | Must | Not started |
| FR-ELEC-06 | All programmable connections shall remain electrically open during startup, reset, while no validated circuit is active, and whenever the embedded controller is disconnected or in an invalid state. | Must | Not started |
| FR-ELEC-07 | The routing system shall support the predefined educational components: LED, capacitor, push button, modular resistor, low-current buzzer and potentiometer. | Must | Open conflict |
| FR-ELEC-08 | The battery module shall act only as a visual representation of the circuit power source; it shall not contain or supply electrical energy, and the actual voltage shall be supplied internally by the bench electronics. | Must | Not started |
| FR-ELEC-09 | The embedded hardware shall communicate with the supervisory system through USB and/or Wi-Fi. | Must | Not started |

**Open conflict, to resolve with the electronics team:**

- **FR-ELEC-07.** The potentiometer is not in the electronics team's original component list, but
  Module 06 is built entirely on it and Module 08 has a potentiometer variant. Listed here as
  required, pending their confirmation that a three-terminal variable component can be routed.

The electronics team's original list specified 22 nodes; this document resolves that as **11
nodes of six contacts each**, one column of the table spanning both banks. Their current
measurement requirement is deliberately absent — see AR-12.

---

## Non-functional requirements

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| NFR-PERF-01 | Isomorphism matching, for guided mode, shall complete within 100 ms for graphs of up to 12 components. | Must | Not started |
| NFR-PERF-02 | A full scan cycle, from camera frame to assembled graph, shall complete within 1 s on the Raspberry Pi 3 B. | Must | Not started |
| NFR-PERF-03 | Pressing Energizar shall produce either an energized circuit or a refusal within 500 ms. | Must | Not started |
| NFR-PERF-04 | A hint shall be displayed within 1 s of the graph difference being computed. | Should | Not started |
| NFR-SAFE-01 | The passive limiter of FR-PWR-13 shall bound fault current continuously, with no reaction time. A board change detected by the scan shall cut power within one scan cycle. | Must | Not started |
| NFR-SAFE-02 | No part accessible to the student shall carry more than 5 V, and no mains voltage shall be present in the enclosure. | Must | Not started |
| NFR-REL-01 | Capsule identification shall be correct in at least 98% of scans under the bench's controlled lighting. | Must | Not started |
| NFR-REL-02 | The bench shall boot to a usable module screen within 60 s. | Should | Not started |
| NFR-REL-03 | Disc color reading shall be correct in at least 98% of scans under the bench's controlled lighting. | Should | Not started |
| NFR-REL-04 | Illumination shall be uniform enough across the whole assembly area to avoid shadows and reflections that impair detection. | Must | Not started |
| NFR-USE-01 | Screen content shall be legible at arm's length by a seated student of 11 to 13 years old. | Must | Not started |
| NFR-USE-02 | A student shall be able to complete Module 01 without adult assistance. | Must | Not started |
| NFR-USE-03 | The companion app shall be operable one-handed on a phone screen of 5 inches or larger, in portrait orientation. | Should | Not started |
| NFR-OPS-01 | The guided curriculum shall run fully offline; cloud connectivity shall be optional. | Must | Not started |
| NFR-MAINT-01 | Modules, steps, target graphs and hints shall be authored as data; adding a module shall not require a code change. | Should | Not started |
| NFR-ELEC-01 | The system shall provide regulated 5 V and 3.3 V power rails. | Must | Not started |
| NFR-ELEC-02 | The normal operating current of a routed branch shall not exceed 15 mA unless the selected switching hardware is validated for a higher current. | Must | Not started |
| NFR-ELEC-03 | Programmable connections shall be implemented using analog crosspoint switches or an equivalent electronically controlled switching architecture. | Must | Not started |
| NFR-ELEC-04 | The main embedded controller shall provide sufficient digital interfaces to control the switching matrix, protection circuitry, sensors and communication interfaces. | Must | Not started |
| NFR-ELEC-05 | Student-accessible electrical contacts shall include protection against electrostatic discharge and accidental electrical transients. | Must | Not started |
| NFR-ELEC-06 | The resistance introduced by the programmable switching path shall be characterized and taken into account when validating every educational circuit. | Must | Not started |
| NFR-ELEC-07 | The electronic system shall be powered by an isolated external AC/DC supply. | Must | Not started |

---

## Anti-requirements

| ID | Constraint | Status |
| --- | --- | --- |
| AR-01 | The workbench will not accept components outside the provided kit, and the student will not energize the circuit from an external battery or power supply. | Not started |
| AR-02 | The system will not evaluate circuits outside the planned modules. | Not started |
| AR-03 | The kit will not involve soldering. | Not started |
| AR-04 | The kit will not involve voltages above 5 V. | Not started |
| AR-05 | The system will not generate pedagogical content in real time using generative AI. | Not started |
| AR-06 | Steps will not be expressed as arbitrary functions; only the three graph operations are admitted. | Not started |
| AR-07 | The system will not require the student to use specific matrix positions, only the correct structure. | Not started |
| AR-08 | The system will not evaluate circuits whose target graph is not declared in a module. | Not started |
| AR-09 | This delivery will not include a teacher dashboard. | Not started |
| AR-10 | The system will never energize a path it has classified as hazardous. | Not started |
| AR-11 | The system will not identify a component without a readable marker; nothing is inferred from shape alone. | Not started |
| AR-12 | The system will not sense button state or potentiometer position at all, powered or unpowered. Only camera-visible attributes are known to it. | Not started |
| AR-13 | The color-code capsule will not reach values outside the eight defined by its discs. | Not started |
| AR-14 | The discs will not use the full ten-color resistor code, only the four colors listed in FR-VIS-09. | Not started |
| AR-15 | The first version will not support motors, relays, lamps or other high-current loads. | Not started |
| AR-16 | The switching matrix will not automatically correct an incorrectly assembled student circuit. | Not started |
