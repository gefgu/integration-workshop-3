#let d = json("data.json")
#let a = json("assessment.json")
#let model = json("design.json")
#let proto = json("prototype.json")
#let aids = json("aids.json")
#let r6 = json("../revision6/assessment.json")
#let mode = sys.inputs.at("mode", default: "assessment")
#let cp(n) = "CP" + if n < 10 { "0" + str(n) } else { str(n) }
#set page(paper: if mode == "drawings" or mode == "wiring" or mode == "scale" { "a3" } else { "a4" }, flipped: true, margin: if mode == "scale" { 5mm } else { 10mm },
 footer: context text(size: 7pt)[Tedtronics · revision7 · EVALUATION ONLY · #counter(page).display()])
#set text(font: "DejaVu Sans", size: 9pt, fill: rgb("243746"))
#set par(spacing: .55em)
#let title(t, sub: none) = { text(size: 19pt, weight: "bold")[#t]; if sub != none { linebreak(); text(size: 9pt)[#sub] }; v(3mm) }
#let rows(head, data, cols) = table(columns: cols, inset: 1.4mm, stroke: .3pt + rgb("c6d1d9"), table.header(..head.map(x => text(weight: "bold")[#x])), ..data.flatten())
#let permanent = model.boards.filter(b => a.evaluation.permanentIds.contains(b.id))
#let warning = block(fill: rgb("fff0cf"), inset: 3mm, width: 100%)[*Not released for soldering.* Software checks do not establish measured fit, manual-wire safety, protection response or PCB manufacturability.]

#if mode == "assessment" {
 title("Revision 7 — assessment", sub: "Same four boards and netlist as revision 6, wired and instrumented so each board can be tested alone.")
 warning
 rows(("Gate", "Result", "Meaning"), (
  ("Software / net preservation", a.softwareStatus, str(a.netPreservation.comparedPins) + " original connected pins compared"),
  ("Measured mechanical fit", a.mechanicalStatus, "Actual board grid, adapter bodies, stack height and extraction pending"),
  ("Powered qualification", a.electricalStatus, "No measured hardware acceptance supplied"),
  ("Smart PCB fabrication", a.manufacturingStatus, "Reference contracts only; no routed fabrication files"),
  ("Overall decision", a.decision, "Four-board target retained; no extra lower board permitted"),
  ("Wiring budgets", if a.softwareStatus == "pass" { "pass" } else { "fail" }, "Crossing ceilings per board, bar spacing, fail-safe links and test-point checks run in the build"),
 ), (1.4fr, .6fr, 3fr))
 v(2mm)
 rows(("Assembly", "Role", "Local wires", "Functional parts"), permanent.map(b => (
  b.id, b.title, str(b.wires.len()), str(b.parts.filter(p => p.body != "terminal").len())
 )), (1fr, 3fr, .6fr, .7fr))
 [Smart circuitry remains separate: the #a.smartReferenceLayoutCount inherited layouts are *logical electrical contracts*, not twelve proposed PCBs or extra perfboards.]
 pagebreak(); title("What changed from revision 6", sub: "Wire tree, test access and split points. The 1,659 functional pins keep their original nets.")
 let r6w(id) = r6.wiring.filter(w => w.board == id).at(0)
 rows(("Board", "Crossings r6 → r7", "Wire length r6 → r7", "Insulated wires", "Bare bar segments", "Sleeves needed"), a.wiring.map(w => (
  w.board,
  str(r6w(w.board).crossings) + " → " + str(w.crossings),
  str(calc.round(r6w(w.board).lengthMm / 1000, digits: 2)) + " → " + str(calc.round(w.lengthMm / 1000, digits: 2)) + " m",
  str(w.wires - w.at("barSegments", default: 0)), str(w.at("barSegments", default: 0)), str(w.at("sleeves", default: 0))
 )), (1fr, 1fr, 1.2fr, .7fr, .8fr, .7fr))
 [*Spatial wire chains.* Each net is chained in board order, nearest already-installed pin first, instead of install-phase and alphabetical order. A wire still only joins pins that are already installed, so every partial-state check keeps passing.]
 parbreak()
 [*Ground bus bars.* Ground on the two lower boards uses up to four bare bars on free rows of the underside, with one short insulated stub per pin. A bar does not cut crossings in this placement (see the sweep in README.md); it is there so one cold joint cannot open ground for everything downstream. Every insulated wire that crosses a bar is flagged for a sleeve in the wire CSV.]
 parbreak()
 [*Test aids, no extra wires for test points.* A 1×8 probe header (same pinout and corner on both lower boards), status LEDs along the bottom edge, and designated existing pads as labelled test points. Removable links split each board; each opens to OFF.]
 parbreak()
 [Crossings count strict segment intersections between different nets; they indicate congestion, not shorts. Insulation, lead access and analog stability still need physical inspection.]
 pagebreak(); title("Mechanical fit and removable tray")
 grid(columns: (1fr, 1fr), gutter: 7mm, [
  *Contact banks*
  - 11 columns per bank; 177.80 mm first-to-last span.
  - Six contacts per column; 50.80 mm row span.
  - Assumed 78 × 38 grid at 2.54 mm; check actual stock.
  - Capsule orientation is unchanged between banks.
  - Contact frame carries insertion force independently.
  *Lower boards*
  - Power zones: input/guards and student cutoff/interlock.
  - Router zones: ESP1/watchdog and matrices/control/interfaces.
  - Module, cable and smart PCB space is additional to pad packing.
 ], [
  *Required clearance — fill from measurements*
  Contact underside protrusions + tallest lower-board assembly + lower-board thickness + underside joints + insulation allowance + cable bend envelope.

  Calculated requirement: #if a.height.requiredHeightMm == none [*pending*] else [#a.height.requiredHeightMm mm].
  Available height: #if a.height.availableHeightMm == none [*pending*] else [#a.height.availableHeightMm mm].

  Use measurements.json, component-envelope-review.csv and manual-review.json. The required calculation is conservative; verify routing-specific clearances in the mock-up.
 ])
 [Print the scale templates at 100%, measure the calibration bar, place actual sockets/modules over the outlines, and rehearse tray removal. If two lower boards cannot provide fit and repair access, mark the arrangement failed; report the matrix functions that need PCB consolidation.]
 pagebreak(); title("Smart prototype — staged evaluation")
 warning
 rows(("Candidate", "Result", "Consequence"), (
  ("Complete R5 one-position support on 7×10", proto.status, proto.fitFinding),
  ("ESP32 + direct precision voltage front end", proto.earlyStatus, "Provisional pad fit only; no mux or isolated multi-position service bus"),
 ), (1.4fr, 1.2fr, 2.3fr))
 [The early board supports display/voltage work. Continuity stimulus uses the existing bounded eight-part diagnostic circuit as an external removable fixture. Later output/current qualification requires an external temporary fixture or final smart PCB. Do not purchase or solder a full 7×10 prototype from the failed packing.]
 rows(("Standalone signal", "Connection / condition"), (
  ("OLED / ADS1115 I2C", "GPIO4 SDA; GPIO22 SCL; 0x3C OLED and 0x48 ADC"),
  ("External continuity stimulus", "GPIO26 through removable control lead; OFF at reset; remove before register-latch use"),
  ("Precision ADC", "AIN0 → P0_1_MUX; AIN1 → P0_2_MUX; no CD4052 on this one-channel fixture"),
  ("Temporary supply", "Verified ESP USB3V3 → 3V3_SYS removable lead, never paralleled with final regulator"),
  ("Final handoff", "GPIO26 returns to ESP2 latch; final mux, bus isolation and watchdog tests repeated"),
 ), (1.3fr, 3.5fr))
 [Prototype evidence does not pass the permanent assembly checkpoints. Keep its serial number and firmware profile separate. The ADC carrier and OLED are external modules whose mounting envelopes are unverified.]
 pagebreak(); title("Checkpoint chapters and release decision")
 rows(("Chapter", "Checkpoints", "Filmable acceptance"), (
  ("First light and diagnostics", "CP00–03", "LED on/OFF; open and wrong jumpers rejected; correction needs a fresh test"),
  ("One smart display and voltage", "CP04–08", "Identity/OFF status; calibration; actual and signed voltage"),
  ("Final power protection", "CP09–14", "Qualified rails; startup OFF; latched overload; heartbeat and transient cutoff"),
  ("One complete smart position", "CP15–23", "Bounded source/sink, pulse, gates, memory and measured current"),
  ("Programmable matrix", "CP24–26", "Routed LED loop, continuity and invalid-route rejection"),
  ("All positions", "CP27–31", "Every position qualified; at most three active; removal/reconfiguration safe"),
  ("System sessions", "CP32–36", "Pi, explicit enable, RFID failures and complete lesson"),
 ), (1.2fr, .6fr, 3fr))
 [CP00 needs no final power or matrix. CP01 diagnostics use fixed connections. CP09 begins power; CP24 begins matrix. Preserve permanent work; only labelled temporary links and test arrangements change. Use checkpoint-guide.pdf and transitions.csv.]
 [*October milestones:* October 22 demonstration must remain independent of PCB arrival. October 29 requires tested electronics with partial firmware integration. PCB procurement and firmware work proceed in parallel; missing hardware, incomplete PCB files or unavailable diagnostic firmware remain schedule blockers.]
 [*Release rule:* fail on net/placement errors or measured fit failure. Otherwise remain pending until physical access, all applicable bench tests and final PCB manufacturing review have evidence. No computed drawing becomes a measured pass.]
}

#if mode == "checkpoints" {
 for c in d.checkpoints {
  title(c.id + " — " + c.title, sub: "Filmable win: " + c.win)
  grid(columns: (1fr, 1fr), gutter: 6mm, [
   *Construction*
   Add #c.parts parts/posts, #c.wireCount wires and #c.harnessCount harness conductors.
   Assemblies: #c.boards.join(", ").
   Place one component or node column at a time; inspect it separately. Add one wire at a time. Earlier permanent components and wiring remain fixed.
   #for link in c.links [• #link \ ]
  ], [
   *Firmware contract*
   #c.firmware
   *Measured acceptance*
   #for t in c.tests [• #t.description \ ]
   *Film*
   #c.filming.shots.join(" ")
   Negative case: #c.filming.negative
  ])
  [Record serial numbers, hardware and firmware revisions, equipment, actual readings, temporary-link states and waveforms. Prototype evidence does not transfer. Failed or inconclusive tests block acceptance.]
  if c.phase < 36 { pagebreak() }
 }
}

