"""Integration tests for S-2 audit log schema alignment.

Frontend expects: id_log, tabla, registro_id, accion, usuario,
ip_address, fecha, datos_anteriores, datos_nuevos.

Legacy keys (id, id_registro, ip, detalle) are preserved for
backward-compat until all consumers migrate.
"""

import json
from datetime import datetime

import pytest

from app.models.sistema import AuditLog


API = "/api/v1"


@pytest.fixture()
def audit_row(db):
    """Insert an AuditLog row with a JSON detalle envelope typical of
    the internal log_audit writer."""
    detalle = json.dumps({
        "tabla": "paises",
        "id": 42,
        "ip": "1.2.3.4",
        "antes": {"nombre": "Old"},
        "despues": {"nombre": "New"},
    }, ensure_ascii=False)
    row = AuditLog(
        accion="UPDATE",
        detalle=detalle,
        usuario="testadmin",
        created_at=datetime(2026, 4, 23, 12, 0, 0),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def test_audit_log_returns_ui_keys(client, auth_headers, audit_row):
    r = client.get(f"{API}/sistema/audit-log", headers=auth_headers)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) >= 1
    row = next(x for x in rows if x.get("id_log") == audit_row.id)

    # S-2 UI-aligned primary keys
    assert row["id_log"] == audit_row.id
    assert row["tabla"] == "paises"
    assert row["registro_id"] == 42
    assert row["accion"] == "UPDATE"
    assert row["usuario"] == "testadmin"
    assert row["ip_address"] == "1.2.3.4"
    assert row["fecha"].startswith("2026-04-23")
    assert row["datos_anteriores"] == {"nombre": "Old"}
    assert row["datos_nuevos"] == {"nombre": "New"}


def test_audit_log_preserves_legacy_keys(client, auth_headers, audit_row):
    """Legacy `id`, `id_registro`, `ip`, `detalle` keys still present."""
    r = client.get(f"{API}/sistema/audit-log", headers=auth_headers)
    row = next(x for x in r.json() if x.get("id_log") == audit_row.id)

    assert row["id"] == audit_row.id
    assert row["id_registro"] == 42
    assert row["ip"] == "1.2.3.4"
    assert "detalle" in row


def test_audit_log_tabla_filter(client, auth_headers, db):
    """?tabla=foo filters by extracted tabla from detalle."""
    for nombre_tabla in ("paises", "especies"):
        row = AuditLog(
            accion="CREATE",
            detalle=json.dumps({"tabla": nombre_tabla, "id": 1}),
            usuario="testadmin",
            created_at=datetime.utcnow(),
        )
        db.add(row)
    db.commit()

    r = client.get(f"{API}/sistema/audit-log", params={"tabla": "paises"}, headers=auth_headers)
    assert r.status_code == 200
    for row in r.json():
        assert (row.get("tabla") or "").lower() == "paises"
