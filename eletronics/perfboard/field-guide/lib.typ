// Shared components for the CP00 field guides.

// ---------- Design tokens ----------
#let ink = rgb("#14181f")
#let muted = rgb("#566070")
#let rule = rgb("#d5dae2")
#let soft = rgb("#f3f5f8")
#let danger = rgb("#b4232c")
#let amber = rgb("#8a5a00")
#let acc = (
  g1: rgb("#1263c9"),
  g2: rgb("#7a3ee0"),
  g3: rgb("#c9400a"),
  g4: rgb("#0b7f55"),
  g5: rgb("#b4232c"),
)
#let wire-fill = (
  black: rgb("#222222"), orange: rgb("#ef8500"), red: rgb("#d32f2f"), blue: rgb("#1976d2"),
  grey: rgb("#888888"), yellow: rgb("#c79500"), bare: rgb("#78909c"),
)


// ---------- Components ----------
#let mono(body) = text(font: "DejaVu Sans Mono", size: 8.5pt, body)

#let banner(kicker, title, accent, sub: none) = block(width: 100%, fill: accent, radius: 3mm, inset: 4.5mm, below: 3mm)[
  #text(fill: white.transparentize(15%), size: 7.5pt, weight: "bold", tracking: 0.1em)[#upper(kicker)]
  #v(1mm)
  #text(fill: white, size: 16pt, weight: "bold")[#title]
  #if sub != none { v(1mm); text(fill: white.transparentize(10%), size: 9pt)[#sub] }
]

#let tile(value, label, accent) = block(width: 100%, fill: accent.transparentize(90%), stroke: 0.6pt + accent.transparentize(55%), radius: 2mm, inset: (x: 2mm, y: 2.4mm))[
  #align(center)[
    #text(size: 16pt, weight: "bold", fill: accent)[#value]
    #v(-0.6mm)
    #text(size: 6.8pt, fill: muted, weight: "bold")[#upper(label)]
  ]
]
#let stats(accent, ..items) = grid(columns: items.pos().len() * (1fr,), gutter: 1.8mm, ..items.pos().map(i => tile(i.at(0), i.at(1), accent)))

#let sec(title, accent) = block(above: 5.5mm, below: 2.2mm, sticky: true)[
  #text(size: 8.5pt, weight: "bold", fill: accent, tracking: 0.08em)[#upper(title)]
  #v(-1.5mm)
  #line(length: 100%, stroke: 0.7pt + accent.transparentize(60%))
]

#let callout(kind, body) = {
  let (c, f) = if kind == "warning" { (danger, rgb("#fdecea")) } else if kind == "caution" { (amber, rgb("#fff4d6")) } else { (muted, soft) }
  block(width: 100%, fill: f, stroke: (left: 1.4mm + c), radius: (right: 1.5mm), inset: (x: 3mm, y: 2.4mm), below: 2.5mm)[
    #text(size: 7pt, weight: "bold", fill: c, tracking: 0.1em)[#upper(kind)]
    #v(-0.4mm)
    #body
  ]
}

#let checkbox(size: 4mm) = box(width: size, height: size, stroke: 0.9pt + ink, radius: 0.8mm, baseline: 0.5mm)

#let todo(body) = grid(columns: (6mm, 1fr), gutter: 1.5mm, align: top, checkbox(), body)

