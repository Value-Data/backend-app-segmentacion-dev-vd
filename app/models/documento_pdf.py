"""Modelo para almacenar PDFs generados en base64, indexados por RUT."""

from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class DocumentoPdf(SQLModel, table=True):
    __tablename__ = "documentos_pdf"
    __table_args__ = {"extend_existing": True}

    id_documento: Optional[int] = Field(default=None, primary_key=True)
    rut: str = Field(sa_column=Column(sa.String(20), nullable=False, index=True))
    tipo_reporte: str = Field(sa_column=Column(sa.String(50), nullable=False))
    nombre_archivo: str = Field(sa_column=Column(sa.NVARCHAR(200), nullable=False))
    descripcion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    pdf_base64: str = Field(sa_column=Column(sa.NVARCHAR(None), nullable=False))
    tamano_bytes: Optional[int] = Field(default=None)
    id_entidad: Optional[int] = Field(default=None)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    activo: Optional[bool] = Field(default=True)
