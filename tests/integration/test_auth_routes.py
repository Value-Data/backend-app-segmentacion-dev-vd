"""Integration tests for auth routes: /api/v1/auth/*."""

from tests.conftest import TEST_USERNAME, TEST_PASSWORD


class TestLoginRoute:
    """Tests for POST /api/v1/auth/login."""

    def test_login_success(self, client, test_user):
        """POST /auth/login with correct credentials should return a token."""
        response = client.post(
            "/api/v1/auth/login",
            json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["username"] == TEST_USERNAME

    def test_login_wrong_password(self, client, test_user):
        """POST /auth/login with wrong password should return 401."""
        response = client.post(
            "/api/v1/auth/login",
            json={"username": TEST_USERNAME, "password": "WrongPassword!"},
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        """POST /auth/login with unknown username should return 401."""
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "noone", "password": "whatever"},
        )
        assert response.status_code == 401

    def test_login_missing_fields(self, client):
        """POST /auth/login without required fields should return 422."""
        response = client.post("/api/v1/auth/login", json={})
        assert response.status_code == 422


class TestMeRoute:
    """Tests for GET /api/v1/auth/me."""

    def test_me_with_valid_token(self, client, test_user, auth_headers):
        """GET /auth/me with a valid JWT should return user info."""
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == TEST_USERNAME
        assert data["rol"] == "admin"
        assert "id_usuario" in data

    def test_me_without_token(self, client):
        """GET /auth/me without Authorization header should return 401."""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    def test_me_with_invalid_token(self, client):
        """GET /auth/me with a bad token should return 401."""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401


class TestLogoutRoute:
    """Tests for POST /api/v1/auth/logout."""

    def test_logout_returns_ok(self, client):
        """POST /auth/logout should return {"ok": True}."""
        response = client.post("/api/v1/auth/logout")
        assert response.status_code == 200
        assert response.json() == {"ok": True}
