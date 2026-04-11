"""Audit logging service — inserts rows into audit_log without committing."""

import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.sistema import AuditLog

logger = logging.getLogger(__name__)


def log_audit(
    db: Session,
    *,
    tabla: str,
    registro_id: int | None = None,
    accion: str,
    datos_anteriores: str | None = None,
    datos_nuevos: str | None = None,
    usuario: str | None = None,
) -> None:
    """Create an AuditLog row and add it to the session.

    Maps the generic audit params to the actual audit_log table columns:
    - accion = accion
    - detalle = "{tabla} #{registro_id}: antes={datos_anteriores} despues={datos_nuevos}"
    - usuario = usuario
    - created_at = now()
    """
    try:
        detalle_parts = [f"{tabla}"]
        if registro_id is not None:
            detalle_parts.append(f"#{registro_id}")
        if datos_anteriores:
            detalle_parts.append(f"antes={datos_anteriores[:500]}")
        if datos_nuevos:
            detalle_parts.append(f"despues={datos_nuevos[:500]}")
        detalle = " | ".join(detalle_parts) or accion

        entry = AuditLog(
            accion=accion,
            detalle=detalle,
            usuario=usuario or "sistema",
            created_at=datetime.utcnow(),
        )
        db.add(entry)
        db.flush()
    except Exception:
        db.rollback()
        logger.exception("Error al registrar audit_log para %s.%s (%s)", tabla, registro_id, accion)
