"""Endpoints para polinizantes, fotos, y bitacora de portainjertos."""

import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
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

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "variedades")


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

@router.get("/variedades/{id_variedad}/fotos")
def list_fotos(
    id_variedad: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return (
        db.query(VariedadFoto)
        .filter(VariedadFoto.id_variedad == id_variedad)
        .order_by(desc(VariedadFoto.fecha_creacion))
        .all()
    )


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

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "img.jpg")[1]
    safe_name = f"{id_variedad}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, safe_name)

    with open(filepath, "wb") as f:
        content = file.file.read()
        f.write(content)

    foto = VariedadFoto(
        id_variedad=id_variedad,
        filename=file.filename or safe_name,
        filepath=filepath,
        descripcion=descripcion,
    )
    db.add(foto)
    db.commit()
    db.refresh(foto)
    return foto


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
    if os.path.exists(foto.filepath):
        os.remove(foto.filepath)
    db.delete(foto)
    db.commit()
    return {"detail": "Foto eliminada"}


@router.get("/variedades/fotos/{fid}/file")
def serve_foto(
    fid: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Serve foto file. Accepts token via query param for use in <img src>."""
    if not token:
        raise HTTPException(status_code=401, detail="Token requerido")
    from app.core.security import decode_access_token
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token invalido o expirado")
    foto = db.get(VariedadFoto, fid)
    if not foto:
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    if not os.path.exists(foto.filepath):
        raise HTTPException(status_code=404, detail="Archivo no encontrado en disco")
    return FileResponse(foto.filepath, media_type="image/jpeg", filename=foto.filename)


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
    return foto


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
