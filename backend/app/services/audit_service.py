"""Audit logging service — inserts rows into audit_log without committing."""

import json
import logging
from datetime import datetime

from fastapi import Request
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
    ip: str | None = None,
    request: Request | None = None,
) -> None:
    """Insert audit_log row. detalle serializado como JSON para que el
    endpoint /sistema/audit-log pueda extraer tabla/id/ip/diff.

    El parámetro `request` es opcional — si se pasa, se extrae la IP del cliente.
    """
    try:
        # Extract IP from request if provided
        if request is not None and ip is None:
            try:
                ip = request.client.host if request.client else None
                # Honor X-Forwarded-For cuando hay proxy (Azure App Service)
                xff = request.headers.get("x-forwarded-for")
                if xff:
                    ip = xff.split(",")[0].strip()
            except Exception:
                pass

        # Parse JSON snippets back to dict if posible
        def _safe_parse(v):
            if not v:
                return None
            if isinstance(v, str):
                try:
                    return json.loads(v)
                except (json.JSONDecodeError, TypeError):
                    return v[:500]
            return v

        detalle_dict = {
            "tabla": tabla,
            "id": registro_id,
            "ip": ip,
            "antes": _safe_parse(datos_anteriores),
            "despues": _safe_parse(datos_nuevos),
        }
        detalle = json.dumps(detalle_dict, default=str, ensure_ascii=False)

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
