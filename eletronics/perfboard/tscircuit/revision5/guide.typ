#let d = json("data.json")
#let checks = json("checks.json")
#set page(paper: "a4", flipped: true, margin: 10mm,
  footer: context text(size: 7pt, fill: rgb("667788"))[Tedtronics · #d.revision · Engineering prototype · #counter(page).display()])
#set text(font: "DejaVu Sans", size: 9pt, fill: rgb("243746"))
#set par(leading: .55em, spacing: .65em)
#let title(t, sub: none) = {
  text(size: 19pt, weight: "bold")[#t]
  if sub != none { linebreak(); text(size: 9pt, fill: rgb("536878"))[#sub] }
  v(3mm)
}
#let table-rows(headers, rows, widths) = table(columns: widths, inset: 1.5mm, stroke: .3pt + rgb("c6d1d9"),
  table.header(..headers.map(h => text(weight: "bold", size: 8pt)[#h])), ..rows.flatten())
#let mode = sys.inputs.at("mode", default: "architecture")
#let early = mode == "early"

#title("Tedtronics — perfboard revision 5", sub: "7×10 cm stock · two banks · six interchangeable positions · three active capsules")
#block(fill: rgb("fff0cf"), inset: 4mm, width: 100%)[
  *#d.release.status* \
  Software checks: *#checks.softwareStatus*. Actual hardware, module envelopes, timing and electrical performance remain pending. Read the release gates before soldering.
]
#v(3mm)
#grid(columns: (1fr, 1fr), gutter: 8mm,
 [
  == Architecture
  - ESP1 owns routing, rail enable and fault reset.
  - ESP2 owns smart modes, voltage scanning and joystick ADC1 inputs.
  - Each bank shares an ADS1115 voltage scanner and buffered selector.
  - Every position retains independent output clamps and series-path isolation.
  - Pi and its peripherals have a separate supply. RC522 uses the purchased MIFARE tags.
  - Socket through-hole ICs. Carrier interfaces are labelled pigtails; their connector numbering is not IC numbering.
 ], [
  == Construction comparison
  #table-rows(("Metric", "Legacy", "Revision 5"), (
    ("Boards", str(d.metrics.legacy.boards), str(d.metrics.revision5.boards)),
    ("Functional parts", str(d.metrics.legacy.functionalParts), str(d.metrics.revision5.functionalParts)),
    ("Adapter assemblies", str(d.metrics.legacy.adapters), str(d.metrics.revision5.adapters)),
    ("Local wire segments", str(d.metrics.legacy.wires), str(d.metrics.revision5.wires)),
    ("Board solder estimate", str(d.metrics.legacy.estimatedBoardSolderOperations), str(d.metrics.revision5.estimatedBoardSolderOperations)),
  ), (1.6fr, 1fr, 1fr))
  #text(size: 8pt)[The legacy design used larger boards. Revision 5 also has #d.metrics.revision5.terminalPosts distribution posts and #d.metrics.harnessConductors harness conductors. Counts exclude carrier internals and adapter/socket preparation. This revision reduces adapters; it is not a claim of fewer boards or a finished minimum-work optimum.]
 ])

#pagebreak()
#title("Electrical bounds and release gates")
#grid(columns: (1fr, 1fr), gutter: 8mm, [
  == Calculated design bounds
  - Voltage input impedance: ≥1.98 MΩ with 1% divider resistors.
  - Worst divided input at 5.25 V: #calc.round(d.engineering.voltage.maxBufferInputV, digits: 3) V.
  - Static source/sink clamp maximum: #calc.round(d.engineering.outputClamp.worstSourceSinkMa, digits: 2) mA.
  - Current shunt: 1 Ω ±1%; 10 mV shunt burden at 10 mA, plus switch and wiring resistance.
  - Bank scan target: ≤20 ms. Wait for conversion-ready, discard after switching and keep timestamps.
  - Watchdog expiry target: 200–350 ms; actual HC123 timing must be measured before permanent installation.
  - 5 V guard static trip: 5.053–5.227 V. Approximately 23 mV margin below the contact ceiling does not establish safe fault transients.
  These calculations do not establish loop stability, transient limits or measured accuracy.
 ], [
  == Pending physical evidence
  #for gate in d.release.pending [• #gate \ ]
  Verify the exact carrier pads, actual stock grid, socket bodies, compressed pogo heights and inter-board mounting offsets.

  Current contact geometry needs *156 pogo pins*. The inventory lists 150, leaving a six-pin shortage before spares.

  The 12 V adapter provides a nominal 24 W budget. Measure fan, light, controller and buck input loads. Do not include the Pi in this budget.
 ])

