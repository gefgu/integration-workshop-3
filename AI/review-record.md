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

## Round 2 — fixes and verification (2026-10-31)

This section supersedes the incomplete implementation note and the earlier “still open” list for the findings below. The fixes have **not been re-reviewed by critics**. These are software simulation checks, not measured hardware or camera evidence. No shared database seed, commit, push or Notion write was performed. Existing unrelated worktree changes were preserved.

### Student findings

| Finding | Status | Change and evidence |
|---|---|---|
| N-01 | Fixed | Guided jumper placement now checks cumulative electrical connectivity, rather than inventory alone. `graph_validator/tests/test_steps.py::test_n01_disconnected_jumper_is_not_praised` failed before the validator change and passes afterwards. Component placement still checks inventory; wire steps check the requested nets. Powered final checks show the simulator diagnosis when a matching circuit does not operate. |
| N-02, N-07, T2-08 | Fixed | Prediction quizzes accept every choice with neutral feedback, preserve the hypothesis into the experiment and compare it with a result summary after the missions. L2/L4 build checks no longer require energizing before their prediction. Following mission wording is neutral. Import/export preserves the optional v4 prediction field. `tests/round2.test.ts` checks all required lessons; `AI/round2-browser.py` verifies wrong L2/L4 hypotheses continue and L2 reaches prediction before its first required power-on. |
| N-03 | Fixed | L2 mission no longer promises a check mark; limited-current feedback is orange/neutral in build and experiment screens. Chrome verifies the simulator-limit label. |
| N-04 | Fixed | Duplicate-pair detection ignores components disconnected from both battery terminals. `tests/model.test.ts` regression failed before the fix and passes with two isolated parallel jumpers. Existing battery-short tests pass. No measured hardware claim or full browser reproduction is made for this unit-tested simulator defect. |
| N-05 | Fixed | L2 challenge ends with a question about the missing jumper and the open current path; curriculum structure/round-trip tests pass. |
| N-06 | Fixed | Each jumper tray card explicitly shows its end-to-end reach in columns, computed from its span. Legacy piece names are preserved for saved lessons and generated instructions. Potentiometer tray also shows 100 Ω–10 kΩ and seven −/+ values. Source checked; no hardware dimensions inferred. |
| N-08 | Fixed | Removed the claim that reversing an LED protects it; the explanation says it blocks current and stays dark. Source checked. |
| N-09 | Fixed | Debug net lists deduplicate identical net descriptions before using them as React keys. Source checked; browser checks report no console errors. |
| N-10 | Fixed | Found the missing-slider cause: dragged pieces receive IDs different from the answer key. The slider now falls back to the student's potentiometer by type. Text distinguishes seven −/+ values from slider intermediates; the honest discrete-control observation is accepted. Buttons are 32×32 px. Unit round-trip checks and a Chrome fixture with renamed piece IDs verify this. Applies to L6 and L8 potentiometer lessons. |
| N-11 | Fixed | Current-limit warning says resistance is absent or too small, explicitly calls 15 mA a simulator limit, and does not claim physical protection. Source checked and L2 browser limit check passes. |
| N-12 | Fixed | Clip answers are only A/B; clip order is randomized per play and answer keys/feedback follow the order. A second question asks how the student compared. `AI/round2-audio-browser.py` verifies both forced random orders and the follow-up question. |
| N-13 | Fixed | Live buzzer and played clips show simulated volume and pitch in Hz; text says physical buzzer behavior is unmeasured. Chrome verifies clip visual cues. Audible sound quality and physical sound remain unverified. |
| N-14 | Fixed | Diagnosis retains LED and buzzer branch currents. Alarm readout shows LED ≈6.4 mA, buzzer ≈10.6 mA and battery total ≈17.0 mA. LED brightness and buzzer synthesis use their own branch current. `tests/round2.test.ts` reproduces/checks the branch-current defect with the L10 target. |
| N-15 | Fixed | Removed the minimal-help promise; defined the common return as the LED cathode's column and named it in both relevant wire instructions. Hints now respond after consecutive wrong attempts. Source and hint regression checks. |
| N-16, S-03 | Fixed | L1 challenge tells the student to seat the battery with poles in separate columns, observe the simulated status LED and answer a node question. Fault challenges retain fault-finding prompts. Curriculum tests pass. |
| N-17, S-05 | Fixed | Untouched final checks say the stage is checked and ask the student to observe the assembly; they do not claim a complete operating circuit when only a battery is present. Source checked. The explicit review step is retained to preserve v4 validator step indexing. |
| N-18 / timed challenge | Fixed | Large bordered timer appears above the board. Both preview and bench mode offer Continue after timeout to reach the explanation/question, with zero-score expiry preserved. Message never points to the teacher-only restart control. Chrome bench-mode timeout check passes. |
| S-02 | Fixed | Ammeter and status use one decimal place (6.3 mA). L3 explains 6.25→6.3 rounding and the simulated 10 Ω ammeter resistance, versus ≈6.4 mA without it. Capsule, curriculum and model tests pass. |
| S-04 | Fixed | Attempts count board changes and explicit power-on attempts, not initial validation responses. Hints use the validator message even when its same-graph hint is suppressed, then escalate. Unit checks plus Chrome verify L2/L4 preview and bench player mode: first miss withholds the hint, second reveals it, third/fourth give progressively more direct guidance. |
| S-01, S-06 | Preserved | Existing no-resistor warning and rotated LED symbol remain; warning wording now explicitly refers to simulation. |
| S-07 | Removed / not applicable | Colour-coded resistor remains removed; it was not reintroduced. |

