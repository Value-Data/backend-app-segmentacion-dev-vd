"""Sistema routes: usuarios, roles, audit log."""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.security import hash_password
from app.models.sistema import Usuario, Rol, AuditLog
from app.schemas.sistema import UsuarioCreate, UsuarioUpdate, UsuarioRead
from app.schemas.auth import PasswordChange
from app.services import crud

router = APIRouter(prefix="/sistema", tags=["Sistema"])


# ── Usuarios ────────────────────────────────────────────────────────────────
# S-1: response_model=UsuarioRead excluye password_hash automáticamente
# y lo hace visible en OpenAPI — más robusto que un helper manual.

@router.get("/usuarios", response_model=list[UsuarioRead])
def list_usuarios(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    return crud.list_all(db, Usuario, only_active=False)


@router.get("/usuarios/{id}", response_model=UsuarioRead)
def get_usuario(
    id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    return crud.get_by_id(db, Usuario, id)


@router.post("/usuarios", response_model=UsuarioRead, status_code=201)
def create_usuario(
    data: UsuarioCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    exists = db.query(Usuario).filter(Usuario.username == data.username).first()
    if exists:
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


@router.put("/usuarios/{id}", response_model=UsuarioRead)
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
    """Lista roles. S-5: parsea permisos como array nativo (no string JSON)."""
    rows = crud.list_all(db, Rol)
    result = []
    for r in rows:
        permisos = r.permisos
        if isinstance(permisos, str):
            try:
                permisos = json.loads(permisos)
            except (json.JSONDecodeError, TypeError):
                permisos = [permisos] if permisos else []
        result.append({
            "id_rol": r.id_rol,
            "nombre": r.nombre,
            "descripcion": r.descripcion,
            "permisos": permisos or [],
            "activo": r.activo,
        })
    return result


# ── Audit Log ──────────────────────────────────────────────────────────────
@router.get("/audit-log")
def list_audit_log(
    accion: str | None = Query(None, description="Filtrar por accion"),
    tabla: str | None = Query(None, description="Filtrar por tabla afectada"),
    usuario: str | None = Query(None, description="Filtrar por usuario"),
    fecha_desde: str | None = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Lista audit log.

    S-2: schema adaptado al frontend. Mapea detalle JSON a campos
    específicos (tabla afectada, id registro, ip, diff) cuando es
    parseable. Los campos legacy del dataset ValueData (contratista_rut)
    se excluyen del response.
    """
    q = db.query(AuditLog)
    if accion:
        q = q.filter(AuditLog.accion == accion)
    if usuario:
        q = q.filter(AuditLog.usuario == usuario)
    if fecha_desde:
        q = q.filter(AuditLog.created_at >= fecha_desde)

    rows = q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    def _parse(row: AuditLog) -> dict:
        tabla_name = None
        id_registro = None
        ip = None
        diff = None
        detalle_str = row.detalle or ""
        try:
            parsed = json.loads(detalle_str) if detalle_str.startswith("{") else None
            if isinstance(parsed, dict):
                tabla_name = parsed.get("tabla") or parsed.get("table")
                id_registro = parsed.get("id") or parsed.get("id_registro")
                ip = parsed.get("ip")
                diff = parsed.get("diff") or parsed.get("cambios")
        except (json.JSONDecodeError, TypeError):
            pass
        return {
            "id": row.id,
            "accion": row.accion,
            "tabla": tabla_name,
            "id_registro": id_registro,
            "ip": ip,
            "usuario": row.usuario,
            "fecha": row.created_at.isoformat() if row.created_at else None,
            "detalle": detalle_str[:500],  # truncar para listado
            "diff": diff,
        }

    items = [_parse(r) for r in rows]

    # Apply tabla filter post-parse (ya que vive en JSON detalle)
    if tabla:
        items = [i for i in items if (i["tabla"] or "").lower() == tabla.lower()]

    return items


@router.get("/audit-log/tablas")
def audit_log_tablas(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    """Lista las tablas únicas encontradas en los detalles del audit log (S-18)."""
    rows = db.query(AuditLog.detalle).limit(5000).all()
    tablas = set()
    for (detalle,) in rows:
        if not detalle:
            continue
        try:
            p = json.loads(detalle) if detalle.startswith("{") else None
            if isinstance(p, dict):
                t = p.get("tabla") or p.get("table")
                if t:
                    tablas.add(str(t))
        except (json.JSONDecodeError, TypeError):
            pass
    return sorted(tablas)
