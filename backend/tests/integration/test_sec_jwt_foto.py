"""Integration tests for SEC-JWT: /files/fotos/{fid} auth hardening.

Before: the endpoint accepted both Authorization: Bearer and ?token=
fallback. JWTs in query strings leak to proxy/CDN logs, referer headers
and shared caches.

After:
- Authorization: Bearer <token> is the only supported auth.
- Any request with ?token= returns 410 Gone with deprecation message.
- Request with no auth returns 401.
"""

import pytest

from app.core.security import create_access_token
from app.models.maestras import Especie
from app.models.variedades import Variedad
from app.models.variedades_extra import VariedadFoto


API = "/api/v1"


@pytest.fixture()
def foto_id(db):
    esp = Especie(codigo="CER", nombre="Cerezo", activo=True)
    db.add(esp)
    db.commit()
    db.refresh(esp)
    var = Variedad(codigo="CER-FOTO-1", nombre="Con foto",
                   id_especie=esp.id_especie, activo=True)
    db.add(var)
    db.commit()
    db.refresh(var)
    foto = VariedadFoto(
        id_variedad=var.id_variedad,
        filename="t.jpg",
        filepath="db",
        content_type="image/jpeg",
        data=b"\x89PNG\r\n\x1a\n" + b"\x00" * 16,  # any bytes
    )
    db.add(foto)
    db.commit()
    db.refresh(foto)
    return foto.id


def test_foto_with_bearer_header_ok(client, auth_headers, foto_id):
    r = client.get(f"{API}/files/fotos/{foto_id}", headers=auth_headers)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/")


def test_foto_with_query_token_returns_410(client, test_user, foto_id):
    """SEC-JWT: ?token= is deprecated → 410 Gone, never serves the image."""
    token = create_access_token({"sub": test_user.username, "rol": test_user.rol})
    r = client.get(f"{API}/files/fotos/{foto_id}", params={"token": token})
    assert r.status_code == 410
    assert "deprecado" in r.json()["detail"].lower()


def test_foto_with_both_header_and_query_token_returns_410(client, auth_headers, test_user, foto_id):
    """Even if the header is valid, any ?token= present triggers 410.

    This forces clients to migrate cleanly; the header alone is the
    only supported flow.
    """
    token = create_access_token({"sub": test_user.username, "rol": test_user.rol})
    r = client.get(f"{API}/files/fotos/{foto_id}",
                   params={"token": token}, headers=auth_headers)
    assert r.status_code == 410


def test_foto_no_auth_returns_401(client, foto_id):
    r = client.get(f"{API}/files/fotos/{foto_id}")
    assert r.status_code == 401


def test_foto_invalid_bearer_returns_401(client, foto_id):
    r = client.get(f"{API}/files/fotos/{foto_id}",
                   headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401
