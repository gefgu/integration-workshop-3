# Test environment shared by both critics

Everything below is already running. **Do not start, stop or restart servers, do not touch the shared Neon
database, and do not edit any repository file** — you are a reviewer. Write nothing except your report.

| What | Where |
|---|---|
| Teacher website + bench screen (Vite) | http://127.0.0.1:5180/ (teacher), http://127.0.0.1:5180/bench.html?servico=http://127.0.0.1:8766 (bench screen; without `?servico=` it looks for the service on port 8765) |
| API (isolated SQLite copy of the curriculum) | http://127.0.0.1:8010 |
| Bench service (simulated bench, loaded with the full curriculum) | http://127.0.0.1:8766 |
| Teacher login | `professor@tedtronics.local` / `tedtronics` (isolated database only) |

The isolated database holds the 20 curriculum lessons (ids `curriculo-…`) and 5 modules. A class
“E2E currículo” with one student (nickname `e2e`, picked for the bench when a module is sent) is assigned all modules.

## How to drive the UI

The Chrome extension may not be connected. A headless-Chrome driver is provided:

```python
# run with: graph_validator/.venv/bin/python your_script.py   (write scripts in your scratch directory, not the repo)
import sys; sys.path.insert(0, "graph_validator/tools")
from cdp import Browser                        # fill, click, click_text(text, exact=True), text(), screenshot, errors
from lab_driver import open_lesson, missions, click_piece, drag_from_tray, drag_piece_out
with Browser("http://127.0.0.1:5180/") as b:
    open_lesson(b, "Lição 2 — O primeiro circuito fechado (guiada)")   # logs in, opens the lesson in the test player
    b.click_text("Entendi, continuar"); b.full_screenshot("shot.png"); print(b.text()); print(b.errors)
```

Read the docstrings of `graph_validator/tools/cdp.py` and `lab_driver.py` first. Screenshots are PNG files you can
open with the Read tool. In the lesson test page, “preencher com o gabarito” fills the current build step's answer
(teacher preview only); a real student drags pieces from the tray. Use `exact=True` for “Energizar”/“Desligar”
(the Sandbox has its own “Energizar bancada”).

## Ground rules for what you claim

* Every finding needs: **where** (screen/lesson/step), **action** (what you did, so it can be repeated),
  **evidence** (text you read, screenshot path, console error, test output), **severity**, and a **concrete fix**.
* Severity: **Blocker** (cannot complete or misleads about safety/hardware), **Major** (confuses or fails
  a typical user), **Minor** (friction, polish), **Note** (observation, no change needed).
* Reproduce before reporting. If you could not reproduce or could not check something (for example sound
  cannot be heard in headless Chrome), say so under “Not verified” — **never invent observations**.
* Distinguish **software simulation** from **measured hardware**. The correct state of this project is: currents,
  brightness, buzzer sound, capacitor fade and the bench status LED are **simulated by the software**; the
  camera and hardware were not used. Flag any text, screen or label that could make a user believe otherwise.
* Report in pt-BR terms the user would see; write your report in English.
* Finish with: a ranked findings table, a list of what you verified works, and “Not verified”.

## Round 2 additions

* Write findings to your report file **as you go** (append after every few findings), not only at the end: a session can be
  interrupted. The report path is given in your task; it is the only repository file you may write.
* Never use `pkill`/`killall`; other reviewers run Chrome at the same time. The driver gives each Chrome its own port.
* Round 1 reports are in `AI/reviews/round1-*.md`. Round 2 must (a) re-check each round-1 *Major* finding and say
  FIXED / NOT FIXED with evidence, then (b) look for new problems, especially in what you did not reach in round 1.
* Changes since round 1: jumper step text uses tray names and follows swapped pieces; unsaved-changes banner; duplicate
  drops the `exemplo`/`currículo` tags; library lists own lessons first, then the curriculum in order; teacher notes
  rewritten; time-out in a timed challenge now offers Continue (to the explanation); prediction questions added before the
  experiment in guided lessons 2, 4, 5, 7; LED arrow flips when rotated; column numbers drawn on the board; units/slots in
  the help panel; challenge hints count consecutive misses of any kind; no resistor in lesson 2 shows a "limited by the
  bench" warning. The colour-coded resistor and the bonus lessons were removed from the project (20 lessons now).
* Known and accepted, do not report again unless it got worse: capacitor fade is 1.7 s with no replay; no L10 challenge
  version; sound cannot be judged headless.