#if mode == "architecture" {
 pagebreak(); title("Board inventory")
 table-rows(("Board", "Purpose", "Parts", "First phase"), d.boards.map(b => (
   b.id, b.title, str(b.parts.len()), "CP" + str(calc.min(..b.parts.map(p => p.phase)))
 )), (1.4fr, 3fr, .4fr, .5fr))
}

#if mode == "architecture" or early {
 for c in d.checkpoints.filter(c => not early or c.phase <= 8) {
  pagebreak(); title(c.id + " — " + c.title, sub: "Filmable win: " + c.win)
  grid(columns: (1fr, 1fr), gutter: 8mm, [
   == Installation
   Add #c.parts components/posts, #c.wireCount local wires and #c.harnessCount harness conductors. Earlier permanent work stays in place.
   #if c.boards.len() > 0 [Boards receiving parts: #c.boards.join(", ").]
   #for l in c.links [• #l \ ]
   == Firmware handoff
   #c.firmware
  ], [
   == Measured acceptance
   #for t in c.tests [• #t.description \ ]
   == Film the result
   #c.filming.shots.join(" ") \
   Negative example: #c.filming.negative \
   Record actual readings, equipment, board/firmware revision and link positions.
  ])
 }
}

#if early or mode == "drawings" {
 let model = json("design.json")
 let post(board, net) = model.boards.filter(b => b.id == board).at(0).nets.filter(n => n.name == net).at(0).pins.filter(ep => ep.starts-with("J_LINK_")).at(0)
 pagebreak(); title("CP01 — removable measurement leads", sub: "Student source positive unplugged. No matrix. Keep these leads distinct from permanent harnesses.")
 table-rows(("Purpose", "From", "To / condition"), (
  ("Temporary precision input A", "measurement-a-precision / " + post("measurement-a-precision", "NODE00"), "A1 C4 / NODE03; also J_DIAGNOSTIC.1 stimulus"),
  ("Temporary precision input B", "measurement-a-precision / " + post("measurement-a-precision", "NODE01"), "A1 C1 / NODE00; also J_DIAGNOSTIC.2 return"),
  ("Temporary 3.3 V supply", "router-core J_FIXTURE.1", "measurement-a-precision / " + post("measurement-a-precision", "3V3_SYS")),
  ("Common return", "router-core J_FIXTURE.2", "measurement-a-precision JP_RETURN.2 / GND; permanent ground harness may supply this"),
  ("Temporary ADC SDA", "router-core J_FIXTURE.3 / GPIO4", "measurement-a-precision J_A_ADC_MODULE.4 / SDA"),
  ("Temporary ADC SCL", "router-core J_FIXTURE.4 / GPIO16", "measurement-a-precision J_A_ADC_MODULE.3 / SCL"),
  ("Stimulus control", "router-core J_FIXTURE.5 / GPIO25", "measurement-a-precision / " + post("measurement-a-precision", "FIX_STIM") + "; use the CP01 permanent harness"),
  ("Test return link", "measurement-a-precision JP_RETURN.1", "JP_RETURN.2; fit only during unpowered continuity test"),
 ), (1.1fr, 1.6fr, 2fr))
 text(size: 8pt)[The input terminals retain their final net names even while temporary leads test C4/C1. Their permanent NODE00/NODE01 harness is absent until CP06. CD4052 selector pull-downs choose channel0; leave later ESP2 selector harnesses disconnected. At CP06 remove temporary sense/stimulus leads and JP_RETURN before installing the permanent node harness. The USB3V3 feed is removed before final regulated-rail links are fitted at CP11; temporary ESP1 bus control ends at CP15.]
}

#if mode == "drawings" or early {
 pagebreak(); title("CP00 — temporary USB source", sub: "Solderless fixture; excluded from the 7×10 cm permanent-board inventory")
 grid(columns: (100mm, 1fr), gutter: 5mm,
  image(d.fixture.file, height: 150mm), [
   #table-rows(("# / reference", "Purpose"), d.fixture.parts.map(p => (str(p.number) + " / " + p.ref, p.label)), (1fr, 2fr))
   #text(size: 8pt)[J_CONTROL pins 1…4 receive router J_PROTOTYPE pins 1…4: USB5V, USB3V3, GND, GPIO32 enable. Q_PASS is NDP6020P (G/D/S); Q_ENABLE is 2N7000 (S/G/D). Confirm the purchased lead order. The five-hole groups are factory-connected; do not add wires for the listed ties.]
  ])
 pagebreak(); title("CP00 — temporary-source schematic")
 image(d.fixture.schematic, width: 100%, height: 145mm, fit: "contain")
 pagebreak(); title("CP00 — fixture jumpers and kit loop")
 grid(columns: (1.6fr, 1fr), gutter: 6mm, [
  #table-rows(("Wire / net", "Endpoints", "TOP holes"), d.fixture.wires.map(w => (
   w.id + " / " + w.net, w.from + " → " + w.to,
   w.fromHole.map(str).join(",") + " → " + w.toHole.map(str).join(",")
  )), (1fr, 1.2fr, .8fr))
 ], [
  *Factory ties — no added jumper*
  #for t in d.fixture.ties [#t.from → #t.to (#t.net) \
  ]
  *Four top-side kit pieces*
  Fake battery: C1 negative / C2 positive. \
  1 kΩ resistor: C2 → C3. \
  LED: C3 anode → C4 cathode. \
  Jumper: C4 → C1. \
  Source output pin1 → A1 J_NODE pin3 (NODE01 / C2); output pin2 → pin1 (NODE00 / C1).

  No protected-power board or matrix is required. Verify reset/disable extinguishes the LED and the disconnected shorted source stays ≤9.5 mA before attaching the kit.
 ])
}