#let step(n, accent, body, ..rest) = {
  let extra = rest.pos().at(0, default: none)
  block(width: 100%, breakable: false, stroke: 0.7pt + rule, radius: 2mm, inset: 3mm, below: 2.5mm, {
    grid(columns: (7.5mm, 1fr), gutter: 2.5mm, align: top,
      box(width: 6.5mm, height: 6.5mm, radius: 50%, fill: accent, align(center + horizon, text(fill: white, weight: "bold", size: 9.5pt)[#n])),
      {
        body
        if extra != none {
          v(1.2mm)
          block(width: 100%, fill: soft, radius: 1.5mm, inset: 2mm, extra)
        }
      })
  })
}

#let swatch(name, size: 3mm) = box(width: size, height: size, radius: 50%, fill: wire-fill.at(name, default: gray), stroke: 0.5pt + ink.transparentize(40%), baseline: 0.5mm)

#let record(label, unit) = grid(columns: (auto, 1fr, auto), gutter: 1.5mm, align: bottom, text(size: 8.5pt, fill: muted)[#label], line(length: 100%, stroke: 0.6pt + muted), text(size: 8.5pt, fill: muted)[#unit])

// ---------- Board drawings ----------
#let board-fill = rgb("#efe6c8")
#let hole-fill = rgb("#fffdf5")
#let hole-stroke = rgb("#c4b383")

#let label-step(c) = if c > 3.6mm { 1 } else if c > 2.6mm { 2 } else { 5 }

#let perf-view(g, side, accent, width: 82mm, maxh: 9999mm, prof: "phone", k: 1.0) = {
  let v = g.view
  let lm = 5.5mm
  let nx = v.x1 - v.x0 + 1
  let ny = v.y1 - v.y0 + 1
  let c = calc.min((width - lm) / nx, (maxh - lm) / ny)
  let bh = ny * c
  let px(x) = lm + (if side == "bottom" { (v.x1 - x) + 0.5 } else { (x - v.x0) + 0.5 }) * c
  let py(y) = lm + ((y - v.y0) + 0.5) * c
  let r = c * 0.2
  let step-l = label-step(c)
  box(width: nx * c + lm, height: bh + lm, {
    place(top + left, dx: lm, dy: lm, rect(width: nx * c, height: bh, fill: board-fill, stroke: 0.6pt + hole-stroke, radius: 1mm))
    for x in range(v.x0, v.x1 + 1) {
      if calc.rem(x, step-l) == 0 {
        place(top + left, dx: px(x) - 3mm, dy: 0mm, box(width: 6mm, align(center, text(size: 4.8pt * k, fill: muted)[#x])))
      }
    }
    for y in range(v.y0, v.y1 + 1) {
      if calc.rem(y, step-l) == 0 {
        place(top + left, dx: 0mm, dy: py(y) - 1.3mm, box(width: lm - 0.8mm, align(right, text(size: 4.8pt * k, fill: muted)[#y])))
      }
    }
    for x in range(v.x0, v.x1 + 1) {
      for y in range(v.y0, v.y1 + 1) {
        place(top + left, dx: px(x) - r, dy: py(y) - r, circle(radius: r, fill: hole-fill, stroke: 0.3pt + hole-stroke))
      }
    }
    // Part outlines: top view = bodies; bottom view = ghost footprints.
    let outline(p, color, dashed) = {
      let xa = calc.min(px(p.bounds.xmin), px(p.bounds.xmax))
      let ya = py(p.bounds.ymin)
      place(top + left, dx: xa, dy: ya, rect(width: (p.bounds.xmax - p.bounds.xmin) * c, height: (p.bounds.ymax - p.bounds.ymin) * c, radius: 0.8mm,
        fill: if dashed { none } else { color.transparentize(86%) },
        stroke: (paint: color, thickness: 0.7pt, dash: if dashed { "dashed" } else { none })))
    }
    for p in g.context { outline(p, muted.transparentize(40%), true) }
    for p in g.parts { outline(p, accent, side == "bottom") }
    // Bottom view: wires first (lane-offset paths from build-data), labels after pins and ends.
    if side == "bottom" {
      for w in g.wires {
        let col = wire-fill.at(w.colorName, default: gray)
        let pts = w.pts.map(q => (px(q.at(0)), py(q.at(1))))
        place(top + left, curve(stroke: (paint: col, thickness: (if w.bare { 1.6pt } else { 1.0pt }) * k, cap: "round", join: "round"), curve.move(pts.first()), ..pts.slice(1).map(q => curve.line(q))))
      }
    }
    // Pins / solder pads.
    for p in g.parts {
      for pin in p.pins {
        let first = pin.n == 1
        let x = px(pin.hole.at(0))
        let y = py(pin.hole.at(1))
        let rr = c * 0.34
        if side == "bottom" {
          place(top + left, dx: x - rr, dy: y - rr, circle(radius: rr, fill: rgb("#c9ced6"), stroke: 0.7pt + ink))
        } else {
          place(top + left, dx: x - rr, dy: y - rr, circle(radius: rr, fill: if first { rgb("#d32f2f") } else { white }, stroke: 0.9pt + accent))
        }
      }
    }
    // Wire ends on the bottom view (the solder points).
    if side == "bottom" {
      for w in g.wires {
        let col = wire-fill.at(w.colorName, default: gray)
        for e in (w.a, w.b) {
          place(top + left, dx: px(e.at(0)) - c * 0.17, dy: py(e.at(1)) - c * 0.17, circle(radius: c * 0.17, fill: col, stroke: 0.4pt + white))
        }
      }
    }
    if side == "bottom" {
      let lw = if prof == "desk" { 8mm } else { 6mm }
      let lh = if prof == "desk" { 3.8mm } else { 3mm }
      for w in g.wires {
        if not w.bare {
          let col = wire-fill.at(w.colorName, default: gray)
          let q = w.lab.at(prof)
          place(top + left, line(start: (px(q.at(2)), py(q.at(3))), end: (px(q.at(0)), py(q.at(1))), stroke: 0.5pt * k + col))
          place(top + left, circle(radius: 0.35mm * k, fill: col, stroke: none), dx: px(q.at(2)) - 0.35mm * k, dy: py(q.at(3)) - 0.35mm * k)
          place(top + left, dx: px(q.at(0)) - lw / 2, dy: py(q.at(1)) - lh / 2,
            box(width: lw, height: lh, fill: white, radius: 0.8mm, stroke: 0.6pt + col, align(center + horizon, text(size: 4.8pt * k, weight: "bold")[#w.id])))
        }
      }
    }
  })
}

#let bb-letter(x) = if x <= 6 { ("a", "b", "c", "d", "e").at(x - 2) } else { ("f", "g", "h", "i", "j").at(x - 9) }

#let bb-view(g, accent, width: 82mm, maxh: 9999mm, prof: "phone", k: 1.0) = {
  let v = g.view
  let lm = 5.5mm
  let nx = 14
  let ny = v.y1 - v.y0 + 1
  let c = calc.min((width - lm) / nx, (maxh - lm) / ny)
  let px(x) = lm + (x - 1 + 0.5) * c
  let py(y) = lm + ((y - v.y0) + 0.5) * c
  let r = c * 0.16
  let cols = (2, 3, 4, 5, 6, 9, 10, 11, 12, 13)
  box(width: nx * c + lm, height: ny * c + lm, {
    place(top + left, dx: lm, dy: lm, rect(width: nx * c, height: ny * c, fill: rgb("#e4e9ef"), stroke: 0.6pt + rgb("#b9c2cf"), radius: 1mm))
    place(top + left, dx: px(7) - c * 0.1, dy: lm, rect(width: c * 1.2, height: ny * c, fill: rgb("#cfd6df")))
    for x in cols { place(top + left, dx: px(x) - 1.5mm, dy: 0mm, box(width: 3mm, align(center, text(size: 6pt, fill: muted, weight: "bold")[#bb-letter(x)]))) }
    // Connected-row bands for rows that carry a part or a jumper.
    let used = ()
    for p in g.parts { for pin in p.pins { used.push((if pin.hole.at(0) <= 6 { 0 } else { 1 }, pin.hole.at(1))) } }
    for w in g.wires { for e in (w.a, w.b) { used.push((if e.at(0) <= 6 { 0 } else { 1 }, e.at(1))) } }
    for u in used.dedup() {
      let (x0, x1) = if u.at(0) == 0 { (2, 6) } else { (9, 13) }
      place(top + left, dx: px(x0) - c * 0.45, dy: py(u.at(1)) - c * 0.4, rect(width: (x1 - x0) * c + c * 0.9, height: c * 0.8, fill: accent.transparentize(84%), radius: 1mm))
    }
    for y in range(v.y0, v.y1 + 1) {
      place(top + left, dx: 0mm, dy: py(y) - 1.4mm, box(width: lm - 0.8mm, align(right, text(size: 5.5pt, fill: muted)[#y])))
      for x in cols { place(top + left, dx: px(x) - r, dy: py(y) - r, circle(radius: r, fill: rgb("#2a313c"))) }
    }
    // Bodies
    for p in g.parts {
      let xs = p.pins.map(q => q.hole.at(0))
      let ys = p.pins.map(q => q.hole.at(1))
      let x0 = xs.sorted().first()
      let x1 = xs.sorted().last()
      let y0 = ys.sorted().first()
      let y1 = ys.sorted().last()
      let w = (x1 - x0) * c + c * 0.9
      let hh = (y1 - y0) * c + c * 0.9
      place(top + left, dx: px(x0) - c * 0.45, dy: py(y0) - c * 0.45, rect(width: w, height: hh, radius: 1.2mm, fill: white.transparentize(15%), stroke: 0.9pt + accent))
      let lab = text(size: 5.6pt, weight: "bold", fill: accent)[#p.ref]
      if hh > w * 1.4 {
        place(top + left, dx: px(x0) - c * 0.45, dy: py(y0) - c * 0.45, box(width: w, height: hh, align(center + horizon, rotate(-90deg, reflow: true, lab))))
      } else {
        place(top + left, dx: px(x0) - c * 0.45, dy: py(y0) - c * 0.45, box(width: w, height: hh, align(center + horizon, lab)))
      }
      for pin in p.pins {
        let first = pin.n == 1
        place(top + left, dx: px(pin.hole.at(0)) - c * 0.3, dy: py(pin.hole.at(1)) - c * 0.3, circle(radius: c * 0.3, fill: if first { rgb("#d32f2f") } else { accent }, stroke: 0.5pt + white))
        if p.pins.len() <= 4 and (pin.label.len() <= 8) {
          let left-side = pin.hole.at(0) >= 9
          let t = box(fill: white.transparentize(10%), inset: (x: 0.6mm, y: 0.2mm), radius: 0.6mm, text(size: 5pt, weight: "bold")[#pin.label])
          if left-side { place(top + left, dx: px(pin.hole.at(0)) - c * 0.45 - 12mm, dy: py(pin.hole.at(1)) - 1.2mm, box(width: 12mm, align(right, t))) }
          else { place(top + left, dx: px(pin.hole.at(0)) + c * 0.45, dy: py(pin.hole.at(1)) - 1.2mm, t) }
        }
      }
    }
    // Jumpers, then labels placed clear of every line (build-data).
    for w in g.wires {
      let col = wire-fill.at(w.colorName, default: gray)
      let a = (px(w.a.at(0)), py(w.a.at(1)))
      let b = (px(w.b.at(0)), py(w.b.at(1)))
      if w.tie {
        place(top + left, line(start: a, end: b, stroke: (paint: muted, thickness: 0.8pt, dash: "dotted")))
      } else {
        place(top + left, line(start: a, end: b, stroke: (paint: col, thickness: 1.5pt * k, cap: "round")))
      }
    }
    let lw = if prof == "desk" { 6.5mm } else { 5mm }
    let lh = if prof == "desk" { 3.2mm } else { 2.6mm }
    for w in g.wires {
      if not w.tie {
        let col = wire-fill.at(w.colorName, default: gray)
        let q = w.lab.at(prof)
        place(top + left, line(start: (px(q.at(2)), py(q.at(3))), end: (px(q.at(0)), py(q.at(1))), stroke: 0.5pt * k + col))
        place(top + left, dx: px(q.at(0)) - lw / 2, dy: py(q.at(1)) - lh / 2,
          box(width: lw, height: lh, fill: white, radius: 0.8mm, stroke: 0.6pt + col, align(center + horizon, text(size: 4.6pt * k, weight: "bold")[#w.id])))
      }
    }
  })
}

#let view-frame(title, note, body, accent) = block(width: 100%, breakable: false, below: 3mm)[
  #grid(columns: (1fr, auto), align: bottom,
    text(size: 9pt, weight: "bold")[#title], text(size: 7pt, fill: muted)[#note])
  #v(1mm)
  #block(width: 100%, stroke: 0.7pt + rule, radius: 2mm, inset: 1.2mm, clip: true, body)
]

#let schematic(id, accent) = view-frame("Schematic", "tscircuit", image("build/" + id + "-schematic.svg", width: 100%), accent)

// ---------- Lists ----------
#let parts-table(g) = {
  table(columns: (auto, 1fr, auto), stroke: (x, y) => (bottom: 0.5pt + rule), inset: (x: 1.5mm, y: 1.6mm), align: (left, left, right),
    table.header(text(size: 7pt, fill: muted, weight: "bold")[REF], text(size: 7pt, fill: muted, weight: "bold")[PART], text(size: 7pt, fill: muted, weight: "bold")[PINS]),
    ..g.parts.map(p => (
      mono(p.ref),
      [#text(size: 8.5pt)[#p.label] #if p.value != "" [ · #p.value] #if p.mpn != "" [\ #text(size: 6.8pt, fill: muted)[#p.mpn]]],
      text(weight: "bold")[#p.pins.len()],
    )).flatten())
}

#let cut-list(g) = {
  let items = g.cutlist.map(w => box(inset: (x: 2.2mm, y: 1.6mm), radius: 2mm, stroke: 0.7pt + rule, fill: soft)[
    #swatch(w.colorName) #h(0.8mm) #text(weight: "bold")[#w.qty ×] #w.cut mm])
  items.join(h(1.6mm))
}

#let wire-table(g, accent) = {
  table(columns: (auto, auto, 1fr, auto), stroke: (x, y) => (bottom: 0.5pt + rule), inset: (x: 1.4mm, y: 1.5mm), align: (left, center, left, right),
    table.header(..("ID", "", "FROM → TO", "CUT").map(t => text(size: 7pt, fill: muted, weight: "bold")[#t])),
    ..g.wires.map(w => (
      mono(w.id), swatch(w.colorName),
      [#mono(w.from) → #mono(w.to)\ #text(size: 6.8pt, fill: muted)[holes (#w.a.at(0),#w.a.at(1)) → (#w.b.at(0),#w.b.at(1))]],
      text(weight: "bold")[#w.cut mm],
    )).flatten())
}

#let rows-of(p) = {
  let xs = p.pins.map(q => q.hole.at(0)).dedup().sorted()
  xs.map(x => {
    let ys = p.pins.filter(q => q.hole.at(0) == x).map(q => q.hole.at(1)).sorted()
    [column #x, rows #ys.map(str).join(", ")]
  }).join("; ")
}

#let short-title = ("Pogo contact columns", "NODE header and wires", "ESP32 controller", "Breadboard USB switch")
#let group-head(g, idx, accent, total: 5, sub: none) = {
  banner("Group " + str(idx) + " of " + str(total), short-title.at(idx - 1), accent, sub: sub)
}


#let steps-g1(g, a) = [
#step(1, a)[*Install the pogo pins.* Put each part in from the top, pogo side up.][
  #for p in g.parts [#todo[#mono(p.ref): #rows-of(p)]]
]
#step(2, a)[*Solder the pins.* Turn the board over. Solder all #g.counts.pads pins from the bottom.][
  #todo[Each pin is straight and square to the board.]
  #todo[No solder bridge to the next column.]
]
#step(3, a)[*Cut #g.counts.bare bare straps*, each 17 mm.]
#step(4, a)[*Solder the straps.* In each column, join pin 1–2, 2–3, 3–4, 4–5, 5–6 on the bottom.][
  #for p in g.parts [#todo[Column #p.pins.first().hole.at(0): 5 straps]]
]
#step(5, a)[*Measure with the multimeter in continuity mode.* Power OFF.][
  #todo[All 6 pins in one column read below 1 Ω.]
  #todo[Pins in two different columns read open (above 10 MΩ).]
]
]

#let steps-g2(g, a) = [
#step(1, a)[*Install the J_NODE header* on the bottom side. Pin 1 at column 3, row 33.][
  #todo[Red pad is at pin 1.]
]
#step(2, a)[*Solder the #g.parts.first().pins.len() header pins* from the top side.][
  #todo[No solder bridge between pins.]
]
#step(3, a)[*Cut #g.counts.wires wires:* #cut-list(g)]
#step(4, a)[*Route and solder the wires on the bottom.* Solder only the two ends of each wire.][
  #for w in g.wires [#todo[#mono(w.id): #mono(w.from) → #mono(w.to), #swatch(w.colorName) #w.cut mm]]
]
#step(5, a)[*Put a sleeve on every crossing.* A crossing is not a connection.]
#step(6, a)[*Measure.* Power OFF.][
  #todo[Each wire reads below 1 Ω from end to end.]
  #todo[Two different wires read open.]
]
]

#let steps-g3(g, a) = [
#step(1, a)[*Install the ESP32 DevKit.*][
  #for p in g.parts.filter(p => p.ref == "U_ESP1") [#todo[#mono(p.ref): #rows-of(p)]]
]
#step(2, a)[*Install the two headers* on the top side. Red pad is at pin 1.][
  #for p in g.parts.filter(p => p.ref != "U_ESP1") [#todo[#mono(p.ref): #rows-of(p)]]
]
#step(3, a)[*Solder all #g.counts.pads pins* from the bottom.][
  #todo[No solder bridge between pins.]
]
#step(4, a)[*Cut #g.counts.wires wires* from the cut list.]
#step(5, a)[*Route and solder the wires on the bottom.* Solder only the two ends. Put a sleeve on every crossing.][
  #for w in g.wires [#todo[#mono(w.id) #swatch(w.colorName) #mono(w.from) → #mono(w.to)]]
]
#step(6, a)[*Measure.* Power OFF.][
  #todo[Each wire reads below 1 Ω from end to end.]
  #todo[GND and 3V3 read open.]
]
]

#let steps-g4(g, a) = [
#step(1, a)[*Put the parts in the holes.* Pin letters on the drawing must match.][
  #for p in g.parts [#todo[#mono(p.ref): #p.pins.map(q => bb-letter(q.hole.at(0)) + str(q.hole.at(1))).join(", ")]]
]
#step(2, a)[*Add the #g.counts.wires jumpers.* Use male jumper wire. No soldering.][
  #for w in g.wires.filter(w => not w.tie) [#todo[#mono(w.id) #swatch(w.colorName) #mono(bb-letter(w.a.at(0)) + str(w.a.at(1))) → #mono(bb-letter(w.b.at(0)) + str(w.b.at(1)))]]
]
#step(3, a)[*Check the #g.counts.ties row ties.* USB disconnected.][
  #todo[Each tie reads below 1 Ω.]
]
#step(4, a)[*Check pin 1 and polarity* of every part.]
]

#let kit-test(a) = [
#sec("Kit parts on board A1", a)
#table(columns: (auto, 1fr, auto), stroke: (x, y) => (bottom: 0.5pt + rule), inset: (x: 1.5mm, y: 1.8mm),
  table.header(..("ROW", "PART", "ON").map(t => text(size: 7pt, fill: muted, weight: "bold")[#t])),
  [1 · y 9], [Fake battery], [− C1, + C2],
  [2 · y 13], [Resistor 1 kΩ], [C2 – C3],
  [3 · y 17], [LED], [anode C3, cathode C4],
  [4 · y 21], [Kit jumper], [C4 → C1])
#v(1mm)
#text(size: 8pt, fill: muted)[C1–C4 are columns 1–4 (NODE00–NODE03).]

#sec("Steps", a)
#step(1, a)[*Link the test source to A1.* Use two flying leads from the breadboard J_OUTPUT.][
  #todo[J_OUTPUT pin 1 → A1 J_NODE pin 3 (C2, positive).]
  #todo[J_OUTPUT pin 2 → A1 J_NODE pin 1 (C1, ground).]
]
#step(2, a)[*Connect the USB prototype leads.* Four separate leads from matrix J_PROTOTYPE to breadboard J_CONTROL.][
  #todo[Pin 1 matches pin 1 on both ends.]
]
#step(3, a)[*Fit the four kit parts* on the contact rows. See the table above.][
  #todo[LED polarity is correct.]
  #todo[Measured resistor value is 1 kΩ.]
]

#sec("Checks", a)
#step(1, a)[*Identify the hardware.* Find the ESP32 DevKit pinout, USB 5V and 3V3. Measure the real pogo and adapter size before final solder.][
  #todo[Pinout matches the table.]
]
#step(2, a)[*Measure A1, unpowered.* Pins in one column: below 1 Ω. Different columns: above 10 MΩ.][
  #record("Column result", "pass / fail")
]
#step(3, a)[*Measure the prototype, A1 disconnected.* USB 5V: 5.25 V or less. 3V3: 3.20 to 3.38 V. Short-circuit current: 9.5 mA or less.][
  #record("USB 5V", "V")
  #record("3V3", "V")
  #record("Short current", "mA")
]
#callout("caution")[Short the output only for the current test. Remove the short before you fit the kit.]
#step(4, a)[*Run the firmware.* GPIO32 LOW: LED is OFF. Enable: LED is ON. Disable: LED is OFF.][
  #record("Firmware revision", "")
  #record("Voltage at C2, under load", "V")
]
#callout("note")[The test source is not regulated. Do not call it the final 5V rail.]
#step(5, a)[*Do the negative test.* Reset the ESP32. The LED must go dark. Do not touch the kit.][
  #todo[LED is dark after reset.]
]
#step(6, a)[*Film the win.* Show power OFF and the firmware revision. Show the LED switch ON and OFF. Show the real readings.][
  #todo[Record readings, units, equipment, link positions and firmware revision.]
]

#v(2mm)
#block(width: 100%, fill: a, radius: 2mm, inset: 3.5mm)[
  #grid(columns: (7mm, 1fr), gutter: 2mm, align: horizon, checkbox(size: 5.5mm),
    text(fill: white, weight: "bold", size: 11pt)[Accept CP00 — all checks pass])
]
]

#let key-content() = [
#let key-row(sym, title, body) = grid(columns: (13mm, 1fr), gutter: 2.5mm, align: horizon, sym, [#text(weight: "bold")[#title] \ #text(size: 8.5pt, fill: muted)[#body]])
#let sym-box(body) = box(width: 13mm, height: 8mm, radius: 1.5mm, fill: board-fill, stroke: 0.6pt + hole-stroke, align(center + horizon, body))

#key-row(sym-box(circle(radius: 1.6mm, fill: rgb("#d32f2f"), stroke: 0.8pt + acc.g1)), "Red pin", "Pin 1 of a part. Match it to pin 1 on the part.")
#v(2mm)
#key-row(sym-box(circle(radius: 1.6mm, fill: white, stroke: 0.9pt + acc.g1)), "Open pin", "Any other pin. Top view only.")
#v(2mm)
#key-row(sym-box(circle(radius: 1.6mm, fill: rgb("#c9ced6"), stroke: 0.7pt + ink)), "Solder pad", "Bottom view. Make a solder joint here.")
#v(2mm)
#key-row(sym-box(line(length: 9mm, stroke: (paint: wire-fill.orange, thickness: 1.1pt, cap: "round"))), "Insulated wire", "Under the board. Solder only the two ends. Put a sleeve on every crossing.")
#v(2mm)
#key-row(sym-box(line(length: 9mm, stroke: (paint: wire-fill.bare, thickness: 1.8pt, cap: "round"))), "Bare strap", "Joins the pins of one column. Touch no other column.")
#v(2mm)
#key-row(sym-box(rect(width: 9mm, height: 4mm, radius: 0.8mm, fill: acc.g1.transparentize(86%), stroke: 0.7pt + acc.g1)), "Part body", "Top view. Colored = this group. Dashed gray = built earlier.")
#v(2mm)
#key-row(box(width: 13mm, height: 8mm, radius: 1.5mm, fill: rgb("#e4e9ef"), stroke: 0.6pt + rgb("#b9c2cf"), align(center + horizon, line(length: 9mm, stroke: (paint: muted, thickness: 0.8pt, dash: "dotted")))), "Row tie", "Breadboard. The row already joins these holes. Add no jumper.")

#sec("Two views of a perfboard", ink)
Numbers on the edges are the *top* hole numbers. They are the same on both views.

- *TOP*: look at the part side.
- *BOTTOM (mirrored)*: turn the board over left-to-right. Column 1 is now on the right.

#sec("Words", ink)
#callout("warning")[A warning tells you about a risk to people or to the board. Read it first.]
#callout("caution")[A caution tells you about a risk to a part or to a measurement.]
#callout("note")[A note gives extra information.]
]
