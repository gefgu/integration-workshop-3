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

## Run the production server locally

```bash
cd teacher_authoring_app && npm run build
```

```bash
graph_validator/.venv/Scripts/uvicorn --app-dir graph_validator/src graph_validator.service.web:app --port 8090
```

Or with Docker: `docker build -t tedtronics .` then
`docker run -p 8000:8000 -e TEDTRONICS_DATABASE_URL=… -e TEDTRONICS_BENCH_SECRET=… tedtronics`.
