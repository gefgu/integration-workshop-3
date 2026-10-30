# Critic review record

## Which models reviewed

GPT-6.1 Sol was **not available** in this environment (the agent tool offers only Claude models). The two critics were
therefore **separate Claude Opus 5.5 subagents** (`claude-opus-5-5`), one per perspective, run with the prompts in
`teacher-critic.md` and `student-critic.md` (shared setup: `_common-environment.md`). No claim is made that the
requested model was used.

## Round 1 (the only round)

Both critics drove the real app in headless Chrome (`graph_validator/tools/cdp.py`, `lab_driver.py`) against an isolated
SQLite copy of the curriculum. The computer was suspended mid-review, which stopped both. Their reports were recovered by
resuming each agent and asking it to write down what it had already verified:

* `reviews/round1-teacher.md`: 21 confirmed findings (9 major, 11 minor, 1 note), 4 suspicions; interrupted in Modules.
* `reviews/round1-student.md`: 21 confirmed findings (7 major, 11 minor, 3 note), 6 suspicions; all 22 lessons opened,
  most end-to-end runs not finished.

Both reports are partial. Screenshots were lost with the scratchpad; the evidence kept is on-screen text and API output.

## Fixed after round 1 (code, then TS 91 tests, validator 93 tests, typecheck all passing)

| Finding | Fix |
|---|---|
| T-01, T-02 stale / wrong jumper step text | `stepText` names jumpers like the tray; `refreshGeneratedText` regenerates generated text when the bound piece changes (custom text untouched) |
| T-03, T-21 question numbering | Question blocks are numbered over the whole lesson, matching the save error |
| T-04 unsaved edits | "Alterações ainda não salvas" note in the editor, a banner in the test player, and a `beforeunload` guard |
| T-05 hidden question editor | The step-questions section opens while a step question is selected or empty, and says what it holds |
| T-06, T-18 duplicates | Copies drop the `exemplo`/`currículo` tags and get new question ids; editing an example shows a "use Duplicar" note |
| T-07 no starting point | Own lessons first, then the curriculum in teaching order (guided before challenge), plus a "Comece por aqui" hint |
| T-08 developer jargon in teacher notes | All 22 notes rewritten in teacher language; provenance stays in `curriculum-notes.md` |
| T-09 bench delivery wording | Says the site does not reach the bench; delivery is by the teacher app over Bluetooth |
| T-16, T-20 | No doubled "(guiada)"; singular/plural counts |
| S-01 LED with no resistor looked fine | Status says "(limitada pela bancada)" and shows a warning instead of a calm check mark |
| S-02 four different mA values | The L3 question uses "perto de 6 mA" |
| S-03 "Monte o circuito" on pre-built challenges | Pre-built challenges say "Encontre o que está errado…" |
| S-04 stuck with no hint | Consecutive misses of any kind now count toward `hintAfter` |
| S-05 empty "Muito bem!" steps | The untouched final check says the whole circuit was verified |
| S-06 LED arrow after rotating | The arrow flips with the LED; the cathode bar is dark and thicker |
| S-07, S-08 colour-code value shown | In the challenge the piece and tray show "? Ω" |
| S-10 value over bands | Value on a dark chip; first band wider |
| S-11 column numbers hidden | Numbers drawn above bank A and below bank B |
| S-12 L1 diagram | Redrawn as 11 columns × (6 + 6) |
| S-13, S-16 slots and units | The help panel explains E1–E6, V, Ω and µF |
| S-14 loose contact with a check mark | No check mark while a part is loose |
| S-17 capacitor polarity | The step warns that the capacitor has a side (reverse is not simulated) |
| S-20 | Bench URL with `?servico=` documented in `_common-environment.md` |

## Not re-reviewed, and still open

No re-review round was run (stopped at the user's request, low usage). The fixes above were checked only by tests,
typecheck and lint, not by a critic. Open items:

* S-09 (a pink marker over the third band of the colour-code piece): not reproduced or changed.
* S-15 (capacitor fade lasts 1.7 s, no replay), S-18 (guided L2/L4/L5/L7 ask after the experiment instead of a
  prediction first), S-21 (no L10 challenge, by design), P-01…P-06 (L10 return wiring and the "tutor speaks after two
  errors" text, L4 polarity hint, L8 challenge question, L9 alarm, pot −/+ direction).
* T-10 and T-11 (tag chips and type filters), T-12 (L10 title), T-13, T-14, T-15 (alert on bad SVG), T-17 (time-out
  skips the explanation), T-19, S-1…S-4 (editor accepts an open circuit; wording of the bonus note).
* Teacher review never reached Modules reordering/assignment, Turmas, Alunos, Painel, export/import.
* Sound cannot be judged in headless Chrome. Tablet and small-screen layout were not checked.
* Lint: one pre-existing error remains in `src/bench/BenchApp.tsx` (not touched).
