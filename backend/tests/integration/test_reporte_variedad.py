"""Integration tests for REP-1: reporte de variedad must include
polinizantes y susceptibilidades con nombres resueltos (no #id).

Antes: GET /reportes/variedad/{id} → {variedad, inventario, plantaciones,
mediciones, bitacora, labores_count} — segmentación y AI trabajaban con
data incompleta.

Ahora: response incluye polinizantes[] y susceptibilidades[] con nombre,
código, grupo, severidad resueltos via JOIN.
"""

import pytest

from app.models.maestras import Especie, Susceptibilidad
from app.models.variedades import Variedad, VariedadSusceptibilidad
from app.models.variedades_extra import VariedadPolinizante


API = "/api/v1"


@pytest.fixture()
def tamara_like(db):
    """Build a Tamara-like variedad (Cerezo) with pol + sus."""
    cer = Especie(codigo="CER", nombre="Cerezo", activo=True)
    db.add(cer)
    db.commit()
    db.refresh(cer)

    tamara = Variedad(codigo="CER-73", nombre="Tamara",
                       id_especie=cer.id_especie, activo=True)
    partner = Variedad(codigo="CER-74", nombre="Lapins",
                       id_especie=cer.id_especie, activo=True)
    db.add_all([tamara, partner])
    db.commit()
    db.refresh(tamara)
    db.refresh(partner)

    sus_pitting = Susceptibilidad(codigo="CER-DAH-001", nombre="Pitting",
                                   id_especie=cer.id_especie, grupo="Daños", severidad="alta",
                                   activo=True)
    sus_sutura = Susceptibilidad(codigo="CER-PYS-003", nombre="Sutura",
                                  id_especie=cer.id_especie, grupo="Partiduras", severidad="media",
                                  activo=True)
    db.add_all([sus_pitting, sus_sutura])
    db.commit()
    for s in (sus_pitting, sus_sutura):
        db.refresh(s)

    # Link
    db.add(VariedadPolinizante(id_variedad=tamara.id_variedad,
                                polinizante_variedad_id=partner.id_variedad,
                                polinizante_nombre=partner.nombre, activo=True))
    db.add(VariedadSusceptibilidad(id_variedad=tamara.id_variedad,
                                    id_suscept=sus_pitting.id_suscept, nivel="alta"))
    db.add(VariedadSusceptibilidad(id_variedad=tamara.id_variedad,
                                    id_suscept=sus_sutura.id_suscept, nivel="media"))
    db.commit()

    return {"tamara": tamara, "partner": partner,
            "sus_pitting": sus_pitting, "sus_sutura": sus_sutura}


def test_reporte_includes_polinizantes(client, auth_headers, tamara_like):
    r = client.get(
        f"{API}/reportes/variedad/{tamara_like['tamara'].id_variedad}",
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "polinizantes" in body
    assert len(body["polinizantes"]) == 1
    pol = body["polinizantes"][0]
    assert pol["polinizante_codigo"] == "CER-74"
    assert pol["polinizante_nombre"] == "Lapins"


def test_reporte_includes_susceptibilidades_with_names(client, auth_headers, tamara_like):
    r = client.get(
        f"{API}/reportes/variedad/{tamara_like['tamara'].id_variedad}",
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "susceptibilidades" in body
    assert len(body["susceptibilidades"]) == 2

    nombres = {s["nombre"] for s in body["susceptibilidades"]}
    assert nombres == {"Pitting", "Sutura"}

    # Todas traen grupo + severidad resueltos (no #id)
    for s in body["susceptibilidades"]:
        assert s["codigo"] is not None
        assert s["grupo"] is not None
        assert s["severidad"] is not None


def test_reporte_empty_variedad_has_empty_lists(client, auth_headers, db):
    """Variedad sin polinizantes ni susceptibilidades → listas vacías, no 500."""
    esp = Especie(codigo="NEC", nombre="Nectarina", activo=True)
    db.add(esp)
    db.commit()
    db.refresh(esp)
    v = Variedad(codigo="NEC-EMPTY", nombre="Empty V",
                 id_especie=esp.id_especie, activo=True)
    db.add(v)
    db.commit()
    db.refresh(v)

    r = client.get(f"{API}/reportes/variedad/{v.id_variedad}", headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["polinizantes"] == []
    assert body["susceptibilidades"] == []


def test_reporte_preserves_existing_keys(client, auth_headers, tamara_like):
    """No rompemos consumers existentes."""
    r = client.get(
        f"{API}/reportes/variedad/{tamara_like['tamara'].id_variedad}",
        headers=auth_headers,
    )
    body = r.json()
    for k in ("variedad", "inventario", "plantaciones",
              "mediciones", "bitacora", "labores_count"):
        assert k in body, f"missing key {k}"
