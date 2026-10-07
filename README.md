# TedTronics - Team #2

**TedTronics: Tutor Educacional para Eletrônica**

TedTronics is the team project for Integration Workshop 3 at UTFPR-CT.

It is an interactive electronics workbench for Fundamental II students: they build a real circuit out of Lego-like component capsules on a connection table, press **Energizar**, and watch it actually work while a guided tutor walks them through each step.

## Documentation

Project documentation (blog, project description, requirements, budget, risk analysis, guided modules, and tasks/Gantt) has moved to Notion:

📄 [Project Notion](https://app.notion.com/p/fdd9670c116e82209954010e6b830a37)

## Teacher app and SQLite

The teacher workspace stores lessons, turmas, students, and turma lesson assignments in `graph_validator/tedtronics.sqlite3`. The file is created automatically on first start and ignored by Git. The login is a demo placeholder using the seeded teacher (ID 1); it does not authenticate the entered credentials.

1. Run `cd graph_validator && python3 -m venv .venv && .venv/bin/pip install -e '.[dev]'`.
2. Run `cd teacher_authoring_app && npm install`.
3. Run `./run.sh` from the repository root. It applies the Alembic migration, starts the FastAPI service on port 8000, and starts Vite. No Docker or database server is needed.

If you start the services separately, run `graph_validator/.venv/bin/alembic -c graph_validator/alembic.ini upgrade head` before `npm run validator` from `teacher_authoring_app`. The Vite `/api` proxy forwards workspace and validator requests to FastAPI. To use a different SQLite file, set `TEDTRONICS_DATABASE_URL=sqlite:////absolute/path/to/file.sqlite3` for both migration and API processes.

### Tutor voice (Piper TTS)

Saving a lesson also synthesizes everything the tutor says in it (title, instruction, step texts, quiz questions, options and feedback, custom feedback messages) with the offline [Piper](https://github.com/OHF-Voice/piper1-gpl) voice `pt_BR-cadu-medium`, as MP3. Fixed phrases shared by every lesson (default feedback, praise) live in a separate system pack.

1. `cd graph_validator && .venv/bin/pip install -e '.[dev,tts]'`
2. `graph_validator/tools/fetch_voice.sh` downloads the voice (~63 MB) into `graph_validator/voices/` and builds the system pack (~340 phrases, takes several minutes once).

The MP3s are cached by text in `graph_validator/audio/` (both folders are git-ignored; override with `TEDTRONICS_AUDIO_DIR` and `TEDTRONICS_PIPER_VOICE`), so re-saving only synthesizes changed phrases. "Exportar" downloads a `.zip` with `lesson.json` and `audio/*.mp3`; `GET /tts/system.zip` has the system pack. Without the `tts` extra or the voice, lessons still save, just without audio. Rebuild the system pack (`.venv/bin/python -m graph_validator.tts system`) after changing default messages in `feedback.py`.

Previously saved browser lessons are not imported. The teacher can still import and export lesson JSON files through the app.

## Team

- Gabriel Martines
- Gustavo Henrique Bruno dos Santos (Project Manager)
- João Vitor Bezerra
- Julia Mariano
- Tainara Novaes
