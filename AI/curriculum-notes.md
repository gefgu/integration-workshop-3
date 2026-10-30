# Curriculum build notes (provenance, decisions, limitations)

Source: Notion “Guided Lessons and Challenges” (read directly, not written to). Lessons 1–10,
with the guided and challenge versions the page specifies: **20 lessons** in 5 modules
(`teacher_authoring_app/src/curriculum/`). Audience: Fundamental II, Brazilian Portuguese.

## What was AI-assisted, and how

* The explanations, questions with per-answer feedback and the 12 illustrations were **drafted by Claude (Sonnet 5.5)
  during development** and stored inside each lesson (`explain` steps, inline SVG), so they work offline on the bench.
  **No AI runs while a student plays**; the “tutor” is the mascot plus stored text.
* Illustrations are generated from code (`art.ts`) so values are never hard-coded: the resistor bands are computed
  from the resistance (`ohmsBands`). They are teaching sketches, not engineering drawings.
* Lessons are fixed content, not generated per student. Each lesson's `teacherNotes` says what it teaches, how success is
  judged, what is simulated and where it departs from Notion.

## Schematics referenced by Notion

`docs/modules_plan/images/esquematico_modulo_*.png` are missing from the checkout, but all 11 images and the old
`modules.md` exist in git history (deleted in commit `901fc53`; present in its parent). They were recovered, read, and
the circuits rebuilt for the **5 V** bench (the drawings say 9 V). `curriculum/circuits.ts` documents each layout.
Nothing was re-added to `docs/` (the repo removed them on purpose).

## Departures from the Notion text (all also stated in each lesson's teacher notes)

| Lesson | Notion says | What is implemented | Why |
|---|---|---|---|
| 3 | components: battery, 470 Ω, LED, 2 jumpers; display shows mA | adds the **ammeter capsule** (slot E2) and a third jumper | the success criterion needs the mA display; the capsule is the only mA display |
| 3 challenge | two resistors, e.g. 220 Ω and 1 kΩ | 220 Ω vs 1 kΩ, swapped with buttons in the experiment | matches the kit (220/470/1k) |
| 7 | capacitor drawn in parallel with the LED | capacitor across the supply columns, empties through R+LED (τ≈0.5 s) | as drawn it would only flash for milliseconds; the lesson describes a visible fade |
| 7 challenge | two capacitors of different values | 1 × 1000 µF vs 2 in parallel (2000 µF) | the kit has only 1000 µF parts (max 2) |
| 8 challenge | two **recorded** audio clips | two **synthesized** clips (A = 1 kΩ, B = 220 Ω) | no recordings exist; the buzzer was never measured |
| 9 | “real” alarm, jumper half-inserted | simulated: loose part tilted + “solto” badge + flicker; simulated cut-out | hardware cannot safely demonstrate a short |
| 2 | LED without resistor “as a teaching simplification” | `allowNoResistor`: current capped at the bench's 15 mA ceiling | the 5 V model would otherwise report “sem resistor” |

## Simulation vs measurement (kept visible to students and teachers)

Simulated by software: LED current/brightness (5 V − 2 V LED drop, 15 mA ceiling), buzzer volume and pitch (didactic
model, 450 Hz + 60 Hz/mA), capacitor discharge (exponential, τ = R·C), the bench status LED, the loose-contact flicker,
the short-circuit cut-out, the ammeter/voltmeter screens, and the resistor-band drawings (computed from the value).
**Not done:** no camera detection, no bench hardware, no measured timings or sound. Buzzer pitch behaviour on the real
buzzer is **unverified**; the lessons say so.

## Pre-existing defects found and fixed while importing

1. **Validator/app disagreement on the potentiometer.** The app places it across 2 columns (since 2026-10-07); the
   Python validator required 1, so any lesson with a potentiometer was rejected as an *invalid board*. Fixed in
   `catalog.py` (+ regression test).
2. **A jumper across the battery's own two columns** was reported as a duplicated pair, not a short. Now `curto`
   (lesson 9 asks the student to do exactly this). `tests/model.test.ts` was updated.
3. **Parallel branches:** the simulator lit only one branch; the alarm (lesson 10) needs LED and buzzer together.
4. The lesson API silently dropped unknown lesson fields; v4 fields now persist.

## Known limits

* The full 20-lesson module is ~140 KB (933 BLE frames of 150 characters); each thematic module is 22–43 KB. Real-BLE
  transfer time was **not measured** (the test used the WebSocket simulator of the same protocol).
* TTS audio was not generated for the seeded lessons (TTS off): the tutor voice needs a re-save on a machine with the voice.
* Two buttons can't be pressed at once with a mouse; the lab offers “Botão A/B” latch controls.
* Sound is synthesized; it cannot be judged in headless Chrome (reviewed by labels/controls only).

## Removed: the color-coded resistor (2026-10-30)

The color-code resistor capsule (EFR12) and the Notion resistor-color bonus lesson were removed from the software at
the user's request. The 22-lesson curriculum became **20 lessons**; the seed deletes the retired
`curriculo-bonus-*` lessons and the old "Trilha 2 — Código de cores…" module (`RETIRED_LESSON_IDS`,
`RETIRED_MODULE_TITLES`). Earlier critic reports under `AI/reviews/` and `review-record.md` describe the bonus lesson
as it was reviewed; those findings no longer apply to it.
