"""Integration tests for POL-1..7 hardening of /variedades/{id}/polinizantes.

Covers:
- POL-1 cross-especie rejected
- POL-2 self-reference rejected
- POL-3 XSS sanitized
- POL-4 extra fields rejected (strict schema)
- POL-7 duplicate rejected
- Happy path same-especie by FK
- Happy path free-text (no FK)
- DELETE soft-deletes and audit
"""

import pytest

from app.models.maestras import Especie
from app.models.variedades import Variedad


API = "/api/v1"


@pytest.fixture()
def especies(db):
    cer = Especie(codigo="CER", nombre="Cerezo", activo=True)
    cir = Especie(codigo="CIR", nombre="Ciruela", activo=True)
    db.add_all([cer, cir])
    db.commit()
    db.refresh(cer)
    db.refresh(cir)
    return {"cerezo": cer, "ciruela": cir}


@pytest.fixture()
def variedades(db, especies):
    rows = [
        Variedad(codigo="CER-TEST-001", nombre="Cerezo A", id_especie=especies["cerezo"].id_especie, activo=True),
        Variedad(codigo="CER-TEST-002", nombre="Cerezo B", id_especie=especies["cerezo"].id_especie, activo=True),
        Variedad(codigo="CIR-TEST-001", nombre="Ciruela X", id_especie=especies["ciruela"].id_especie, activo=True),
    ]
    db.add_all(rows)
    db.commit()
    for r in rows:
        db.refresh(r)
    return {"cerA": rows[0], "cerB": rows[1], "cirX": rows[2]}


def test_pol_same_especie_by_fk_ok(client, auth_headers, variedades):
    """Happy path: same especie FK accepted."""
    r = client.post(
        f"{API}/variedades/{variedades['cerA'].id_variedad}/polinizantes",
        json={"polinizante_variedad_id": variedades["cerB"].id_variedad},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["polinizante_variedad_id"] == variedades["cerB"].id_variedad
    assert body["polinizante_nombre"] == "Cerezo B"


def test_pol_cross_especie_rejected(client, auth_headers, variedades):
    """POL-1: polinizante from different especie → 422."""
    r = client.post(
        f"{API}/variedades/{variedades['cerA'].id_variedad}/polinizantes",
        json={"polinizante_variedad_id": variedades["cirX"].id_variedad},
        headers=auth_headers,
    )
    assert r.status_code == 422
    assert "misma especie" in r.json()["detail"].lower()


def test_pol_self_reference_rejected(client, auth_headers, variedades):
    """POL-2: self-reference → 422."""
    r = client.post(
        f"{API}/variedades/{variedades['cerA'].id_variedad}/polinizantes",
        json={"polinizante_variedad_id": variedades["cerA"].id_variedad},
        headers=auth_headers,
    )
    assert r.status_code == 422
    assert "sí misma" in r.json()["detail"]


def test_pol_xss_sanitized_in_nombre(client, auth_headers, variedades):
    """POL-3: <script> stripped from polinizante_nombre.

    bleach(strip=True, tags=[]) removes the tag wrapper; inner text may
    remain as plain text. That is safe because (a) the DB never stores
    the tag, (b) React escapes on render.
    """
    r = client.post(
        f"{API}/variedades/{variedades['cerA'].id_variedad}/polinizantes",
        json={"polinizante_nombre": "<script>alert(1)</script>Externo Z"},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    nombre = r.json()["polinizante_nombre"]
    # Tag wrapper must be gone — not renderable as HTML anymore
    assert "<script>" not in nombre
    assert "</script>" not in nombre
    assert "<" not in nombre and ">" not in nombre
    # Safe user content preserved
    assert "Externo Z" in nombre


def test_pol_extra_field_rejected(client, auth_headers, variedades):
    """POL-4: unknown field → 422 (extra='forbid')."""
    r = client.post(
        f"{API}/variedades/{variedades['cerA'].id_variedad}/polinizantes",
        json={
            "polinizante_variedad_id": variedades["cerB"].id_variedad,
            "activo": False,  # unknown — should be rejected
        },
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_pol_no_fk_no_name_rejected(client, auth_headers, variedades):
    """Schema: requires one of FK or nombre."""
    r = client.post(
        f"{API}/variedades/{variedades['cerA'].id_variedad}/polinizantes",
        json={},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_pol_duplicate_rejected(client, auth_headers, variedades):
    """POL-7: second insert of same polinizante → 409."""
    payload = {"polinizante_variedad_id": variedades["cerB"].id_variedad}
    url = f"{API}/variedades/{variedades['cerA'].id_variedad}/polinizantes"
    r1 = client.post(url, json=payload, headers=auth_headers)
    assert r1.status_code == 201
    r2 = client.post(url, json=payload, headers=auth_headers)
    assert r2.status_code == 409
    assert "ya registrado" in r2.json()["detail"].lower()


def test_pol_delete_soft_and_audit(client, auth_headers, variedades, db):
    """DELETE sets activo=False and leaves an audit_log row."""
    from app.models.sistema import AuditLog

    r = client.post(
        f"{API}/variedades/{variedades['cerA'].id_variedad}/polinizantes",
        json={"polinizante_variedad_id": variedades["cerB"].id_variedad},
        headers=auth_headers,
    )
    pid = r.json()["id"]

    r = client.delete(
        f"{API}/variedades/{variedades['cerA'].id_variedad}/polinizantes/{pid}",
        headers=auth_headers,
    )
    assert r.status_code == 200

    audits = db.query(AuditLog).filter(AuditLog.accion == "DELETE").all()
    assert any('"tabla": "variedades_polinizantes"' in a.detalle for a in audits)
