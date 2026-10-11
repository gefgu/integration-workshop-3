#let d = json("data.json")
#let a = json("assessment.json")
#let model = json("design.json")
#let proto = json("prototype.json")
#let mode = sys.inputs.at("mode", default: "assessment")
#let cp(n) = "CP" + if n < 10 { "0" + str(n) } else { str(n) }
#set page(paper: if mode == "drawings" or mode == "wiring" or mode == "scale" { "a3" } else { "a4" }, flipped: true, margin: if mode == "scale" { 5mm } else { 10mm },
 footer: context text(size: 7pt)[Tedtronics · revision6 · EVALUATION ONLY · #counter(page).display()])
#set text(font: "DejaVu Sans", size: 9pt, fill: rgb("243746"))
#set par(spacing: .55em)
#let title(t, sub: none) = { text(size: 19pt, weight: "bold")[#t]; if sub != none { linebreak(); text(size: 9pt)[#sub] }; v(3mm) }
#let rows(head, data, cols) = table(columns: cols, inset: 1.4mm, stroke: .3pt + rgb("c6d1d9"), table.header(..head.map(x => text(weight: "bold")[#x])), ..data.flatten())
#let permanent = model.boards.filter(b => a.evaluation.permanentIds.contains(b.id))
#let warning = block(fill: rgb("fff0cf"), inset: 3mm, width: 100%)[*Not released for soldering.* Software checks do not establish measured fit, manual-wire safety, protection response or PCB manufacturability.]

#if mode == "assessment" {
 title("Four-perfboard hybrid — assessment", sub: "Two contact banks above; power and controller/matrix below on a removable tray.")
 warning
 rows(("Gate", "Result", "Meaning"), (
  ("Software / net preservation", a.softwareStatus, str(a.netPreservation.comparedPins) + " original connected pins compared"),
  ("Measured mechanical fit", a.mechanicalStatus, "Actual board grid, adapter bodies, stack height and extraction pending"),
  ("Powered qualification", a.electricalStatus, "No measured hardware acceptance supplied"),
  ("Smart PCB fabrication", a.manufacturingStatus, "Reference contracts only; no routed fabrication files"),
  ("Overall decision", a.decision, "Four-board target retained; no extra lower board permitted"),
 ), (1.4fr, .6fr, 3fr))
 v(2mm)
 rows(("Assembly", "Role", "Local wires", "Functional parts"), permanent.map(b => (
  b.id, b.title, str(b.wires.len()), str(b.parts.filter(p => p.body != "terminal").len())
 )), (1fr, 3fr, .6fr, .7fr))
 [Smart circuitry remains separate: the #a.smartReferenceLayoutCount inherited layouts are *logical electrical contracts*, not twelve proposed PCBs or extra perfboards.]
 pagebreak(); title("Construction effort — compare the same scope")
 rows(("Metric", "R5 retained groups", "R6 permanent boards"), (
  ("Perfboards", "15 (contacts + power + router + interfaces)", "4"),
  ("Local wire segments", "597", str(a.metrics.permanent.wires)),
  ("Functional parts", "167", str(a.metrics.permanent.functionalParts)),
  ("SMD adapters", "9", str(a.metrics.permanent.adapters)),
  ("Board solder estimate", "See R5 whole-system report", str(a.metrics.permanent.estimatedBoardSolderOperations)),
 ), (1.3fr, 2fr, 1fr))
 [The whole R5 system has 27 perfboards and 1,392 local wires. Moving the smart subsystem to PCB removes its 795 local hand-wire segments from the permanent perfboard scope. Consolidating the remaining groups removes only 17 local segments: *board count falls much faster than wiring effort*.]
 [Current boundary harness model: #a.metrics.harnessConductors conductors / #a.metrics.harnessEndTerminations ends, versus 279 / 558 in R5. These include inherited seams inside the smart reference contracts. Final PCB consolidation changes the harness count; this is not a final cable purchase list. Solder estimates exclude socket/adapter preparation, carrier internals and harness ends.]
 rows(("Board", "Wires", "Segment crossings", "Wire length", "Longest sensitive path"), a.wiring.map(w => (
  w.board, str(w.wires), str(w.crossings), str(calc.round(w.lengthMm / 1000, digits: 2)) + " m", str(calc.round(w.sensitiveMaxLengthMm, digits: 1)) + " mm"
 )), (1fr, .4fr, .7fr, .6fr, 1fr))
 [Crossings count strict segment intersections between different nets. They are a congestion indicator, not shorts or a complete overlap count. Insulation, lead access and analog stability require physical inspection.]
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
