# ESP32 smart-controller — 30 × 45-hole perfboard candidate

This is the independent design requested on **2026-10-21**: classic **30-pin** ESP32 DevKit, six remote SSD1306 ports (at most three active positions), two basic ADC voltage inputs selected by the main routing board, two-axis joystick, GPIO UART to the Pi, and an empty future pulse area. The photographed 15-pin-per-edge labels define the socket map. No 16-channel mux, ammeter, joystick click, or pulse output driver is installed.

**Design complete as a review candidate; NOT released for soldering.** The actual socket pitch/body fit, board plating, connector mating room, supply behavior, OLED pull-ups, analog performance and integrated firmware timing require the attached audit. Do not use a generated drawing or software pass as measured hardware evidence.

## Open these files

- [Interactive top/underside and selectable wiring groups](index.html) — opens locally, no server or network required.
- [Design PDF](design-guide.pdf) — 11 A4-landscape pages: 1:1 TOP/MIRRORED UNDERSIDE, part legend, GPIO map, full schematic overview, five native schematic detail pages, operating limits and audit summary.
- [Wiring PDF](wiring-guide.pdf) — one net group per page, maximum ten wires per view, with exact endpoint coordinates. Dashed lines are endpoint indicators, NOT insulated-wire clearance qualification or manufactured copper.
- [Native tscircuit schematic](assets/schematic.svg), [TOP](assets/top.svg), [mirrored underside](assets/underside.svg), and [native PCB footprint view](assets/native-pcb.svg).
- [Audit record](audit.csv), [pin endpoints](pins.csv), [wire endpoints](wires.csv), [GPIO map](gpio.csv), [removable links](links.csv), and [BOM](bom.csv).
- [Complete software verification](verification.json), [electrical/native geometry audit](checks.json), [schematic placement](schematic-placement.txt), [native PCB placement](placement.txt), [pad shorts](shorts.txt), [PCB style](pcb-style.json).

`audit.csv` is a manual record, initially all **PENDING**; it is preserved on rebuild. `audit-template.csv` is regenerated. No test from the earlier joystick/LED experiment qualifies this new board automatically. Existing hardware revisions, CP00–CP36 acceptance, the app/catalog and saved progress are untouched.

## Electrical choices

| Function | Pins / construction |
| --- | --- |
| OLED clock | GPIO22, shared SCL |
| OLED SDA0…5 | GPIO4, 21, 19, 18, 17, 16; never tied together |
| Joystick X/Y | GPIO36/VP and GPIO39/VN, ADC1 |
| Voltage P1/P2 | GPIO34 and GPIO35, ADC1, after separate divider/filter networks |
| Pi UART RX/TX | GPIO32 receives Pi pin8/GPIO14; GPIO33 sends to Pi pin10/GPIO15; Pi pin6 is GND |
| Future logic | GPIO13, 14, 23, 25, 26, 27 at J_EXP; no educational load may connect directly |

**13 GPIOs** serve current functions, plus six at the future logic header. Boot-strapping pins and USB UART0 remain untouched. GPIO35 is now an ADC input: the joystick click wire and its 10 kΩ pull-up must be absent. The earlier UART test's GPIO16/17 allocation conflicts with SDA and must not be copied unchanged. See [firmware handoff](firmware.md).

Each raw voltage input passes through a removable link, a 10 kΩ top / 10 kΩ bottom divider, a 1 kΩ ADC series resistor, and a local 100 nF filter. Normal raw input range is **0–5.25 V relative to common ground**, not a negative absolute voltage. Nominal ADC voltage is half the raw voltage. Both channels are sampled sequentially, then firmware computes calibrated P1−P2.

This deliberately simplified **20 kΩ input load** changes the circuit under test. It is not the original ≥1 MΩ buffered precision frontend and does not establish the original accuracy/continuity requirements. There is **no overvoltage clamp or power-off signal isolation**: connect inputs only within the stated range and with the receiver powered; open both sense links before programming/unpowering it. No diagnostic source remains attached during ordinary voltage readings.

No external SDA or SCL pull-up resistors or reserved pull-up footprints are installed. The OLED modules supply them. The user reported a resistance measurement between SDA and VCC; SCL and each remaining module still require confirmation. Parallel module SCL pull-ups can be too strong even if each module works alone. Disconnected SDA lines may float; firmware must release inactive lines and validate module presence. The supply must also cover every powered screen, not merely the three software-active positions. Start at 100 kHz; qualify 400 kHz only after actual cable/bus measurements. This direct-bus candidate omits the baseline TCA9517 isolation and has no hot-plug or unpowered-module qualification.

## Power modes

- **External operation:** USB disconnected; qualified regulated 3.3 V enters J_POWER; JP_EXT fitted. Restore sense links only after board and source domains are powered and checked.
- **USB programming:** unplug the external supply cable, remove JP_EXT and both sense shunts, disconnect peripherals that could drive an unpowered domain, then attach USB. USB powers the DevKit and board rail. Remove USB before returning to external operation.
- Never parallel USB/onboard-regulator output with the external 3.3 V source. Pi communication carries TX/RX/GND only; no Pi positive supply is connected.

## Physical placement and assembly authority

