# Smart circuit reconciliation

Source: `eletronics/SCH_TedTronics_2026-10-04(6).json` (SHA256 84cb84d3bba3dfe70a106c55da5c7816000a35fcab404a4feabafec407cbca82). EasyEDA symbol/pin/wire geometry is preserved in easyeda-source.json. Revision8/lower/design.json is the integrated electrical authority.

| Earlier EasyEDA function | Integrated circuit |
|---|---|
| ESP32 on J1/J2 | ESP2, final revision5/6/8 GPIO contract; physical pin labels retained |
| U1/U3 74HCT125 P3 buffers | Independent active source/sink clamps and default-off PhotoMOS isolation at all six positions |
| U4/U5 74HCT595 | Three SN74HCT595 registers with HIGH/LOW/AMMETER bits for six positions |
| Shared SCL and six SDA lines | Shared controller-side SCL_A and six separate TCA9517 buffered B-side buses |
| U6/U7 74HCT4051 before dividers | Buffered voltage inputs, two bank selectors and ADS1115 interfaces |
| U2 INA219 on one position | INA226 module interfaces, external 1-ohm Kelvin shunts and isolated current paths at every position |
| Firmware-only shutdown assumptions | Independent smart watchdog, rail-qualified register OE and default-off drivers |

All 22 NODEs remain independent. Terminal labels NODE1–NODE11 are bank-local display numbers; original NODE00–NODE21 identities remain in the electrical source. Capsule electronics are passive OLED/service interfaces; smart controllers and sensing live on the base side. Pi supply stays separate.

Construction ground-bar geometry and synthetic boundary posts are omitted as symbols; their electrical membership is retained. Existing physical diagnostic/prototype headers remain as unused final-board interfaces; no temporary USB bridge or fixed-source cable is added. Physical board boundaries are documentation, not a new PCB partition.

The legacy EasyEDA geometry extraction records 73 symbols and 308 pins. It joins wire vertices, pin anchors and matching named flags, while preserving unmarked interior crossings. This graph documents the legacy source; it is not substituted for the later protected circuit.

No historical source or hardware pin assignment is modified. The exact source-to-drawing reference and connector mappings are in reference-crosswalk.json and harnesses.json. Generated results do not establish hardware performance.
