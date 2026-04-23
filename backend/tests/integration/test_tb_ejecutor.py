"""TB-EJECUTOR: POST /testblocks/{id}/grupo/labores y /grupo/fenologia
aceptan un ejecutor distinto al usuario logueado.

Separa:
  - usuario_registro = quien está logueado (siempre)
  - ejecutor = quien efectivamente hizo la labor/observación (puede diferir)

Caso de uso: supervisor registra lo hecho por su cuadrilla.
"""

import pytest
from datetime import date

from app.core.security import hash_password
from app.models.sistema import Usuario
from app.models.maestras import Especie, TipoLabor, EstadoFenologico
from app.models.testblock import TestBlock, PosicionTestBlock, Planta
from app.models.variedades import Variedad
from app.models.laboratorio import EjecucionLabor


API = "/api/v1"


@pytest.fixture()
def setup_tb(db):
    esp = Especie(codigo="CER", nombre="Cerezo", activo=True)
    db.add(esp)
    db.commit()
    db.refresh(esp)
    var = Variedad(codigo="CER-TB-001", nombre="Test V",
                   id_especie=esp.id_especie, activo=True)
    db.add(var)
    db.commit()
    db.refresh(var)

    tb = TestBlock(codigo="TB-EJ", nombre="TB Ejecutor", id_campo=1,
                   num_hileras=1, pos_por_hilera=3, activo=True)
    db.add(tb)
    db.commit()
    db.refresh(tb)

    positions = []
    for i in range(1, 4):
        p = PosicionTestBlock(
            codigo_unico=f"TB-EJ-H1-P{i}",
            id_testblock=tb.id_testblock,
            hilera=1, posicion=i,
            id_variedad=var.id_variedad,
            estado="alta",
        )
        db.add(p)
        positions.append(p)
    db.commit()
    for p in positions:
        db.refresh(p)
        pl = Planta(id_posicion=p.id_posicion, id_variedad=var.id_variedad,
                    fecha_alta=date.today(), activa=True)
        db.add(pl)
    db.commit()

    operator = Usuario(
        username="operador1",
        nombre_completo="Juan Cuadrilla",
        email="juan@g.cl",
        password_hash=hash_password("pw"),
        rol="operador",
        activo=True,
    )
    db.add(operator)
    db.commit()
    db.refresh(operator)

    labor = TipoLabor(codigo="PODA", categoria="poda", nombre="Poda", activo=True)
    db.add(labor)
    db.commit()
    db.refresh(labor)

    estado_fenol = EstadoFenologico(
        id_especie=esp.id_especie, codigo="FLOR",
        nombre="Floración", orden=1, activo=True,
    )
    reg_fenol_labor = TipoLabor(
        codigo="REG_FENOL", categoria="fenologia",
        nombre="Registro fenologico", activo=True,
    )
    db.add_all([estado_fenol, reg_fenol_labor])
    db.commit()
    db.refresh(estado_fenol)

    return {
        "tb": tb, "positions": positions, "operator": operator,
        "labor": labor, "estado_fenol": estado_fenol,
    }


def test_grupo_labores_ejecutor_from_id_persona(client, auth_headers, setup_tb, db):
    """TB-EJECUTOR: id_persona_ejecutora en body → ejecutor = nombre_completo."""
    body = {
        "posiciones_ids": [p.id_posicion for p in setup_tb["positions"]],
        "id_labor": setup_tb["labor"].id_labor,
        "fecha_programada": date.today().isoformat(),
        "id_persona_ejecutora": setup_tb["operator"].id_usuario,
    }
    r = client.post(
        f"{API}/testblocks/{setup_tb['tb'].id_testblock}/grupo/labores",
        json=body, headers=auth_headers,
    )
    assert r.status_code == 200, r.text

    rows = db.query(EjecucionLabor).filter(
        EjecucionLabor.id_labor == setup_tb["labor"].id_labor
    ).all()
    assert len(rows) == 3
    for row in rows:
        assert row.ejecutor == "Juan Cuadrilla", f"got ejecutor={row.ejecutor}"
        assert row.usuario_registro == "testadmin"


def test_grupo_labores_ejecutor_from_string(client, auth_headers, setup_tb, db):
    """TB-EJECUTOR: ejecutor como string libre en body → usado tal cual."""
    body = {
        "posiciones_ids": [p.id_posicion for p in setup_tb["positions"]],
        "id_labor": setup_tb["labor"].id_labor,
        "ejecutor": "Cuadrilla externa - Empresa X",
    }
    r = client.post(
        f"{API}/testblocks/{setup_tb['tb'].id_testblock}/grupo/labores",
        json=body, headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    row = db.query(EjecucionLabor).filter(
        EjecucionLabor.id_labor == setup_tb["labor"].id_labor
    ).first()
    assert row.ejecutor == "Cuadrilla externa - Empresa X"


def test_grupo_labores_ejecutor_fallback(client, auth_headers, setup_tb, db):
    """TB-EJECUTOR: sin campos override → ejecutor = user.username."""
    body = {
        "posiciones_ids": [p.id_posicion for p in setup_tb["positions"]],
        "id_labor": setup_tb["labor"].id_labor,
    }
    r = client.post(
        f"{API}/testblocks/{setup_tb['tb'].id_testblock}/grupo/labores",
        json=body, headers=auth_headers,
    )
    assert r.status_code == 200, r.text
    row = db.query(EjecucionLabor).filter(
        EjecucionLabor.id_labor == setup_tb["labor"].id_labor
    ).first()
    assert row.ejecutor == "testadmin"
    assert row.usuario_registro == "testadmin"


def test_grupo_fenologia_ejecutor_from_id_persona(client, auth_headers, setup_tb, db):
    body = {
        "posiciones_ids": [p.id_posicion for p in setup_tb["positions"]],
        "estado_fenologico_id": setup_tb["estado_fenol"].id_estado,
        "fecha": date.today().isoformat(),
        "id_persona_ejecutora": setup_tb["operator"].id_usuario,
    }
    r = client.post(
        f"{API}/testblocks/{setup_tb['tb'].id_testblock}/grupo/fenologia",
        json=body, headers=auth_headers,
    )
    assert r.status_code == 200, r.text

    rows = db.query(EjecucionLabor).filter(
        EjecucionLabor.id_labor != setup_tb["labor"].id_labor
    ).all()
    assert len(rows) >= 1
    for row in rows:
        assert row.ejecutor == "Juan Cuadrilla"
        assert row.usuario_registro == "testadmin"


def test_grupo_fenologia_ejecutor_invalid_id_falls_back(client, auth_headers, setup_tb, db):
    """id_persona_ejecutora inexistente → cae al fallback del logueado."""
    body = {
        "posiciones_ids": [p.id_posicion for p in setup_tb["positions"]],
        "estado_fenologico_id": setup_tb["estado_fenol"].id_estado,
        "id_persona_ejecutora": 99999,
    }
    r = client.post(
        f"{API}/testblocks/{setup_tb['tb'].id_testblock}/grupo/fenologia",
        json=body, headers=auth_headers,
    )
    assert r.status_code == 200, r.text
