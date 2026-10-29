"""Row-level access for the teacher's phone through the Neon Data API (Postgres only).

The phone signs in with Neon Auth; its JWT makes the Data API run as role `authenticated`.
`current_teacher_id()` maps that user to a teacher by verified email. The web server connects
as the table owner and is not affected by row-level security.

Revision ID: 0003_phone_access
Revises: 0002_accounts_modules_progress
"""
import os

from alembic import op
import sqlalchemy as sa

revision = "0003_phone_access"
down_revision = "0002_accounts_modules_progress"
branch_labels = None
depends_on = None

# Same fallback as graph_validator.service.security.bench_secret(); set a real one in production.
DEV_BENCH_SECRET = "tedtronics-dev-bench-secret"
TABLES = ["teachers", "school_classes", "students", "modules", "saved_lessons",
          "class_lessons", "class_modules", "module_lessons"]
EVENT_KINDS = ("session", "step_done", "lesson_done", "quiz_answer", "challenge_score")

CURRENT_TEACHER = """
CREATE OR REPLACE FUNCTION public.current_teacher_id() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private, neon_auth AS $$
  SELECT t.id FROM public.teachers t
  JOIN neon_auth."user" u ON lower(u.email) = lower(t.email)
  WHERE u.id = auth.user_id()::uuid
    AND (u."emailVerified" OR NOT (SELECT require_verified_email FROM private.phone_settings))
  LIMIT 1
$$
"""

BENCH_SESSION = """
CREATE OR REPLACE FUNCTION public.bench_session() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, private, extensions AS $$
DECLARE
  tid integer := public.current_teacher_id();
  tname text;
  expires bigint := floor(extract(epoch FROM now()))::bigint + 12 * 3600;
  payload text;
  signature text;
BEGIN
  IF tid IS NULL THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  SELECT name INTO tname FROM public.teachers WHERE id = tid;
  payload := translate(trim(trailing '=' FROM replace(encode(convert_to(
      json_build_object('tid', tid, 'name', tname, 'exp', expires)::text, 'UTF8'), 'base64'), E'\\n', '')), '+/', '-_');
  signature := translate(trim(trailing '=' FROM replace(encode(
      hmac(convert_to(payload, 'UTF8'), convert_to((SELECT secret FROM private.bench_secret), 'UTF8'), 'sha256'),
      'base64'), E'\\n', '')), '+/', '-_');
  RETURN jsonb_build_object('token', payload || '.' || signature, 'expires_at', expires,
                            'teacher', jsonb_build_object('id', tid, 'name', tname));
END $$
"""

# Mirrors GET /bench/package (service/bench.py): module lessons in order without `audio`, the class's
# active tagged students, and content-derived version ids (hashes differ from the Python server's; the
# bench treats them as opaque).
BENCH_PACKAGE = """
CREATE OR REPLACE FUNCTION public.bench_package(p_module_id integer, p_class_id integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  tid integer := public.current_teacher_id();
  m public.modules%ROWTYPE;
  c public.school_classes%ROWTYPE;
  lessons jsonb;
  students jsonb;
  body jsonb;
BEGIN
  IF tid IS NULL THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO m FROM public.modules WHERE id = p_module_id AND teacher_id = tid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Módulo não encontrado.' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO c FROM public.school_classes WHERE id = p_class_id AND teacher_id = tid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Turma não encontrada.' USING ERRCODE = 'P0002'; END IF;
  SELECT jsonb_agg(d.doc || jsonb_build_object('lessonVersion', left(encode(digest(d.doc::text, 'sha256'), 'hex'), 16))
                   ORDER BY d.position)
    INTO lessons
    FROM (SELECT ml.position, sl.document::jsonb - 'audio' AS doc
            FROM public.module_lessons ml JOIN public.saved_lessons sl ON sl.id = ml.lesson_id
           WHERE ml.module_id = m.id) d;
  IF lessons IS NULL THEN RAISE EXCEPTION 'O módulo não tem lições.' USING ERRCODE = '22023'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'nickname', s.nickname,
                                               'nfc_code', s.nfc_code) ORDER BY s.name), '[]'::jsonb)
    INTO students
    FROM public.students s
   WHERE s.class_id = c.id AND s.active AND coalesce(s.nfc_code, '') <> '';
  body := jsonb_build_object(
    'module', jsonb_build_object('id', m.id, 'title', m.title, 'description', m.description,
      'lesson_ids', (SELECT jsonb_agg(lesson_id ORDER BY position) FROM public.module_lessons WHERE module_id = m.id)),
    'class', jsonb_build_object('id', c.id, 'name', c.name),
    'lessons', lessons,
    'students', students);
  RETURN jsonb_build_object(
    'format', 1,
    'version_id', left(encode(digest(body::text, 'sha256'), 'hex'), 16),
    'teacher', jsonb_build_object('id', tid, 'name', (SELECT name FROM public.teachers WHERE id = tid)),
    'created_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"+00:00"')) || body;
END $$
"""

