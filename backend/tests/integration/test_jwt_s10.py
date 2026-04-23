"""Integration tests for S-10 JWT hardening.

Coverage:
- TTL por rol: admin token expira antes que visualizador.
- Logout revoca el jti: requests posteriores con el mismo token → 401.
- Logout es idempotente.
- Blacklist no afecta otros tokens del mismo usuario (solo el jti revocado).
- Claims iat/jti/id_usuario/email presentes (ya estaba, cubrimos regresión).
"""

import pytest

from app.core.config import get_settings
from app.core.security import create_access_token, decode_access_token
from app.models.sistema import Usuario


API = "/api/v1"


def test_jwt_has_jti_and_iat(auth_headers):
    token = auth_headers["Authorization"].split(" ", 1)[1]
    payload = decode_access_token(token)
    assert payload is not None
    assert "jti" in payload
    assert "iat" in payload
    assert len(payload["jti"]) >= 16  # uuid4 hex


def test_login_admin_ttl_shorter_than_viewer(client, test_user, db):
    """S-10: admin TTL (4h) < viewer TTL (12h)."""
    # test_user fixture is admin. Login returns admin token.
    settings = get_settings()
    r = client.post(f"{API}/auth/login", json={
        "username": test_user.username,
        "password": "Secret123!",
    })
    assert r.status_code == 200, r.text
    admin_token = r.json()["access_token"]
    admin_payload = decode_access_token(admin_token)
    admin_ttl_sec = admin_payload["exp"] - admin_payload["iat"]

    # Create a viewer user and login as them.
    from app.core.security import hash_password
    viewer = Usuario(
        username="s10viewer",
        nombre_completo="S10 Viewer",
        email="viewer@test.cl",
        password_hash=hash_password("Pass123!"),
        rol="visualizador",
        activo=True,
    )
    db.add(viewer)
    db.commit()

    r = client.post(f"{API}/auth/login", json={
        "username": "s10viewer",
        "password": "Pass123!",
    })
    assert r.status_code == 200
    viewer_token = r.json()["access_token"]
    viewer_payload = decode_access_token(viewer_token)
    viewer_ttl_sec = viewer_payload["exp"] - viewer_payload["iat"]

    assert admin_ttl_sec == settings.JWT_EXPIRE_MINUTES_ADMIN * 60
    assert viewer_ttl_sec == settings.JWT_EXPIRE_MINUTES_DEFAULT * 60
    assert admin_ttl_sec < viewer_ttl_sec


def test_logout_blacklists_jti(client, test_user):
    """S-10: after logout the same token must be rejected."""
    r = client.post(f"{API}/auth/login", json={
        "username": test_user.username, "password": "Secret123!",
    })
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Token works
    r = client.get(f"{API}/auth/me", headers=headers)
    assert r.status_code == 200

    # Logout
    r = client.post(f"{API}/auth/logout", headers=headers)
    assert r.status_code == 200

    # Same token is now rejected
    r = client.get(f"{API}/auth/me", headers=headers)
    assert r.status_code == 401
    assert "revocado" in r.json()["detail"].lower()


def test_logout_is_idempotent(client, test_user):
    r = client.post(f"{API}/auth/login", json={
        "username": test_user.username, "password": "Secret123!",
    })
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r1 = client.post(f"{API}/auth/logout", headers=headers)
    assert r1.status_code == 200

    # Second logout same token: sends a now-blacklisted Bearer; endpoint
    # must still return 200 (doesn't fetch current_user; works on raw token).
    r2 = client.post(f"{API}/auth/logout", headers=headers)
    assert r2.status_code == 200


def test_logout_does_not_affect_other_tokens(client, test_user):
    """Revoking one jti must not revoke another token for the same user."""
    # Two separate logins = two distinct jti.
    r1 = client.post(f"{API}/auth/login", json={
        "username": test_user.username, "password": "Secret123!",
    })
    token_a = r1.json()["access_token"]

    r2 = client.post(f"{API}/auth/login", json={
        "username": test_user.username, "password": "Secret123!",
    })
    token_b = r2.json()["access_token"]

    assert token_a != token_b

    # Logout token A
    client.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {token_a}"})

    # Token B still works
    r = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token_b}"})
    assert r.status_code == 200
