from __future__ import annotations

from alembic import context
from sqlalchemy import create_engine, pool

from graph_validator.service.storage import Base, database_url

config = context.config
target_metadata = Base.metadata


def run_migrations_online() -> None:
    engine = create_engine(database_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


run_migrations_online()
