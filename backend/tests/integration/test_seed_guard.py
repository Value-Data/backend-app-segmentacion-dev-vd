"""Integration tests for EF-4 seed guard (require_non_production).

When settings.ENV is 'production', seed/destructive endpoints must
return 403. In other envs (dev/staging/test), they proceed as before.
"""

import pytest

from app.core.config import get_settings


API = "/api/v1"


@pytest.fixture()
def production_env(monkeypatch):
    """Force settings.ENV=production for one test, then clear cache."""
    get_settings.cache_clear()
    monkeypatch.setenv("ENV", "production")
    yield
    get_settings.cache_clear()


def test_seed_estados_fenologicos_blocked_in_production(client, auth_headers, production_env):
    r = client.post(f"{API}/labores/seed-estados-fenologicos",
                    headers=auth_headers)
    assert r.status_code == 403
    assert "entorno" in r.json()["detail"].lower()


def test_seed_tipos_labor_blocked_in_production(client, auth_headers, production_env):
    r = client.post(f"{API}/labores/seed-tipos-labor", headers=auth_headers)
    assert r.status_code == 403


def test_seed_demo_blocked_in_production(client, auth_headers, production_env):
    r = client.post(f"{API}/seed/demo", headers=auth_headers)
    assert r.status_code == 403


def test_seed_regiones_comunas_blocked_in_production(client, auth_headers, production_env):
    r = client.post(f"{API}/seed/regiones-comunas", headers=auth_headers)
    assert r.status_code == 403


def test_seed_susceptibilidades_blocked_in_production(client, auth_headers, production_env):
    r = client.post(f"{API}/seed/seed-susceptibilidades", headers=auth_headers)
    assert r.status_code == 403


def test_seed_endpoint_allowed_in_dev(client, auth_headers):
    """In default test env (ENV=dev) the endpoint is not gated at 403.

    It may return 201 (created), 400 (no especies to seed), or 500 if prerequisites
    are missing, but it must NOT be 403.
    """
    r = client.post(f"{API}/labores/seed-tipos-labor", headers=auth_headers)
    assert r.status_code != 403
