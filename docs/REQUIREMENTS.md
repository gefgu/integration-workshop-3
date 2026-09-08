# TedThunder requirements

This document records the current requirements from the first exported requirements table in the project workspace.


## Functional requirements

| ID | Category | Requirement | Status |
| --- | --- | --- | --- |
| FR-01 | SOFTWARE | Students can build their own challenges and share it them with each other | Not started |
| FR-02 | SOFTWARE | Each step of a guided module shall be defined by a target graph | Not started |
| FR-03 | SOFTWARE | The graph shall distinguish electrical nodes, component terminals, internal component edges, and contact edges. | Not started |
| FR-04 | SOFTWARE | A step shall be approved when the assembled graph contains the target graph by subgraph isomorphism | Not started |
| FR-05 | SOFTWARE | Each step shall introduce exactly one type of change: node placement, edge placement, or attribute change. | Not started |
| FR-06 | SOFTWARE | Component attributes (button state, resistor value, potentiometer position) shall be part of the graph and shall be targetable by a step. | Not started |
| FR-07 | SOFTWARE | Each step shall declare its expected electrical diagnosis, allowing intermediate steps in which the circuit already operates. | Not started |
| FR-08 | SOFTWARE | On every board change, the system shall compute the difference between the assembled graph and the current step's target graph. | Not started |
| FR-09 | SOFTWARE | Each missing element shall generate a task associated with the step in which it was first introduced. | Not started |
| FR-10 | SOFTWARE | The tutor shall address the task with the lowest step index, handling regressions before advancing. | Not started |
| FR-11 | SOFTWARE | Elements present on the board but absent from the target graph shall be tolerated unless they change the electrical diagnosis. | Not started |
| FR-12 | SOFTWARE | After approving a step, the system shall re-evaluate subsequent steps in cascade, without requiring the student to redo what is already satisfied. | Not started |
| FR-13 | SOFTWARE | Challenge mode shall validate only the final target graph and the inventory constraints, with no intermediate steps. | Not started |
| FR-14 | HARDWARE | Topology scanning and attribute reading shall produce a complete graph on every cycle, with no state carried between cycles. | Not started |

## Non-functional requirements

| ID | Requirement | Status |
| --- | --- | --- |
| NFR-01 | Isomorphism matching, for guided mode, shall complete within 100 ms for graphs of up to 12 components. | Not started |


## Anti-requirements

| ID | Constraint | Status |
| --- | --- | --- |
| AR-01 | The workbench will not accept components outside the provided kit | Not started |
| AR-02 | The system will not evaluate circuits outside the planned modules | Not started |
| AR-03 | The kit will not involve soldering | Not started |
| AR-04 | The kit will not involve voltages above 5 V | Not started |
| AR-05 | The system will not generate pedagogical content in real time using generative AI | Not started |
| AR-06 | Steps will not be expressed as arbitrary functions; only the three graph operations are admitted. | Not started |
| AR-07 | The system will not require the student to use specific matrix positions, only the correct structure. | Not started |
| AR-08 | The system will not evaluate circuits whose target graph is not declared in a module. | Not started |
