# TedTronics requirements

Requirements for the TedTronics interactive electronics workbench, transcribed and organized from
"TedTronics - Requirements.pdf".

## Functional Requirements

### Vision and component identification

1. Each component must contain a unique and specific ArUco marker.
2. ArUco markers must be positioned on the top of each component, facing the camera.
3. The system must identify the color class of each capsule on the board, distinguishing between the kit's 6 capsule colors:
   - The battery component must be red.
   - The LED and Buzzer components must be green.
   - The Resistor and Capacitor components must be blue.
   - The Button and Potentiometer components must be yellow.
   - The Jumpers must be white.
   - The Smart Capsules must be black.
4. The system must have a fixed camera positioned so that it can view the entire circuit assembly area.
5. The system must have dedicated lighting to improve the visibility of the components for the camera.

### Circuit graph model and step validation

1. The system must take the identified positions (column, row) of the component terminals and the component type to build a graph representation. This graph considers each terminal a node, distinguishing between terminal types (e.g. anode and cathode). It places an edge between nodes of the same component and between nodes of the same column. Each node has an attribute for its type and position.
2. The system, under the guided class, must have a target graph representation for each step.
3. The system, under the challenge class, must have a target graph representation for the final circuit only.
4. Each step from the guided tutorial must teach exactly one action, where that action is one of the following: placing a component; placing a connection (edge); interacting with a component; or selecting a button. No tutorial step shall require the user to perform more than one of these actions.
5. The system must approve a step when the graph representation of the circuit of the workbench matches the target graph by isomorphism, including the node position (column, row) if present on the target graph.
6. The system must not approve a step when the graph representation of the circuit of the workbench does not match the target graph by isomorphism.
7. For any valid circuit on the board, moving every component by the same column and row offset, such that every component still occupies valid sockets, must produce a circuit graph isomorphic to the original, so that lesson validation does not depend on where the student built the circuit.

### Electronics routing and power

1. The circuit must be powered down until the button "Energizar" is pressed.
2. The system must use a programmable electronic matrix to create connections between the workbench nodes.
3. The system must use integrated circuits to perform electronic switching between the nodes and the internal buses.
4. The system must allow multiple nodes to be connected to the same internal bus, forming the same electrical network.
5. The system must remove the previous programmable connections before configuring a new circuit.
6. The system must turn off the circuit power supply if an inappropriate electrical condition is detected, such as overcurrent or short circuit.
7. The system must provide a regulated low-voltage power supply for the educational circuits.
8. The system must receive a validated netlist and use it to automatically configure the electrical connections of the circuit.

### Kit components and hardware

1. The components must be able to be inserted into the board.
2. The kit must contain the components listed below:
   - 1 Battery.
   - 2 LED.
   - 1 Buzzer.
   - 1 Resistor of 220 Ω.
   - 1 Resistor of 470 Ω.
   - 1 Resistor of 1 kΩ.
   - 2 Capacitors of 1000 uF.
   - 1 Color-Code resistor capsule.
   - 2 Pushbutton.
   - 1 Potentiometer.
   - 6 Short Jumpers (span 2 columns).
   - 3 Long Jumpers (span 3 columns).
   - 3 Bridge Jumpers (span the central divider).
   - 3 Smart Capsules.
3. The configurable resistor must allow the selection of different resistance values through a physical mechanism.
4. The buttons used in the circuits must operate as real electrical switches after the circuit is routed.
5. The capacitors used in the circuits must exhibit real electrical charging and discharging behavior.
6. The component representing the battery must act only as a visual representation of the power source, while the actual electrical power must be provided internally by the workbench.

### Smart components

1. The system shall provide exactly 3 smart components:
   - Each smart component shall have an OLED screen that displays the component's current behavior (e.g., fuse exploding) or its type (e.g., AND gate).
   - Smart components shall only be placeable on rows 1 and 6 of the banks.
   - The behavior of each smart component shall be assigned by the currently active lesson.
   - Each smart component shall have 2 physical buttons for user interaction with the component.
