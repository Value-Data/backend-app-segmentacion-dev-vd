"""Add poligono_coords and zoom_nivel columns to testblocks table."""

from app.core.database import engine
from sqlalchemy import text


def migrate():
    with engine.connect() as conn:
        for col, sql_type in [
            ("poligono_coords", "NVARCHAR(MAX) NULL"),
            ("zoom_nivel", "INT NULL"),
        ]:
            r = conn.execute(text(f"SELECT COL_LENGTH('testblocks', '{col}')"))
            if r.scalar() is None:
                conn.execute(text(f"ALTER TABLE testblocks ADD {col} {sql_type}"))
                print(f"  + Column '{col}' added to testblocks")
            else:
                print(f"  = Column '{col}' already exists in testblocks")
        conn.commit()
    print("Migration 004 complete.")


if __name__ == "__main__":
    migrate()
