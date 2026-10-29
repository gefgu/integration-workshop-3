# HISTÓRICO — substituído pela versão simplificada com RC522

Não instalar a proposta de60/69 peças com base neste diretório. O guia atual é [wiring_guide.pdf](../wiring_guide.pdf), gerado por [simplified-final](../simplified-final/README.md). Este diretório é preservado como histórico de alternativas, não como instrução atual de montagem.

# Smart-components board — complete wiring package v1

Primary deliverable: [Guia de fiação em português](guia-final-placa-inteligente.pdf). Additional reference: [Native tscircuit schematic sheets](esquema-complemento.pdf).

This package covers the existing simplified ESP32 board and a separate **30×45-hole completion perfboard**. It contains no internal routing-board design. The existing board is treated as built exactly as its simplified PDF; its 39 Sxx wires, six OLED headers, UART, joystick, sockets, power and capacitors are preserved. The completion board's 77 parts/166 Fxxx connection segments implement buffered high-impedance voltage acquisition, one protected source/sink output, a diagnostic stimulus/return and hardware expiry. A pair selected elsewhere arrives through the external signal connector; output goes to the selected P3. No 16-channel multiplexer is needed on this board.

**Physical release PENDING.** This is a concrete design/wiring candidate, not measured confirmation of fit, safety, pulse timing or analog stability. It requires actual 30×45 completion-board/adaptor dry fit, known capacitor value/tolerance, source/sink short and transient tests, voltage/input-leakage qualification and verified external EDU_ON/EDU_OFF_OK signals. No retracing of the old board is prescribed. No assumption is made that 77 extra components fit in its remaining lower area.

## Files

- `guia-final-placa-inteligente.pdf`: stage-1 audit, exact ESP32-to-completion cable pinout, power/external signals, numbered placement and mirrored underside, parts and per-wire tables, bring-up and firmware contract.
- `esquema-complemento.pdf`: native detail sheets. Named signals between sheets; local connections use wires. Header MPN placeholders are removed from all drawings.
- `pins.csv`, `wires.csv`, `bom.csv`: completion-board pin positions/connections/component values; Fxxx identifiers are separate from original Sxx/Wxxx.
- `audit.csv`: manual physical evidence, preserved on rebuild; all initially pending.
- `verification.json`, `checks.json`, `schematic-placement.txt`, `placement.txt`, `shorts.txt`, `pcb-style.json`: software evidence only; pad checks do not establish safe insulated-wire paths.
- `design.mjs`, `circuit.tsx`, `build.tsx`, `documents.mjs`: independent model, tscircuit source, checks and PDF generator.

Regenerate from the tscircuit directory: `npm run build:smart-perfboard:final`.

## Interface contract — no router redesign

Controller harness J_CTRL: ARM13, HB14, MODE_A25, MODE_B26, MODE_C27, ADC34, ADC35, EDU_ON-to-GPIO23, local 3V3, GND. These are GPIO numbers, not ESP32 physical pin numbers. Existing UART32/33 and all OLED/joystick pins are unchanged.

Power harness: 5V_SYS, GND, 5V_EDU, GND. 5V_EDU is the qualified switched/limited student source derived from 5V_SYS, not an independently higher supply. No 12 V is allowed on the smart board. No USB/external ESP supply paralleling.

External signal harness: SENSE_A, GND, SENSE_B, PULSE_OUT, GND, EDU_ON, EDU_OFF_OK. Sense inputs are absolute 0…5.25 V; publish signed A−B. EDU flags are **0/3.3 V**, with physical pull-downs; they are not power pins. EDU_ON must reflect healthy source and energized student domain. EDU_OFF_OK must be a verified unpowered condition, including capacitor charge and external sources; never replace it by a permanent jumper. Their generation is outside this board and still needs to be identified on the actual existing system before integration. Requests alone are not evidence of these states.

Mode code is C:B:A. 000 = all open, 001 = source (EDU_ON required), 010 = sink (EDU_ON required), 100 = diagnostic stimulus and return (EDU_OFF_OK required); all other codes use unconnected decoder outputs. ARM holds the HC123 in reset unless authorized; fresh heartbeat edges continue only while session/configuration is valid. Go via 000 with ≥5 ms break-before-make on every transition. HC238 ensures mutually exclusive steady-state functions, not glitch-free multi-bit updates. Firmware must implement the transition sequence.

## Design calculations and limits

- 1MΩ+1MΩ, both ±0.1%, give 1.998 MΩ minimum nominal DC differential input resistance to the bias source, before parasitics. Bias is ~0.5 V; divider nodes ~0.25…2.88 V. Rail-off leakage and actual impedance still require measurement. Calibrate A and B independently; don't infer an exact offset solely from nominal resistors. Old 10k/10k networks are not installed.
- MCP6002-I/P voltage buffers are candidate parts for the specified voltmeter tolerance. They do not make ESP32 ADC results calibrated or guarantee precision continuity. Frontend accuracy and ≤100 ms update need actual measurement, averaging and timing qualification.
- Source/sink shunts 10Ω, references 1k/49.9k: approximately 9.8 mA nominal at 5 V. Conservative preliminary bound with 5.25 V, 1% resistors and ±7 mV amplifier offset is ~11.34 mA. This is not an oscillation/transient guarantee. The MCP6002 current-regulation substitution needs physical loop compensation/stability qualification; do not release based on the arithmetic alone.
- 270Ω LED resistors and BC548B drivers target >5 mA at 3.2 V, Vf≤1.5 V and VCE≤0.2 V. Measure actual current before relying on AQY212EH on-resistance/timing specifications.
- BSS84 and 2N7000 are mounted on **D/S/G numbered interfaces**. Verify adapter maps explicitly. BC548B in the drawing is C/B/E; don't silently replace it with E/B/C 2N3904. Candidate body envelopes are not purchased-body verification.
- Continuity stimulus is 3.3 V through diode/11k and default-open PhotoMOS. At ≤3.38 V and 11k−1%, ignoring diode drop, source current ≤0.311 mA. Return relay is open outside precheck. Calibrate actual diode/source and full measurement path; unknown routing resistance, ADC noise and alternative paths can make results inconclusive. Historical ≤20Ω/≥100Ω acceptance is **not qualified** by this prototype calculation or by a 1k/open test; never report a strict PASS without the required uncertainty bound.
- Timing is an acceptance target: HC123 ~200–350 ms expiry must be measured at actual 3.3 V, R/C tolerance and temperature; AQY/compensation delays and load response count toward actual pulse frequency/duty. Scope 0.5–10 Hz, 25–75% duty, ≤0.5 V low / ≥3.5 V high at up to 2 mA at the final P3 node, including external path resistance.

Existing `perfboard_stage1_test` tests OLED/joystick/UART only. New integration firmware is not included in this wiring-only delivery; legacy smart firmware has incompatible selector/UART pins. Do not enable this completion board with it.

## Sources

- Project's Notion requirements snapshot: `../../routing-next/notion-requirements-2026-10-25.json` (read-only consultation; no Notion changes).
- MCP6002: https://www.microchip.com/en-us/product/MCP6002
- CD74HC123: https://www.ti.com/lit/ds/symlink/cd74hc123.pdf
- CD74HC238: https://www.ti.com/lit/ds/symlink/cd74hc238.pdf
- AQY212EH: https://industry.panasonic.eu/pd-379914/relays/relays/photomos/photomos-ge-dip4-1-form-a/aqy212eh

MPNs for passives are reference placeholders, not a verified purchase list; values, tolerances, packages and actual supplier identities must be checked. Header identities remain unknown. No orders/publication/external edits are authorized or performed.
