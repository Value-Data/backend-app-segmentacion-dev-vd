"""Variedad, variedad_susceptibilidades, variedades_log,
defectos, defectos_variedades, asignaciones_testblock models.
"""

import base64
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import field_serializer
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class Variedad(SQLModel, table=True):
    __tablename__ = "variedades"
    id_variedad: Optional[int] = Field(default=None, primary_key=True)
    id_especie: int = Field(foreign_key="especies.id_especie")
    id_pmg: Optional[int] = Field(default=None, foreign_key="pmg.id_pmg")
    id_origen: Optional[int] = Field(default=None, foreign_key="origenes.id_origen")
    codigo: str = Field(sa_column=Column(sa.String(30), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    nombre_corto: Optional[str] = Field(default=None, sa_column=Column(sa.String(10)))
    nombre_comercial: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    tipo: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    origen: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    anio_introduccion: Optional[int] = Field(default=None)
    epoca_cosecha: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    epoca: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    vigor: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    req_frio_horas: Optional[int] = Field(default=None)
    req_frio: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    color_fruto: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    color_pulpa: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    id_color_fruto: Optional[int] = Field(default=None, foreign_key="colores.id_color")
    id_color_pulpa: Optional[int] = Field(default=None, foreign_key="colores.id_color")
    id_color_cubrimiento: Optional[int] = Field(default=None, foreign_key="colores.id_color")
    calibre_esperado: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    firmeza_esperada: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    susceptibilidad: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    estado: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    fecha_ultima_visita: Optional[date] = Field(default=None)
    proxima_accion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    observaciones: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    imagen: Optional[bytes] = Field(default=None, sa_column=Column(sa.LargeBinary))
    color: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    fertilidad: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    alelos: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    polinizantes: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    portainjertos_recomendados: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    familia_genetica: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    recomendaciones: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    fecha_cosecha_ref: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    auto_fertil: Optional[bool] = Field(default=None)
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))

    @field_serializer("imagen")
    @classmethod
    def serialize_imagen(cls, v: bytes | None) -> str | None:
        if v is None:
            return None
        return base64.b64encode(v).decode("ascii")


class VariedadSusceptibilidad(SQLModel, table=True):
    __tablename__ = "variedad_susceptibilidades"
    id_vs: Optional[int] = Field(default=None, primary_key=True)
    id_variedad: int = Field(foreign_key="variedades.id_variedad")
    id_suscept: int = Field(foreign_key="susceptibilidades.id_suscept")
    nivel: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    notas: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))


# ── variedades_log ─────────────────────────────────────────────────────────
class VariedadLog(SQLModel, table=True):
    __tablename__ = "variedades_log"
    id_log: Optional[int] = Field(default=None, primary_key=True)
    id_variedad: int = Field(foreign_key="variedades.id_variedad")
    accion: str = Field(sa_column=Column(sa.String(50), nullable=False))
    campo_modificado: Optional[str] = Field(default=None, sa_column=Column(sa.String(100)))
    valor_anterior: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    valor_nuevo: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    usuario: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    fecha: Optional[datetime] = Field(default=None)
    notas: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))


# ── defectos ───────────────────────────────────────────────────────────────
class Defecto(SQLModel, table=True):
    __tablename__ = "defectos"
    id: Optional[int] = Field(default=None, primary_key=True)
    codigo: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    nombre: str = Field(sa_column=Column(sa.String(100), nullable=False))
    nombre_en: Optional[str] = Field(default=None, sa_column=Column(sa.String(100)))
    categoria: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    activo: Optional[bool] = Field(default=True)
    orden: Optional[int] = Field(default=None)
    created_at: Optional[datetime] = Field(default=None)
    updated_at: Optional[datetime] = Field(default=None)
    imagen_url: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    imagen: Optional[bytes] = Field(default=None, sa_column=Column(sa.LargeBinary))


# ── defectos_variedades ──────────────────────────────────────────────────────
class DefectoVariedad(SQLModel, table=True):
    __tablename__ = "defectos_variedades"
    id: Optional[int] = Field(default=None, primary_key=True)
    id_variedad: int = Field(foreign_key="variedades.id_variedad")
    id_defecto: int = Field(foreign_key="defectos.id")
    created_at: Optional[datetime] = Field(default=None)


# ── asignaciones_testblock ──────────────────────────────────────────────────
class AsignacionTestBlock(SQLModel, table=True):
    __tablename__ = "asignaciones_testblock"
    id_asignacion: Optional[int] = Field(default=None, primary_key=True)
    id_variedad: int = Field(foreign_key="variedades.id_variedad")
    id_cuartel: int = Field(foreign_key="cuarteles.id_cuartel")
    cantidad_posiciones: Optional[int] = Field(default=None)
    fecha_asignacion: Optional[date] = Field(default=None)
    estado: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    observaciones: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    fecha_creacion: Optional[datetime] = Field(default=None)