#if mode == "drawings" or early {
 let selected = if early { d.boards.filter(b => b.parts.any(p => p.phase <= 8)) } else { d.boards }
 for b in selected {
  pagebreak(); title(b.id, sub: b.title)
  grid(columns: (1fr, 1fr), gutter: 4mm,
    align(center, image("assets/" + b.id + "-top.svg", height: 152mm)),
    align(center, image("assets/" + b.id + "-underside.svg", height: 152mm)))
  pagebreak(); title(b.id + " — numbered parts")
  text(size: 8pt)[Numbered badges refer to this table. Coordinates and complete pin maps are in the corresponding CSV. Body outlines are provisional; pad coordinates are the design reference.]
  for start in range(0, b.parts.len(), step: 28) {
   if start > 0 { pagebreak(); title(b.id + " — parts continued") }
   table-rows(("#", "Reference", "Purpose", "Install", "Adapter / carrier"), b.parts.slice(start, calc.min(start+28, b.parts.len())).map(p => (
     str(p.number), p.ref, p.label, "CP" + str(p.phase), p.adapter + p.carrier
   )), (.25fr, 1.25fr, 2.1fr, .4fr, 1.4fr))
  }
  for s in b.schematics {
   pagebreak(); title(b.id + " — " + s.section)
   image(s.file, width: 100%, height: 145mm, fit: "contain")
   text(size: 7pt)[Named boundaries preserve external net membership. See design.json for every boundary destination; no connection is removed from the electrical model.]
  }
 }
}

#if mode == "wiring" or early {
 for g in d.wireGroups.filter(g => not early or int(g.checkpoint.slice(2)) <= 8) {
  pagebreak(); title(g.checkpoint + " — " + g.board, sub: "Install these wires after their endpoint components; inspect each net with power isolated.")
  grid(columns: (110mm, 1fr), gutter: 6mm,
   image(g.file, height: 145mm), [
    #table-rows(("ID / net", "From → to", "TOP holes"), g.wires.map(w => (
      w.id + " / " + w.net, w.from + " → " + w.to,
      "(" + w.fromHole.map(str).join(",") + ") → (" + w.toHole.map(str).join(",") + ")"
    )), (1fr, 1.5fr, 1fr))
    #text(size: 8pt)[Insulated underside wire except the explicitly bare node straps. Strip only endpoints; sleeve crossings. A bend is not a solder joint. The SVG shows the existing prescribed paths, not manufactured PCB copper.]
   ])
 }
}

#if mode == "wiring" or early {
 let terminal(e, board) = {
  let bits = e.split(".")
  let b = d.boards.filter(b => b.id == board).at(0)
  let p = b.parts.filter(p => p.ref == bits.at(0)).at(0)
  let pin = p.pins.filter(pin => pin.number == int(bits.at(1))).at(0)
  board + " / " + e + "\nTOP (" + pin.hole.map(str).join(",") + ")"
 }
 for c in d.checkpoints.filter(c => c.harnesses.len() > 0 and (not early or c.phase <= 8)) {
  for start in range(0, c.harnesses.len(), step: 14) {
   pagebreak(); title(c.id + " — inter-board harnesses", sub: "Install after local wires; power isolated. Confirm every conductor end to end before plugging in.")
   table-rows(("ID / purpose", "From terminal", "To terminal"), c.harnesses.slice(start, calc.min(start+14, c.harnesses.len())).map(h => (
    h.id + " / " + h.net, terminal(h.fromPin, h.from), terminal(h.toPin, h.to)
   )), (1fr, 2fr, 2fr))
   text(size: 8pt)[TOP hole numbering remains the same when viewed from the mirrored underside. Use insulated wire and strain relief. Lengths follow the measured enclosure layout; the cross-board topology is specified here, but no measured harness length or purchased connector body is implied. A named net without its conductor is not connected.]
  }
 }
}
