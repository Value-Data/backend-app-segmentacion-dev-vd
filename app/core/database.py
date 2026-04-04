"""SQLAlchemy engine and session management for SQL Server."""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlmodel import SQLModel

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_size=5,
    max_overflow=10,
    pool_recycle=1800,
    pool_pre_ping=True,
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)


def get_db():
    """Dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
