# Fritzing files

## Naming
One sketch per checkpoint, named after the checkpoint file:

```
cp01-module-a1.fzz
cp02-power-board.fzz
cp03-smart-board-voltmeter.fzz
…
```

## Workflow per checkpoint
1. **Copy** the previous checkpoint's `.fzz` to the new name (CP01 starts empty).
   Never edit an older checkpoint file; it documents what was built.
2. **Add only the new parts.** Parts that already exist stay where they are. If the new
   checkpoint seems to need a change to an existing board, stop: that would break the
   no-rework rule, so fix the plan first.
3. In the **breadboard view**, use the *Perfboard* part from the Core parts bin and resize
   it in the Inspector to the board's hole count (see each checkpoint).
4. Place the parts, draw the wires, set the **wire colours** from `00-standards.md`, and
   label the nets with the PCBv2 names (`NODE00`, `SDA_0`, …).
5. **Check for stacked duplicates.** Fritzing sometimes drops a copy of a part on top of
   another, and wires then attach to the hidden copy. Drag each part aside once and check.
6. **Export the netlist:** File → Export → XML Netlist. Save it next to the sketch as
   `cpNN-*.xml`.
7. Ask Claude to **diff the XML netlist** against the checkpoint's wiring table. It reports
   unconnected pins, shorts between nets, ICs missing power or ground, floating enable
   pins, ESP32 strapping-pin use, and mismatches with the PCBv2 netlist.
8. Solder only after the diff is clean.

## Custom parts (made once, in CP00)
Fritzing's library covers DIP logic chips and generic headers. Make these in the Parts
Editor by adapting a generic part (change the pin count and the pin labels):

| Part | Start from | Notes |
|---|---|---|
| MT8816AE | Generic IC, DIP-40 | Label all 40 pins from the datasheet |
| Pogo pin | Generic 1-pin male header | Label it `POGO` so the BOM counts them |
| IDC 2×5 box header | Generic 2×5 male header | Mark pin 1 and the key side in the label |
| ESP32 DevKitC 38-pin | Library part if it matches, otherwise 2 × 19 female headers | Check the pin order against your board |
| Discrete eFuse daughterboard | Generic header strip | One part with its interface pins only, so the power board sketch stays simple |

**Check every library part's pin labels against the datasheet.** Neither Fritzing nor
Claude can tell if a library part has wrong labels.

## What Claude can and can't check
- **Can:** connectivity in the exported netlist, against the checkpoint tables and the PCBv2 netlist.
- **Can't:** whether a wire went into the right hole on the real board, or wrong pin labels in a part.
  The continuity tests in each checkpoint cover the physical side.
