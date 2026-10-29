"""Teacher accounts, modules, NFC tag audit log and bench progress events.

Revision ID: 0002_accounts_modules_progress
Revises: 0001_workspace
"""
from alembic import op
import sqlalchemy as sa

from graph_validator.service.security import DEMO_PASSWORD, hash_password

revision = "0002_accounts_modules_progress"
down_revision = "0001_workspace"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("teachers") as batch:
        batch.add_column(sa.Column("password_hash", sa.String(255), nullable=False, server_default=""))
        batch.add_column(sa.Column("created_at", sa.DateTime(), nullable=True))
    # The seeded demo teacher (id 1) signs in with professor@tedtronics.local / tedtronics.
    op.execute(sa.text("UPDATE teachers SET password_hash = :h WHERE id = 1 AND password_hash = ''")
               .bindparams(h=hash_password(DEMO_PASSWORD)))
    op.create_table(
        "auth_tokens",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("teachers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_auth_tokens_teacher_id", "auth_tokens", ["teacher_id"])
    op.create_table(
        "modules",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("teachers.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_modules_teacher_id", "modules", ["teacher_id"])
    op.create_table(
        "module_lessons",
        sa.Column("module_id", sa.Integer(), sa.ForeignKey("modules.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("lesson_id", sa.String(128), sa.ForeignKey("saved_lessons.id"), primary_key=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint("module_id", "position", name="uq_module_lesson_position"),
    )
    op.create_table(
        "class_modules",
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("module_id", sa.Integer(), sa.ForeignKey("modules.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint("class_id", "position", name="uq_class_module_position"),
    )
    op.create_table(
        "tag_link_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("student_name", sa.String(255), nullable=False),
        sa.Column("nfc_code", sa.String(255), nullable=False),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tag_link_events_teacher_id", "tag_link_events", ["teacher_id"])
    op.create_index("ix_tag_link_events_student_id", "tag_link_events", ["student_id"])
    op.create_table(
        "progress_events",
        sa.Column("event_id", sa.String(64), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nfc_code", sa.String(255), nullable=False),
        sa.Column("lesson_id", sa.String(128), nullable=True),
        sa.Column("module_id", sa.Integer(), nullable=True),
        sa.Column("lesson_version", sa.String(64), nullable=True),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("step_idx", sa.Integer(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("duration_s", sa.Float(), nullable=True),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("at", sa.DateTime(), nullable=False),
        sa.Column("bench_id", sa.String(64), nullable=False),
        sa.Column("received_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_progress_events_student_id", "progress_events", ["student_id"])


def downgrade() -> None:
    op.drop_index("ix_progress_events_student_id", table_name="progress_events")
    op.drop_table("progress_events")
    op.drop_index("ix_tag_link_events_student_id", table_name="tag_link_events")
    op.drop_index("ix_tag_link_events_teacher_id", table_name="tag_link_events")
    op.drop_table("tag_link_events")
    op.drop_table("class_modules")
    op.drop_table("module_lessons")
    op.drop_index("ix_modules_teacher_id", table_name="modules")
    op.drop_table("modules")
    op.drop_index("ix_auth_tokens_teacher_id", table_name="auth_tokens")
    op.drop_table("auth_tokens")
    with op.batch_alter_table("teachers") as batch:
        batch.drop_column("created_at")
        batch.drop_column("password_hash")
