"""Endpoints para consultar y gestionar PDFs almacenados por RUT."""

import base64
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from io import BytesIO

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.sistema import Usuario
from app.models.documento_pdf import DocumentoPdf

router = APIRouter(prefix="/documentos-pdf", tags=["Documentos PDF"])


# ── Helper: guardar PDF en base64 ─────────────────────────────────────────

def guardar_pdf_base64(
    db: Session,
    rut: str,
    tipo_reporte: str,
    nombre_archivo: str,
    pdf_bytes: bytes,
    descripcion: str | None = None,
    id_entidad: int | None = None,
    usuario: str | None = None,
) -> DocumentoPdf:
    """Guarda un PDF como base64 en la tabla documentos_pdf."""
    doc = DocumentoPdf(
        rut=rut,
        tipo_reporte=tipo_reporte,
        nombre_archivo=nombre_archivo,
        descripcion=descripcion,
        pdf_base64=base64.b64encode(pdf_bytes).decode("ascii"),
        tamano_bytes=len(pdf_bytes),
        id_entidad=id_entidad,
        usuario_creacion=usuario,
        fecha_creacion=datetime.utcnow(),
        activo=True,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


# ── Listar PDFs por RUT ───────────────────────────────────────────────────

@router.get("/por-rut/{rut}")
def listar_por_rut(
    rut: str,
    tipo_reporte: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Lista todos los PDFs almacenados para un RUT."""
    q = db.query(DocumentoPdf).filter(
        DocumentoPdf.rut == rut,
        DocumentoPdf.activo == True,
    )
    if tipo_reporte:
        q = q.filter(DocumentoPdf.tipo_reporte == tipo_reporte)
    docs = q.order_by(desc(DocumentoPdf.fecha_creacion)).all()
    return [
        {
            "id_documento": d.id_documento,
            "rut": d.rut,
            "tipo_reporte": d.tipo_reporte,
            "nombre_archivo": d.nombre_archivo,
            "descripcion": d.descripcion,
            "tamano_bytes": d.tamano_bytes,
            "id_entidad": d.id_entidad,
            "usuario_creacion": d.usuario_creacion,
            "fecha_creacion": d.fecha_creacion,
        }
        for d in docs
    ]


# ── Descargar PDF por ID ──────────────────────────────────────────────────

@router.get("/{id_documento}/descargar")
def descargar_pdf(
    id_documento: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Descarga un PDF almacenado por su ID."""
    doc = db.get(DocumentoPdf, id_documento)
    if not doc or not doc.activo:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    pdf_bytes = base64.b64decode(doc.pdf_base64)
    buf = BytesIO(pdf_bytes)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={doc.nombre_archivo}"},
    )


# ── Obtener PDF base64 por ID ────────────────────────────────────────────

@router.get("/{id_documento}")
def obtener_pdf(
    id_documento: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Retorna el documento con su base64 incluido."""
    doc = db.get(DocumentoPdf, id_documento)
    if not doc or not doc.activo:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return {
        "id_documento": doc.id_documento,
        "rut": doc.rut,
        "tipo_reporte": doc.tipo_reporte,
        "nombre_archivo": doc.nombre_archivo,
        "descripcion": doc.descripcion,
        "pdf_base64": doc.pdf_base64,
        "tamano_bytes": doc.tamano_bytes,
        "id_entidad": doc.id_entidad,
        "usuario_creacion": doc.usuario_creacion,
        "fecha_creacion": doc.fecha_creacion,
    }


# ── Eliminar (soft delete) ───────────────────────────────────────────────

@router.delete("/{id_documento}")
def eliminar_pdf(
    id_documento: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Soft-delete de un documento PDF."""
    doc = db.get(DocumentoPdf, id_documento)
    if not doc or not doc.activo:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    doc.activo = False
    db.commit()
    return {"detail": "Documento eliminado"}


# ── Buscar RUTs con documentos ────────────────────────────────────────────

@router.get("/")
def listar_ruts(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Lista todos los RUTs que tienen documentos almacenados."""
    from sqlalchemy import func, distinct
    rows = (
        db.query(
            DocumentoPdf.rut,
            func.count(DocumentoPdf.id_documento).label("total"),
            func.max(DocumentoPdf.fecha_creacion).label("ultimo_pdf"),
        )
        .filter(DocumentoPdf.activo == True)
        .group_by(DocumentoPdf.rut)
        .order_by(desc(func.max(DocumentoPdf.fecha_creacion)))
        .all()
    )
    return [{"rut": r.rut, "total_documentos": r.total, "ultimo_pdf": r.ultimo_pdf} for r in rows]
