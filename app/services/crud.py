"""Generic CRUD service that handles List/Get/Create/Update/SoftDelete for any model."""

import json
import logging
from datetime import datetime
from app.core.utils import utcnow
from typing import Any, Type

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlmodel import SQLModel

from app.models.base import TABLE_PK_MAP
from app.services.audit_service import log_audit

logger = logging.getLogger(__name__)


def _get_pk_col(model: Type[SQLModel]) -> str:
    """Return the primary key column name for the given model."""
    table_name = model.__tablename__
    pk = TABLE_PK_MAP.get(table_name)
    if pk is None:
        # Fallback: inspect model for PK
        for col_name, field in model.model_fields.items():
            extra = field.json_schema_extra or {}
            if getattr(field, "primary_key", False):
                return col_name
        raise ValueError(f"No PK mapping for table '{table_name}'")
    return pk


def list_all(
    db: Session,
    model: Type[SQLModel],
    *,
    filters: dict[str, Any] | None = None,
    only_active: bool = True,
    skip: int = 0,
    limit: int = 1000,
) -> list[SQLModel]:
    q = db.query(model)
    if only_active and hasattr(model, "activo"):
        q = q.filter(model.activo == True)
    if filters:
        for key, value in filters.items():
            if value is not None and hasattr(model, key):
                q = q.filter(getattr(model, key) == value)
    # MSSQL requires ORDER BY when using OFFSET/LIMIT
    pk_col = _get_pk_col(model)
    q = q.order_by(getattr(model, pk_col))
    return q.offset(skip).limit(limit).all()


def get_by_id(db: Session, model: Type[SQLModel], record_id: int) -> SQLModel:
    pk_col = _get_pk_col(model)
    obj = db.query(model).filter(getattr(model, pk_col) == record_id).first()
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{model.__tablename__} {record_id} no encontrado")
    return obj


def create(
    db: Session,
    model: Type[SQLModel],
    data: BaseModel,
    *,
    usuario: str | None = None,
) -> SQLModel:
    values = data.model_dump(exclude_unset=True)
    if usuario and hasattr(model, "usuario_creacion"):
        values["usuario_creacion"] = usuario
    obj = model(**values)
    db.add(obj)
    db.commit()
    db.refresh(obj)

    # --- audit ---
    try:
        pk_col = _get_pk_col(model)
        registro_id = getattr(obj, pk_col, None)
        log_audit(
            db,
            tabla=model.__tablename__,
            registro_id=registro_id,
            accion="CREATE",
            datos_nuevos=json.dumps(values, default=str, ensure_ascii=False),
            usuario=usuario,
        )
        db.commit()
    except Exception:
        logger.exception("Audit log failed for CREATE on %s", model.__tablename__)
    # --- /audit ---

    return obj


def update(
    db: Session,
    model: Type[SQLModel],
    record_id: int,
    data: BaseModel,
    *,
    usuario: str | None = None,
) -> SQLModel:
    obj = get_by_id(db, model, record_id)
    values = data.model_dump(exclude_unset=True)
    if usuario and hasattr(model, "usuario_modificacion"):
        values["usuario_modificacion"] = usuario
    if hasattr(model, "fecha_modificacion"):
        values["fecha_modificacion"] = utcnow()

    # Capture old values for the fields that are actually changing
    old_values: dict[str, Any] = {}
    for key, value in values.items():
        if hasattr(obj, key):
            current = getattr(obj, key)
            if current != value:
                old_values[key] = current

    for key, value in values.items():
        if hasattr(obj, key):
            setattr(obj, key, value)
    db.commit()
    db.refresh(obj)

    # --- audit ---
    try:
        if old_values:
            # Build new_values dict only for keys that actually changed
            new_values = {k: values[k] for k in old_values}
            log_audit(
                db,
                tabla=model.__tablename__,
                registro_id=record_id,
                accion="UPDATE",
                datos_anteriores=json.dumps(old_values, default=str, ensure_ascii=False),
                datos_nuevos=json.dumps(new_values, default=str, ensure_ascii=False),
                usuario=usuario,
            )
            db.commit()
    except Exception:
        logger.exception("Audit log failed for UPDATE on %s id=%s", model.__tablename__, record_id)
    # --- /audit ---

    return obj


def soft_delete(
    db: Session,
    model: Type[SQLModel],
    record_id: int,
    *,
    usuario: str | None = None,
) -> dict:
    obj = get_by_id(db, model, record_id)
    if hasattr(obj, "activo"):
        obj.activo = False
        if hasattr(obj, "fecha_modificacion"):
            obj.fecha_modificacion = utcnow()
        if usuario and hasattr(obj, "usuario_modificacion"):
            obj.usuario_modificacion = usuario
        db.commit()
    else:
        db.delete(obj)
        db.commit()

    # --- audit ---
    try:
        log_audit(
            db,
            tabla=model.__tablename__,
            registro_id=record_id,
            accion="DELETE",
            usuario=usuario,
        )
        db.commit()
    except Exception:
        logger.exception("Audit log failed for DELETE on %s id=%s", model.__tablename__, record_id)
    # --- /audit ---

    return {"ok": True, "id": record_id}