SYNC_EVENTS = """
CREATE OR REPLACE FUNCTION public.sync_bench_events(bench_id text, events jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tid integer := public.current_teacher_id();
  ev jsonb;
  eid text;
  acked text[] := '{}';
  rejected jsonb := '[]'::jsonb;
  inserted integer := 0;
  n integer;
BEGIN
  IF tid IS NULL THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(events) <> 'array' OR jsonb_array_length(events) > 2000 THEN
    RAISE EXCEPTION 'events must be an array of at most 2000 items';
  END IF;
  IF bench_id IS NULL OR length(bench_id) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION 'invalid bench_id';
  END IF;
  FOR ev IN SELECT * FROM jsonb_array_elements(events) LOOP
    eid := ev->>'event_id';
    BEGIN
      IF eid IS NULL OR length(eid) NOT BETWEEN 8 AND 64 THEN RAISE EXCEPTION 'event_id inválido'; END IF;
      IF EXISTS (SELECT 1 FROM public.progress_events WHERE event_id = eid) THEN
        acked := acked || eid;  -- re-upload: already stored (SFR59)
        CONTINUE;
      END IF;
      IF NOT (ev->>'kind' = ANY (ARRAY[%(kinds)s])) THEN RAISE EXCEPTION 'kind inválido'; END IF;
      IF coalesce((ev->>'duration_s')::float, 0) < 0 THEN RAISE EXCEPTION 'duração negativa'; END IF;
      IF length(coalesce(ev->>'nfc_code', '')) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'nfc_code inválido'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.students s JOIN public.school_classes c ON c.id = s.class_id
                     WHERE s.id = (ev->>'student_id')::int AND c.teacher_id = tid) THEN
        rejected := rejected || jsonb_build_object('event_id', eid, 'reason', 'Aluno não pertence a este professor.');
        CONTINUE;
      END IF;
      INSERT INTO public.progress_events (event_id, student_id, nfc_code, lesson_id, module_id, lesson_version, kind,
                                          step_idx, score, duration_s, seq, at, bench_id, received_at)
      VALUES (eid, (ev->>'student_id')::int, ev->>'nfc_code', ev->>'lesson_id', (ev->>'module_id')::int,
              ev->>'lesson_version', ev->>'kind', (ev->>'step_idx')::int, (ev->>'score')::int,
              (ev->>'duration_s')::float, (ev->>'seq')::int,
              ((ev->>'at')::timestamptz AT TIME ZONE 'UTC'), bench_id, (now() AT TIME ZONE 'UTC'))
      ON CONFLICT (event_id) DO NOTHING;
      GET DIAGNOSTICS n = ROW_COUNT;
      inserted := inserted + n;
      acked := acked || eid;
    EXCEPTION WHEN OTHERS THEN
      IF eid IS NULL THEN CONTINUE; END IF;
      rejected := rejected || jsonb_build_object('event_id', eid, 'reason', SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('acked', to_jsonb(acked), 'rejected', rejected, 'inserted', inserted);
END $$
""" % {"kinds": ", ".join(f"'{k}'" for k in EVENT_KINDS)}


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def _has_neon_auth() -> bool:
    return bool(op.get_bind().execute(sa.text("SELECT to_regclass('neon_auth.\"user\"')")).scalar())


