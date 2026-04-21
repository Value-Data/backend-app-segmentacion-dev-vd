"""Endpoints para polinizantes, fotos, y bitacora de portainjertos."""

import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Header
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

router = APIRouter(tags=["Variedades Extra"])


# ── Polinizantes ──────────────────────────────────────────────────────────

@router.get("/variedades/{id_variedad}/polinizantes")
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


@router.post("/variedades/{id_variedad}/polinizantes")
def add_polinizante(
    id_variedad: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    var = db.get(Variedad, id_variedad)
    if not var:
        raise HTTPException(status_code=404, detail="Variedad no encontrada")

    pol_variedad_id = data.get("polinizante_variedad_id")
    pol_nombre = data.get("polinizante_nombre")

    if pol_variedad_id:
        pol_var = db.get(Variedad, pol_variedad_id)
        if not pol_var:
            raise HTTPException(status_code=404, detail="Variedad polinizante no encontrada")
        pol_nombre = pol_var.nombre
    elif not pol_nombre:
        raise HTTPException(status_code=422, detail="Se requiere polinizante_variedad_id o polinizante_nombre")

    pol = VariedadPolinizante(
        id_variedad=id_variedad,
        polinizante_variedad_id=pol_variedad_id,
        polinizante_nombre=pol_nombre,
    )
    db.add(pol)
    db.commit()
    db.refresh(pol)
    return pol


@router.delete("/variedades/{id_variedad}/polinizantes/{pid}")
def delete_polinizante(
    id_variedad: int,
    pid: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    pol = db.get(VariedadPolinizante, pid)
    if not pol or pol.id_variedad != id_variedad:
        raise HTTPException(status_code=404, detail="Polinizante no encontrado")
    pol.activo = False
    db.commit()
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

    content = file.file.read()
    content_type = file.content_type or "image/jpeg"

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

    Auth: prefiere cabecera `Authorization: Bearer <token>` (no filtra el JWT
    a logs/Referer). Acepta `?token=` sólo como fallback para links/imgs
    legacy todavía en uso.
    """
    from app.core.security import decode_access_token

    bearer = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization.split(" ", 1)[1].strip()
    effective = bearer or token
    if not effective:
        raise HTTPException(status_code=401, detail="Token requerido")
    payload = decode_access_token(effective)
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
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    entry = BitacoraPortainjerto(
        id_portainjerto=id_portainjerto,
        nota=data["nota"],
        fecha=data.get("fecha"),
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
    data: dict,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_role("admin")),
):
    entry = db.get(BitacoraPortainjerto, bid)
    if not entry or entry.id_portainjerto != id_portainjerto:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    if "nota" in data:
        entry.nota = data["nota"]
    if "fecha" in data:
        entry.fecha = data["fecha"]
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
