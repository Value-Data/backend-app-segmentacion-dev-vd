"""Master/lookup table models: paises, regiones, comunas, campos, cuarteles, especies,
portainjertos, pmg, origenes, viveros, colores, susceptibilidades, tipos_labor,
estados_fenologicos, estados_planta, temporadas, bodegas, catalogos, correlativos,
centros_costo, marcos_plantacion.
"""

import base64
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import field_serializer
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


# ── paises ──────────────────────────────────────────────────────────────────
class Pais(SQLModel, table=True):
    __tablename__ = "paises"
    id_pais: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(10), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    nombre_en: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    orden: Optional[int] = Field(default=0)
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


# ── regiones ────────────────────────────────────────────────────────────────
class Region(SQLModel, table=True):
    __tablename__ = "regiones"
    id_region: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(5), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    numero: Optional[int] = Field(default=None)
    orden: Optional[int] = Field(default=None)
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


# ── comunas ─────────────────────────────────────────────────────────────────
class Comuna(SQLModel, table=True):
    __tablename__ = "comunas"
    id_comuna: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    id_region: int = Field(foreign_key="regiones.id_region")
    codigo_postal: Optional[str] = Field(default=None, sa_column=Column(sa.String(10)))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


# ── campos ──────────────────────────────────────────────────────────────────
class Campo(SQLModel, table=True):
    __tablename__ = "campos"
    id_campo: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(20), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    ubicacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    comuna: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    region: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    direccion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    responsable: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    hectareas: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(10, 2)))
    latitud: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(10, 7)))
    longitud: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(10, 7)))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))


# ── cuarteles ───────────────────────────────────────────────────────────────
class Cuartel(SQLModel, table=True):
    __tablename__ = "cuarteles"
    id_cuartel: Optional[int] = Field(default=None, primary_key=True)
    id_campo: int = Field(foreign_key="campos.id_campo")
    codigo: str = Field(sa_column=Column(sa.String(20), nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    num_hileras: Optional[int] = Field(default=None)
    pos_por_hilera: Optional[int] = Field(default=None)
    es_testblock: Optional[bool] = Field(default=None)
    centro_costo: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    hileras: Optional[int] = Field(default=None)
    posiciones_por_hilera: Optional[int] = Field(default=None)
    sistema: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    notas: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    id_centro_costo: Optional[int] = Field(default=None)
    id_marco: Optional[int] = Field(default=None)
    latitud: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(10, 6)))
    longitud: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(10, 6)))
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    superficie: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(10, 2)))
    id_especie: Optional[int] = Field(default=None)
    especies_ids: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    layout_configurado: Optional[bool] = Field(default=None)


# ── especies ────────────────────────────────────────────────────────────────
class Especie(SQLModel, table=True):
    __tablename__ = "especies"
    id_especie: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(10), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(50), nullable=False))
    nombre_cientifico: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    emoji: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(10)))
    color_hex: Optional[str] = Field(default=None, sa_column=Column(sa.String(7)))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))


# ── portainjertos ───────────────────────────────────────────────────────────
class Portainjerto(SQLModel, table=True):
    __tablename__ = "portainjertos"
    id_portainjerto: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(20), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(50), nullable=False))
    vigor: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    compatibilidad: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    origen: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    caracteristicas: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    cruce: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    especie: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    tipo: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    patron: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    propagacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    obtentor: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    sensibilidad: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    susceptibilidades: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    ventajas: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    notas: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    imagen: Optional[bytes] = Field(default=None, sa_column=Column(sa.LargeBinary))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))

    @field_serializer("imagen")
    @classmethod
    def serialize_imagen(cls, v: bytes | None) -> str | None:
        if v is None:
            return None
        return base64.b64encode(v).decode("ascii")


# ── pmg ─────────────────────────────────────────────────────────────────────
class Pmg(SQLModel, table=True):
    __tablename__ = "pmg"
    id_pmg: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(20), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    licenciante: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    pais_origen: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    pais: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    ciudad: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    email: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    telefono: Optional[str] = Field(default=None, sa_column=Column(sa.String(30)))
    direccion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    contacto: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    notas: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    contacto_nombre: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    contacto_email: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    contacto_telefono: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    viveros_chile: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)


# ── pmg_especies ────────────────────────────────────────────────────────────
class PmgEspecie(SQLModel, table=True):
    __tablename__ = "pmg_especies"
    id_pmg_especie: Optional[int] = Field(default=None, primary_key=True)
    id_pmg: Optional[int] = Field(default=None, foreign_key="pmg.id_pmg")
    id_especie: Optional[int] = Field(default=None, foreign_key="especies.id_especie")
    activo: bool = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


# ── portainjerto_especies ──────────────────────────────────────────────────
class PortainjertoEspecie(SQLModel, table=True):
    __tablename__ = "portainjerto_especies"
    id_pe: Optional[int] = Field(default=None, primary_key=True)
    id_portainjerto: int = Field(foreign_key="portainjertos.id_portainjerto")
    id_especie: int = Field(foreign_key="especies.id_especie")
    activo: bool = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


# ── origenes ────────────────────────────────────────────────────────────────
class Origen(SQLModel, table=True):
    __tablename__ = "origenes"
    id_origen: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(20), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    pais: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    tipo: Optional[str] = Field(default=None, sa_column=Column(sa.String(30)))
    contacto: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    notas: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))


