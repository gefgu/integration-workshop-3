# Inventory and purchasing — revision 5

Reviewed 2026-10-11. Deliver to Curitiba-PR; no CEP, checkout stock or delivery estimate has been confirmed. This is a parts-discovery list, not an order or a claim of availability. Exact quantities and references are generated in [bom.csv](bom.csv); the temporary CP00 fixture and top-side kit pieces are additional.

## Reuse the ordered inventory

| Item | Use / condition |
|---|---|
| Two received ESP32-S38 boards | Router and smart controller; confirm actual classic ESP32 pinout and dimensions. Both are used, so the second is no longer a spare. |
| Pi3B, webcam, speakers, LCD | Separate Pi supply; identify LCD interface and its power requirement before final integration. |
| 12V2A adapter | Bench input, nominal 24W; measure total load and regulator losses. |
| 5V2A adapter | Candidate separate Pi supply; test Pi with camera/display/audio load. |
| LM2596 and XL4015 | Planned 5V and 3.3V modules respectively; XL4015 ceases to be a spare. Identify its variant and qualify stability/thermal behavior at 3.3V. |
| Five OLEDs | Enough for at most three simultaneously active capsules, plus two spares; not six populated capsules. Verify address/pull-ups and envelope. |
| RC522 and MIFARE1K tags | Reused, replacing the legacy PN532 interface. |
| 150 pogo pins | 156 bench contacts required, hence at least six additional compatible pins before spares. Identify the exact ordered variant. |
| MF-R050, LM393, input fuse/holder | Reuse after checking package and actual ratings. |
| Passives kit | Inventory values/tolerances; the design requires more than the three listed 100nF capacitors. |
| SS34 SMD parts | Remain available; the current hand-build model selects through-hole 1N5822 instead. Do not interchange footprints silently. |
| CH446Q×5, TPS25200, CD4013 | Not used in this revision. MT8816 DIP routing, discrete low-current protection and HC74 latch have different wiring. |
| Ordered 1µF capacitors | Listing/type uncertain; do not assume they meet the 5% film watchdog timing selection. |
| Two fans, light strip, joystick, buttons | Retained. Strip current, fan startup and joystick body/pinout need measurement. |

## First demonstration shopping priority

CP00: actual 7×10cm stock, compatible contacts, sockets/headers, insulated wire, solderless fixture, NDP6020P, 2N7000, 560Ω±1%≥0.25W, 10kΩ, 100kΩ, 100nF; top-side fake battery, 1kΩ resistor, LED and jumper. Confirm equivalent transistors electrically and update their measured lead order before substitution.

CP01–08: one precision OPA2333 adapter, one CD4052 DIP, one ADS1115 carrier, measured 1MΩ input dividers, 5.62kΩ/1kΩ local-bias resistors and decoupling, 11kΩ±1% stimulus, associated capacitors/BAT85/pull-ups, one AQY212EH and 2N7000 stimulus switch with 270Ω±1% LED resistor, removable test leads, one TCA9517 adapter for CP06, service contacts and one ordered OLED. These stages use the eventual permanent bank-A precision scanner; the matrix, final power board and INA226 are not required for the early LED/continuity/voltage demonstration.

## Additional full-system parts and supplier evidence

| Selection / quantity | Purchasing path / limitation |
|---|---|
| 7×10cm double-sided isolated-pad boards ×27 | Three ten-board kits give 30, with three stock spares. User-selected stock; actual 26×38 grid remains an assumption. |
| ADS1115 carrier ×2 | [Mercado Livre listing](https://www.mercadolivre.com.br/modulo-conversor-analogico-digital-ads1115/p/MLB2038776439) is a discovery lead; current direct availability was not retrieved. [Eletrogate](https://www.eletrogate.com/modulo-conversor-analogico-digital-adc-ads1115) showed unavailable in this review. Verify module pin labels, dimensions and genuine converter before using. |
| INA226 carrier ×6 + 1Ω±1% external shunt ×6 | Search Mercado Livre for domestic-stock INA226; an observed 2-piece import listing does not establish timely delivery. Carrier shunt removal and VBUS routing are mandatory checks. Do not buy an INA219 as a drop-in substitution. |
| MCP6002-I/P DIP8 ×6 | Domestic DIP sourcing remains unconfirmed. Observed Mercado Livre SOP8/import listings would restore adapters and are not the selected package. |
| MCP6004-I/P DIP14 ×2 | [FindComp exact-package listing](https://www.findcomp.com.br/circuito-integrado-mcp6004-ip-dip-14) exists but explicitly showed unavailable. Do not interpret the page’s generic availability description as stock. |
| ULN2003A DIP16 ×4 | Mercado Livre domestic kits are a suitable search path; verify A-family DIP package, not a motor board or SMD package. Exact vendor/stock not selected. |
| MT8816AE1 DIP40 ×2 | Mercado Livre discovery results exist; exact authenticated DIP40 listing/stock pending. Socket these. Do not replace with the purchased CH446Q without a separate pin/control revision. |
| OPA2333 SOIC8 ×3 | Precision adapter selection; domestic availability unconfirmed. General MCP6002/LM358 substitutions do not meet the CP01 diagnostic error budget without reanalysis. |
| AQY212EH DIP4 ×26 | Independent isolation switches; domestic source unconfirmed. Alternative relay/module needs leakage, resistance, drive and turn-off analysis. |
| TCA9517 ×6; LTC4365 ×2; INA180 ×1; LVC125 ×1 | Remaining adapter/protection procurement risks. [LTC4365 distributor listing](https://www.digikey.com.br/pt/products/detail/analog-devices-inc/LTC4365ITS8-TRPBF/2405925) is an international distributor path, not proof of Brazilian local stock or arrival. |
| Socketed HC/HCT logic and reset supervisors | See BOM for exact family and count. HCT/HC/LVC families are not interchangeable at all interfaces. |
| 341 edge distribution posts, harnesses, sockets, adapters, 24AWG wire | Provisional physical interfaces. Prefer locally stocked pin strips/crimped harnesses after measured clearance/strain-relief review. MPNs in drawings are hidden until bought parts are identified. |

## Qualification before duplication

Buy/identify enough for one precision voltage channel and one complete source/sink/current position first. Measure clamp stability, PhotoMOS timing/leakage, INA226 modified-carrier behavior and ADC scheduling. Duplicate across positions only after that cell passes. A different readily available component may reduce cost or adapters, but its pinout, error and partial-power behavior must be rechecked in the model.

The complete system is not yet a domestic-stock-only purchasing solution. Precision op-amps, PhotoMOS switches, bus isolators and voltage guards remain the main sourcing risks. This is also why the early demo avoids final power and matrix dependencies. It still requires the precision OPA2333 and stimulus PhotoMOS for CP01, and a bus isolator for CP06; these are purchasing gates, not optional parts.