#if mode == "drawings" {
 for b in permanent {
  title(b.id + " — placement", sub: "TOP coordinates retained on MIRRORED UNDERSIDE. Numbered reference tables follow.")
  grid(columns: (1fr, 1fr), gutter: 4mm,
   image("assets/" + b.id + "-top.svg", width: 100%, height: 185mm, fit: "contain"),
   image("assets/" + b.id + "-underside.svg", width: 100%, height: 185mm, fit: "contain"))
  warning
  for offset in range(0, b.parts.len(), step: 24) {
   pagebreak(); title(b.id + " — components and endpoints")
   rows(("Badge", "Ref / purpose", "Install", "TOP hole coordinates", "Adapter / module"), b.parts.slice(offset, calc.min(offset+24,b.parts.len())).map(p => (
    str(b.parts.position(x => x.ref == p.ref)+1), p.ref + ": " + p.label, cp(p.phase), p.pins.map(pin => str(pin.number)+"="+pin.hole.map(str).join(",")).join("; "), p.at("adapter", default: "") + p.at("externalPart", default: "")
   )), (.35fr, 2fr, .4fr, 2fr, 1fr))
  }
  for sheet in d.boards.filter(x => x.id == b.id).at(0).schematics {
   pagebreak(); title(b.id + " — " + sheet.section)
   image(sheet.file, width: 100%, height: 205mm, fit: "contain")
   [Continuous connections within a functional block; named boundaries preserve all external connections. Full model and endpoint crosswalk accompany this PDF.]
  }
  pagebreak()
 }
 title("Standalone early smart reference", sub: "Separate temporary fixture; not a fifth permanent perfboard")
 if proto.earlyPlacement != none {
  grid(columns: (1fr, 1fr), gutter: 4mm,
   image("assets/smart-early-top.svg", height: 180mm), image("assets/smart-early-underside.svg", height: 180mm))
  for s in model.drawings.filter(x => x.board == "smart-early") {
   pagebreak(); title("Early prototype — " + s.section); image(s.file, width: 100%, height: 205mm, fit: "contain")
  }
  pagebreak(); title("External continuity stimulus — temporary fixture")
  image(model.drawings.filter(x => x.section == "External continuity stimulus").at(0).file, width: 100%, height: 190mm, fit: "contain")
  [See prototype-stimulus-pins.csv for actual IC pins and net membership. FIX_STIM receives standalone GPIO26; power is verified 3.3 V; TEST_A/TEST_B and JP_RETURN are removable. Student positive must be disconnected. This drawing is a schematic, not a measured breadboard placement.]
 }
}

