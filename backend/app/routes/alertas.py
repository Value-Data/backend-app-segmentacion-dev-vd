"""Alertas routes: list, resolve, reglas, evaluar."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.sistema import Usuario
from app.models.analisis import Alerta, ReglaAlerta
from app.schemas.analisis import AlertaResolverRequest, ReglaAlertaCreate, ReglaAlertaUpdate
from app.services import crud
from app.services.alerta_service import resolver_alerta, evaluar_reglas

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


@router.put("/reglas/{id}")
def update_regla(
    id: int,
    data: ReglaAlertaUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Actualiza una regla (AL-3: antes no había PUT)."""
    regla = db.query(ReglaAlerta).filter(ReglaAlerta.id_regla == id).first()
    if not regla:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(regla, k, v)
    db.commit()
    db.refresh(regla)
    return regla


@router.delete("/reglas/{id}", status_code=200)
def delete_regla(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Soft-delete: activo=0 (AL-3: antes no había DELETE)."""
    regla = db.query(ReglaAlerta).filter(ReglaAlerta.id_regla == id).first()
    if not regla:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    regla.activo = False
    db.commit()
    return {"ok": True, "id_regla": id}


@router.post("/evaluar")
def api_evaluar_reglas(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin", "agronomo")),
):
    """Ejecuta el motor de evaluación de reglas y genera alertas (AL-1, AL-2, AL-5).

    Cada regla se dispara por `codigo` (ALRT-001 brix, ALRT-003 dias_sin_registro,
    ALRT-005 stock_actual<minimo). Las condiciones SQL libres en el campo
    `condicion` son sólo metadata descriptiva; la lógica real vive en
    alerta_service.evaluar_reglas (AL-4: no se ejecuta SQL del usuario).
    Evita duplicados: no crea alerta activa si ya existe una con mismo
    (tipo, posición, título).
    """
    return evaluar_reglas(db)