Columns **1–30** go left-to-right and rows **1–45** top-to-bottom in the TOP view. Coordinates retain those numbers on the mirrored underside. All component bodies are on top; insulated hook-up wires run underneath. Use sleeves where wires cross joints or exposed metal. Do not solder bare underside buses or infer junctions from drawn crossings.

- ESP32 sockets: **C10 and C20, R5–R19**, with USB facing row 1. Row spacing **25.4 mm is provisional** and MUST match the actual DevKit before soldering either socket. The sockets are standard 1×15 headers; the board body is a separate approximate envelope, not a fabricated bare-IC footprint.
- Six OLED connectors: C2–C5 at R4,7,10,13,16,19. Their order is **3V3, GND, SCL, SDA**; the OLED module may use a different order. Use individual female jumper leads according to signal labels.
- Power, UART and joystick connectors occupy the upper right; sensing/filter circuitry is lower left.
- The **C17–C29 / R28–R43** rectangle is reserved on both faces: 13×16 holes, approximately **33.0 × 40.6 mm** including half-pitch margins. Keep actual wire loops out. It does not promise that a complete future pulse safety circuit will fit.
- No mounting-hole drilling or board cutting is authorized by this candidate. The provisional outline assumes half-pitch margins; measure actual edges, enclosure, plug access and strain relief first.
- Footprints use documented standard tscircuit pinrows, axial 7.62 mm resistors and radial capacitors. Their native pad coordinates are checked against every planned hole. Purchased component bodies and plating remain unmeasured.

The numbered layout and `pins.csv`/`wires.csv` define the proposed endpoints. Only three long guide connections carry explicit corridor notes around the reserve; the rest of the dashed straight links simply identify endpoints. Select one net group at a time, physically plan insulated lead lengths/routes and inspect clearance before soldering. No custom router or routed PCB copper is used. Ground distribution pins are tied with insulated links, not an inferred shared pad strip.

## Audit and bring-up

Complete `audit.csv` in order:

1. Measure grid/pads, dry-fit sockets/DevKit, actual connectors and capacitors, USB clearance, mounting and reserve.
2. Inspect every endpoint, adjacent-pad isolation, resistor value, capacitor polarity and each removable link with power off.
3. Qualify the board rail without the ESP32 or peripherals. Add the removable ESP32, one OLED, joystick, UART and remaining loads in separate tested steps.
4. Test each screen port, ADC channel against a measured source/meter, equal/differential inputs, known matrix routes and their settling, joystick directions, and both UART directions.
5. Run three active positions with UI/communications and record actual acquisition/refresh latency, stale-data behavior, brownout/reset/reconnect behavior and supply limits.

Failed, unknown or inconclusive items remain pending. The blank pulse area must stay unpopulated until a separate protected-output design and audit exist. Independent current limits, rail protection and authorization remain project requirements even though the optional ammeter was omitted.

## Regenerate

From the tscircuit directory:

```sh
npm run build:smart-perfboard
```

Requires the existing local Bun/tscircuit packages and Typst. `design.mjs` is the independent single source for parts, TOP holes, nets and explicit wire trees; `controller.circuit.tsx` renders the native schematic/footprints; `layout.mjs` draws grid annotations and selectable endpoint guides; `documents.mjs` exports the PDFs and audit template. Never manually edit generated SVG/JSON/CSV exports; manual `audit.csv` is the deliberate exception.

The build runs native source, pin, netlist, schematic-placement, complete-board placement, pad-shorts and PCB-style checks plus independent wire-net equivalence, occupied-hole and footprint-coordinate checks. No routes exist, so copper checks cannot verify insulated wires. Connector MPN placeholders stay in data and are stripped from schematic text with the same text-only policy as `scripts/strip-connector-mpns.mjs`; existing global stripping hooks remain intact. They are not purchased-part identifications.

The source documents the installed passive networks but does not implement firmware or prove power sequencing. Read [the project guidelines](../guidelines.md) and [the baseline firmware contract](../revision5/firmware.md) for retained safety responsibilities; this candidate records its deviations rather than silently changing those baselines.

## Schematic presentation

Internal passives and removable sense links use continuous native tscircuit traces. Named ports are retained at external cable connectors, the removable ESP32 module sockets, and power/ground connections. The right ESP32 socket is shown beside the ADC networks. This changes schematic presentation only; perfboard hole coordinates, GPIO assignments, components and hand-wire endpoints are unchanged.

The schematic power view omits J_POWER and JP_EXT as assembly details and uses supply/GND symbols at the decoupling capacitors. Both remain in the physical layout, BOM and electrical model.

Pull-up update: the former six SDA resistors and optional SCL footprint were removed. Their holes are now free. Divider and ADC series resistors remain. Wiring IDs and numbered placement badges are regenerated; use the current PDFs/CSVs.

## First-stage soldering handoff

- [Portuguese soldering and wire-by-wire guide](stage1/guia-soldagem-etapa1.pdf)
- [First-stage native schematic PDF](stage1/esquema-etapa1.pdf)

Build with `npm run build:smart-perfboard:stage1`. Includes only sockets, power input/link, capacitors and OLED/joystick/UART connectors. Stage wires use Sxx identifiers and omit deferred sensing/expansion/ground-distribution headers; use this stage-specific ground tree. Confirm the actual photo against proposed hole coordinates, capacitor value/polarity and connector mating clearances before soldering. No measured fit or bench acceptance is implied.
