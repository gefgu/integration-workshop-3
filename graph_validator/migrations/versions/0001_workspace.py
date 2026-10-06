"""Initial teacher workspace schema.

Revision ID: 0001_workspace
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_workspace"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "teachers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
    )
    op.create_table(
        "school_classes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("teachers.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
    )
    op.create_index("ix_school_classes_teacher_id", "school_classes", ["teacher_id"])
    op.create_table(
        "students",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("nickname", sa.String(255), nullable=False),
        sa.Column("nfc_code", sa.String(255), nullable=True, unique=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.UniqueConstraint("class_id", "nickname", name="uq_student_class_nickname"),
    )
    op.create_index("ix_students_class_id", "students", ["class_id"])
    op.create_table(
        "saved_lessons",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("teachers.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_saved_lessons_teacher_id", "saved_lessons", ["teacher_id"])
    op.create_table(
        "class_lessons",
        sa.Column("class_id", sa.Integer(), sa.ForeignKey("school_classes.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("lesson_id", sa.String(128), sa.ForeignKey("saved_lessons.id"), primary_key=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint("class_id", "position", name="uq_class_lesson_position"),
    )
    op.execute(sa.text("INSERT INTO teachers (id, email, name) VALUES (1, 'professor@tedtronics.local', 'Professor de demonstração')"))


def downgrade() -> None:
    op.drop_table("class_lessons")
    op.drop_index("ix_saved_lessons_teacher_id", table_name="saved_lessons")
    op.drop_table("saved_lessons")
    op.drop_index("ix_students_class_id", table_name="students")
    op.drop_table("students")
    op.drop_index("ix_school_classes_teacher_id", table_name="school_classes")
    op.drop_table("school_classes")
    op.drop_table("teachers")
