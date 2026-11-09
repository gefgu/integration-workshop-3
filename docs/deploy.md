# Publishing TedTronics online

What goes where:

| Part | Where it runs | Notes |
|---|---|---|
| Teacher website + API | **Render** (one Docker web service, `render.yaml`) | the site is served at `/`, the API at `/api` |
| Database | **Neon** Postgres (the project the phone app already uses) | migrations run on every deploy (`alembic upgrade head`) |
| Bench (screen + service + camera) | the bench's **Raspberry Pi** | offline-first; talks to the phone, not to the internet |
| Teacher app | Android **APK** (EAS build) | Neon build: talks to Neon directly |

## 1. Neon: copy the connection string

1. Open the Neon console → your project → **Connect**.
2. Copy the **connection string** (`postgresql://…?sslmode=require`). Use the pooled one if Neon offers both.
3. Keep it private: it contains the database password. It is pasted only into Render (step 2), never into the code.

Bench secret: the bench unlock is signed with a shared secret. In Neon it lives in `private.bench_secret`
(created by migration 0003). Use the **same value** for `TEDTRONICS_BENCH_SECRET` on Render and on every bench.

## 2. Render: create the service

1. Push the branch to GitHub (`bench_screens`, or `main` after merging; `render.yaml` names the branch).
2. In Render: **New → Blueprint** → connect the GitHub repository `gefgu/integration-workshop-3`.
3. Render reads `render.yaml` and asks for:
   - `TEDTRONICS_DATABASE_URL` → the Neon connection string;
   - `TEDTRONICS_BENCH_SECRET` → the bench secret.
4. **Apply**. The first build takes a few minutes (Node builds the site, then Python installs the API).
5. When it is live, open `https://<service>.onrender.com/healthz` → `{"status":"ok","site":"ok"}`.

The website is at `https://<service>.onrender.com/`. Teachers create their account there; the TedTronics
curriculum is imported on the first login.

Free plan: the service sleeps after 15 minutes without visits; the first visit after that takes about a minute.

## 3. After publishing

- **Teacher app**: in the non-Neon build, type `https://<service>.onrender.com/api` as the server on the login
  screen. The Neon build needs nothing: it already talks to Neon.
- **Phone progress**: migration `0004_phone_progress` gives the phone read access to its own students'
  progress. It runs on the first deploy.
- **Local data**: the local SQLite files (`graph_validator/tedtronics.sqlite3`) are not uploaded. Teachers sign up
  online and the curriculum comes back by itself; classes and students are created again.
- **Updates**: every push to the branch in `render.yaml` deploys again (`autoDeploy`).

## One teacher account for the site and the phone

Neon is the single source of truth for teachers. The phone app (Neon build) only sees teachers in Neon's
`public.teachers`, so a site that runs on the local SQLite file creates accounts the phone can never find
("não corresponde a um professor"). The site's login screen and `run.ps1` say which database is in use.

1. Neon console → project → **Connect** → copy the connection string (pooled and, if offered, direct).
2. Create `.env.local` at the repository root (git-ignored; never commit it or paste it anywhere):
   `DATABASE_URL=<pooled string>`, `DATABASE_URL_UNPOOLED=<direct string>`, `TEDTRONICS_BENCH_SECRET=<bench secret>`.
   `neon link` writes the same file. `run.ps1` and `run-local.sh` load it, run the migrations and start the API on Neon.
3. Bring the local teachers (with their lessons, modules, classes, students and progress) into Neon:
   `graph_validator/.venv/Scripts/python graph_validator/tools/sync_sqlite_to_neon.py` prints what it would add
   (nothing is written); add `--apply` to write, `--email teacher@tedtronics.com` to copy only one teacher.
   It never updates or deletes Neon rows: a teacher already in Neon is reported and skipped (`--into-existing` adds
   only the items that teacher lacks). Running it again adds nothing. Passwords keep working (same hash).
4. Set `TEDTRONICS_NEON_AUTH_URL` (the same Neon Auth URL as the phone's `EXPO_PUBLIC_NEON_AUTH_URL`) in
   `.env.local` and on Render. Then the site checks passwords in Neon Auth too: **one e-mail and one password**
   for the site and the phone. Signing up on the site creates the phone account; an account made on the phone
   signs in on the site; changing the password in the site's profile changes it on the phone. An old site password
   moves to Neon Auth on the next sign-in, unless the phone already has its own password: then that one is used.
   Passwords need 8+ characters. The e-mail cannot be changed while Neon Auth is on.

`tools/sqlite_to_postgres.py` is different: it **empties** the target first. Use it only for a brand-new database.

## Run the production server locally

```bash
cd teacher_authoring_app && npm run build
```

```bash
graph_validator/.venv/Scripts/uvicorn --app-dir graph_validator/src graph_validator.service.web:app --port 8090
```

Or with Docker: `docker build -t tedtronics .` then
`docker run -p 8000:8000 -e TEDTRONICS_DATABASE_URL=… -e TEDTRONICS_BENCH_SECRET=… tedtronics`.
