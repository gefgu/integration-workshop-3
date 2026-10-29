#set page(paper: "a4", flipped: true, margin: 10mm)
#set text(font: "DejaVu Sans", size: 9pt)
#set heading(numbering: none)
= Smart-controller perfboard — TOP and mirrored underside
CANDIDATE: native software checks do not release this board for soldering. Both drawings use TOP coordinates.

#grid(columns: (1fr,1fr), align: center, image("assets/top.svg",width:110mm), image("assets/underside.svg",width:110mm))
#pagebreak()
= Placement legend
Numbers match the drawing badges. Pin 1 is ringed. Use pins.csv for every endpoint; holes are 1-based. USB faces row 1.

#set text(size:8pt)
#table(columns: (6%, 20%, 48%, 26%), inset: 3pt, align: left,
text("#"), text("Ref"), text("Part / function"), text("TOP coordinate range"),
text("1"), text("J_ESP_L"), text("30-pin ESP32 left socket"), text("C10/R5 → C10/R19"),
text("2"), text("J_ESP_R"), text("30-pin ESP32 right socket"), text("C20/R5 → C20/R19"),
text("3"), text("J_POWER"), text("Regulated 3.3 V IN"), text("C25/R3 → C26/R3"),
text("4"), text("JP_EXT"), text("REMOVE for USB programming"), text("C25/R6 → C26/R6"),
text("5"), text("J_UART"), text("Pi: cross TX/RX"), text("C25/R14 → C27/R14"),
text("6"), text("J_JOY"), text("Joystick axes ONLY"), text("C24/R19 → C27/R19"),
text("7"), text("J_OLED0"), text("OLED slot 0"), text("C2/R4 → C5/R4"),
text("8"), text("J_OLED1"), text("OLED slot 1"), text("C2/R7 → C5/R7"),
text("9"), text("J_OLED2"), text("OLED slot 2"), text("C2/R10 → C5/R10"),
text("10"), text("J_OLED3"), text("OLED slot 3"), text("C2/R13 → C5/R13"),
text("11"), text("J_OLED4"), text("OLED slot 4"), text("C2/R16 → C5/R16"),
text("12"), text("J_OLED5"), text("OLED slot 5"), text("C2/R19 → C5/R19"),
text("13"), text("J_SENSE"), text("From main matrix: no raw ADC connection"), text("C2/R28 → C4/R28"),
text("14"), text("JP_SENSE1"), text("P1 disconnect link"), text("C3/R30 → C4/R30"),
text("15"), text("JP_SENSE2"), text("P2 disconnect link"), text("C11/R30 → C12/R30"),
text("16"), text("J_EXP"), text("Future GPIO: NO output driver fitted"), text("C21/R25 → C28/R25"),
text("17"), text("J_GND"), text("Ground distribution: insulated links"), text("C2/R44 → C9/R44"),
text("18"), text("R_P1_TOP"), text("10k"), text("C3/R32 → C3/R35"),
text("19"), text("R_P1_BOT"), text("10k"), text("C3/R37 → C6/R37"),
text("20"), text("R_P1_SER"), text("1k"), text("C3/R39 → C6/R39"),
text("21"), text("C_P1"), text("100nF"), text("C6/R41 → C7/R41"),
text("22"), text("R_P2_TOP"), text("10k"), text("C11/R32 → C11/R35"),
text("23"), text("R_P2_BOT"), text("10k"), text("C11/R37 → C14/R37"),
text("24"), text("R_P2_SER"), text("1k"), text("C11/R39 → C14/R39"),
text("25"), text("C_P2"), text("100nF"), text("C14/R41 → C15/R41"),
text("26"), text("C_BULK"), text("47uF"), text("C26/R10 → C27/R10"),
text("27"), text("C_LOCAL"), text("100nF"), text("C24/R22 → C25/R22")
)
#pagebreak()
#set text(size:9pt)
= GPIO and connector contract
#table(columns: (21%, 10%, 69%), inset: 3pt, align: left,
text("Signal"), text("GPIO"), text("Function"),
text("SCL"), text("22"), text("Shared clock; six SDA wires remain separate"),
text("SDA_0"), text("4"), text("OLED slot 0"),
text("SDA_1"), text("21"), text("OLED slot 1"),
text("SDA_2"), text("19"), text("OLED slot 2"),
text("SDA_3"), text("18"), text("OLED slot 3"),
text("SDA_4"), text("17"), text("OLED slot 4"),
text("SDA_5"), text("16"), text("OLED slot 5"),
text("JOY_X"), text("36"), text("ADC1; VP"),
text("JOY_Y"), text("39"), text("ADC1; VN"),
text("SENSE1_ADC"), text("34"), text("ADC1; P1 through divider/filter"),
text("SENSE2_ADC"), text("35"), text("ADC1; P2 through divider/filter; NO joystick click pull-up"),
text("UART_RX"), text("32"), text("Pi TX GPIO14 / physical 8 -> this pin"),
text("UART_TX"), text("33"), text("This pin -> Pi RX GPIO15 / physical 10"),
text("EXP_GPIO13"), text("13"), text("Reserved logic only; no educational output drive"),
text("EXP_GPIO14"), text("14"), text("Reserved logic only; no educational output drive"),
text("EXP_GPIO23"), text("23"), text("Reserved logic only; no educational output drive"),
text("EXP_GPIO25"), text("25"), text("Reserved logic only; no educational output drive"),
text("EXP_GPIO26"), text("26"), text("Reserved logic only; no educational output drive"),
text("EXP_GPIO27"), text("27"), text("Reserved logic only; no educational output drive")
)