#if mode == "scale" {
 for b in permanent {
  title(b.id + " — actual-size pad template", sub: "Print 100% / actual size. Verify the 100 mm bar. Bodies and board grid remain provisional.")
  grid(columns: (200mm, 200mm), gutter: 4mm,
   [*TOP* \ #image("assets/"+b.id+"-scale-top.svg", width: 200mm, height: 100mm)],
   [*MIRRORED UNDERSIDE — TOP coordinates* \ #image("assets/"+b.id+"-scale-underside.svg", width: 200mm, height: 100mm)])
  v(10mm); line(length: 100mm, stroke: 1pt); parbreak(); [100 mm calibration line]; parbreak()
  [Check actual components, plugs and adapters over the template. The buck and smart PCB bodies require separate measured allocation. Reference numbers use schematics-and-placement.pdf.]
  pagebreak()
 }
 if proto.earlyPlacement != none {
  title("Early smart reference — actual-size pad template")
  grid(columns: (70mm, 70mm), gutter: 10mm,
   [*TOP* \ #image("assets/smart-early-scale-top.svg", width: 70mm, height: 100mm)],
   [*MIRRORED UNDERSIDE* \ #image("assets/smart-early-scale-underside.svg", width: 70mm, height: 100mm)])
  v(10mm); line(length: 100mm, stroke: 1pt); parbreak(); [100 mm calibration line]; parbreak()
  [Limited direct-voltage fixture; no bank mux, service isolation or full output/current hardware on this board. Physical envelopes are pending.]
 }
}

#if mode == "wiring" {
 for g in d.wireGroups.filter(g => a.evaluation.permanentIds.contains(g.board)) {
  title(g.checkpoint + " — " + g.board, sub: "At most ten added wires per view. Inspect each net with power isolated.")
  grid(columns: (1.4fr, 1fr), gutter: 6mm,
   image(g.file, width: 100%, height: 190mm, fit: "contain"), [
    #rows(("Wire / net", "From → to", "TOP holes"), g.wires.map(w => (
     w.id+" / "+w.net, w.from+" → "+w.to, w.fromHole.map(str).join(",")+" → "+w.toHole.map(str).join(",")
    )), (.8fr, 2fr, .7fr))
   ])
  [Bare node-column straps only; all other wires insulated underneath. A bend is not a joint. Consult the endpoint CSV; do not infer a connection from a crossing.]
  pagebreak()
 }
}

#if mode == "bringup" {
 let cb = "☐ "
 let blank = box(width: 22mm, stroke: (bottom: .5pt), inset: (y: 1pt))[]
 for b in aids.boards {
  title(b.id + " — bring-up pass table", sub: "Run this board alone on the current-limited bench supply. Tick each box and write the reading. Any FAIL stops the sequence; fix it before moving on.")
  grid(columns: (1fr, 1fr), gutter: 7mm, [
   *1. Before power (multimeter, supply OFF, USB unplugged)* \
   #cb Every part is seated, pin 1 matches the drawing, no solder bridge between neighbouring pads. \
   #cb No dead short: GND to each supply rail reads at least 1 kΩ and is stable (record: #blank). \
   #cb Rail to rail (12 V, 5 V, 3.3 V nets) reads at least 1 kΩ. \
   #cb Bare ground bars (#b.bars.len()): each bar touches only its own pads; continuity along each bar below 1 Ω; no bar touches a signal pad. \
   #cb Every removable link is in its documented state (table 4). \
   *2. First power-up* \
   #cb Set the bench supply to #if b.id == "power" [12 V] else [the USB or 5 V source] with a current limit of 100 mA. \
   #cb Switch on. If the limit is reached, switch off at once and look for a short; do not raise the limit. \
   #cb Record the idle current: #blank mA. \
   #if b.id == "power" [
    #cb Adjust LM2596 to 5.00 V and XL4015 to 3.30 V with the consumer links (JP_LOGIC, JP_3V3) open; keep the 5 V buck below the guard trip (about 5.05 V). \
    #cb Fit the consumer links one at a time and re-check the rail LEDs. \
   ] else [
    #cb With JP_R7_EN open, plug the ESP1 USB. The board must power up without enabling the student rail. \
    #cb Load the bring-up firmware and run the self-test sequence in selftest.md (PING, VER, RAILS, FAULT?, I2C SCAN, HB ON/OFF). \
   ]
  ], [
   *3. Status LEDs*
   #rows(("", "LED", "Lights when", "From"), b.leds.map(l => (cb, l.ref, l.meaning, cp(l.phase))), (.2fr, 1.5fr, 2fr, .5fr))
   *4. Removable links (default: shunt fitted)*
   #rows(("", "Link", "Net", "Open means"), b.links.map(l => (cb, l.ref, l.net, l.purpose)), (.2fr, 1fr, 1fr, 3fr))
   #text(size: 8pt)[Every link opens to OFF: the loaded side is pulled low by an existing or added resistor.]
  ])
  pagebreak()
  title(b.id + " — test points and expected readings", sub: "Pads are existing pads; solder a short tin loop on the pad if you want a clip point. Readings are with the bench supply on and the student rail OFF.")
  rows(("", "Test point", "Pad", "Column, row", "Install", "Expected", "Tool", "Reading"), b.testPoints.map(t => (
   cb, t.ref, t.endpoint, str(t.hole.at(0)) + ", " + str(t.hole.at(1)), cp(t.phase), t.expected, t.tool, "________"
  )), (.2fr, 1.1fr, 1.7fr, .6fr, .4fr, 2.6fr, .6fr, .6fr))
  [Polarity and idle levels marked "verify" must be confirmed against the schematic before they are used as pass criteria. A generated table is not measured evidence.]
  pagebreak()
 }
}

