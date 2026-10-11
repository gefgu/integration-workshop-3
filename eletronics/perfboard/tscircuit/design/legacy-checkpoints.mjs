export const checkpoints = [
  {
    "id": "CP00",
    "phase": 0,
    "title": "First light",
    "win": "A real kit LED lights from an ESP32-controlled, protected fake battery.",
    "boards": [
      "power",
      "matrix",
      "a1"
    ],
    "prerequisites": [],
    "firmware": "router factory cp00: watchdog, explicit rail enable and latched reset; fixed battery links only; all future GPIO outputs LOW",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp0-test1",
        "description": "Measure purchased pogo/adapter/DevKit dimensions against the final drawing before soldering. Confirm the four kit pieces fit the selected rows without body collisions.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp0-test2",
        "description": "Unpowered: every rail >1kΩ to GND after capacitor charging; no accidental node/service connection.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp0-test3",
        "description": "With links open: 5V buck 4.90–5.04V; 3.3V buck 3.20–3.38V. Current-limited 12V supply, 100mA initially.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp0-test4",
        "description": "Each column: all six contacts <1Ω; every distinct pair of bare-module nodes >10MΩ with external harness isolated by test plugs.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp0-test5",
        "description": "NODE IDC odd pins map in order; even pins NC. SMART_RAW pins 1/3/5 map directly to the first three nodes (<1Ω).",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp0-test6",
        "description": "1kΩ and 470Ω rail loads remain enabled; 330Ω or 100Ω load trips and remains latched. At 10mA: 5V_EDU 4.75–5.25V.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp0-test7",
        "description": "Sweep load: trip threshold must be >10.6mA and ≤12mA; record REF_TRIP and CURRENT_SENSE.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp0-test8",
        "description": "Scope current at a switched 100Ω load: source current cut off within 1ms, including frozen controller. Do not use UART timestamps as timing evidence.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp0-test9",
        "description": "Independent OV disconnects: sweep 5V/3V3 buck interfaces with consumers isolated; verify actual thresholds and strict contact peak ≤5.25V during a bounded 12V failed-buck step. Test both guards separately before connecting any IC.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp0-test10",
        "description": "Reset while overload persists must not release fault; power cycle, loss of heartbeat, USB unplug or held reset must leave rail off.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp0-test11",
        "description": "With power off, connect J_FIXED_BATTERY pin1 to A1 J_NODE pin3 (C2 +) and pin2 to J_NODE pin1 (C1 ground). Battery capsule: negative C1, positive C2; 1kΩ resistor C2–C3; LED A=C3/K=C4; three-gap kit jumper C4–C1.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp0-test12",
        "description": "No heartbeat/reset: student supply remains OFF. Explicit valid enable lights LED; disable extinguishes it. Reset, USB removal and frozen heartbeat return OFF without automatic restart.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Fixed battery +: C2; ground: C1. Matrix and diagnostic leads absent."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Start with LED off and show the four actual kit pieces.",
        "Enable: LED lights. Disable: LED goes out.",
        "Remove the return jumper with power off; show that no current flows."
      ],
      "negative": "Start with LED off and show the four actual kit pieces.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  },
  {
    "id": "CP01",
    "phase": 1,
    "title": "Electrical verification",
    "win": "Camera approval cannot override a failed electrical jumper test.",
    "boards": [
      "continuity-fixture"
    ],
    "prerequisites": [
      "CP00"
    ],
    "firmware": "router factory cp01: fixed-pair ADC continuity test; GPIO4 SDA,16 SCL,25 STIM; stimulus OFF at boot and before energization",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp1-test1",
        "description": "Student supply OFF and positive fixed-battery lead unplugged. TEST_A→C4, TEST_B→C1; fit JP_RETURN only during test. Check stimulus current ≤0.34mA and educational contact voltages 0–5.25V.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp1-test2",
        "description": "Calibrate open, a known short and 1kΩ. Measure open stimulus voltage Vs with DMM; infer R=10k×V/(Vs−V), accounting for divider gain and input loading. Known short ≤20Ω; ≥100Ω rejected; 20–100Ω or saturated/unstable readings inconclusive and OFF. Compare inferred short with DMM continuity <1Ω.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp1-test3",
        "description": "Test the actual four-piece scene: correct C4–C1 kit jumper passes; one lifted contact and wrong-node placements fail. Include alternate paths through LED/resistor in calibration; no false pass through a component.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp1-test4",
        "description": "Simulated camera approval + failed/inconclusive electrical result keeps student supply OFF. Correction requires a fresh electrical test and separate enable request.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp1-test5",
        "description": "Before enable: stimulus OFF, JP_RETURN removed, test leads disconnected, fixed battery lead restored with power off. No automatic enable after a passing test.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Rail OFF; fixed positive lead open; probes C4/C1; JP_RETURN fitted for test only.",
      "Before enable: stimulus OFF; JP_RETURN and probes removed; fixed positive lead restored."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Select simulated camera approval; clearly label it simulated.",
        "Show an open contact: enter measured rejection, LED remains off.",
        "Repeat with a wrong-node kit jumper.",
        "Correct it, record a fresh pass, disconnect the fixture, and request enable."
      ],
      "negative": "Show an open contact: enter measured rejection, LED remains off.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  },
  {
    "id": "CP02",
    "phase": 2,
    "title": "Capsule greeting",
    "win": "One capsule displays a pt-BR greeting, identity, and OFF/ready status.",
    "boards": [
      "smart-controller",
      "smart-channel:0",
      "a1"
    ],
    "prerequisites": [
      "CP01"
    ],
    "firmware": "smart cp02: I2C OLED greeting only, all relay bits zero",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp2-test1",
        "description": "Inspect A1 service order SCL/SDA/GND/3V3 and verify all four cable pins; no swap of P1/P3.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp2-test2",
        "description": "Only position0 is active. OLED 0x3C responds on its isolated bus; show identity and Olá / Desligado, with no fabricated sensor reading.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp2-test3",
        "description": "Power cycle and USB reconnect repeat the greeting and start OFF. Firmware heartbeat stops while configuration is invalid.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Fixed battery or documented smart-output test fixture. Diagnostic probes disconnected."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Show the installed capsule and power on.",
        "Frame its greeting and identity.",
        "Restart and show the known OFF state."
      ],
      "negative": "Restart and show the known OFF state.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  },
  {
    "id": "CP03",
    "phase": 3,
    "title": "Real voltage",
    "win": "The capsule displays actual signed voltage that agrees with a DMM.",
    "boards": [
      "smart-channel:0"
    ],
    "prerequisites": [
      "CP02"
    ],
    "firmware": "smart cp03: ADS1115 differential voltage, calibrated divider factor2, signed display ≥10Hz",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp3-test1",
        "description": "Verify ADS1115 0x48. Sweep P1/P2 within 0–5.25V; compare displayed signed difference with DMM at 0,1,2.5,5V. Error ≤0.10V+5%|reading|, impedance ≥1MΩ, update rate ≥10Hz.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp3-test2",
        "description": "Reverse sense polarity to show a negative difference; do not apply negative absolute contact voltages. P3 remains disconnected and ammeter paths open.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Fixed battery or documented smart-output test fixture. Diagnostic probes disconnected."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Display zero and the DMM reference.",
        "Change applied voltage and show matching readings.",
        "Reverse the sense connections with power off and show signed voltage."
      ],
      "negative": "Reverse the sense connections with power off and show signed voltage.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  },
  {
    "id": "CP04",
    "phase": 4,
    "title": "Pulse output",
    "win": "A kit LED visibly blinks at the configured frequency and duty cycle.",
    "boards": [
      "smart-channel:0"
    ],
    "prerequisites": [
      "CP03"
    ],
    "firmware": "smart cp04: current-limited P3 pulse, break-before-make ≥5ms, HIGH/LOW mutually exclusive",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp4-test1",
        "description": "P3 low ≤0.5V and high ≥3.5V with measured 2mA load. Short to GND and separately to 5.25V: ≤12mA; scope transient and regulator oscillation.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp4-test2",
        "description": "Pulse 0.5/1/10Hz and duty 25/50/75%: frequency ±5%; duty ±5 percentage points; measure at the physical node.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp4-test3",
        "description": "Use a separately documented LED+1kΩ output fixture on P3. Do not connect the fixed battery to P3. OFF/reset/invalid state disables both output relays.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp4-test4",
        "description": "Rail off, invalid configuration, halted heartbeat and disconnected USB: leakage ≤10µA at each P1/P2/P3 at 0V and 5.25V; ammeter path open.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Fixed battery or documented smart-output test fixture. Diagnostic probes disconnected."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Begin with LED off.",
        "Show 0.5Hz,1Hz and faster pulse settings.",
        "Change duty cycle and frame the LED plus configured values.",
        "Stop configuration heartbeat: output turns off."
      ],
      "negative": "Begin with LED off.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  },
  {
    "id": "CP05",
    "phase": 5,
    "title": "Logic gates",
    "win": "Physical input changes produce the expected truth-table output.",
    "boards": [
      "smart-channel:0"
    ],
    "prerequisites": [
      "CP04"
    ],
    "firmware": "smart cp05: AND/OR/NOT etc; ≤1V LOW, ≥3V HIGH; undefined inputs retain last state",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp5-test1",
        "description": "Test each selected gate truth table using protected input levels. Require 20ms stable input and ≤100ms output response. Confirm open inputs read LOW.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp5-test2",
        "description": "Sweep 1–3V undefined region: retain previous state. Show P3 LOW ≤0.5V / HIGH ≥3.5V with 2mA load.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Fixed battery or documented smart-output test fixture. Diagnostic probes disconnected."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Show the selected gate and its truth table.",
        "Change input kit connections with power off between arrangements.",
        "Frame inputs, capsule state and output LED for each case."
      ],
      "negative": "Change input kit connections with power off between arrangements.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  },
  {
    "id": "CP06",
    "phase": 6,
    "title": "Memory",
    "win": "The output retains a set state and reset has priority.",
    "boards": [
      "smart-channel:0"
    ],
    "prerequisites": [
      "CP05"
    ],
    "firmware": "smart cp06: SR latch; reset wins; initial and rail-off state zero",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp6-test1",
        "description": "Set output, remove the set input and verify retained state. Reset clears it. Simultaneous set/reset resolves to zero.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp6-test2",
        "description": "Restart, rail OFF or configuration loss clears memory and leaves output disabled.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Fixed battery or documented smart-output test fixture. Diagnostic probes disconnected."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Set the LED on.",
        "Remove set input: LED remains on.",
        "Reset: LED goes off.",
        "Show reset priority and restart state."
      ],
      "negative": "Reset: LED goes off.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  },
  {
    "id": "CP07",
    "phase": 7,
    "title": "Series current",
    "win": "Changing a real resistor changes the measured LED-loop current.",
    "boards": [
      "smart-channel:0"
    ],
    "prerequisites": [
      "CP06"
    ],
    "firmware": "smart cp07: INA219 series mode; only AMMETER relays close; signed calibration",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp7-test1",
        "description": "Current mode ±0/1/5/10mA: error ≤0.20mA+5%|reading|, ≥10 updates/s; voltage modes must leave ammeter switches open.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp7-test2",
        "description": "INA219 0x40 responds. Use a documented series test arrangement and removable leads; do not assume four-column capsule geometry supports every series arrangement.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp7-test3",
        "description": "OFF, voltage or output mode opens both ammeter terminals. Verify leakage ≤10µA with test stimulus disconnected.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Fixed battery or documented smart-output test fixture. Diagnostic probes disconnected."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Show the series wiring before power.",
        "Compare capsule current with DMM.",
        "Change resistance with power off and compare again.",
        "Leave current mode and show its open circuit."
      ],
      "negative": "Change resistance with power off and compare again.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  },
  {
    "id": "CP08",
    "phase": 8,
    "title": "Programmable routing",
    "win": "The same kit circuit works with its battery assigned to another node pair.",
    "boards": [
      "matrix",
      "a1"
    ],
    "prerequisites": [
      "CP07"
    ],
    "firmware": "router cp08: final matrix clear/route/precheck/enable; fixed battery harness unplugged",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp8-test1",
        "description": "MT supply 10.0–12.6V, digital high ≥3.3V, low ≤0.8V; reset and CS active high.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp8-test2",
        "description": "Sweep all X addresses and Y buses, proving the non-monotonic X address map. Banks share BUS2…BUS7.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp8-test3",
        "description": "Boot/reset/watchdog expiry: all crosspoints open. Disable rail, clear, configure, precheck, then enable; never configure live.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp8-test4",
        "description": "Scope full clear + 22-node configuration ≤50ms at the physical strobe pins; verify Ron at 0/2.5/5V.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp8-test5",
        "description": "Calibrate with 1kΩ 0.1%; distinguish open, short, 220Ω, 1kΩ and diode polarity; resistance error ≤10% after calibration.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp8-test6",
        "description": "Discharge 1000µF initially at 5V to <0.1V in 3s; keep total analog pin current ≤12mA.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp8-test7",
        "description": "Any short, unknown/invalid configuration or stale routing generation prevents rail enable; the precheck itself leaves rail off.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp8-test8",
        "description": "With all power off remove only the fixed battery patch leads; retain every soldered wire. Connect A1 NODE ribbon. In matrix mode no fixed source or fixture stimulus may remain connected.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp8-test9",
        "description": "Show a valid second battery position and corresponding kit arrangement. Invalid topology or stale routing generation cannot enable power.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Fixed battery patch harness removed. Matrix selects sources and nodes."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Show fixed harness removed and the matrix connection installed.",
        "Run the original loop through programmable routing.",
        "Move the battery assignment and kit arrangement.",
        "Show rejection of an invalid configuration."
      ],
      "negative": "Show rejection of an invalid configuration.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  },
  {
    "id": "CP09",
    "phase": 9,
    "title": "Complete bank A",
    "win": "Three interchangeable smart positions work concurrently on bank A.",
    "boards": [
      "a2",
      "a3",
      "smart-channel:1",
      "smart-channel:2"
    ],
    "prerequisites": [
      "CP08"
    ],
    "firmware": "router/smart cp09: bank A; three active positions; independent SDA buses",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp9-test1",
        "description": "Repeat CP01 electrical mapping for A2/A3; test NODE00–NODE10 and positions 0/1/2.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp9-test2",
        "description": "Three active capsules meet meter update rates and output timing concurrently; fourth active request refused.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp9-test3",
        "description": "Repeat screen, voltage, pulse, gate, memory, current and leakage tests independently on each new card. Three active capsules meet all update/timing limits.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Fixed battery patch harness removed. Matrix selects sources and nodes."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Show all three bank-A positions.",
        "Move a capsule between positions with power off.",
        "Show three simultaneous readings or modes."
      ],
      "negative": "Move a capsule between positions with power off.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  },
  {
    "id": "CP10",
    "phase": 10,
    "title": "Complete bank B",
    "win": "A capsule works in either bank without being rotated.",
    "boards": [
      "b1",
      "b2",
      "b3",
      "smart-channel:3",
      "smart-channel:4",
      "smart-channel:5"
    ],
    "prerequisites": [
      "CP09"
    ],
    "firmware": "router/smart cp10: all22 nodes, six positions, max3 active",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp10-test1",
        "description": "Repeat module mapping for B1/B2/B3; verify mirrored service order without renumbering holes.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp10-test2",
        "description": "Test NODE00–NODE21 and all six smart positions, any combination of three active; no unintended bank-to-bank connection.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp10-test3",
        "description": "Moving a capsule drops rail before configuration; position identity is independent of capsule identity.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp10-test4",
        "description": "Repeat every smart mode and electrical acceptance on the three new cards. Bank-B rows reflect but P1/P3 and service electrical order remain unchanged.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Fixed battery patch harness removed. Matrix selects sources and nodes."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Frame both banks.",
        "Move the same capsule to bank B without rotation.",
        "Show correct identity/configuration and real reading.",
        "Attempt a fourth active position: rejected."
      ],
      "negative": "Attempt a fourth active position: rejected.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  },
  {
    "id": "CP11",
    "phase": 11,
    "title": "Pi control",
    "win": "An explicit Pi request energizes only a verified ready circuit.",
    "boards": [
      "integration"
    ],
    "prerequisites": [
      "CP10"
    ],
    "firmware": "Pi cp11: manual session approval and Energizar/Back requests; no NFC authorization yet",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp11-test1",
        "description": "Pi separately powered: its 5V must not connect to bench 5V. Test all four USB/bench-power combinations for backfeeding.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp11-test2",
        "description": "Verify physical Pi pin mapping and button debounce. Readiness alone does not energize; explicit request is required. Back/reset/restart returns OFF.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp11-test3",
        "description": "Factory Pi demonstration uses explicit supervised approval; production mode remains blocked until NFC/full integration acceptance.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Fixed battery patch harness removed. Matrix selects sources and nodes."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Show ready but not energized.",
        "Press Energizar: valid circuit lights.",
        "Press Back: supply turns off.",
        "Request enable with missing prerequisites: rejected."
      ],
      "negative": "Press Back: supply turns off.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  },
  {
    "id": "CP12",
    "phase": 12,
    "title": "NFC approval",
    "win": "Known identity permits approval; unknown or absent tags do not.",
    "boards": [
      "integration"
    ],
    "prerequisites": [
      "CP11"
    ],
    "firmware": "Pi cp12: PN532 mode0 LSB-first ≤1MHz initial SPI; identity alone never energizes",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp12-test1",
        "description": "PN532 SPI mode 0, LSB-first, ≤1MHz initial clock: known/unknown/absent tag correctly reported; NFC failure leaves session unapproved.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp12-test2",
        "description": "Known tag allows the subsequent readiness checks; unknown/absent/error clears approval. Explicit Energizar is still required after a successful tag.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Fixed battery patch harness removed. Matrix selects sources and nodes."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Present an unknown tag: no approval.",
        "Present a known tag: approval visible, LED still off.",
        "Request energization after all checks.",
        "Remove/change identity and show invalidation."
      ],
      "negative": "Present a known tag: approval visible, LED still off.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  },
  {
    "id": "CP13",
    "phase": 13,
    "title": "Complete integration",
    "win": "Faults shut down the finished bench and recovery never auto-energizes.",
    "boards": [
      "power",
      "matrix",
      "smart-controller",
      "integration"
    ],
    "prerequisites": [
      "CP12"
    ],
    "firmware": "cp13 production: complete generation/ack/session/interlock protocol; no factory bypass",
    "firmwareImplemented": false,
    "tests": [
      {
        "id": "cp13-test1",
        "description": "Graph, recognition, predicted current, routing and all active capsule acknowledgements must pass before enable.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp13-test2",
        "description": "USB unplug/reset or missed heartbeat disables rail and smart outputs within 1s; every restart begins OFF.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp13-test3",
        "description": "30-minute repeated lessons with no reset, incorrect route or false trip. Series-circuit tests use explicitly documented removable leads where geometry requires them.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp13-test4",
        "description": "Repeat hardware cutoff ≤1ms, strict transient contact peaks ≤5.25V, 30-minute operation, no backfeed, leakage ≤10µA and every six-position mode. Record oscilloscope readings as text; screenshots remain external.",
        "source": "manual",
        "required": true
      },
      {
        "id": "cp13-test5",
        "description": "Verify enclosure inaccessibility, cable strain relief and all purchased-part fit gates. Production release remains pending until actual evidence is recorded.",
        "source": "manual",
        "required": true
      }
    ],
    "links": [
      "Fixed battery patch harness removed. Matrix selects sources and nodes."
    ],
    "filming": {
      "initialState": "Student supply OFF; inspect link positions; show checkpoint and firmware revision. Hardware fit/bench results remain pending until measured.",
      "shots": [
        "Run a valid lesson circuit.",
        "Disconnect communication: output shuts down.",
        "Show a hardware fault and latched OFF state.",
        "Restore communication/reset: stays OFF until a fresh complete approval and request."
      ],
      "negative": "Show a hardware fault and latched OFF state.",
      "record": "Record measured readings, equipment, fixture/link states, firmware revision, and pass/fail. Filming requires the specified firmware, which this implementation does not deliver."
    }
  }
];
