"""Integration tests for SUS-2..6 hardening.

Covers:
- SUS-2: GET /mantenedores/susceptibilidades?especie=X filters by id_especie
- SUS-2: POST /mantenedores/susceptibilidades accepts id_especie
- SUS-4: POST /variedades/{id}/susceptibilidades cross-especie → 422
- SUS-5: POST with extra id_variedad in body → 422 (extra="forbid")
- SUS-6: DELETE writes audit_log row
"""

import pytest

from app.models.maestras import Especie, Susceptibilidad
from app.models.variedades import Variedad, VariedadSusceptibilidad
from app.models.sistema import AuditLog


API = "/api/v1"


@pytest.fixture()
def fixtures(db):
    cer = Especie(codigo="CER", nombre="Cerezo", activo=True)
    cir = Especie(codigo="CIR", nombre="Ciruela", activo=True)
    db.add_all([cer, cir])
    db.commit()
    db.refresh(cer)
    db.refresh(cir)

    var_cer = Variedad(codigo="CER-SUS-001", nombre="Cerezo V1",
                       id_especie=cer.id_especie, activo=True)
    var_cir = Variedad(codigo="CIR-SUS-001", nombre="Ciruela V1",
                       id_especie=cir.id_especie, activo=True)
    db.add_all([var_cer, var_cir])
    db.commit()
    db.refresh(var_cer)
    db.refresh(var_cir)

    sus_cer = Susceptibilidad(codigo="CER-DAH-001", nombre="Pitting",
                              id_especie=cer.id_especie, grupo="Daños", activo=True)
    sus_cir = Susceptibilidad(codigo="CIR-PUD-001", nombre="Monilia",
                              id_especie=cir.id_especie, grupo="Pudriciones", activo=True)
    sus_legacy = Susceptibilidad(codigo="LGY-001", nombre="Legacy sin especie",
                                  id_especie=None, activo=True)
    db.add_all([sus_cer, sus_cir, sus_legacy])
    db.commit()
    for s in (sus_cer, sus_cir, sus_legacy):
        db.refresh(s)

    return {
        "cer": cer, "cir": cir,
        "var_cer": var_cer, "var_cir": var_cir,
        "sus_cer": sus_cer, "sus_cir": sus_cir, "sus_legacy": sus_legacy,
    }


def test_sus_filter_by_especie(client, auth_headers, fixtures):
    """SUS-2: GET /mantenedores/susceptibilidades?especie=<cer> returns only cer rows."""
    r = client.get(
        f"{API}/mantenedores/susceptibilidades",
        params={"especie": fixtures["cer"].id_especie},
        headers=auth_headers,
    )
    assert r.status_code == 200
    codigos = [row["codigo"] for row in r.json()]
    assert "CER-DAH-001" in codigos
    assert "CIR-PUD-001" not in codigos


def test_sus_create_with_id_especie(client, auth_headers, fixtures, db):
    """SUS-2: POST /mantenedores/susceptibilidades persists id_especie."""
    payload = {
        "codigo": "CER-NEW-001",
        "nombre": "Nueva cerezo",
        "grupo": "Daños",
        "id_especie": fixtures["cer"].id_especie,
    }
    r = client.post(f"{API}/mantenedores/susceptibilidades",
                    json=payload, headers=auth_headers)
    assert r.status_code == 201, r.text

    # Response may omit id_especie (generic CRUD has no response_model),
    # so verify persistence directly in DB.
    row = db.query(Susceptibilidad).filter_by(codigo="CER-NEW-001").first()
    assert row is not None
    assert row.id_especie == fixtures["cer"].id_especie
    assert row.grupo == "Daños"


def test_sus_assign_cross_species_rejected(client, auth_headers, fixtures):
    """SUS-4: assigning ciruela susceptibilidad to a cerezo variedad → 422."""
    r = client.post(
        f"{API}/mantenedores/variedades/{fixtures['var_cer'].id_variedad}/susceptibilidades",
        json={"id_suscept": fixtures["sus_cir"].id_suscept},
        headers=auth_headers,
    )
    assert r.status_code == 422
    assert "no aplica" in r.json()["detail"].lower()


def test_sus_assign_same_species_ok(client, auth_headers, fixtures):
    """SUS-4: same-species assignment succeeds."""
    r = client.post(
        f"{API}/mantenedores/variedades/{fixtures['var_cer'].id_variedad}/susceptibilidades",
        json={"id_suscept": fixtures["sus_cer"].id_suscept},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text


def test_sus_assign_legacy_no_especie_ok(client, auth_headers, fixtures):
    """Legacy susceptibilidad without id_especie → allowed (no bloqueo)."""
    r = client.post(
        f"{API}/mantenedores/variedades/{fixtures['var_cer'].id_variedad}/susceptibilidades",
        json={"id_suscept": fixtures["sus_legacy"].id_suscept},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text


def test_sus_body_with_id_variedad_rejected(client, auth_headers, fixtures):
    """SUS-5: body con id_variedad → 422 (extra='forbid')."""
    r = client.post(
        f"{API}/mantenedores/variedades/{fixtures['var_cer'].id_variedad}/susceptibilidades",
        json={
            "id_variedad": fixtures["var_cer"].id_variedad,
            "id_suscept": fixtures["sus_cer"].id_suscept,
        },
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_sus_delete_writes_audit(client, auth_headers, fixtures, db):
    """SUS-6: DELETE /variedades/{id}/susceptibilidades/{vs} leaves an audit row."""
    r = client.post(
        f"{API}/mantenedores/variedades/{fixtures['var_cer'].id_variedad}/susceptibilidades",
        json={"id_suscept": fixtures["sus_cer"].id_suscept},
        headers=auth_headers,
    )
    assert r.status_code == 201
    id_vs = r.json()["id_vs"]

    r = client.delete(
        f"{API}/mantenedores/variedades/{fixtures['var_cer'].id_variedad}/susceptibilidades/{id_vs}",
        headers=auth_headers,
    )
    assert r.status_code == 200

    rows = db.query(AuditLog).filter(AuditLog.accion == "DELETE").all()
    assert any('"tabla": "variedad_susceptibilidades"' in a.detalle for a in rows)


def test_sus_variedad_not_found_404(client, auth_headers, fixtures):
    r = client.post(
        f"{API}/mantenedores/variedades/99999/susceptibilidades",
        json={"id_suscept": fixtures["sus_cer"].id_suscept},
        headers=auth_headers,
    )
    assert r.status_code == 404


def test_sus_susceptibilidad_not_found_404(client, auth_headers, fixtures):
    r = client.post(
        f"{API}/mantenedores/variedades/{fixtures['var_cer'].id_variedad}/susceptibilidades",
        json={"id_suscept": 99999},
        headers=auth_headers,
    )
    assert r.status_code == 404
