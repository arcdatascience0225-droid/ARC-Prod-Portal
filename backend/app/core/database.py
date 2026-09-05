import sqlite3
import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

# A few repositories run raw SQL (via sqlalchemy.text(...)) with a
# uuid.UUID Python object as a bind parameter (e.g. `current_user.id`).
# psycopg2 (Postgres) knows how to adapt uuid.UUID automatically; Python's
# built-in sqlite3 module does not, and raises
# "sqlite3.ProgrammingError: Error binding parameter ...: type 'UUID' is
# not supported" unless we teach it how. This registers that conversion
# once, globally, for every sqlite3 connection in the process - it has no
# effect at all when running against Postgres.
sqlite3.register_adapter(uuid.UUID, lambda u: str(u))

# SQLite's default driver only allows the connection to be used from the
# thread that created it; FastAPI runs each request in a threadpool worker,
# so this flag is required when running against sqlite:/// URLs. It's a
# no-op (ignored) for every other backend, including Postgres.
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine_kwargs = {"pool_pre_ping": True, "connect_args": connect_args}
if not settings.DATABASE_URL.startswith("sqlite"):
    # Default pool (5 + 10 overflow = 15 max connections) is too small once
    # a few dozen students are active at once (each request briefly opens
    # a session — answer-saves, snapshots, violation reports, etc. all add
    # up). pool_recycle avoids using a connection Supabase's pooler has
    # silently dropped after sitting idle.
    engine_kwargs.update(pool_size=15, max_overflow=25, pool_recycle=300, pool_timeout=20)

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
