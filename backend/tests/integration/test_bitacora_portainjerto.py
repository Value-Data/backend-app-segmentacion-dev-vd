"""Integration tests for bitácora portainjerto hardening.

Same pattern as bitácora variedad (Pase 1): extra='forbid', bleach
sanitization, date range validation.
"""

import pytest
from datetime import date

from app.models.maestras import Portainjerto
from app.models.variedades_extra import BitacoraPortainjerto


API = "/api/v1"


@pytest.fixture()
def portainjerto(db):
    pi = Portainjerto(codigo="GIS6", nombre="Gisela 6", activo=True)
    db.add(pi)
    db.commit()
    db.refresh(pi)
    return pi


def test_bitacora_pi_empty_body_rejected(client, auth_headers, portainjerto):
    r = client.post(
        f"{API}/portainjertos/{portainjerto.id_portainjerto}/bitacora",
        json={}, headers=auth_headers,
    )
    assert r.status_code == 422  # nota required


def test_bitacora_pi_xss_sanitized(client, auth_headers, portainjerto):
    r = client.post(
        f"{API}/portainjertos/{portainjerto.id_portainjerto}/bitacora",
        json={"nota": "<script>alert(1)</script>Observación normal"},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    assert "<" not in r.json()["nota"]
    assert "Observación normal" in r.json()["nota"]


def test_bitacora_pi_extra_field_rejected(client, auth_headers, portainjerto):
    r = client.post(
        f"{API}/portainjertos/{portainjerto.id_portainjerto}/bitacora",
        json={"nota": "test", "created_by": "hacker"},  # created_by forbidden
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_bitacora_pi_fecha_out_of_range_rejected(client, auth_headers, portainjerto):
    r = client.post(
        f"{API}/portainjertos/{portainjerto.id_portainjerto}/bitacora",
        json={"nota": "test", "fecha": "1980-01-01"},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_bitacora_pi_happy_path(client, auth_headers, portainjerto, db):
    r = client.post(
        f"{API}/portainjertos/{portainjerto.id_portainjerto}/bitacora",
        json={"nota": "Injerto exitoso en 14 de 15", "fecha": date.today().isoformat()},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["nota"].startswith("Injerto exitoso")
    row = db.get(BitacoraPortainjerto, body["id"])
    assert row is not None
    assert row.created_by == "testadmin"
