"""Integration tests for EF-2 hardening of /mantenedores/estados-fenologicos.

Covers:
- EF-2a: id_especie pointing to nonexistent Especie → 404 (no ghost FK)
- EF-2b: duplicate (id_especie, codigo) → 409
- Happy path: valid create succeeds
"""

import pytest

from app.models.maestras import Especie, EstadoFenologico


API = "/api/v1"


@pytest.fixture()
def especie_cer(db):
    esp = Especie(codigo="CER", nombre="Cerezo", activo=True)
    db.add(esp)
    db.commit()
    db.refresh(esp)
    return esp


def test_ef_ghost_especie_rejected(client, auth_headers):
    """EF-2a: create con id_especie inexistente → 404 (antes: 201 ghost)."""
    r = client.post(
        f"{API}/mantenedores/estados-fenologicos",
        json={
            "id_especie": 9999,
            "codigo": "YEMA",
            "nombre": "Yema dormante",
            "orden": 1,
        },
        headers=auth_headers,
    )
    assert r.status_code == 404
    assert "no existe" in r.json()["detail"].lower()


def test_ef_happy_path(client, auth_headers, especie_cer):
    r = client.post(
        f"{API}/mantenedores/estados-fenologicos",
        json={
            "id_especie": especie_cer.id_especie,
            "codigo": "YEMA",
            "nombre": "Yema dormante",
            "orden": 1,
        },
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text


def test_ef_duplicate_codigo_same_especie_rejected(client, auth_headers, especie_cer):
    """EF-2b: second create with same (id_especie, codigo) → 409."""
    payload = {
        "id_especie": especie_cer.id_especie,
        "codigo": "YEMA",
        "nombre": "Yema dormante",
        "orden": 1,
    }
    r1 = client.post(f"{API}/mantenedores/estados-fenologicos",
                     json=payload, headers=auth_headers)
    assert r1.status_code == 201
    r2 = client.post(f"{API}/mantenedores/estados-fenologicos",
                     json=payload, headers=auth_headers)
    assert r2.status_code == 409
    assert "ya existe" in r2.json()["detail"].lower()


def test_ef_same_codigo_different_especies_ok(client, auth_headers, especie_cer, db):
    """Same codigo across different especies is allowed (uniqueness is per-especie)."""
    cir = Especie(codigo="CIR", nombre="Ciruela", activo=True)
    db.add(cir)
    db.commit()
    db.refresh(cir)

    for esp_id in (especie_cer.id_especie, cir.id_especie):
        r = client.post(
            f"{API}/mantenedores/estados-fenologicos",
            json={
                "id_especie": esp_id,
                "codigo": "FLOR",
                "nombre": "Floración",
                "orden": 5,
            },
            headers=auth_headers,
        )
        assert r.status_code == 201, r.text
