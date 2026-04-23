"""Integration tests for Pase 2 — audit columns on previously-lacking mantenedores.

MT-1: usuario_creacion was null for rows in paises, bodegas, temporadas,
catalogos, comunas, regiones, variedades_polinizantes. After Pase 2:
- Models expose usuario_creacion / usuario_modificacion / fecha_modificacion.
- Generic CRUD (services/crud.py) already sets usuario_creacion from the JWT
  when the column exists on the model.
- variedades_polinizantes POST sets it explicitly (not via CRUD).

These tests verify the pipeline now writes usuario_creacion on POST.
"""

import pytest

from app.models.maestras import (
    Pais, Region, Comuna, Temporada, Bodega, Catalogo, Especie,
)
from app.models.variedades import Variedad
from app.models.variedades_extra import VariedadPolinizante


API = "/api/v1"


def test_paises_post_sets_usuario_creacion(client, auth_headers, db):
    r = client.post(
        f"{API}/mantenedores/paises",
        json={"codigo": "AR", "nombre": "Argentina", "orden": 3},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    row = db.query(Pais).filter_by(codigo="AR").first()
    assert row is not None
    assert row.usuario_creacion == "testadmin"


def test_bodegas_post_sets_usuario_creacion(client, auth_headers, db):
    r = client.post(
        f"{API}/mantenedores/bodegas",
        json={"codigo": "BOD-X", "nombre": "Bodega X"},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    row = db.query(Bodega).filter_by(codigo="BOD-X").first()
    assert row is not None
    assert row.usuario_creacion == "testadmin"


def test_temporadas_post_sets_usuario_creacion(client, auth_headers, db):
    r = client.post(
        f"{API}/mantenedores/temporadas",
        json={"codigo": "T26", "nombre": "Temporada 2026"},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    row = db.query(Temporada).filter_by(codigo="T26").first()
    assert row is not None
    assert row.usuario_creacion == "testadmin"


def test_catalogos_post_sets_usuario_creacion(client, auth_headers, db):
    r = client.post(
        f"{API}/mantenedores/catalogos",
        json={"tipo": "tipo-test", "valor": "valor-test"},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    row = db.query(Catalogo).filter_by(tipo="tipo-test", valor="valor-test").first()
    assert row is not None
    assert row.usuario_creacion == "testadmin"


def test_polinizantes_post_sets_usuario_creacion(client, auth_headers, db):
    """variedades_polinizantes: explicit set in route (not via generic CRUD)."""
    esp = Especie(codigo="CER", nombre="Cerezo", activo=True)
    db.add(esp)
    db.commit()
    db.refresh(esp)
    v_a = Variedad(codigo="CER-AUD-1", nombre="A", id_especie=esp.id_especie, activo=True)
    v_b = Variedad(codigo="CER-AUD-2", nombre="B", id_especie=esp.id_especie, activo=True)
    db.add_all([v_a, v_b])
    db.commit()
    db.refresh(v_a)
    db.refresh(v_b)

    r = client.post(
        f"{API}/variedades/{v_a.id_variedad}/polinizantes",
        json={"polinizante_variedad_id": v_b.id_variedad},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    row = db.get(VariedadPolinizante, pid)
    assert row.usuario_creacion == "testadmin"


def test_paises_update_sets_usuario_modificacion(client, auth_headers, db):
    """Update should stamp usuario_modificacion + fecha_modificacion via crud.update."""
    r = client.post(
        f"{API}/mantenedores/paises",
        json={"codigo": "BR", "nombre": "Brasil"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    pid = db.query(Pais).filter_by(codigo="BR").first().id_pais

    r = client.put(
        f"{API}/mantenedores/paises/{pid}",
        json={"nombre": "Brasil (actualizado)"},
        headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    row = db.query(Pais).filter_by(id_pais=pid).first()
    assert row.usuario_modificacion == "testadmin"
    assert row.fecha_modificacion is not None