### Teacher findings

| Finding | Status | Change and evidence |
|---|---|---|
| T2-01 / T-04 | Fixed | Data-router navigation blockers guard dirty lesson and module editors. Lesson preview/editor transitions preserve edits. Browser Back, route links, reload/close and sign-out have guards. Chrome verifies canceling route navigation, Back and sign-out preserves edits. Real browser reload/close prompt was not exercised; beforeunload handler is installed. |
| T2-02 / T-06 | Fixed | Duplicate saves and opens the new copy, announces its source and shows a copy note. Existing tag stripping/new quiz IDs remain covered by `lessonstore.test.ts`. |
| T2-03 | Fixed | Module title/description show a dirty banner and navigation guard; Save gives “Módulo salvo.” Order/classes are explicitly described as automatically saved. Chrome module test verifies banner, canceled navigation, save confirmation and clean state. |
| T2-04 / T-16 | Fixed | Library, module picker and class picker share teaching order. Labels detect an existing kind anywhere in the title, including before “(cópia)”, so kinds are not appended twice. Unit regression verifies order and copy labels. |
| T2-05 | Addressed | Module package text explains JSON as review/backup, says the website does not deliver it and directs delivery through the teacher's phone app. No new physical transfer feature was claimed or implemented. |
| T2-06 | Fixed | Dashboard says “Melhor nota: … (… desafios)”. Source checked. |
| T2-07 | Fixed | Import collision offers copy (default) or replace-on-save. Import opens a draft and never writes immediately. Chrome verifies no writes on import/open, fresh ID for a copy, original ID for explicit replacement, and exactly one write after Save. Uses in-memory workspace fixtures only. |
| T2-08 | Fixed | Covered with N-02/N-07 above. |
| T2-09 | Fixed | Initial randomized start is not an attempt. L2 first miss does not reveal the full hint; Chrome verifies preview and bench player mode. |
| T2-10 | Fixed | Editor label, lesson notes and comments now say consecutive mistakes of any kind. Source checked. |
| T2-11 | Fixed | Student labels and teacher notes call 15 mA a simulation/model limit. No physical protection is asserted. Source checked and browser verifies limit label. |
| T2-12 | Fixed | Replaced “repositório” with classroom language; L1 criterion names the simulated status LED on screen. Source checked. |
| T2-13 / T-09 | Fixed wording | Uses the existing teacher phone app without inventing its name or claiming working Bluetooth delivery. Module, dashboard and idle bench wording explicitly leave physical end-to-end transfer in testing. Actual phone/BLE delivery remains unmeasured. |
| T2-14 | Reviewed; no change required | Reversing both battery and LED is electrically valid in this model, as the critic states. Kept equivalence rather than rejecting a valid solution; escalating hint explicitly suggests preserving the battery position while comparing LED orientation. |
| T2-15 | Fixed | Validator service package builder strips `teacherNotes`, retaining offline answer keys. The in-memory package API regression failed with teacher notes present, then passes after removal. Stored lesson documents remain unchanged. |
| T-05 | Fixed | Guided step questions can be edited inline in their step card; the globally numbered question list remains available. Source checked and app checks pass. |
| T-10 | Fixed | Redundant all-set/example chips are removed; six main filters plus a “Mais etiquetas” selector replace the long chip row. Source checked. |
| T-14 | Fixed | Save/player messages use plain “Sem voz do tutor” text without internal TTS details or doubled punctuation. Source checked. |
| Other cheap round-1 leftovers | Fixed / preserved | Type filters now use lesson kind even without tags (T-11); L10 title clearly says integration/guiada (T-12); dangling/unassigned steps suppress stale “passos corretos” (T-13); invalid SVGs show inline errors and the upload control remains available for replacement (T-15). Previously fixed numbering, duplicate tag stripping, singular/plural, slot/unit help and diagrams remain covered by existing code/tests. Round-1 reports are context, not a claim of a fresh full critic audit. |

