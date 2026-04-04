"""Audit logging service — inserts rows into audit_log without committing."""

import logging

from sqlalchemy.orm import Session

from app.models.sistema import AuditLog

logger = logging.getLogger(__name__)


def log_audit(
    db: Session,
    *,
    tabla: str,
    registro_id: int | None,
    accion: str,
    datos_anteriores: str | None = None,
    datos_nuevos: str | None = None,
    usuario: str | None = None,
) -> None:
    """Create an AuditLog row and add it to the session.

    Does NOT commit — the caller's transaction handles it.
    If anything fails, the error is logged but never propagated so the
    main operation is not interrupted.
    """
    try:
        entry = AuditLog(
            tabla=tabla,
            registro_id=registro_id,
            accion=accion,
            datos_anteriores=datos_anteriores,
            datos_nuevos=datos_nuevos,
            usuario=usuario,
        )
        db.add(entry)
        db.flush()
    except Exception:
        logger.exception("Error al registrar audit_log para %s.%s (%s)", tabla, registro_id, accion)
