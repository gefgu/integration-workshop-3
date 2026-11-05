"""The teacher's phone may read its own students' progress (Postgres + Neon Auth only).

Adds a read-only row-level policy on progress_events so the phone app can show each class's progress, scores
and time, like the website's dashboard. Writes still go only through sync_bench_events().

Revision ID: 0004_phone_progress
Revises: 0003_phone_access
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_phone_progress"
down_revision = "0003_phone_access"
branch_labels = None
depends_on = None

MY_STUDENTS = (
    "(SELECT s.id FROM public.students s JOIN public.school_classes c ON c.id = s.class_id "
    "WHERE c.teacher_id = public.current_teacher_id())"
)


def _enabled() -> bool:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return False  # SQLite (local dev) has no roles or row-level security
    has_auth = bind.execute(sa.text("SELECT to_regclass('neon_auth.\"user\"')")).scalar()
    has_fn = bind.execute(sa.text("SELECT to_regprocedure('public.current_teacher_id()')")).scalar()
    return bool(has_auth and has_fn)


def upgrade() -> None:
    if not _enabled():
        return
    op.execute("ALTER TABLE public.progress_events ENABLE ROW LEVEL SECURITY")
    op.execute("GRANT SELECT ON public.progress_events TO authenticated")
    op.execute("DROP POLICY IF EXISTS phone_read ON public.progress_events")
    op.execute(
        f"CREATE POLICY phone_read ON public.progress_events FOR SELECT TO authenticated "
        f"USING (student_id IN {MY_STUDENTS})"
    )


def downgrade() -> None:
    if not _enabled():
        return
    op.execute("DROP POLICY IF EXISTS phone_read ON public.progress_events")
    op.execute("REVOKE SELECT ON public.progress_events FROM authenticated")
