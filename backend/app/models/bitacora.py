"""Bitacora de variedades model."""

from datetime import datetime, date
from typing import Optional
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class BitacoraVariedad(SQLModel, table=True):
    __tablename__ = "bitacora_variedades"
    id_entrada: Optional[int] = Field(default=None, primary_key=True)
    id_variedad: int = Field(foreign_key="variedades.id_variedad")
    tipo_entrada: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    fecha: Optional[date] = Field(default=None)
    titulo: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    contenido: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    resultado: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    id_testblock: Optional[int] = Field(default=None, foreign_key="testblocks.id_testblock")
    ubicacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    usuario: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