Only 13 GPIOs are committed to current functions; six more are brought to the reserved logic header. GPIO0/2/5/12/15 boot pins and USB UART0 pins remain unused. Joystick SW is omitted; GPIO35 belongs to sense input 2. The 16-channel mux is not installed.

OLED headers are pin 1=3V3, 2=GND, 3=SCL, 4=SDA. They are NOT guaranteed to match module header order. J_UART is GND, ESP_TX(GPIO33), ESP_RX(GPIO32). J_SENSE is P1_RAW, GND, P2_RAW. J_JOY is 3V3, GND, VRx, VRy.
 #pagebreak()
= Complete schematic — continuous internal signal wiring
#image("assets/schematic.svg",width:100%,height:160mm,fit:"contain")
#pagebreak()
= Power and source isolation
#image("assets/schematic-power.svg",width:100%,height:160mm,fit:"contain")
#pagebreak()
= ESP32 left socket, joystick and Pi UART
#image("assets/schematic-controller.svg",width:100%,height:160mm,fit:"contain")
#pagebreak()
= Six SSD1306 connectors; module pull-ups
#image("assets/schematic-screens.svg",width:100%,height:160mm,fit:"contain")
#pagebreak()
= Two basic voltage channels
#image("assets/schematic-sensing.svg",width:100%,height:160mm,fit:"contain")
#pagebreak()
= Reserved GPIO and ground distribution
#image("assets/schematic-expansion.svg",width:100%,height:160mm,fit:"contain")
#pagebreak()
= Power, input limits and firmware handoff
#table(columns: (20%, 40%, 40%), inset: 3pt, align: left,
text("Link"), text("External operation"), text("USB programming"),
text("JP_EXT"), text("FITTED"), text("OPEN"),
text("JP_SENSE1"), text("FITTED only after input checks"), text("OPEN"),
text("JP_SENSE2"), text("FITTED only after input checks"), text("OPEN")
)

- External mode: USB unplugged, regulated 3.3 V connected through JP_EXT. USB mode: physically unplug external power, remove JP_EXT and both sense links, disconnect externally driven peripherals, then plug USB. Both modes share GND only with the Pi. Never apply sense voltages to an unpowered receiver.
- Raw sense inputs are DC 0–5.25 V relative to GND only. Each 10k/10k divider scales to 0–2.625 V, followed by 1k and 100nF at the ADC. These are not overvoltage clamps. The input load is approximately 20kΩ, so the measured circuit is disturbed; original ≥1MΩ/precision requirements are not met by this simplified candidate.
- The maximum raw-to-filter time constant is roughly 1.1 ms with a high-impedance source. Start with ≥10 ms settling after an acknowledged routing change; read both ADC1 channels without changing that route. Correlate position, route generation, timestamp and validity. ADC readings are sequential, not simultaneous. Compare each channel against a meter; report signed P1−P2 only when both fresh inputs are valid.
- Start OLED communication at 100 kHz. Route the hardware I²C controller to one SDA at a time; other SDA pins stay released/high. Never tie them together. This prototype lacks the baseline TCA9517 power-off isolation: no hot insertion/unpowered modules until leakage and bus behavior are qualified. No external SDA/SCL pull-ups are fitted. Verify both module pull-ups and the combined SCL loading; disconnected SDA inputs may float.
- Target 10 updates/s for each active position only after an integrated timing test. Limit display transfers and avoid full-frame redraws in the acquisition loop; qualify 400 kHz separately. A voltage reading is not proof of capsule presence; require a fresh response from the actual OLED. Six headers do not imply six simultaneously active modes; at most three positions are active. Budget every physically powered OLED.
- GPIO32/33 are the new UART RX/TX pins. The old UART demo GPIO16/17 mapping conflicts with screens and cannot be used unchanged. The old joystick demo button handling/pull-up on GPIO35 must also be removed before this board is used.
- Expansion pins are logic only. No pulse output driver, current limiter, watchdog gate or student power connection is installed. The reserved 13×16-hole area is not a guaranteed fit for a future complete protected output circuit. No ADC result or software command bypasses the existing authorization/fault requirements.
#pagebreak()
= Pre-solder and bring-up audit
All physical rows in audit.csv begin PENDING. It is preserved across rebuilds; audit-template.csv is regenerated. Record actual measurements and reviewer/date; do not convert a generated pass into a physical pass.

#table(columns: (18%, 82%), inset: 3pt, align: left,
text("Gate"), text("Required evidence"),
text("Mechanical"), text("Actual pitch/pads/plating; 25.4 mm DevKit row spacing; all 30 pin labels; USB access; sockets/plug/capacitor envelopes; mounting/strain relief; blank area clear on both faces."),
text("Unpowered"), text("Every pin and wire matches CSVs; no adjacent bridges; intended ground continuity; NC isolation; sense links/dividers and JP_EXT isolation; correct capacitor polarity."),
text("First power"), text("No ESP32 or modules at first; qualify voltage/current/polarity. Add removable DevKit, one OLED, joystick, UART, then remaining loads incrementally. Never change links live."),
text("Functional"), text("Test all OLED ports individually, both ADC channels against known voltages/meter, route changes, equal/differential readings, both UART directions, joystick directions, then three active positions together."),
text("Negative cases"), text("Disconnected input/screen, stale route generation, unpowered receiver, wrong serial data, reset and reconnect; outputs remain absent/off. Disconnect source before changing measurement polarity."),
text("Release"), text("Only the measured scope may be signed off. No CP00–CP36 acceptance, final accuracy, power-off isolation, pulse safety or manufacturing release is implied.")
)
