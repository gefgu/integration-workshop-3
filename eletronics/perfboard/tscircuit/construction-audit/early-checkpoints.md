# CP00–CP08 construction proposal — only 7×10 cm stock

## Before soldering

This guide is a **review proposal**. The layout assumes a 26×38 hole grid; stock geometry and purchased parts are pending. Use the [interactive drawings](index.html) and [endpoint tables](endpoints.csv) for review, not as released soldering paths. Only the existing electrical model is preserved; new physical placements need a new circuit/catalog revision and validation before assembly.

| Stock board | Permanent contents | First checkpoint | Future allowance |
|---|---|---|---|
| contacts-a1 | Four six-contact columns, service contacts, node and smart headers | CP00 nodes; CP04 service | Same board retained for the final A1 position |
| esp1-carrier-1 | ESP1, USB-prototype and continuity interfaces | CP00 | Capacity study retains these placements and adds controller parts; final digital partition not released |
| continuity-1 | Bounded stimulus, buffered two-input voltage sense and ADC | CP01 | Isolated diagnostic fixture; evaluate eventual reuse before duplication |
| voltage-1 | First smart position's bus interface and voltage input | CP06 | Capacity study retains these placements when output/current hardware is added |

USB source uses the existing temporary 400-tie breadboard drawing. Identify its actual row ties and rail breaks. OLED and the top-side fake battery/resistor/LED/jumper are separate mounted kit pieces, not extra perfboard sizes. No protected power board or matrix IC is needed for CP00.

## Fixed placement and construction grouping

TOP coordinates stay identical in the mirrored underside. On the reference A1 template:

| Component | TOP column | TOP rows | Purpose |
|---|---:|---|---|
| NODE00 / C1 | 4 | 9,13,17,21,25,29 | Return node; all six contacts connected |
| NODE01 / C2 | 11 | 9,13,17,21,25,29 | Positive source node for early fixed loop |
| NODE02 / C3 | 18 | 9,13,17,21,25,29 | Junction between the real resistor and LED |
| NODE03 / C4 | 25 | 9,13,17,21,25,29 | LED cathode and inspected return jumper |
| Service SCL/SDA/GND/3V3 | 10,11,12,13 | 3 | Separate service signals; never strap together |

Each node column is one placement group, followed by an inspection group and five individual bare underside straps between adjacent contacts. Future header placement is reserved from the beginning: J_NODE starts at (4,33), J_SMART at (18,33); proposed mounting holes are (2,6) and (25,6). Node ribbon odd pins 1/3/5/7 remain C1/C2/C3/C4. Connector bodies and mount clearances require measured release.

For every non-contact part, the interactive review lists its function, manufacturer pin identity, adapter requirement and candidate TOP holes. Placement is followed by pin-number/polarity inspection. Connect one wire at a time, then test continuity and nearby-net isolation. Wire views highlight endpoints individually to avoid an unreadable full-board tangle. Actual insulated paths, distribution points and strain relief are not yet released.

## Checkpoint sequence and clear wins

