// CP00 — First light: DESKTOP field guide (landscape 16:9 pages, for a computer screen).
// Build:  node scripts/build-data.mjs && typst compile cp00-desktop.typ cp00-field-guide-desktop.pdf
#import "lib.typ": *
#let data = json("build/cp00.json")
#let G = data.groups

#set page(width: 320mm, height: 180mm, margin: (x: 10mm, top: 8mm, bottom: 12mm), fill: white,
  footer: context [
    #set text(size: 7.5pt, fill: muted)
    CP00 · First light · TedTronics perfboard fallback #h(1fr) #counter(page).display()
  ])
#set text(font: "DejaVu Sans", size: 10.5pt, lang: "en", fill: ink)
#set par(leading: 0.55em, spacing: 1em)
#show raw: set text(font: "DejaVu Sans Mono")

#let tot-wires = G.map(g => g.counts.wires).sum()
#let tot-pads = G.map(g => g.counts.pads).sum()
#let tot-mm = G.filter(g => g.kind == "perf").map(g => g.counts.wireMm).sum()
#let accent-of(i) = acc.at("g" + str(i + 1))

// ---------- Desktop-only pieces ----------
#let strip(n, title, accent, ..tiles) = block(width: 100%, fill: accent, radius: 3mm, inset: (x: 5mm, y: 3.4mm), below: 3mm)[
  #grid(columns: (1fr, auto), align: horizon, gutter: 6mm,
    [#text(fill: white.transparentize(15%), size: 7.5pt, weight: "bold", tracking: 0.1em)[#upper(n)] \ #text(fill: white, size: 18pt, weight: "bold")[#title]],
    grid(columns: tiles.pos().len() * (24mm,), gutter: 2mm, ..tiles.pos().map(t => block(fill: white.transparentize(8%), radius: 1.8mm, inset: (x: 1.5mm, y: 1.8mm), width: 100%)[
      #align(center)[#text(size: 15pt, weight: "bold", fill: accent)[#t.at(0)] \ #text(size: 6.3pt, weight: "bold", fill: muted)[#upper(t.at(1))]]])))
]

#let pin-map(p, g) = {
  let ends = g.wires.map(w => w.a) + g.wires.map(w => w.b)
  let pins = if p.pins.len() > 12 { p.pins.filter(q => ends.contains(q.hole)) } else { p.pins }
  let hole(q) = if g.kind == "breadboard" { bb-letter(q.hole.at(0)) + str(q.hole.at(1)) } else { [col #q.hole.at(0), row #q.hole.at(1)] }
  block(breakable: false, below: 3mm)[
    #text(size: 8.5pt, weight: "bold")[#mono(p.ref) pin map] #if p.pins.len() > 12 [#text(size: 8pt, fill: muted)[ · wired pins only (#pins.len() of #p.pins.len())]]
    #v(0.8mm)
    #table(columns: (auto, 1fr, auto), stroke: (x, y) => (bottom: 0.4pt + rule), inset: (x: 1.4mm, y: 1mm),
      ..pins.map(q => (text(size: 8.5pt, weight: "bold")[#q.n], text(size: 8.5pt)[#q.label], text(size: 8pt, fill: muted)[#hole(q)])).flatten())
  ]
}

#let parts-detail(g) = {
  // One row per distinct component type; identical parts share a row.
  let rows = ()
  for p in g.parts {
    let key = p.type + "|" + p.detail + "|" + p.mpn + "|" + p.value
    let idx = rows.position(r => r.key == key)
    if idx == none { rows.push((key: key, parts: (p,))) } else { rows.at(idx).parts.push(p) }
  }
  table(columns: (auto, 1.1fr, 2fr, auto), stroke: (x, y) => (bottom: 0.5pt + rule), inset: (x: 1.8mm, y: 2mm), align: (left, left, left, right),
    table.header(..("REF", "COMPONENT TYPE", "DETAIL", "PINS").map(t => text(size: 7pt, fill: muted, weight: "bold")[#t])),
    ..rows.map(r => {
      let p = r.parts.first()
      (
        stack(spacing: 1mm, ..r.parts.map(q => mono(q.ref))),
        [#text(weight: "bold", size: 9.5pt)[#p.type] #if p.value != "" [\ #text(size: 8.5pt)[#p.value]]],
        [#text(size: 8.5pt)[#p.detail] #if p.mpn != "" [\ #text(size: 7.5pt, fill: muted)[#p.mpn]]],
        text(weight: "bold")[#if r.parts.len() > 1 [#r.parts.len() × #p.pins.len()] else [#p.pins.len()]],
      )
    }).flatten())
}

#let wire-table-desk(g) = table(columns: (auto, auto, 1fr, auto), stroke: (x, y) => (bottom: 0.5pt + rule), inset: (x: 1.6mm, y: 1.5mm), align: (left, center, left, right),
  table.header(..("ID", "", "FROM → TO", "CUT").map(t => text(size: 7pt, fill: muted, weight: "bold")[#t])),
  ..g.wires.filter(w => not w.tie).map(w => (
    mono(w.id), swatch(w.colorName),
    [#mono(w.from) → #mono(w.to) #text(size: 7.5pt, fill: muted)[ · #if g.kind == "breadboard" [#bb-letter(w.a.at(0))#w.a.at(1) → #bb-letter(w.b.at(0))#w.b.at(1)] else [(#w.a.at(0),#w.a.at(1)) → (#w.b.at(0),#w.b.at(1))]]],
    if g.kind == "breadboard" { [] } else { text(weight: "bold")[#w.cut mm] },
  )).flatten())

// =====================================================================
// COVER
// =====================================================================
#let tot-ins = G.map(g => g.counts.insulated).sum()
#let tot-bare = G.map(g => g.counts.bare).sum()
#scale(88%, origin: top + left, reflow: true, block(width: 113.7%, grid(columns: (1.1fr, 1fr, 1fr), gutter: 9mm,
  [
    #banner("TedTronics · Perfboard fallback", "CP00 — First light", acc.g5, sub: "Win: the ESP32 switches the real four-column LED loop.")
    #stats(acc.g5, (str(tot-pads), "solder points"), (str(tot-ins + tot-bare), "wires to solder"), (str(calc.round(tot-mm / 1000, digits: 1)) + " m", "wire to cut"))
    #v(2mm)
    #stats(acc.g5, (str(G.at(3).counts.wires), "jumpers"), ("24", "AWG wire"), ("5", "groups"))
    #callout("warning")[Disconnect USB and all power sources before you build. Do not connect the final supply or the matrix in CP00.]
    #sec("Tools", acc.g5)
    #grid(columns: (1fr, 1fr), gutter: 1.5mm, row-gutter: 2mm,
      todo[Soldering iron and solder], todo[Wire cutter],
      todo[Wire stripper], todo[Multimeter],
      todo[USB cable], todo[Sleeves for wire crossings])
    #sec("Wire", acc.g5)
    - Insulated 24 AWG for all hook-up wires. Run them under the board.
    - Bare wire for the 20 node straps#super[\*].
    #text(size: 8pt, fill: muted)[\* The guidelines give a size only for insulated wire. Use 24 AWG bare wire and confirm.]
  ],
  [
    #sec("Build order", acc.g5)
    #for (i, g) in G.enumerate() {
      let a = accent-of(i)
      block(width: 100%, stroke: 0.7pt + rule, radius: 2mm, inset: 2.8mm, below: 2mm)[
        #grid(columns: (7mm, 1fr), gutter: 2.5mm, align: horizon,
          box(width: 6.4mm, height: 6.4mm, radius: 50%, fill: a, align(center + horizon, text(fill: white, weight: "bold")[#(i + 1)])),
          [#text(weight: "bold")[#short-title.at(i)] \ #text(size: 8.5pt, fill: muted)[#if g.kind == "breadboard" [#g.counts.parts parts · #g.counts.wires jumpers · no soldering] else [#g.counts.parts parts · #g.counts.wires wires · #g.counts.pads solder points]]])
      ]
    }
    #block(width: 100%, stroke: 0.7pt + rule, radius: 2mm, inset: 2.8mm, below: 2mm)[
      #grid(columns: (7mm, 1fr), gutter: 2.5mm, align: horizon,
        box(width: 6.4mm, height: 6.4mm, radius: 50%, fill: acc.g5, align(center + horizon, text(fill: white, weight: "bold")[5])),
        [#text(weight: "bold")[Fit the kit and test] \ #text(size: 8.5pt, fill: muted)[4 kit parts · 6 checks · film]])
    ]
    #text(size: 8.5pt, fill: muted)[Each group has three pages: views, full schematic, then parts and steps.]
  ],
  [
    #sec("Key", ink)
    #key-content()
  ])))

// =====================================================================
// GROUPS 1–4
// =====================================================================
#for (i, g) in G.enumerate() {
  let a = accent-of(i)
  let n = i + 1
  let stats-tiles = if g.kind == "breadboard" {
    ((str(g.counts.parts), "parts"), (str(g.counts.wires), "jumpers"), ("0", "solder points"))
  } else {
    ((str(g.counts.parts), "parts"), (str(g.counts.wires), "wires"), (str(g.counts.pads), "solder points"), (str(calc.round(g.counts.wireMm / 1000, digits: 2)) + " m", "wire"))
  }
  let page-strip(sub) = strip("Group " + str(n) + " of 5 · " + sub, short-title.at(i), a, ..stats-tiles)

  // ---- A. Views
  pagebreak()
  page-strip("Views")
  if g.kind == "perf" {
    grid(columns: (1fr, 1fr), gutter: 6mm,
      view-frame("TOP", "part side · red pin = pin 1", align(center, perf-view(g, "top", a, width: 143mm, maxh: 118mm, prof: "desk", k: 1.35)), a),
      view-frame("BOTTOM", "mirrored · solder side · wire labels beside each wire", align(center, perf-view(g, "bottom", a, width: 143mm, maxh: 118mm, prof: "desk", k: 1.35)), a))
  } else {
    grid(columns: (122mm, 1fr), gutter: 8mm,
      view-frame("BREADBOARD", "rows a–e and f–j are joined", bb-view(g, a, width: 110mm, maxh: 118mm, prof: "desk", k: 1.3), a),
      [
        #sec("Jumpers", a)
        #wire-table-desk(g)
        #v(1mm)
        #text(size: 9pt, fill: muted)[No jumper for #g.counts.ties row ties. The breadboard rows already join those holes.]
        #callout("caution")[Q_PASS and Q_ENABLE have three pins in a fixed order. Read the pin letters on the drawing.]
      ])
  }

  // ---- B. Full schematic
  pagebreak()
  page-strip("Schematic")
  align(center, image("build/g" + str(n) + "-schematic.svg", width: 100%, height: 128mm, fit: "contain"))

  // ---- C. Parts and steps
  pagebreak()
  page-strip("Parts and steps")
  columns(2, gutter: 9mm, {
    sec("Components", a)
    parts-detail(g)
    v(2mm)
    for p in g.parts.filter(p => not p.ref.starts-with("J_NODE0") and p.pins.len() > 1 and (p.kind == "header" or p.ref == "U_ESP1")) { pin-map(p, g) }
    if g.kind == "perf" {
      sec("Cut list", a)
      cut-list(g)
      v(1mm)
      text(size: 8.5pt, fill: muted)[#if g.counts.bare > 0 [Bare wire, 24 AWG. 4 pad gaps (10.2 mm) plus 6 mm for the ends.] else [Insulated 24 AWG. Routed length plus 10 mm for the ends.]]
    }
    if g.counts.bare == 0 { sec("Wires", a); wire-table-desk(g) }
    sec("Steps", a)
    if n == 1 { steps-g1(g, a) } else if n == 2 { steps-g2(g, a) } else if n == 3 { steps-g3(g, a) } else { steps-g4(g, a) }
  })
}

// =====================================================================
// GROUP 5
// =====================================================================
#pagebreak()
#{
  let a = acc.g5
  strip("Group 5 of 5", "Fit the kit and test", a, ("4", "kit parts"), ("6", "checks"), ("1", "film"))
  columns(2, gutter: 9mm, kit-test(a))
}
