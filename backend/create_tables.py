"""Creates every table in the platform in one shot.

Usage:
    python create_tables.py

This is the recommended way to stand up a fresh database for this merged
project. `app.models` imports every model module so `Base.metadata`
contains the full merged schema (all Foundation / Student / Faculty /
HR-Placement / Admin+Analytics tables) - a single `create_all()` call
creates them all with correct FK ordering resolved by SQLAlchemy.

An Alembic scaffold is also provided under alembic/ for teams who want
versioned migrations going forward; `alembic revision --autogenerate`
will pick up this same merged metadata.
"""
from app.core.database import Base, engine
import app.models  # noqa: F401  (imports every model so metadata is complete)


def main():
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print(f"Done. {len(Base.metadata.tables)} tables ensured:")
    for name in sorted(Base.metadata.tables.keys()):
        print(f"  - {name}")


if __name__ == "__main__":
    main()