| CP | Construction / preparation | Link state | Visible win | Required negative demonstration |
|---|---|---|---|---|
| 00 | Identify DevKit; construct four columns; inspect source fixture; place real 1kΩ resistor, LED and jumper on top | USB bounded source only: C2 positive, C1 ground; matrix/final power absent | Explicit ESP32 enable lights LED; disable/reset makes it dark | Reset and disable keep LED OFF |
| 01 | Install continuity fixture in interface, stimulus and sense groups; inspect each group; calibrate known short/open/1kΩ | Positive source unplugged; TEST_A=C4, TEST_B=C1; JP_RETURN fitted only for testing | Lifted return jumper is electronically rejected | Convincing visual placement never overrides failed continuity |
| 02 | No new permanent hardware; move the removable jumper to the specified wrong node | Same isolated diagnostic setup | Wrong-node connection is rejected | Resistor/LED alternate paths must not appear as a valid jumper |
| 03 | Correct jumper; take a fresh reading; separately prepare enable | Before enable: stimulus OFF, probes/JP_RETURN removed; restore bounded positive with source OFF | Fresh pass followed by explicit enable lights LED | Correction alone and a stale pass cannot energize |
| 04 | Place one OLED capsule and required service contacts; identify actual display carrier | Remove diagnostic fixture from service bus; temporary 3.3 V leads; GPIO4 SDA/GPIO16 SCL; educational source OFF | Real pt-BR greeting on OLED | Reset or reconnect cannot automatically energize |
| 05 | No new permanent electronics; friends add identity/status firmware | Same OLED setup | A1 identity and actual Desligado/Pronto state appear | Removal/configuration change invalidates authorization |
| 06 | Install first smart interface and voltage divider/buffer/ADC groups; inspect; calibrate | Remove continuity fixture and direct OLED leads; use TCA9517 A side; temporary isolated 3.3 V links; P3/ammeter absent | Calibrated voltage agrees with a DMM | Out-of-tolerance calibration is rejected |
| 07 | No new permanent hardware; connect the inspected bounded LED loop and measurement leads | Same voltage setup; one educational source only | Changing a real load changes the real reading | Removed source produces near-zero reading, not a cached value |
| 08 | No new permanent hardware; swap only measurement leads while power is OFF | P1/P2 absolute voltages stay within 0–5.25 V | Signed differential reading reverses | Never apply negative absolute voltage to obtain a negative reading |

## Electrical acceptance and firmware handoff

The authoritative unchanged thresholds remain in [firmware-contract.md](../firmware-contract.md) and [checkpoints.json](../assembly/checkpoints.json). The review embeds their complete test descriptions for CP00–CP08. Firmware implementation is owned by the user's friends.

- **CP00:** each column <1Ω; isolated different columns >10MΩ where equipment can substantiate it. USB source ≤5.25 V; 3.3 V supply 3.20–3.38 V. Source resistor 560Ω ±1%, ≥0.25 W. Isolated source short current ≤9.5 mA. GPIO32 LOW/default/reset=OFF. The source is intentionally unregulated; no GPIO supplies student power.
- **CP01–03:** GPIO4 SDA, GPIO16 SCL, GPIO25 stimulus; ADS1115 0x48. Limited stimulus <0.34 mA. ≤20Ω pass, ≥100Ω reject; 20–100Ω, unstable or saturated = inconclusive. Record calibration, actual stimulus and inferred resistance. Both fail and inconclusive retain OFF. Link change expires prior results. Removal of diagnostic links precedes a separate enable request.
- **CP04–05:** OLED 0x3C, 3.3 V logic; one effective pull-up set. Actual display and hardware state must agree; simulated camera status is demonstration input only.
- **CP06–08:** remove the first fixture's 0x48 device before connecting the smart ADC. TCA9517 A side: J_CONTROL7 SDA,9 SCL,8 USB3V3,6 temporary3V3_SYS,4 GND. OLED and ADC are local B-side devices. Use buffered 1M/1M dividers, differential AIN0−AIN1, ±4.096 V ADC range; multiply calibrated difference by two. Update ≥10 Hz; voltage error ≤0.10 V + 5% absolute reading; physical input ≥1MΩ. Do not substitute an unbuffered carrier for the high-impedance frontend.

For each film: show the setup with source OFF, checkpoint/firmware revision and removable links; demonstrate the win; show the negative case; capture the actual instrument reading and outcome. Record supply, equipment, board revision, fixture, links, units and timestamps. Failed measurements block the stage. Construction completion is not electrical acceptance.

## Transitions that must preserve earlier permanent work

- CP01–03 use only removable probes/source leads to change modes; do not desolder the LED setup.
- CP04 direct OLED leads are temporary. CP06 removes those leads and the conflicting continuity ADC from the bus before connecting the buffered service interface.
- CP09–14 qualify final power separately. Before connecting final rails, remove the USB educational positive and temporary 3.3 V bridges. Never parallel sources.
- CP15 migrates service to ESP2 and installs qualified output groups; earlier voltage components stay fixed. Initial LED/fixed battery leads are removed only as temporary kit arrangements.
- CP24 removes fixed educational-source patch leads before matrix routing. Permanent contacts and wiring stay fixed.

The capacity study reserves space by preserving early pin coordinates, but functional locality and future harness access still need design work. Do not use its 28-board allocation as the final construction plan.
