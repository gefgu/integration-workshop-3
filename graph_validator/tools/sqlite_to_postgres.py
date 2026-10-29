"""Copy every row of the local SQLite database into a Postgres database (e.g. Neon).

Usage: python graph_validator/tools/sqlite_to_postgres.py <sqlite-file> <postgres-url>

The target must already be migrated (`alembic upgrade head`). Its app tables are
emptied first (including the demo rows the migrations seed) so the result mirrors
the SQLite file; `alembic_version` is left alone.
"""
import sys

from sqlalchemy import create_engine, func, select, text

from graph_validator.service.storage import Base


def main(sqlite_file: str, pg_url: str) -> None:
    for prefix in ("postgresql://", "postgres://"):
        if pg_url.startswith(prefix):
            pg_url = "postgresql+psycopg://" + pg_url[len(prefix):]
    src = create_engine(f"sqlite:///{sqlite_file}")
    dst = create_engine(pg_url)
    tables = Base.metadata.sorted_tables  # parents before children

    with src.connect() as s, dst.begin() as d:
        names = ", ".join(f'"{t.name}"' for t in tables)
        d.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
        for table in tables:
            rows = [dict(r._mapping) for r in s.execute(select(table))]
            if rows:
                d.execute(table.insert(), rows)
            for col in table.primary_key.columns:
                if col.autoincrement is True or (col.type.python_type is int and col.autoincrement == "auto"):
                    d.execute(text(
                        f"SELECT setval(pg_get_serial_sequence('\"{table.name}\"', '{col.name}'), "
                        f"COALESCE((SELECT MAX(\"{col.name}\") FROM \"{table.name}\"), 1), "
                        f"(SELECT MAX(\"{col.name}\") IS NOT NULL FROM \"{table.name}\"))"
                    ))
            print(f"{table.name}: {len(rows)} rows")

    with dst.connect() as d:
        for table in tables:
            n = d.execute(select(func.count()).select_from(table)).scalar()
            print(f"verify {table.name}: {n}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
