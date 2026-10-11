// CP00 — First light: PHONE field guide (portrait, one tall page per group).
// Build:  node scripts/build-data.mjs && typst compile cp00.typ cp00-field-guide.pdf
#import "lib.typ": *
#let data = json("build/cp00.json")
#let G = data.groups

#set page(width: 92mm, height: auto, margin: (x: 5mm, y: 6mm), fill: white)
#set text(font: "DejaVu Sans", size: 9.5pt, lang: "en", fill: ink)
#set par(leading: 0.55em, spacing: 1.1em)
#show raw: set text(font: "DejaVu Sans Mono")

// =====================================================================
// PAGE 1 — Start here
// =====================================================================
#let tot-wires = G.map(g => g.counts.wires).sum()
#let tot-ins = G.map(g => g.counts.insulated).sum()
#let tot-bare = G.map(g => g.counts.bare).sum()
#let tot-pads = G.map(g => g.counts.pads).sum()
#let tot-mm = G.filter(g => g.kind == "perf").map(g => g.counts.wireMm).sum()
#let jumpers = G.at(3).counts.wires

#banner("TedTronics · Perfboard fallback", "CP00 — First light", acc.g5, sub: "Win: the ESP32 switches the real four-column LED loop.")

#stats(acc.g5, (str(tot-pads), "solder points"), (str(tot-ins + tot-bare), "wires to solder"), (str(calc.round(tot-mm / 1000, digits: 1)) + " m", "wire to cut"))
#v(2mm)
#stats(acc.g5, (str(jumpers), "jumpers"), ("24", "AWG wire"), ("5", "groups"))

#callout("warning")[Disconnect USB and all power sources before you build. Do not connect the final supply or the matrix in CP00.]