### Verification and remaining limits

- `teacher_authoring_app`: `npm test` passes (13 test files); `npm run typecheck` passes; production build passes. `npm run lint` reports only the accepted pre-existing error at `src/bench/BenchApp.tsx:218`, plus existing warnings. That line was not edited.
- `graph_validator/.venv/bin/pytest`: 91 passed. `PYTHONPATH=bench/service graph_validator/.venv/bin/pytest bench/service/tests`: 7 passed. FastAPI emits its existing Starlette/httpx deprecation warning. Sandbox test processes stalled; the same isolated suites passed outside the sandbox and the stalled processes were terminated individually.
- Reproducible Chrome checks: `AI/round2-browser.py`, `AI/round2-editor-extra.py`, `AI/round2-audio-browser.py`, using `teacher_authoring_app/tests/round2-browser.html` and its TSX fixture. Workspace saves/modules are mocked in browser memory. Validation goes to a local validator on a dedicated port with an explicit isolated SQLite URL. No curriculum seed was run. The bench tests here exercise the shared player in bench mode, not a full NFC/phone/BLE session.
- Lesson v4 still maps explain/experiment to interact 1:1 in the validator, covered by `round2.test.ts`. No firmware/electronics or legacy hardware files were edited for these fixes.
- Not verified: physical currents, protection, fit, camera detection, physical phone/BLE delivery, audible sound quality, narrow/tablet layouts, or a fresh full curriculum browser traversal. The optional isolated curriculum delivery e2e was not run. Accepted limits (short simulated capacitor fade/no replay and no L10 challenge) remain as specified by the brief.
- The user still needs to review, re-seed the intended database and commit. These fixes have **not been re-reviewed by critics** and do not release hardware for construction.

Additional final browser evidence: `AI/round2-predictions-browser.py` exercises **all 14 answer choices** across L2/L4/L5/L7 guided and L6 challenge; every hypothesis reaches the experiment. `AI/round2-audio-browser.py` forces both clip orders and checks visual cues, answer-key alignment and the explanatory follow-up. Guided inline editors render each question prompt only once; the separate list is retained only for orphan step questions, with global numbering preserved.

To reproduce the browser fixtures without touching shared data: run Vite on port 5187 with `TEDTRONICS_API_PORT=8017`, and the validator on port 8017 with `TEDTRONICS_DATABASE_URL` explicitly set to an isolated SQLite path. Then run each `AI/round2-*-browser.py` script (and `AI/round2-editor-extra.py`) with `graph_validator/.venv/bin/python`. The scripts use only the fixture and validator; workspace persistence is mocked. No seed is necessary. Dedicated test servers were stopped after verification.
