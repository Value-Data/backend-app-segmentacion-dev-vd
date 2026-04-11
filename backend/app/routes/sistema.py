"""Sistema routes: usuarios, roles, audit log."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.security import hash_password
from app.models.sistema import Usuario, Rol, AuditLog
from app.schemas.sistema import UsuarioCreate, UsuarioUpdate
from app.schemas.auth import PasswordChange
from app.services import crud

router = APIRouter(prefix="/sistema", tags=["Sistema"])


# ── Usuarios ────────────────────────────────────────────────────────────────
@router.get("/usuarios")
def list_usuarios(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    return crud.list_all(db, Usuario, only_active=False)


@router.post("/usuarios", status_code=201)
def create_usuario(
    data: UsuarioCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    # Check uniqueness
    exists = db.query(Usuario).filter(Usuario.username == data.username).first()
    if exists:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Username ya existe")

    usuario = Usuario(
        username=data.username,
        nombre_completo=data.nombre_completo,
        email=data.email,
        password_hash=hash_password(data.password),
        rol=data.rol,
        campos_asignados=data.campos_asignados,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@router.put("/usuarios/{id}")
def update_usuario(
    id: int,
    data: UsuarioUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    return crud.update(db, Usuario, id, data, usuario=user.username)


@router.put("/usuarios/{id}/password")
def change_password(
    id: int,
    data: PasswordChange,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    target = crud.get_by_id(db, Usuario, id)
    target.password_hash = hash_password(data.new_password)
    db.commit()
    return {"ok": True}


# ── Roles ───────────────────────────────────────────────────────────────────
@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return crud.list_all(db, Rol)


# ── Audit Log ──────────────────────────────────────────────────────────────
@router.get("/audit-log")
def list_audit_log(
    accion: str | None = Query(None, description="Filtrar por accion"),
    fecha_desde: str | None = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    q = db.query(AuditLog)
    if accion:
        q = q.filter(AuditLog.accion == accion)
    if fecha_desde:
        q = q.filter(AuditLog.created_at >= fecha_desde)
    return q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
