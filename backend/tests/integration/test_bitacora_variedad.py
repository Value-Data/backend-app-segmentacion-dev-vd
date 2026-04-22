"""Integration tests for BIT-2..5 hardening of /variedades/{id}/bitacora.

Covers:
- BIT-2: required fields (empty body rejected)
- BIT-3: fecha out of range rejected
- BIT-4: XSS sanitized in titulo/contenido
- BIT-5: extra fields rejected (strict schema)
- tipo_entrada: must be a known enum value
- happy path: valid entry persists with tipo_entrada and usuario
"""

import pytest
from datetime import date, timedelta

from app.models.maestras import Especie
from app.models.variedades import Variedad


API = "/api/v1"


@pytest.fixture()
def variedad(db):
    esp = Especie(codigo="CER", nombre="Cerezo", activo=True)
    db.add(esp)
    db.commit()
    db.refresh(esp)
    v = Variedad(codigo="CER-BIT-001", nombre="Test Var", id_especie=esp.id_especie, activo=True)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


def _valid_payload():
    return {
        "tipo_entrada": "Visita terreno test block",
        "titulo": "Visita de control",
        "contenido": "Planta sana, 3 brotes nuevos",
        "fecha": date.today().isoformat(),
    }


def test_bit_empty_body_rejected(client, auth_headers, variedad):
    """BIT-2: empty body should not create a 201."""
    r = client.post(
        f"{API}/mantenedores/variedades/{variedad.id_variedad}/bitacora",
        json={},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_bit_missing_required_fields_rejected(client, auth_headers, variedad):
    """BIT-2: partial body missing titulo/contenido → 422."""
    r = client.post(
        f"{API}/mantenedores/variedades/{variedad.id_variedad}/bitacora",
        json={"tipo_entrada": "Visita terreno test block", "fecha": date.today().isoformat()},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_bit_fecha_out_of_range_rejected(client, auth_headers, variedad):
    """BIT-3: fecha pre-2000 or far future → 422."""
    payload = _valid_payload()
    payload["fecha"] = "1999-12-31"
    r = client.post(
        f"{API}/mantenedores/variedades/{variedad.id_variedad}/bitacora",
        json=payload, headers=auth_headers,
    )
    assert r.status_code == 422

    payload["fecha"] = "2999-01-01"
    r = client.post(
        f"{API}/mantenedores/variedades/{variedad.id_variedad}/bitacora",
        json=payload, headers=auth_headers,
    )
    assert r.status_code == 422


def test_bit_xss_sanitized(client, auth_headers, variedad):
    """BIT-4: <img onerror=...> stripped from titulo and contenido."""
    payload = _valid_payload()
    payload["titulo"] = "<img src=x onerror=alert(1)>Control OK"
    payload["contenido"] = "<script>evil()</script>Planta sana"
    r = client.post(
        f"{API}/mantenedores/variedades/{variedad.id_variedad}/bitacora",
        json=payload, headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    for field in ("titulo", "contenido"):
        assert "<" not in body[field] and ">" not in body[field], body[field]
    assert "Control OK" in body["titulo"]
    assert "Planta sana" in body["contenido"]


def test_bit_extra_field_rejected(client, auth_headers, variedad):
    """BIT-5: unknown field → 422."""
    payload = _valid_payload()
    payload["tipo"] = "Visita terreno"  # QA tried this — it's not tipo_entrada
    r = client.post(
        f"{API}/mantenedores/variedades/{variedad.id_variedad}/bitacora",
        json=payload, headers=auth_headers,
    )
    assert r.status_code == 422


def test_bit_tipo_entrada_must_be_enum(client, auth_headers, variedad):
    """tipo_entrada out of enum values → 422."""
    payload = _valid_payload()
    payload["tipo_entrada"] = "TIPO_INVENTADO"
    r = client.post(
        f"{API}/mantenedores/variedades/{variedad.id_variedad}/bitacora",
        json=payload, headers=auth_headers,
    )
    assert r.status_code == 422


def test_bit_happy_path_persists_tipo_entrada_and_usuario(client, auth_headers, variedad, db):
    """Valid payload → 201 and row stores tipo_entrada + usuario."""
    from app.models.bitacora import BitacoraVariedad

    payload = _valid_payload()
    r = client.post(
        f"{API}/mantenedores/variedades/{variedad.id_variedad}/bitacora",
        json=payload, headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["tipo_entrada"] == "Visita terreno test block"
    assert body["usuario"]  # testadmin

    row = db.query(BitacoraVariedad).filter_by(id_entrada=body["id_entrada"]).first()
    assert row.tipo_entrada == "Visita terreno test block"


def test_bit_update_fecha_range_enforced(client, auth_headers, variedad):
    """PUT also enforces fecha range."""
    # Create first
    r = client.post(
        f"{API}/mantenedores/variedades/{variedad.id_variedad}/bitacora",
        json=_valid_payload(), headers=auth_headers,
    )
    assert r.status_code == 201
    bid = r.json()["id_entrada"]

    # Update with bad date
    r = client.put(
        f"{API}/mantenedores/variedades/{variedad.id_variedad}/bitacora/{bid}",
        json={"fecha": "1980-01-01"}, headers=auth_headers,
    )
    assert r.status_code == 422
