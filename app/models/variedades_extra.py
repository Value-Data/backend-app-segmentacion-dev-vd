"""Models for variedades_polinizantes, variedades_fotos, bitacora_portainjertos, testblock_eventos."""

from datetime import datetime, date
from typing import Optional
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class VariedadPolinizante(SQLModel, table=True):
    __tablename__ = "variedades_polinizantes"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    id_variedad: int = Field(foreign_key="variedades.id_variedad")
    polinizante_variedad_id: Optional[int] = Field(default=None, foreign_key="variedades.id_variedad")
    polinizante_nombre: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200), nullable=True))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


class VariedadFoto(SQLModel, table=True):
    __tablename__ = "variedades_fotos"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    id_variedad: int = Field(foreign_key="variedades.id_variedad")
    filename: str = Field(sa_column=Column(sa.NVARCHAR(255), nullable=False))
    filepath: str = Field(sa_column=Column(sa.NVARCHAR(500), nullable=False))
    descripcion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


class BitacoraPortainjerto(SQLModel, table=True):
    __tablename__ = "bitacora_portainjertos"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    id_portainjerto: int = Field(foreign_key="portainjertos.id_portainjerto")
    fecha: Optional[date] = Field(default_factory=date.today)
    nota: str = Field(sa_column=Column(sa.NVARCHAR(None), nullable=False))
    created_by: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    updated_by: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    activo: Optional[bool] = Field(default=True)


class TestblockEvento(SQLModel, table=True):
    __tablename__ = "testblock_eventos"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    id_testblock: int
    id_posicion: int
    tipo_evento: str = Field(sa_column=Column(sa.String(20), nullable=False))
    datos_antes: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    datos_despues: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    created_by: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    revertido: Optional[bool] = Field(default=False)
