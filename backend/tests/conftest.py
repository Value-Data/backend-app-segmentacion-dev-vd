"""Shared test fixtures: SQLite in-memory engine, DB session, TestClient, test user."""

import pytest
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.security import hash_password, create_access_token
from app.core.database import get_db
from app.main import app
from app.models.sistema import Usuario


# ---------------------------------------------------------------------------
# Engine: SQLite in-memory, shared across a test session
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def engine():
    """Create a single SQLite in-memory engine for the entire test session."""
    _engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Create all tables defined in SQLModel metadata
    SQLModel.metadata.create_all(_engine)
    yield _engine
    _engine.dispose()


# ---------------------------------------------------------------------------
# DB session: one per test, with rollback for isolation
# ---------------------------------------------------------------------------

@pytest.fixture()
def db(engine):
    """Yield a DB session that rolls back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ---------------------------------------------------------------------------
# TestClient with overridden get_db
# ---------------------------------------------------------------------------

@pytest.fixture()
def client(db):
    """FastAPI TestClient with the get_db dependency overridden to use the test session."""

    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Test user: a Usuario row with a hashed password in the test DB
# ---------------------------------------------------------------------------

TEST_USERNAME = "testadmin"
TEST_PASSWORD = "Secret123!"
TEST_ROL = "admin"


@pytest.fixture()
def test_user(db) -> Usuario:
    """Insert a test user with a bcrypt-hashed password and return it."""
    user = Usuario(
        username=TEST_USERNAME,
        nombre_completo="Test Admin",
        email="test@garcesfruit.cl",
        password_hash=hash_password(TEST_PASSWORD),
        rol=TEST_ROL,
        activo=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Auth headers: Bearer token for the test user
# ---------------------------------------------------------------------------

@pytest.fixture()
def auth_headers(test_user) -> dict[str, str]:
    """Return Authorization headers with a valid JWT for the test user."""
    token = create_access_token({"sub": test_user.username, "rol": test_user.rol})
    return {"Authorization": f"Bearer {token}"}
