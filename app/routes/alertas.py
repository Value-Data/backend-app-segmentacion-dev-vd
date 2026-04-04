"""Alertas routes: list, resolve, reglas."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.sistema import Usuario
from app.models.analisis import Alerta, ReglaAlerta
from app.schemas.analisis import AlertaResolverRequest, ReglaAlertaCreate, ReglaAlertaUpdate
from app.services import crud
from app.services.alerta_service import resolver_alerta

router = APIRouter(prefix="/alertas", tags=["Alertas"])


@router.get("")
def list_alertas(
    estado: str | None = Query(None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    q = db.query(Alerta)
    if estado:
        q = q.filter(Alerta.estado == estado)
    return q.order_by(Alerta.fecha_creacion.desc()).all()


@router.put("/{id}/resolver")
def api_resolver(
    id: int,
    data: AlertaResolverRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    if not data.usuario:
        data.usuario = user.username
    return resolver_alerta(db, id, data)


@router.get("/reglas")
def list_reglas(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return crud.list_all(db, ReglaAlerta)


@router.post("/reglas", status_code=201)
def create_regla(
    data: ReglaAlertaCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    return crud.create(db, ReglaAlerta, data, usuario=user.username)
