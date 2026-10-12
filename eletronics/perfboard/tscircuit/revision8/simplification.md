# Power and router-matrix simplification

This is an independent revision8 engineering candidate. Existing builds and revision5–7 remain unchanged. Two lower 200×100 mm isolated-pad perfboards are retained; measured stock, adapter/socket/module bodies, tray access and powered qualification remain pending.

## Parts and circuits

The baseline contains 41 passives on power and 40 on router-matrix. Revision8 contains 35 and 36: **71 total, down 10 (12.3%)**. Five optional LED/resistor pairs and the two button capacitors are removed. One fewer logic IC also removes its 100 nF bypass capacitor, and two shared UV/OV ladders save two resistors. Remaining ICs retain their local bypass capacitors. Current-trip, watchdog and diagnostic passives retain their values and electrical roles.

Power retains 5V_SYS, 3V3_SYS, no-fault and actual student-rail indicators. Router retains USB_ROUTER_3V3 and ROUTER_ALIVE. Test pads cover removed rail indicators. The student indicator takes LED current from 5V_SYS, not the monitored student budget.

The socketed SN74HC10N uses gates 1/2 for `ALLOW_RAIL = enable AND NOT_FAULT AND ROUTER_ALIVE`, and gate 3 for `CLEAR_N = NOT(EDU_FAULT_RESET AND PRESET_N)`. Pin assignments are in the generated endpoint CSV. The HC74 fault latch remains. This is Boolean equivalence; simultaneous pin transitions and supply ramps require scope tests.

The power supervisor becomes **MCP120-300DI/TO**, retaining its external 10 kΩ pull-up. The previous MCP130 internal 5 kΩ, in parallel with 10 kΩ, could demand about 1 mA from the wired-OR fault line, while LTC4365 guarantees FAULT low at 500 µA. Removing that internal pull-up reduces calculated demand to about 346 µA including an input-leakage allowance. The router's MCP130 and external 10 kΩ remain: internal pull-up resistance is typical only and rise-time qualification is outstanding.

## Voltage ladders

Wire each chain `BUCK → top resistor → UV → middle resistor → OV → bottom resistor → GND`; do not exchange UV and OV taps. All six resistors are 0.1%. Candidate MPNs are in the BOM; actual sourcing and body fit are pending.

| Rail | Top | Middle | Bottom | Nominal UV | Nominal OV | Worst-case OV |
|---|---|---|---|---|---|---|
|5V|91.4kΩ|1.35kΩ|10kΩ|4.526V|5.138V|5.049–5.226V|
|3V3|57.6kΩ|2.02kΩ|10.1kΩ|2.876V|3.451V|3.393–3.510V|

`lower/assessment.json` enumerates resistor tolerance, both ±10nA input leakages, comparator threshold 0.4925–0.5075V and hysteresis 20–32mV, including coupled tap leakage and recovery limits. Adjust buck 5V nominally to 5.00 V, below the lowest guard threshold; verify actual tolerance and peaks. The steady calculation does not establish the 5.25 V transient ceiling.

## Connections and hand wiring

- Six 4-pin matrix receivers match the contact NODE groups 4/4/3 exactly. All 22 NODE nets remain independent; unused fourth pins stay open.
- One keyed 10-pin straight-through power/control cable carries 5V_EDU, GND, 3V3_SYS, 5V_SYS, EDU_PWR_EN, EDU_FAULT, EDU_FAULT_RESET, CURRENT_SENSE, ROUTER_ALIVE, 12V_SYS. Receiver installed at CP00; fit qualified final-power harness during CP09 bring-up. The 5 V and 3.3 V consumer rails are permanently connected to their protected supplies.
- LED anodes and safety-control nets are board-local. The three power-board safety bring-up links and router enable, reset and matrix-strobe links are replaced by permanent local wire paths; fail-safe pull-downs remain. The inherited LED-anode cable and enable far-side cable are removed; the latter would have bypassed the power-board interlock split.
- Parts occupy functional bands; local bypass capacitors are within 12 mm of their IC supply pins. Sensitive analog/watchdog loops remain on their board. System, student, USB-router, USB-smart and Pi supplies remain separate nets.
- Ground bars are continuous physical runs with short insulated stubs. All other wires are insulated, stripped only at endpoints. Bridge symbols show proper crossings; touching or overlapping insulated paths do not create electrical joints. Inspect individual net views and endpoint CSVs before assembly.
- Red means power; black means ground; blue/white/yellow/green mean signals. Resistors are amber and capacitors violet in all board views.

Generated length falls from 7.75 m to 5.36 m on power, and 12.10 m to 8.38 m on router-matrix. Proper segment crossings fall 608→350 and 1623→730. These are geometry metrics. Physical wire runs, connection segments, wire-end joints and component-pin joints are reported separately in `lower/comparison.csv`; they are not measured cut lengths or assembly times.

## Reproduce and review

From the tscircuit directory run `npm run build:revision8`. The build regenerates both contact previews, native lower-board checks/schematics/drawings, pad/copper checks, full CP00–CP36 connectivity assessment, BOM, harness/endpoint/wire tables and the HTML guide. It also exercises deliberately corrupted wires, harnesses and interlock inputs, plus the button debounce contract.

Read `lower/checks.json`, `lower/copper-checks.json` and `lower/assessment.json` together. Copper checks cover pads only; insulated wires are annotations and are checked independently. `lower/acceptance-template.json` retains pending physical/bench tests. See [firmware.md](firmware.md) for button and construction changes.

Manufacturer references: [SN74HC10](https://www.ti.com/lit/ds/symlink/sn74hc10.pdf), [LTC4365](https://www.analog.com/media/en/technical-documentation/data-sheets/ltc4365.pdf), [MCP120/130](https://ww1.microchip.com/downloads/en/DeviceDoc/11184d.pdf).


### Power-board test header decision

At the user's choice, remove the power-board `J_PROBE` 1×8 header. `BUCK_5V` and `BUCK_3V3` can be measured at their converter connectors; `EDU_PWR_EN` and `PRESET_N` lack dedicated LEDs, but do not justify a permanent probe header. Use temporary test clips or probe the component pins when diagnosing those control nets. The router-matrix `J_PROBE` remains.
