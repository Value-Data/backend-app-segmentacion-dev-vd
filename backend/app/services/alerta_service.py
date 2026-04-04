"""Alerta service: resolve alerts, check rules."""

from datetime import datetime
from app.core.utils import utcnow

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.analisis import Alerta
from app.schemas.analisis import AlertaResolverRequest


def resolver_alerta(db: Session, id_alerta: int, data: AlertaResolverRequest) -> Alerta:
    alerta = db.query(Alerta).filter(Alerta.id_alerta == id_alerta).first()
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    if alerta.estado == "resuelta":
        raise HTTPException(status_code=400, detail="Alerta ya fue resuelta")

    alerta.estado = "resuelta"
    alerta.notas_resolucion = data.notas
    alerta.usuario_resolucion = data.usuario
    alerta.fecha_resolucion = utcnow()
    db.commit()
    db.refresh(alerta)
    return alerta