#sec("Build order", acc.g5)
#for (i, g) in G.enumerate() {
  let a = acc.at("g" + str(i + 1))
  block(width: 100%, stroke: 0.7pt + rule, radius: 2mm, inset: 2.6mm, below: 2mm)[
    #grid(columns: (7mm, 1fr, auto), gutter: 2mm, align: horizon,
      box(width: 6.2mm, height: 6.2mm, radius: 50%, fill: a, align(center + horizon, text(fill: white, weight: "bold")[#(i + 1)])),
      [#text(weight: "bold")[#short-title.at(i)] \ #text(size: 7.5pt, fill: muted)[#if g.kind == "breadboard" [#g.counts.parts parts · #g.counts.wires jumpers] else [#g.counts.parts parts · #g.counts.wires wires · #g.counts.pads solder points]]],
      text(size: 7pt, fill: muted)[p.#(i + 3)])
  ]
}
#block(width: 100%, stroke: 0.7pt + rule, radius: 2mm, inset: 2.6mm, below: 2mm)[
  #grid(columns: (7mm, 1fr, auto), gutter: 2mm, align: horizon,
    box(width: 6.2mm, height: 6.2mm, radius: 50%, fill: acc.g5, align(center + horizon, text(fill: white, weight: "bold")[5])),
    [#text(weight: "bold")[Fit the kit and test] \ #text(size: 7.5pt, fill: muted)[4 kit parts · 6 checks · film]],
    text(size: 7pt, fill: muted)[p.7])
]

#sec("Tools", acc.g5)
#grid(columns: (1fr, 1fr), gutter: 1.5mm,
  todo[Soldering iron and solder], todo[Wire cutter],
  todo[Wire stripper], todo[Multimeter],
  todo[USB cable], todo[Sleeves for wire crossings])

#sec("Wire", acc.g5)
- Insulated 24 AWG, all hook-up wires. Run them under the board.
- Bare wire for the 20 node straps#super[\*].
- Use the wire colors on the cut lists.
#text(size: 7.5pt, fill: muted)[\* The guidelines give a size only for insulated wire. Use 24 AWG bare wire and confirm.]

// =====================================================================
// PAGE 2 — Key
// =====================================================================
#pagebreak()
#banner("Read this once", "Key", ink, sub: "Symbols used on every page.")

#key-content()

// =====================================================================
// GROUP 1 — Pogo columns
// =====================================================================
#pagebreak()
#let g = G.at(0)
#let a = acc.g1
#group-head(g, 1, a, sub: "Board A1 · four columns of six contacts")
#stats(a, (str(g.counts.parts), "pogo parts"), (str(g.counts.pads), "solder points"), (str(g.counts.bare), "bare straps"))

#callout("note")[All four columns stay electrically separate. Each column is one node.]

#sec("Parts", a)
#parts-table(g)
#sec("Cut list", a)
#cut-list(g)
#v(1mm)
#text(size: 7.5pt, fill: muted)[Bare wire, 24 AWG. 4 pad gaps (10.2 mm) plus 6 mm for the ends.]

#sec("Views", a)
#view-frame("TOP", "pogo side", perf-view(g, "top", a), a)
#view-frame("BOTTOM", "mirrored", perf-view(g, "bottom", a), a)
#schematic("g1", a)

#sec("Steps", a)
#steps-g1(g, a)

// =====================================================================
// GROUP 2 — NODE header
// =====================================================================
#pagebreak()
#let g = G.at(1)
#let a = acc.g2
#group-head(g, 2, a, sub: "Board A1 · header and four blue wires")
#stats(a, (str(g.counts.pins), "header pins"), (str(g.counts.wires), "wires"), (str(g.counts.pads), "solder points"))

#callout("caution")[Mount the header on the *bottom* side. Pin 1 is at column 3, row 33.]

#sec("Parts", a)
#parts-table(g)
#sec("Cut list", a)
#cut-list(g)
#v(1mm)
#text(size: 7.5pt, fill: muted)[Insulated 24 AWG. Routed length plus 10 mm for the ends.]

#sec("Views", a)
#view-frame("TOP", "context", perf-view(g, "top", a), a)
#view-frame("BOTTOM", "mirrored", perf-view(g, "bottom", a), a)
#schematic("g2", a)

#sec("Wires", a)
#wire-table(g, a)

#sec("Steps", a)
#steps-g2(g, a)

// =====================================================================
// GROUP 3 — ESP32 controller
// =====================================================================
#pagebreak()
#let g = G.at(2)
#let a = acc.g3
#group-head(g, 3, a, sub: "Matrix board · ESP32 and two headers")
#stats(a, (str(g.counts.pads), "solder points"), (str(g.counts.wires), "wires"), (str(calc.round(g.counts.wireMm / 1000, digits: 2)) + " m", "wire"))

#callout("warning")[Disconnect USB before you solder or measure.]
#callout("caution")[Check your ESP32 DevKit pinout before you solder. Pin labels must match the table. Measure the real board first.]

#sec("Parts", a)
#parts-table(g)
#sec("Cut list", a)
#cut-list(g)
#v(1mm)
#text(size: 7.5pt, fill: muted)[Insulated 24 AWG. Routed length plus 10 mm for the ends.]

#sec("Views", a)
#view-frame("TOP", "part side", perf-view(g, "top", a), a)
#view-frame("BOTTOM", "mirrored", perf-view(g, "bottom", a), a)
#schematic("g3", a)

#sec("Wires", a)
#wire-table(g, a)

#sec("Steps", a)
#steps-g3(g, a)

// =====================================================================
// GROUP 4 — Breadboard switch
// =====================================================================
#pagebreak()
#let g = G.at(3)
#let a = acc.g4
#group-head(g, 4, a, sub: "Breadboard · default-OFF USB switch")
#stats(a, (str(g.counts.parts), "parts"), (str(g.counts.wires), "jumpers"), ("0", "solder points"))

#callout("warning")[Keep the USB cable disconnected. Put in all parts first.]
#callout("caution")[Q_PASS and Q_ENABLE have three pins in a fixed order. Read the pin letters on the drawing.]

#sec("Parts", a)
#parts-table(g)

#sec("Top view", a)
#view-frame("BREADBOARD", "rows a–e and f–j are joined", bb-view(g, a), a)
#schematic("g4", a)

#sec("Jumpers", a)
#table(columns: (auto, auto, 1fr), stroke: (x, y) => (bottom: 0.5pt + rule), inset: (x: 1.4mm, y: 1.5mm),
  table.header(..("ID", "", "FROM → TO (HOLES)").map(t => text(size: 7pt, fill: muted, weight: "bold")[#t])),
  ..g.wires.filter(w => not w.tie).map(w => (mono(w.id), swatch(w.colorName),
    [#mono(bb-letter(w.a.at(0)) + str(w.a.at(1))) → #mono(bb-letter(w.b.at(0)) + str(w.b.at(1))) \ #text(size: 6.8pt, fill: muted)[#w.net]])).flatten())
#v(1mm)
#text(size: 8pt, fill: muted)[No jumper for #g.counts.ties row ties. The breadboard rows already join them.]

#sec("Steps", a)
#steps-g4(g, a)

// =====================================================================
// GROUP 5 — Kit and test
// =====================================================================
#pagebreak()
#let a = acc.g5
#banner("Group 5 of 5", "Fit the kit and test", a, sub: "No soldering · record every reading")
#stats(a, ("4", "kit parts"), ("6", "checks"), ("1", "film"))

#callout("warning")[Do not use a GPIO pin as a battery. The kit source is the 560 Ω limited USB test source.]
#callout("note")[The firmware is not in this guide. You need the compatible factory firmware revision for check 5.]

#kit-test(a)
