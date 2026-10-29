# TedTronics - Team #2

**TedTronics: Tutor Educacional para Eletrônica**

TedTronics is the team project for Integration Workshop 3 at UTFPR-CT.

It is an interactive electronics workbench for Fundamental II students: they build a real circuit out of Lego-like component capsules on a connection table, press **Energizar**, and watch it actually work while a guided tutor walks them through each step.

## Documentation

Project documentation (blog, project description, requirements, budget, risk analysis, guided modules, and tasks/Gantt) has moved to Notion:

📄 [Project Notion](https://app.notion.com/p/fdd9670c116e82209954010e6b830a37)

## Software (D3): teacher website, teacher app, server and bench

| Part | Folder | What it does |
|---|---|---|
| Server API | `graph_validator/` | FastAPI + SQLite (Alembic): teacher accounts, lessons, modules, classes, students, NFC tags (with audit log), bench sync, dashboard, and the graph validator. |
| Teacher website | `teacher_authoring_app/` (`index.html`) | Phone-first React site: sign-up/login, lesson editor, modules, classes, students and tags, performance dashboard. |
| Teacher app | `teacher_mobile_app/` | Expo / React Native: login, classes and students, connect to a bench (Bluetooth or simulator), send a module, sync progress, offline queue. |
| Bench | `bench/service/` + `teacher_authoring_app/bench.html` | Bench service (local storage, protocol, local validation) and the 7" screen: tag login, guided lesson, challenge, score and top-3 ranking. |
| Protocol | `protocol/bench.ts`, `docs/bench-protocol.md` | App ⇄ bench messages, framed for BLE; the simulator carries the same frames over WebSocket. |

### Setup

1. `cd graph_validator && python -m venv .venv`, then install with `.venv/bin/pip install -e ".[dev]" -e ../bench/service` (Windows: `.venv\Scripts\pip ...`).
2. `cd teacher_authoring_app && npm install`
3. Start everything: `./run.sh` (Linux/macOS/Git Bash) or `powershell -ExecutionPolicy Bypass -File run.ps1` (Windows). This applies the migrations and starts:
   - API on `http://<pc>:8000`
   - bench service on `http://<pc>:8765` (demo mode on)
   - website on `http://<pc>:5173`, bench screen on `http://<pc>:5173/bench.html`
4. Teacher app: `cd teacher_mobile_app && npm install && npx expo start`. In Expo Go only the **Simulador** link works. Bluetooth needs a development build (`npx expo run:android`). On the login screen, use the PC's IP: `http://<pc>:8000`.

The demo teacher created by the migration is `professor@tedtronics.local` / `tedtronics`. New teachers sign up on the website. Data lives in `graph_validator/tedtronics.sqlite3` and `bench/service/bench.sqlite3`; both are git-ignored. `TEDTRONICS_DATABASE_URL` points the API to another file. `TEDTRONICS_BENCH_SECRET` must be the same on the API and on the bench: it signs the session that unlocks the bench.

### End-to-end demo

1. On the website: sign up → create lessons (one guided, one challenge) → **Módulos**: create a module with them and tick the class → **Alunos**: register students and link a tag code (e.g. `TAG-1`).
2. In the app: log in → **Bancada** → **Simulador** → `<pc>:8765` → **Enviar módulo** (module + class). Without the phone, the bench screen's "Modo demonstração" unlocks it, but no module is loaded.
3. On `bench.html`: type `TAG-1` + Enter (a USB NFC reader types the same way) → do the lesson → leave halfway and come back: it resumes at the same step → the challenge shows the score and the top 3.
4. In the app: **Sincronizar progresso** (with no internet, the data waits on the phone and goes up later) → the website's **Painel** shows progress, score and time.

### Tests

- `graph_validator`: `.venv/bin/python -m pytest`
- `bench/service`: `../../graph_validator/.venv/bin/python -m pytest`
- `teacher_authoring_app`: `npm test && npm run typecheck`
- `teacher_mobile_app`: `npm test && npm run typecheck && npx expo lint`

### Tutor voice (Piper TTS)

Saving a lesson also synthesizes everything the tutor says in it (title, instruction, step texts, quiz questions, options and feedback, custom feedback messages) with the offline [Piper](https://github.com/OHF-Voice/piper1-gpl) voice `pt_BR-cadu-medium`, as MP3. Fixed phrases shared by every lesson (default feedback, praise) live in a separate system pack.

1. `cd graph_validator && .venv/bin/pip install -e '.[dev,tts]'`
2. `graph_validator/tools/fetch_voice.sh` downloads the voice (~63 MB) into `graph_validator/voices/` and builds the system pack (~340 phrases, takes several minutes once).

The MP3s are cached by text in `graph_validator/audio/` (both folders are git-ignored; override with `TEDTRONICS_AUDIO_DIR` and `TEDTRONICS_PIPER_VOICE`), so re-saving only synthesizes changed phrases. "Exportar" downloads a `.zip` with `lesson.json` and `audio/*.mp3`; `GET /tts/system.zip` has the system pack. Without the `tts` extra or the voice, lessons still save, just without audio. Rebuild the system pack (`.venv/bin/python -m graph_validator.tts system`) after changing default messages in `feedback.py`.

## Team

- Gabriel Martines
- Gustavo Henrique Bruno dos Santos (Project Manager)
- João Vitor Bezerra
- Julia Mariano
- Tainara Novaes
