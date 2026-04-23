"""Endpoints para polinizantes, fotos, y bitacora de portainjertos."""

import json
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Header, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.sistema import Usuario
from app.models.variedades import Variedad
from app.models.variedades_extra import (
    VariedadPolinizante, VariedadFoto,
    BitacoraPortainjerto, TestblockEvento,
)
from app.schemas.variedades import (
    PolinizanteCreate, PolinizanteRead,
    BitacoraPortainjertoCreate, BitacoraPortainjertoUpdate,
)
from app.services.audit_service import log_audit

router = APIRouter(tags=["Variedades Extra"])


# ── Polinizantes ──────────────────────────────────────────────────────────

@router.get("/variedades/{id_variedad}/polinizantes", response_model=list[PolinizanteRead])
def list_polinizantes(
    id_variedad: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return (
        db.query(VariedadPolinizante)
        .filter(VariedadPolinizante.id_variedad == id_variedad, VariedadPolinizante.activo == True)
        .order_by(VariedadPolinizante.polinizante_nombre)
        .all()
    )


@router.post("/variedades/{id_variedad}/polinizantes", status_code=201, response_model=PolinizanteRead)
def add_polinizante(
    id_variedad: int,
    body: PolinizanteCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Add a polinizante to a variedad.

    Guardrails (POL-1..7):
    - POL-1: polinizante must be same especie as the parent variedad.
    - POL-2: self-reference rejected.
    - POL-3: polinizante_nombre sanitized in schema (stored text, no HTML).
    - POL-4: strict schema (extra="forbid") — unknown fields rejected.
    - POL-7: duplicates on active rows rejected (409).
    """
    var = db.get(Variedad, id_variedad)
    if not var:
        raise HTTPException(status_code=404, detail="Variedad no encontrada")

    pol_variedad_id = body.polinizante_variedad_id
    pol_nombre = body.polinizante_nombre

    if pol_variedad_id is not None:
        # POL-2: self-reference
        if pol_variedad_id == id_variedad:
            raise HTTPException(
                status_code=422,
                detail="Una variedad no puede ser polinizante de sí misma",
            )
        pol_var = db.get(Variedad, pol_variedad_id)
        if not pol_var:
            raise HTTPException(status_code=404, detail="Variedad polinizante no encontrada")
        # POL-1: cross-especie
        if var.id_especie is not None and pol_var.id_especie is not None \
                and pol_var.id_especie != var.id_especie:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Polinizante debe ser de la misma especie "
                    f"(variedad={var.id_especie}, polinizante={pol_var.id_especie})"
                ),
            )
        # Derive nombre from linked variedad when FK provided
        pol_nombre = pol_var.nombre

    # POL-7: dedupe on active rows
    dupe_q = db.query(VariedadPolinizante).filter(
        VariedadPolinizante.id_variedad == id_variedad,
        VariedadPolinizante.activo == True,  # noqa: E712
    )
    if pol_variedad_id is not None:
        dupe = dupe_q.filter(VariedadPolinizante.polinizante_variedad_id == pol_variedad_id).first()
    else:
        dupe = dupe_q.filter(
            VariedadPolinizante.polinizante_variedad_id.is_(None),
            VariedadPolinizante.polinizante_nombre == pol_nombre,
        ).first()
    if dupe:
        raise HTTPException(status_code=409, detail="Polinizante ya registrado")

    pol = VariedadPolinizante(
        id_variedad=id_variedad,
        polinizante_variedad_id=pol_variedad_id,
        polinizante_nombre=pol_nombre,
        usuario_creacion=user.username,  # MT-1 Pase 2
    )
    db.add(pol)
    db.commit()
    db.refresh(pol)

    try:
        log_audit(
            db,
            tabla="variedades_polinizantes",
            registro_id=pol.id,
            accion="CREATE",
            datos_nuevos=json.dumps(
                {
                    "id_variedad": id_variedad,
                    "polinizante_variedad_id": pol_variedad_id,
                    "polinizante_nombre": pol_nombre,
                },
                ensure_ascii=False,
            ),
            usuario=user.username,
            request=request,
        )
        db.commit()
    except Exception:
        pass

    return pol


@router.delete("/variedades/{id_variedad}/polinizantes/{pid}")
def delete_polinizante(
    id_variedad: int,
    pid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    pol = db.get(VariedadPolinizante, pid)
    if not pol or pol.id_variedad != id_variedad:
        raise HTTPException(status_code=404, detail="Polinizante no encontrado")
    pol.activo = False
    pol.usuario_modificacion = user.username  # MT-1 Pase 2
    pol.fecha_modificacion = datetime.utcnow()
    db.commit()

    try:
        log_audit(
            db,
            tabla="variedades_polinizantes",
            registro_id=pid,
            accion="DELETE",
            usuario=user.username,
            request=request,
        )
        db.commit()
    except Exception:
        pass

    return {"detail": "Eliminado"}


# ── Fotos ─────────────────────────────────────────────────────────────────

@router.get("/fotos-principales")
def fotos_principales(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Return a map {id_variedad: foto_id} for all principal photos."""
    rows = (
        db.query(VariedadFoto.id_variedad, VariedadFoto.id)
        .filter(VariedadFoto.es_principal == True)
        .all()
    )
    return {r[0]: r[1] for r in rows}


@router.get("/variedades/{id_variedad}/fotos")
def list_fotos(
    id_variedad: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    rows = (
        db.query(VariedadFoto)
        .filter(VariedadFoto.id_variedad == id_variedad)
        .order_by(desc(VariedadFoto.fecha_creacion))
        .all()
    )
    # No enviar bytes binarios en el JSON — solo metadatos
    return [
        {
            "id": f.id,
            "id_variedad": f.id_variedad,
            "filename": f.filename,
            "descripcion": f.descripcion,
            "es_principal": f.es_principal,
            "content_type": f.content_type,
            "fecha_creacion": f.fecha_creacion,
        }
        for f in rows
    ]


# FIX-FOTOS: restrict uploads to real image types and cap size to prevent
# arbitrary-binary uploads and OOM via huge files stored in the DB.
ALLOWED_IMAGE_MIME = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_FOTO_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/variedades/{id_variedad}/fotos")
def upload_foto(
    id_variedad: int,
    file: UploadFile = File(...),
    descripcion: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    var = db.get(Variedad, id_variedad)
    if not var:
        raise HTTPException(status_code=404, detail="Variedad no encontrada")

    content_type = (file.content_type or "image/jpeg").lower()
    if content_type not in ALLOWED_IMAGE_MIME:
        raise HTTPException(
            status_code=415,
            detail=f"Tipo de archivo no permitido: {content_type}. "
                   f"Permitidos: {sorted(ALLOWED_IMAGE_MIME)}",
        )

    content = file.file.read()
    if len(content) > MAX_FOTO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Archivo demasiado grande: {len(content)} bytes. "
                   f"Máximo permitido: {MAX_FOTO_BYTES} bytes (5 MB).",
        )
    if len(content) == 0:
        raise HTTPException(status_code=422, detail="Archivo vacío")

    foto = VariedadFoto(
        id_variedad=id_variedad,
        filename=file.filename or f"{id_variedad}_{uuid.uuid4().hex[:8]}.jpg",
        filepath="db",  # stored in database, not on disk
        content_type=content_type,
        data=content,
        descripcion=descripcion,
    )
    db.add(foto)
    db.commit()
    db.refresh(foto)
    return {
        "id": foto.id,
        "id_variedad": foto.id_variedad,
        "filename": foto.filename,
        "descripcion": foto.descripcion,
        "es_principal": foto.es_principal,
        "content_type": foto.content_type,
        "fecha_creacion": foto.fecha_creacion,
    }


@router.delete("/variedades/{id_variedad}/fotos/{fid}")
def delete_foto(
    id_variedad: int,
    fid: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    foto = db.get(VariedadFoto, fid)
    if not foto or foto.id_variedad != id_variedad:
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    # Clean up legacy disk file if it exists
    if foto.filepath and foto.filepath != "db" and os.path.exists(foto.filepath):
        os.remove(foto.filepath)
    db.delete(foto)
    db.commit()
    return {"detail": "Foto eliminada"}


@router.get("/files/fotos/{fid}")
def serve_foto(
    fid: int,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Serve foto from DB (or legacy disk).

    Auth: requiere cabecera `Authorization: Bearer <token>`.
    El parámetro `?token=` está deprecado (SEC-JWT) porque filtraba el
    JWT a logs HTTP, referer y cachés compartidos — cualquier request
    que lo use recibe 410 Gone. El frontend debe usar AuthImage
    (fetch con header Bearer + blob URL).
    """
    from app.core.security import decode_access_token

    bearer = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization.split(" ", 1)[1].strip()

    # SEC-JWT: rechazar querystring-token aunque haya venido junto con header.
    if token is not None:
        raise HTTPException(
            status_code=410,
            detail=(
                "El acceso vía ?token= está deprecado (filtra el JWT). "
                "Usar Authorization: Bearer <token>."
            ),
        )

    if not bearer:
        raise HTTPException(status_code=401, detail="Token requerido")
    payload = decode_access_token(bearer)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token invalido o expirado")

    foto = db.get(VariedadFoto, fid)
    if not foto:
        raise HTTPException(status_code=404, detail="Foto no encontrada")

    # Cache privado para que proxies/CDN no compartan contenido entre usuarios.
    cache_header = "private, max-age=3600"

    # Serve from DB binary
    if foto.data:
        return Response(
            content=foto.data,
            media_type=foto.content_type or "image/jpeg",
            headers={
                "Content-Disposition": f'inline; filename="{foto.filename}"',
                "Cache-Control": cache_header,
            },
        )

    # Fallback: legacy disk file
    if foto.filepath and foto.filepath != "db" and os.path.exists(foto.filepath):
        from fastapi.responses import FileResponse
        return FileResponse(
            foto.filepath,
            media_type="image/jpeg",
            filename=foto.filename,
            headers={"Cache-Control": cache_header},
        )

    # Foto existe pero sin data ni disco -> mismo 404 unificado
    raise HTTPException(status_code=404, detail="Foto no encontrada")


@router.put("/variedades/{id_variedad}/fotos/{fid}/principal")
def set_foto_principal(
    id_variedad: int,
    fid: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    foto = db.get(VariedadFoto, fid)
    if not foto or foto.id_variedad != id_variedad:
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    # Quitar principal de todas las fotos de esta variedad
    all_fotos = (
        db.query(VariedadFoto)
        .filter(VariedadFoto.id_variedad == id_variedad)
        .all()
    )
    for f in all_fotos:
        f.es_principal = (f.id == fid)
    db.commit()
    db.refresh(foto)
    return {
        "id": foto.id,
        "id_variedad": foto.id_variedad,
        "filename": foto.filename,
        "descripcion": foto.descripcion,
        "es_principal": foto.es_principal,
        "content_type": foto.content_type,
        "fecha_creacion": foto.fecha_creacion,
    }


# ── Bitacora Portainjertos ────────────────────────────────────────────────

@router.get("/portainjertos/{id_portainjerto}/bitacora")
def list_bitacora_pi(
    id_portainjerto: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return (
        db.query(BitacoraPortainjerto)
        .filter(
            BitacoraPortainjerto.id_portainjerto == id_portainjerto,
            BitacoraPortainjerto.activo == True,
        )
        .order_by(desc(BitacoraPortainjerto.fecha))
        .all()
    )


@router.post("/portainjertos/{id_portainjerto}/bitacora")
def add_bitacora_pi(
    id_portainjerto: int,
    body: BitacoraPortainjertoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Crear entrada de bitácora de portainjerto.

    Schema strict: extra='forbid', sanitiza HTML en `nota`, valida rango
    de fecha (igual que bitácora variedad).
    """
    entry = BitacoraPortainjerto(
        id_portainjerto=id_portainjerto,
        nota=body.nota,
        fecha=body.fecha,
        created_by=user.username,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/portainjertos/{id_portainjerto}/bitacora/{bid}")
def update_bitacora_pi(
    id_portainjerto: int,
    bid: int,
    body: BitacoraPortainjertoUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    entry = db.get(BitacoraPortainjerto, bid)
    if not entry or entry.id_portainjerto != id_portainjerto:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    values = body.model_dump(exclude_unset=True)
    for field, value in values.items():
        setattr(entry, field, value)
    entry.updated_at = datetime.utcnow()
    entry.updated_by = user.username
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/portainjertos/{id_portainjerto}/bitacora/{bid}")
def delete_bitacora_pi(
    id_portainjerto: int,
    bid: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    entry = db.get(BitacoraPortainjerto, bid)
    if not entry or entry.id_portainjerto != id_portainjerto:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    entry.activo = False
    entry.updated_at = datetime.utcnow()
    entry.updated_by = user.username
    db.commit()
    return {"detail": "Entrada eliminada"}


# ── TestBlock Eventos (historial + deshacer) ──────────────────────────────

@router.get("/testblocks/{id_testblock}/eventos")
def list_eventos(
    id_testblock: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return (
        db.query(TestblockEvento)
        .filter(TestblockEvento.id_testblock == id_testblock)
        .order_by(desc(TestblockEvento.created_at))
        .limit(100)
        .all()
    )