def upgrade() -> None:
    if _is_postgres() and not _has_neon_auth():
        print("WARNING: 0003_phone_access skipped: neon_auth schema not found. Enable Neon Auth, then downgrade -1 and upgrade.")
    # SQLite (local dev) has no roles or row-level security; the phone path is Neon-only.
    if not _is_postgres() or not _has_neon_auth():
        return
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE SCHEMA IF NOT EXISTS private")
    op.execute("REVOKE ALL ON SCHEMA private FROM PUBLIC")
    op.execute("CREATE TABLE IF NOT EXISTS private.bench_secret (secret text NOT NULL)")
    # Verification is off while the phone sign-up is being proven: anyone who signs up with a teacher's email gets
    # that teacher's data. Turn it on with: UPDATE private.phone_settings SET require_verified_email = true.
    op.execute("CREATE TABLE IF NOT EXISTS private.phone_settings (require_verified_email boolean NOT NULL DEFAULT false)")
    op.execute("INSERT INTO private.phone_settings SELECT false WHERE NOT EXISTS (SELECT 1 FROM private.phone_settings)")
    secret = os.getenv("TEDTRONICS_BENCH_SECRET", DEV_BENCH_SECRET)
    op.execute(sa.text("INSERT INTO private.bench_secret SELECT :s WHERE NOT EXISTS (SELECT 1 FROM private.bench_secret)")
               .bindparams(s=secret))
    op.execute(CURRENT_TEACHER)

    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")
    op.execute("GRANT USAGE ON SCHEMA public TO authenticated")
    # Never expose password_hash: grant only the harmless teacher columns.
    op.execute("GRANT SELECT (id, email, name) ON public.teachers TO authenticated")
    for table in TABLES[1:]:
        op.execute(f"GRANT SELECT ON public.{table} TO authenticated")

    mine = "(SELECT id FROM public.school_classes WHERE teacher_id = public.current_teacher_id())"
    my_modules = "(SELECT id FROM public.modules WHERE teacher_id = public.current_teacher_id())"
    policies = {
        "teachers": "id = public.current_teacher_id()",
        "school_classes": "teacher_id = public.current_teacher_id()",
        "modules": "teacher_id = public.current_teacher_id()",
        "saved_lessons": "teacher_id = public.current_teacher_id()",
        "students": f"class_id IN {mine}",
        "class_lessons": f"class_id IN {mine}",
        "class_modules": f"class_id IN {mine}",
        "module_lessons": f"module_id IN {my_modules}",
    }
    for table, using in policies.items():
        op.execute(f"CREATE POLICY phone_read ON public.{table} FOR SELECT TO authenticated USING ({using})")

    op.execute("REVOKE ALL ON FUNCTION public.current_teacher_id() FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION public.current_teacher_id() TO authenticated")
    for sql in (BENCH_SESSION, BENCH_PACKAGE, SYNC_EVENTS):
        op.execute(sql)
    for signature in ("public.bench_session()", "public.bench_package(integer, integer)", "public.sync_bench_events(text, jsonb)"):
        op.execute(f"REVOKE ALL ON FUNCTION {signature} FROM PUBLIC")
        op.execute(f"GRANT EXECUTE ON FUNCTION {signature} TO authenticated")


def downgrade() -> None:
    if not _is_postgres() or not _has_neon_auth():
        return
    for table in TABLES:
        op.execute(f"DROP POLICY IF EXISTS phone_read ON public.{table}")
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON public.{table} FROM authenticated")
    op.execute("DROP FUNCTION IF EXISTS public.sync_bench_events(text, jsonb)")
    op.execute("DROP FUNCTION IF EXISTS public.bench_package(integer, integer)")
    op.execute("DROP FUNCTION IF EXISTS public.bench_session()")
    op.execute("DROP FUNCTION IF EXISTS public.current_teacher_id()")
    op.execute("DROP TABLE IF EXISTS private.bench_secret")
    op.execute("DROP TABLE IF EXISTS private.phone_settings")
    op.execute("DROP SCHEMA IF EXISTS private")
