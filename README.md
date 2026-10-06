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

Previously saved browser lessons are not imported. The teacher can still import and export lesson JSON files through the app.

## Team

- Gabriel Martines
- Gustavo Henrique Bruno dos Santos (Project Manager)
- João Vitor Bezerra
- Julia Mariano
- Tainara Novaes
