# Requirements traceability

Read-only snapshot of the Electronic category in [the project requirements](https://app.notion.com/p/3df9670c116e800b86b0e3d4444e7c9f), fetched 2026-10-10. Exact source text and per-row links are retained in `design/requirements.json`. No Notion requirement or status was changed.

Every physical acceptance test remains pending. “Design/contract” below does not mean measured compliance.

| ID | Design / contract | Checkpoint | Coverage / deviation |
|---|---|---|---|
| [EFR1](https://app.notion.com/3df9670c116e80d4999cf3c73b667a89) | matrix | CP24–26 | Two MT8816 DIP40 arrays; user-selected IC deviation. |
| [EFR10](https://app.notion.com/3df9670c116e802e9f05cafadab84ed9) | power | CP09–14 | 1N5822 input diode; input fuse and main switch. |
| [EFR11](https://app.notion.com/3df9670c116e80569ee7fc4d7a4cad6f) | power + battery capsule | CP00, CP09–14, CP36 | Battery represents internal rail; no GPIO-powered educational battery. Actual rail indicator added. |
| [EFR12](https://app.notion.com/3df9670c116e80769fc8cb036e29fb8b) | excluded | — | Optional configurable resistor excluded by user. |
| [EFR13](https://app.notion.com/3df9670c116e80cda8ade4ca867ffdbd) | real passive capsules | CP01–03, CP25–26, CP36 | Switch contacts are physical dry contacts; route and test continuity. |
| [EFR14](https://app.notion.com/3df9670c116e809694efdd804c112d4c) | real passive capsules + tools | CP25–26, CP36 | Actual capacitors and controlled discharge; no simulated charge behavior. |
| [EFR16](https://app.notion.com/3df9670c116e8041a4e4f36e54546b39) | modules + smart channels + capsule service | CP04–08, CP15, CP27–31 | P1/P2/P3 separate from 4-wire OLED service; six remote frontends. |
| [EFR17](https://app.notion.com/3df9670c116e80078a1cf3d0e19f3536) | integration | CP34–36 | Included optional PN532 SPI carrier and session contract. |
| [EFR18](https://app.notion.com/3e09670c116e81d8b6e8f0e006140028) | firmware contract + hardware enable | CP01–03, CP24–26, CP32–36 | All validation and current-generation acknowledgements required; negative tests specified. |
| [EFR19](https://app.notion.com/3e19670c116e81b6a812f5b74add6d8d) | power | CP09–14 | Measure 5V_EDU before matrix at a 10-mA load; switch drops are separately calibrated. |
| [EFR21](https://app.notion.com/3e19670c116e81f6aaebf62b327afb74) | accepted deviation | CP24–26 | MT8816 substitutes for CH446Q; requirement text retained unchanged. |
| [EFR22](https://app.notion.com/3e19670c116e819eaac1c0d9342c5922) | matrix + accepted deviation | CP24–26 | HCT595 serial address/data latch plus parallel MT strobe; physical ≤50-ms acceptance. |
| [EFR23](https://app.notion.com/3e19670c116e813ea1f5eb98d9d4fa03) | power | CP09–14 | MF-R050 backup PTC; comparator/latch remains primary. |
| [EFR24](https://app.notion.com/3e19670c116e8166b0d9e630378c6be7) | power + accepted deviation | CP09, CP32, CP36 | 12-V/2-A barrel supply for bench; Pi has its own supply. |
| [EFR25](https://app.notion.com/3e19670c116e81eaaa4ad40332c046d3) | external buck modules | CP09–14 | Pololu fixed 5-V/3.3-V modules on standoffs, labelled pigtails. |
| [EFR27](https://app.notion.com/3e49670c116e80e18d99d898b0c0260c) | all ground nets | CP00, CP09–14, CP27–31 | Service and educational ground share a common reference. |
| [EFR28](https://app.notion.com/3e89670c116e80118a99d3a250137cc5) | smart channel + watchdog | CP06–08, CP13, CP15, CP22–23, CP36 | High impedance dividers and PhotoMOS isolation. ≤10-µA static estimate; bench proof pending. |
| [EFR29](https://app.notion.com/3e89670c116e81c8817cf1d5ba2853c9) | smart controller + six TCA9517 buffers | CP06, CP15, CP27–31 | Six independent SDA buses; buffer B sides isolated. |
| [EFR3](https://app.notion.com/3df9670c116e80319ce2ea8c5b76ecbc) | matrix | CP24–26 | Six shared internal Y buses; per-pin summed current bound. |
| [EFR30](https://app.notion.com/3e89670c116e81cc8f85fca00516f167) | smart channel | CP15–17 | OPA2333 feedback source/sink regulators; ≤12-mA static corner. Transients and stability pending. |
| [EFR31](https://app.notion.com/3df9670c116e804b85a6fa50e8e7f494) | three external capsules | CP04–05, CP27–31 | Exactly three interchangeable OLED capsules, up to three active of six positions. |
| [EFR31.1](https://app.notion.com/3e89670c116e8106b828ceef6ada1ad9) | firmware contract | CP04–08, CP16–23 | pt-BR names/live values; firmware and display testing pending. |
| [EFR31.2](https://app.notion.com/3e89670c116e819e8ee6d8825f5fc3ba) | accepted deviation | CP29–31 | Six positions across both banks instead of three fixed bank-A positions. |
| [EFR31.3](https://app.notion.com/3e89670c116e81a4af9ac138b26a1a6b) | firmware contract + independent service buses | CP29–31 | Identity by position; test every capsule in each position. |
| [EFR31.4](https://app.notion.com/3e89670c116e81e2a0dcf254f616a4a8) | firmware contract | CP29–31 | Every position supports all modes; moving changes assigned behavior. |
| [EFR31.5](https://app.notion.com/3e89670c116e8158a762c45a50c663b9) | firmware contract | CP29–31 | Detect/configure/display within 1 s. |
| [EFR31.6](https://app.notion.com/3e89670c116e81bf8ee0f495603277ec) | firmware contract + protected rail | CP29–31 | Capsule movement invalidates READY and drops power before reconfiguration. |
| [EFR32](https://app.notion.com/3e89670c116e81969b40f0207aff05c9) | smart channel | CP15, CP24–26 | Physical node high/low measured with 2-mA load, including matrix path drops. |
| [EFR32.1](https://app.notion.com/3df9670c116e802e806bff8a94b6262e) | ADC frontend + firmware contract | CP18–20 | 1/3-V hysteresis, pulldown, 20-ms stability, 100-ms gates; optional included. |
| [EFR32.2](https://app.notion.com/3e59670c116e8121b480e06dc6383eae) | P3 frontend + firmware contract | CP16–17 | 0.5–10-Hz pulse, 25–75% duty, measured tolerances. |
| [EFR32.3](https://app.notion.com/3e59670c116e81999695fe37067892c0) | OPA2333 + ADS1115 | CP06–08 | Buffered 1M/1M dividers, signed differential; calibration/update/error tests. |
| [EFR32.4](https://app.notion.com/3e89670c116e8144a329d8e01bea4b16) | INA219 + 10Ω + two PhotoMOS | CP22/23 | Bidirectional isolated series ammeter; optional included. |
| [EFR32.5](https://app.notion.com/3e89670c116e810eb146fae72a63c48e) | P3 frontend + firmware contract | CP21 | SR memory reset priority and rail-off reset; optional included. |
| [EFR4](https://app.notion.com/3df9670c116e80c5a7fcc11d7179d9b7) | matrix + firmware contract | CP24–26 | Power off, master reset/clear, then configure. |
| [EFR5](https://app.notion.com/3df9670c116e8083bbd5daa374a53b76) | firmware contract | CP24–26, CP32–36 | Validated generation-bound netlist; firmware implementation pending. |
| [EFR6](https://app.notion.com/3df9670c116e8086bc33cf17750d5919) | matrix | CP13, CP24–26 | MT-VDD reset pull-up and two series release/watchdog MOSFETs; no 5-V startup dependency. |
| [EFR7](https://app.notion.com/3df9670c116e80b0a7bae34dc4f32c4a) | power + firmware contract | CP00–03, CP11–14, CP24–26, CP32–36 | Explicit enable after routing/precheck/acknowledgements. |
| [EFR9](https://app.notion.com/3df9670c116e80b1a8d8f29a7c2f352f) | power | CP12–14, CP36 | INA180 + LM393 + asynchronous fault latch + MOSFET. Independent ≤1-ms cutoff needs scope proof. |
| [ENFR1](https://app.notion.com/3df9670c116e80408195c7b38e9a4b97) | mechanical enclosure integration | CP36 | 12-V/internal power and rear electronics inaccessible; enclosure inspection pending. |
| [ENFR2](https://app.notion.com/3df9670c116e8026b8c4e986e1304e61) | power voltage guards + bounded fault fixtures | CP10–15, CP36 | Strict contact peak 0–5.25 V requires measured failed-buck, reset and output-short tests. Not yet proven. |
| [ENFR4](https://app.notion.com/3df9670c116e80c5841eec233ab0c2d3) | supply guards + power-domain interfaces | CP09–14, CP36 | Verify each rail and all USB/bench-power combinations against selected parts. |
| [ENFR6](https://app.notion.com/3df9670c116e803ab2c2eaf2024be7ce) | matrix + current-model contract + accepted deviation | CP15, CP24–26, CP36 | Use MT analog-pin limit, shared Y sums, conservative 80-mA aggregate. Active-clamp model replaces resistor-only P3 model. |
| [ENFR8](https://app.notion.com/3df9670c116e80f39cabec3404896f9a) | power latch + reset + watchdog | CP11–14, CP32–36 | OFF startup, reset and communication loss; measured acceptance pending. |

New-build checkpoints follow the guided CP00–CP36 sequence. USB-only CP00–08 are explicitly supervised prototype demonstrations using a bounded test source; final regulated power and protection requirements remain gated in CP09–14 and complete integration. Legacy project catalogs retain their original checkpoint identifiers.
