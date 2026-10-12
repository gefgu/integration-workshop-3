# Revision8 firmware handoff

Revision5/6 GPIO mappings, safety protocol, CP00–CP36 stages and revision7 self-test commands remain the baseline. Firmware is owned by the project team. `design/engineering.mjs` contains a reference debounce state machine for contract tests; it is not deployed firmware.

## Buttons without hardware debounce capacitors

Pi GPIO5 / physical pin 29 is `ENERGIZE_N`; GPIO6 / pin 31 is `BACK_N`. Both are active-low dry contacts with external 10k pull-ups to `PI_3V3`. Read at intervals no greater than 5 ms. Accept a level only after 20 ms of continuous stability. Emit one press event on a debounced high-to-low transition. Holding a button emits no repeats; require 20 ms stable release before rearming. A button held at startup emits no press: first observe stable release, then a new press. Reset this state after reboot/reconnect. Contact bounce or a previously held button must never authorize student power.

Button events remain requests to the existing OFF → clear → configure → precheck → fresh acknowledgements → READY → explicit enable sequence. Debounce does not bypass fault, stale session, NFC approval, watchdog or routing checks.

## Changed passive interfaces and construction

- Install `J_ROUTER_POWER_CONTROL` at CP00 with ESP1. Its passive receiving pins reserve the final interface; external power remains disconnected during USB prototype work. Pin 3 (`3V3_SYS`) is deliberately unused/open until the primary cable is fitted at CP09. No IC supply or ground is exempted from continuity checks.
- The qualified power/control harness has ten straight-through conductors. The 5 V and 3.3 V consumer rails and the three safety-control paths are permanent connections; this harness alone does not qualify or energize anything. Remove temporary USB-to-system supply links before final supplies connect.
- Contact A's shared GND/3V3 header arrives at CP06, B's at CP29. Their power branches connect the first installed service contact, rather than relying on a future second position.
- NODE groups retain their original group checkpoints: A at CP00/27/28; B at CP29/30/31. Matrix receiving headers arrive at CP24 and future NODE cable groups remain disconnected until their contacts are installed.
- The power pass-gate, router-enable and heartbeat paths are permanent local wire connections. Router reset and both strobe paths are permanent local connections too. ESP1 enable still passes through the primary cable and the power-board NAND interlock.
- MCP120 replaces the power MCP130; threshold option 300 and D-bond TO92 pin order are unchanged. The discrete current trip, HC74 fault latch and independent HC123 watchdog remain.

## Acceptance still required

Test bounce bursts, <20 ms pulses, held-at-boot input, long hold, repeated presses and simultaneous buttons. Energize is always rejected outside READY. Scope simultaneous fault/reset transitions, brownouts, permanent safety-path behavior and all USB/bench-power combinations. Verify student trip >10.6mA and ≤12mA, cutoff ≤1ms, watchdog expiry 200–350ms, and no automatic restart. Generated Boolean checks cannot qualify propagation hazards or power ramps.