# ── viveros ─────────────────────────────────────────────────────────────────
class Vivero(SQLModel, table=True):
    __tablename__ = "viveros"
    id_vivero: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(20), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    id_pmg: Optional[int] = Field(default=None, foreign_key="pmg.id_pmg")
    representante: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    telefono: Optional[str] = Field(default=None, sa_column=Column(sa.String(30)))
    email: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    direccion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    comuna: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    region: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))


# ── vivero_pmg ─────────────────────────────────────────────────────────────
class ViveroPmg(SQLModel, table=True):
    __tablename__ = "vivero_pmg"
    id_vp: Optional[int] = Field(default=None, primary_key=True)
    id_vivero: int = Field(foreign_key="viveros.id_vivero")
    id_pmg: int = Field(foreign_key="pmg.id_pmg")
    activo: bool = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


# ── colores ─────────────────────────────────────────────────────────────────
class Color(SQLModel, table=True):
    __tablename__ = "colores"
    id_color: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(20), nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(50), nullable=False))
    tipo: str = Field(sa_column=Column(sa.String(20), nullable=False))
    aplica_especie: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    color_hex: Optional[str] = Field(default=None, sa_column=Column(sa.String(7)))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))


# ── susceptibilidades ──────────────────────────────────────────────────────
class Susceptibilidad(SQLModel, table=True):
    __tablename__ = "susceptibilidades"
    id_suscept: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(20), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    nombre_en: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    descripcion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    categoria: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    severidad: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    orden: Optional[int] = Field(default=0)
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))


# ── tipos_labor ─────────────────────────────────────────────────────────────
class TipoLabor(SQLModel, table=True):
    __tablename__ = "tipos_labor"
    id_labor: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(20), unique=True, nullable=False))
    categoria: str = Field(sa_column=Column(sa.String(50), nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    descripcion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    aplica_especies: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    aplica_a: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    frecuencia: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))


# ── estados_fenologicos ────────────────────────────────────────────────────
class EstadoFenologico(SQLModel, table=True):
    __tablename__ = "estados_fenologicos"
    id_estado: Optional[int] = Field(default=None, primary_key=True)
    id_especie: int = Field(foreign_key="especies.id_especie")
    codigo: str = Field(sa_column=Column(sa.String(20), nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(50), nullable=False))
    orden: int = Field(default=0)
    descripcion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    color_hex: Optional[str] = Field(default=None, sa_column=Column(sa.String(7)))
    mes_orientativo: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(20)))
    mes_inicio: Optional[int] = Field(default=None)
    mes_fin: Optional[int] = Field(default=None)
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))


# ── estados_planta ──────────────────────────────────────────────────────────
class EstadoPlanta(SQLModel, table=True):
    __tablename__ = "estados_planta"
    id_estado: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(20), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(50), nullable=False))
    descripcion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    color_hex: str = Field(sa_column=Column(sa.String(7), nullable=False))
    icono: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    requiere_foto: Optional[bool] = Field(default=False)
    es_final: Optional[bool] = Field(default=False)
    orden: Optional[int] = Field(default=0)
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))


# ── temporadas ──────────────────────────────────────────────────────────────
class Temporada(SQLModel, table=True):
    __tablename__ = "temporadas"
    id_temporada: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.NVARCHAR(20), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(50), nullable=False))
    fecha_inicio: Optional[date] = Field(default=None)
    fecha_fin: Optional[date] = Field(default=None)
    estado: Optional[str] = Field(default="activa", sa_column=Column(sa.NVARCHAR(20)))
    notas: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    activo: bool = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


# ── bodegas ─────────────────────────────────────────────────────────────────
class Bodega(SQLModel, table=True):
    __tablename__ = "bodegas"
    id_bodega: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.NVARCHAR(20), nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    ubicacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    responsable: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


# ── catalogos ───────────────────────────────────────────────────────────────
class Catalogo(SQLModel, table=True):
    __tablename__ = "catalogos"
    id: Optional[int] = Field(default=None, primary_key=True)
    tipo: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    valor: str = Field(sa_column=Column(sa.NVARCHAR(200), nullable=False))
    descripcion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    orden: Optional[int] = Field(default=0)
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


# ── correlativos ────────────────────────────────────────────────────────────
class Correlativo(SQLModel, table=True):
    __tablename__ = "correlativos"
    id: Optional[int] = Field(default=None, primary_key=True)
    tipo: str = Field(sa_column=Column(sa.String(30), unique=True, nullable=False))
    prefijo: str = Field(sa_column=Column(sa.String(10), nullable=False))
    ultimo_numero: Optional[int] = Field(default=0)
    formato: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    fecha_modificacion: Optional[datetime] = Field(default=None)


# ── centros_costo ───────────────────────────────────────────────────────────
class CentroCosto(SQLModel, table=True):
    __tablename__ = "centros_costo"
    id: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.NVARCHAR(50), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(200), nullable=False))
    descripcion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    id_campo: Optional[int] = Field(default=None, foreign_key="campos.id_campo")
    responsable: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    presupuesto: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(18, 2)))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))


# ── marcos_plantacion ──────────────────────────────────────────────────────
class MarcoPlantacion(SQLModel, table=True):
    __tablename__ = "marcos_plantacion"
    id: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.NVARCHAR(50), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(200), nullable=False))
    distancia_hilera: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    distancia_planta: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    sistema_conduccion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    descripcion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    dist_entre_hileras: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(10, 2)))
    dist_entre_plantas: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(10, 2)))
    plantas_hectarea: Optional[int] = Field(default=None)
    conduccion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    especie_recomendada: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    id_marco: Optional[int] = Field(default=None)
    predeterminado: Optional[bool] = Field(default=None)
    notas: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