#if mode == "testpoints" {
 for b in aids.boards {
  title(b.id + " — probe header and test points", sub: "One probe position for every board: the 1×8 header J_PROBE at the top left. Pin 1 is GND.")
  grid(columns: (1fr, 1.4fr), gutter: 8mm, [
   *J_PROBE (1×8, row 1, columns #b.probe.first().hole.at(0)–#b.probe.last().hole.at(0))*
   #rows(("Pin", "Label", "Net", "Install"), b.probe.map(p => (str(p.pin), p.label, if p.net == none [(not wired)] else [#p.net], cp(p.phase))), (.4fr, .8fr, 1.4fr, .6fr))
   #text(size: 8pt)[Scope ground clip on pin 1 (GND), probe tip on the pin you need. TRIG is a convenient scope trigger; FAULT shows the latched fault or its reset line.]
  ], [
   *Designated test pads*
   #rows(("Net", "Pad", "Column, row", "Install"), b.testPoints.map(t => (t.net, t.endpoint, str(t.hole.at(0)) + ", " + str(t.hole.at(1)), cp(t.phase))), (1.2fr, 2fr, .8fr, .5fr))
  ])
  v(2mm)
  [*Analogue nodes are not brought out.* Reference, current-sense and gate-drive nets stay short; probe them at the part pad, or use the existing J_POWER_INTERLOCK_TEST header on the power board.]
  pagebreak()
 }
}
