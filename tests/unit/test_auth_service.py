"""Unit tests for app.services.auth_service — authenticate function."""

import pytest
from fastapi import HTTPException

from app.core.security import hash_password
from app.models.sistema import Usuario
from app.schemas.auth import LoginRequest
from app.services.auth_service import authenticate


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_user(db, username: str, password: str, activo: bool = True, rol: str = "admin") -> Usuario:
    """Insert a test user with a hashed password."""
    user = Usuario(
        username=username,
        nombre_completo=f"Test {username}",
        email=f"{username}@test.cl",
        password_hash=hash_password(password),
        rol=rol,
        activo=activo,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestAuthenticate:
    """Tests for auth_service.authenticate."""

    def test_authenticate_valid_credentials(self, db):
        """authenticate should return a TokenResponse for valid username + password."""
        _create_user(db, "validuser", "ValidPass123!")
        req = LoginRequest(username="validuser", password="ValidPass123!")

        response = authenticate(db, req)

        assert response.access_token is not None
        assert len(response.access_token) > 0
        assert response.token_type == "bearer"
        assert response.user.username == "validuser"

    def test_authenticate_wrong_password(self, db):
        """authenticate should raise 401 for wrong password."""
        _create_user(db, "user_wp", "RealPassword!")
        req = LoginRequest(username="user_wp", password="WrongPassword!")

        with pytest.raises(HTTPException) as exc_info:
            authenticate(db, req)
        assert exc_info.value.status_code == 401
        assert "incorrectos" in exc_info.value.detail

    def test_authenticate_nonexistent_user(self, db):
        """authenticate should raise 401 for a username that does not exist."""
        req = LoginRequest(username="ghost", password="anything")

        with pytest.raises(HTTPException) as exc_info:
            authenticate(db, req)
        assert exc_info.value.status_code == 401

    def test_authenticate_inactive_user(self, db):
        """authenticate should raise 401 for an inactive user."""
        _create_user(db, "inactive_user", "GoodPass!", activo=False)
        req = LoginRequest(username="inactive_user", password="GoodPass!")

        with pytest.raises(HTTPException) as exc_info:
            authenticate(db, req)
        assert exc_info.value.status_code == 401

    def test_authenticate_updates_ultimo_acceso(self, db):
        """authenticate should update the ultimo_acceso timestamp on success."""
        user = _create_user(db, "access_user", "Pass123!")
        assert user.ultimo_acceso is None

        req = LoginRequest(username="access_user", password="Pass123!")
        authenticate(db, req)

        db.refresh(user)
        assert user.ultimo_acceso is not None

    def test_authenticate_returns_user_info(self, db):
        """authenticate response should include correct UserInfo fields."""
        _create_user(db, "infouser", "Pass!", rol="agronomo")
        req = LoginRequest(username="infouser", password="Pass!")

        response = authenticate(db, req)
        assert response.user.username == "infouser"
        assert response.user.rol == "agronomo"
        assert response.user.email == "infouser@test.cl"
