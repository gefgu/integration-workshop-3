# Brief for Codex: fix the round-2 review findings

Repo: `/home/gustavo/Documents/UTFPR/oficinas/integration-workshop-3`. Read `AGENTS.md` and `CLAUDE.md` first and follow them.

## Sources of truth (read before editing)
- `AI/reviews/round2-student.md`: student critic, findings N-01..N-14 and S-01..S-07 re-checks.
- `AI/reviews/round2-teacher.md`: teacher critic, findings T2-01..T2-15, T-09, T-10, T-14.
- `AI/reviews/round1-*.md`: round 1, for context only.
- `AI/_common-environment.md`: how to run the app, bench and test servers.
- `AI/curriculum-notes.md`: curriculum design notes.

The critics were Claude Opus 5.5 (GPT-6.1 Sol was unavailable). Their reports hold the evidence and reproduction steps; use them rather than guessing.

## Hard rules
- Work only in `teacher_authoring_app/` (plus `graph_validator/` if a simulator or validator bug requires it) and `AI/`. Do not touch firmware, `eletronics/`, `checks/`, `docs/deliverables/`, or other uncommitted user files.
- **Never write to Notion.** Do not show connector or header part numbers on tscircuit schematics.
- The colour-coded resistor (`resistor_cc`) is permanently removed (see CLAUDE.md). Do not bring it back.
- Everything is software simulation. Never write text that claims a measured value or camera verification. 15 mA is a simulator constant (`BENCH_LIMIT_MA`), not a hardware fact.
- Lessons are in Brazilian Portuguese for Fundamental II. Keep the tone simple and friendly. Keep lesson v4 backward compatible: `toValidatorLesson` maps `explain` and `experiment` to `interact` so step indexes stay 1:1.
- No `/tmp` scripts or toolchains. No `python3 -c` or stdin scripts. Use repo files or the session scratchpad.
- Do **not** commit, push, or run the seed against the shared Neon DB. Leave that to the user.
- Do not edit `src/bench/BenchApp.tsx:218` (a known pre-existing lint error).

## Fix order
Reproduce each Major in the headless-Chrome drivers (`graph_validator/tools/cdp.py`, `lab_driver.py`) or a unit test *before* fixing, and add a regression test afterwards.

1. **Prediction questions (N-07, N-02, T2-08).** In guided L2, L4, L5, L7 (and the L6 challenge question): every answer must accept and continue. Show a Continuar button after any answer, and compare with the real result after the experiment. A wrong guess must not block progress. Reword the following mission text so it does not reveal the answer. Move L2's prediction before the first Energizar.
2. **N-04 simulator bug.** Two jumpers side by side on unused columns make a correct L2 challenge circuit read "Sem corrente" while the tutor says "Montagem certa!". Reproduce, find the root cause in `src/engine/sim.ts` or `lab.ts`, fix it, and add a unit test.
3. **S-04: escalating hints in challenges.** After repeated misses the L2 and L4 challenges (test player and bench screen) must give stronger hints, not the same sentence. Also check T2-09 (the L2 challenge shows its hint after the first miss, not after `hintAfter` = 2).
4. **N-01.** The L2 guided build steps 4 and 5 say "Muito bem!" for jumpers that connect nothing. Do not praise a connection that does nothing, and point to where the problem is.
5. **N-10.** L6 and the L8 potentiometer version say "sem degraus" and "arraste", but the control steps through 7 values and "aos pulos" is marked wrong. Make the text and the answer match the real control, or add a real drag. Prefer fixing the text and accepting the honest answer.
6. **N-14 and S-02.** Make the L10 currents correct for the 470 Ω branch, and make the mA readings consistent (6,25 / 6,3 / 6,4) or explain the difference.
7. **S-03 and S-05.** The L1 challenge should say what to do beyond "Monte o circuito.". Do not say "Conferi o circuito inteiro…" where there is no circuit.
8. **Timed challenge.** Make the timer visible, and do not point students to the teacher-only "Testar de novo" in the time-out message.
9. **Wording and honesty.** T2-11: reword "limitada pela bancada" as a simulation limit. T-09: do not state Bluetooth phone-app delivery as fact and do not invent the app name; say it is delivered by the teacher's phone app, as the user confirmed it exists.
10. **Editor.** T2-07: "Abrir .json" must ask replace or import as copy (default copy) before overwriting an existing id. T2-01: guard in-app navigation against dropping unsaved edits. T2-03, T2-04, T2-06, T2-02: see the teacher report.
11. **Remaining Minor and Note items** (N-03, N-05, N-06, N-08, N-09, N-11, T2-10, T2-12..15, T-10, T-14): fix the cheap ones, and list any you skip with a reason.

## Verify (all must pass)
- `cd teacher_authoring_app && npm test && npm run typecheck && npm run lint` (one known lint error remains in `BenchApp.tsx`).
- `cd graph_validator && .venv/bin/pytest`, and the bench service tests.
- Optionally re-run `scripts/e2e-curriculum.ts` against an isolated SQLite DB (see `AI/_common-environment.md`). Never point it at the shared DB.

## Report back
Update `AI/review-record.md` with a "Round 2" section: each finding, fixed / partly fixed / skipped, how it was verified, and what is still unresolved. State that the fixes have **not** been re-reviewed by critics, and keep separating software simulation from measured hardware. Then stop, and let the user re-seed and commit.
