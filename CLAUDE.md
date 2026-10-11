# Project notes for Claude

## Notion workspace

Project documentation has moved to Notion. Root page: **TedTronics** —
`https://app.notion.com/p/fdd9670c116e82209954010e6b830a37` (page ID
`fdd9670c116e82209954010e6b830a37`).

This lives in a separate "Education Plus" Notion workspace, distinct from
(and not to be confused with) the old, MCP-inaccessible
`https://app.notion.com/p/TedTronics-302c1e2a65bb8267960c012bf961a52a` URL —
do not use that old URL.

Page tree under the root (Project Charter column):
- Problem And Overall Solution
- Budget
- Requirements Table (native database, ID-prefixed MFR/MNFR/EFR/ENFR/SFR/SNFR/SAR rows)
- Risk Analysis (includes 20 linked Risk Response Plan Google Docs, R01–R20)
- Tasks and Gantt Diagram (two inline databases: Project Timeline, and a milestones database; Project Timeline has 6 views — Gantt Chart, Status Board, Task List, Tasks by Deliverable, Hours per Week, Tasks by Week)
- Blog
- Guided Lessons and Challenges

Team Members column also lists each member's email.

**How to interact with it:**
- **Do not write to Notion (create/update/delete pages, database rows, or views) without the user's explicit go-ahead for that specific change.** Reading/fetching/querying is always fine. A broader request (e.g. "help me think through X") does not by itself authorize writing the result into Notion — confirm first, or wait for a follow-up that clearly asks for it.
- Use the `notion-fetch` tool with the page ID above to read current content before editing — always re-fetch immediately before building `content_updates`, since stale whitespace/text causes "no matches found" errors.
- Use `notion-update-page` with `update_content` + `content_updates` (old_str/new_str) for targeted edits, or `replace_content` for full rewrites. `replace_content`/`update_content` that would delete a child page or database requires `allow_deleting_content: true`.
- Databases (Requirements Table, Project Timeline, milestones) are edited via `notion-update-data-source` (SQL-like DDL: `ALTER COLUMN ... SET SELECT(...)`, `ADD COLUMN ...`) and queried via `notion-query-data-sources`. There is no per-row delete — only trashing a whole data source (`in_trash: true`).
- Views are created/updated with `notion-create-view` / `notion-update-view`; read `notion://docs/view-dsl-spec` for the DSL syntax before writing one.
- A newly created child page gets auto-appended at the end of its parent's content — relocating it into a specific section requires two `content_updates` in one call (remove from the end, insert at the target location).

## Course deliverable schedule (Integration Workshop 3)

This is the instructor's grading calendar — the authoritative source for due
dates and for the meaning of the Notion Project Timeline database's
`Deliverable` select field (`Deliverable 1`–`Deliverable 5` map directly to
D1–D5 below; D6 onward have no `Deliverable` tag since they're
integration/presentation milestones, not software/hardware work items).