2. The system must read periodically, at most every 10ms, the current and voltage passing through the placed smart component and the button state.
3. The system must allow these smart components to simulate the behavior of: AND/OR/NAND/NOR/XOR logic gates, a periodic pulse, a multimeter (voltage/current reading).
4. Smart components must electrically connect to the workbench using the same connection system used by the other components.
5. Smart components must also connect to dedicated service rails for their current to be read and their screens to be set.

### Bench display and local interface

1. The bench must include a built-in 7-inch display, so that a student can complete any lesson without an external device.
2. The display must show exactly one of the following screens at a time: the Home screen, the Bluetooth pairing screen, the guided lesson, the questionnaire, the challenge lesson, or the board view from the camera.

### Lessons, tutor and content

1. Each learning module must feature an electronic component.
2. Each module must present a lesson. When a student selects a module from the home screen, the bench must present on its display that module's guided lesson, followed by an optional challenge lesson and its questionnaire.
3. A guided lesson must consist of an ordered sequence of steps, each instructing the student to place or remove a component, or connect two components.
4. The system must give a hint when the step is not approved after a change in the circuit's graph representation.
5. The content of the guide must be "spoken" by the virtual tutor (written on the screen).
6. The virtual tutor must be visually represented by a mascot.
7. The virtual tutor must give feedback to the student during assembly.
8. Feedback must be provided through guidance, not limited to indicating success or error.
9. The system must allow for the creation of educational questionnaires based on practical activities.

### Companion mobile app

1. The system must allow the student's progress to be loaded/stored with a mobile app connected with Bluetooth.
2. The system must allow teachers to assign customized activities to students:
   - The web app must let a teacher create an activity by placing components from the kit's component set on a virtual board that mirrors the bench's 11×6 grid, and saving it with a title and an instruction text.
   - The web app shall let a teacher assign a saved activity to one or more students.
   - The activity can be a guided lesson or a challenge.

## Non-Functional Requirements

### Performance

1. The system must compare the workbench circuit graph representation to the target graph in 200ms.

### Safety and power protection

1. No electrically accessible part of the system shall operate at voltage levels considered unsuitable for the educational use of the workbench.
2. The power supply used internally by the switching circuits must remain inaccessible to the student.
3. The educational circuit power supply must be regulated before being provided to the switching matrix.
4. The Raspberry Pi, ESP32, and educational circuits must have a stable power supply during normal operation of the workbench.
5. The power supply system must include overcurrent protection.
6. The power supply system must include reverse-polarity protection.
7. The programmable connections must remain open during system startup or reset.
8. The system must fully configure all connections before enabling the circuit power supply.
9. The current flowing through the educational circuits must remain within the limits supported by the switching components.
10. The workbench must not energize an incomplete, invalid, or unroutable electrical configuration.
11. The student circuit power supply must always start in the OFF state after workbench power-up, reset, or loss of communication with the controller.

### Reliability and vision

1. The system must function even without a network connection.
2. The physical contacts of the workbench must withstand repeated insertion and removal of the components.
3. The camera must have sufficient resolution to identify the components, their positions, and their markers.
4. The camera position relative to the workbench must remain fixed during normal operation.
5. The lighting system must reduce shadows and reflections that could impair visual recognition.

### Usability and pedagogy

1. Control of the interface interaction functions must be performed using the joystick and buttons.
2. Each guide screen must have a maximum of 2 lines of content.
3. The tutor must not use any term from the kit glossary (current, voltage, resistance, node, short-circuit, ...) in a module before that module has shown its everyday-language explanation.
4. The tutor should be a pixel-art hamster.

### Physical and materials

1. The board and the case must be made of PLA.
2. The bench must be separable using only the hands into at most three parts (board, display unit, camera arm), each fitting within 45 x 35 x 20 cm and weighing at most 5kg.

## Anti-Requirements

1. The system should not use LLMs for its learning tutor.
