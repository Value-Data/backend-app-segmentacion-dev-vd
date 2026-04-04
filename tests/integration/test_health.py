"""Integration tests for root and health endpoints."""


class TestRootEndpoint:
    """Tests for GET /."""

    def test_root_returns_app_info(self, client):
        """GET / should return app name, version, company, and docs URL."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "app" in data
        assert "version" in data
        assert "company" in data
        assert data["company"] == "Garces Fruit"
        assert data["docs"] == "/api/docs"


class TestHealthEndpoint:
    """Tests for GET /health."""

    def test_health_returns_ok(self, client):
        """GET /health should return {"status": "ok"}."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