| Week | Date | Milestone | What's due |
|---|---|---|---|
| 6 | Sep 24 | PC — Project Charter | Blog post with full project details: risk management analysis, functional/non-functional HW+SW requirements, platforms, detailed budget, detailed tasks and schedule. |
| 7 | Oct 1 | **D1** — Mechanical Design | Complete mechanical design: drawings of all parts, printed parts, and their mounting. |
| 8 | Oct 8 | **D2** — Partial Mechanical + Electronic Design | Mechanical project 50% complete. Electronic design including schematics and component testing. |
| 9 | Oct 15 | SECOMP+ | Academic week, no deliverable. |
| 11 | Oct 22 | **D3** — Full Mechanical + Partial Electronic + Software Design | Mechanical structure finished. Electronic hardware project (schematics, PCB, state machine) with functional sensor/actuator tests. Complete software **design** (firmware, database, mobile app, webserver front/back) with full UML set: use-case, sequence, activity, class, deployment, entity-relationship. |
| 12 | Oct 29 | **D4** — Full Electronic + Partial Software | Electronic development 100% ready, partially integrated with firmware/mechanics. Module tests and PoCs expected. Software/firmware development 50% complete. |
| 13 | Nov 5 | **D5** — Full Software implementation | Complete software solution fulfilling all requirements, all elements integrated. Unit tests presented; integration demo with mechanical + electronic + software subsystems operating together if possible. |
| 14 | Nov 12 | D6 — Project integration | Mechanics, hardware, and software fully integrated with a live demonstration. **Mandatory gate**: functionality must be demonstrated to be authorized for the final evaluation board. |
| 15 | Nov 19 | Preliminary presentation | Up to 25-minute presentation + 5-minute video. Bonus: talk with the expert (#2). Working demo is mandatory to proceed. |
| 16 | Nov 26 | Technical Report | Full technical report (15–20 pages, official format, sent by email) + 5-minute overview video clip. |
| 17 | Dec 3 | Final presentation | Live presentation to the examining board. Self-evaluation. |

(Week 10 has no listed deliverable in the source schedule.)

## Requirements source document

The original requirements ("TedTronics - Requirements") live in a Google Doc:
`https://docs.google.com/document/d/1yuu8VpxN86IJ-BdW3lHQQsLrY42D2UGdinciHAku7Ok/edit`

Only the content **above the "Livre" divider** is the accepted/canonical
requirements text — content below it is scratch/free space and should not be
treated as authoritative. This doc was the source used to build both
`docs/REQUIREMENTS.md` (now removed from the repo) and the Notion Requirements
Table database, organized by topic with ID prefixes (MFR/MNFR/EFR/ENFR/SFR/SNFR/SAR).

## Notion user IDs (Project Timeline `Owner` property)

The Notion user lookup only returns Gustavo, so owner IDs map to team members as follows:

| User ID prefix | Member |
|---|---|
| `3d1d872b-594c-8169-bade-0002a31f5e8b` | Gustavo (Project Manager) |
| `3d1d872b-594c-81d6-8cf0-00020e98a058` | Gabriel |
| `1cad872b-594c-817c-9b90-000282c577b5` | Julia |
| `3d1d872b-594c-813b-a3ae-0002375b7358` | João |
| `505d8936-d226-497f-b83b-099d2de8bac3` | Tainara |

Set `Owner` with `["user://<id>"]` in `notion-update-page` `update_properties`.

## Perfboard electronics guidelines

For every electronics change, read and follow [eletronics/perfboard/tscircuit/guidelines.md](eletronics/perfboard/tscircuit/guidelines.md), its audit and firmware contracts. CP00–CP36 add hardware in verified functional groups; earlier permanent wiring and placement remain fixed. Removable links and kit arrangements may change.

The latest construction target is revision6: four permanent 10×20 cm isolated-pad boards, including exactly two lower boards on a removable tray, and smart electronics on custom PCBs. Read its section of the perfboard guidelines and revision6/firmware.md. The 7×10 cm revision5 layouts remain the electrical baseline; neither candidate packing nor drawings establish measured fit.

The current independent electronics redesign is revision5. Follow the revision5 section of the perfboard guidelines and its firmware handoff. Work on the PDF/circuit export; keep legacy web-app progress pinned. Revision5 remains an engineering prototype until purchased dimensions and electrical bench tests pass.

**Connector part numbers:** never show connector, header or pogo-pin MPNs (e.g. Mill-Max `0906-0-15-20-76-14-11-0`, `61201021621`, `TSW-105-07-G-S`) on any tscircuit schematic — the purchased parts are not identified yet, and the number reads as a claim about the part. The MPN must stay in the circuit data (tscircuit checks fail without one), so `eletronics/perfboard/tscircuit/scripts/strip-connector-mpns.mjs` removes the drawn text from `dist/boards/*/schematic.svg`, `local.json` and `assembly/*-schematic.svg`; it runs from `npm run build` and `build:local`. Keep that hook and regenerate the schematics after any change. MPNs may stay in BOM/catalog data, flagged as unverified.
