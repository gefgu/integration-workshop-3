# Guided assembly redesign

Open the [step-by-step assembly app](tscircuit/README.md). Start with the USB LED fixture; full protected power starts at CP09 and the matrix at CP24. New builds use thirty-seven smaller milestones. Existing builds remain pinned to their earlier sequence.

# Perfboard electronics checkpoints

Build in small verified additions through CP00–CP36. Earlier permanent parts and soldered connections stay fixed; removable links, firmware and top-side kit arrangements may change.

Start with the [assembly app instructions](tscircuit/README.md), [guidelines](tscircuit/guidelines.md), [audit](tscircuit/AUDIT.md), [standards](00-standards.md) and [firmware contract](tscircuit/firmware-contract.md). The app stores independent build projects, seventeen permanent board records plus one temporary breadboard fixture, wire/component/cable progress, readings and notes in SQLite.

The first wins are a real kit LED loop, electrical rejection of a bad kit jumper without a matrix chip, a capsule greeting, and measured voltage. Later wins cover pulse, logic, memory, current, routing, both banks, Pi and NFC. Each [checkpoint](tscircuit/assembly/checkpoints.json) has a filming card and measured acceptance tests.

Use numbered TOP and MIRRORED UNDERSIDE together while soldering. Physical fit and bench acceptance remain pending. Historical snapshots and old CP filenames are superseded; use cp00.md through cp36.md. Firmware implementation and live USB integration are separate work.
