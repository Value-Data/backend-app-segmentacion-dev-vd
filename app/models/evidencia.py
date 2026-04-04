"""Evidence/photos for labor executions."""

from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class EvidenciaLabor(SQLModel, table=True):
    __tablename__ = "evidencia_labores"
    __table_args__ = {"extend_existing": True}

    id_evidencia: Optional[int] = Field(default=None, primary_key=True)
    id_ejecucion: int = Field(foreign_key="ejecucion_labores.id_ejecucion")
    tipo: Optional[str] = Field(default="foto", sa_column=Column(sa.String(20)))  # foto, nota, qr_scan
    descripcion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    imagen_base64: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    url: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    lat: Optional[float] = Field(default=None)
    lng: Optional[float] = Field(default=None)
    usuario: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
