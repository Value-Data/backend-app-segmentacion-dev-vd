"""TestBlock, hileras, posiciones, and plantas models."""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class TestBlock(SQLModel, table=True):
    __tablename__ = "testblocks"
    id_testblock: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(20), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    id_campo: int = Field(foreign_key="campos.id_campo")
    id_centro_costo: Optional[int] = Field(default=None, foreign_key="centros_costo.id")
    id_cuartel: Optional[int] = Field(default=None, foreign_key="cuarteles.id_cuartel")
    id_marco: Optional[int] = Field(default=None, foreign_key="marcos_plantacion.id")
    num_hileras: Optional[int] = Field(default=None)
    posiciones_por_hilera: Optional[int] = Field(default=None)
    total_posiciones: Optional[int] = Field(default=None)
    latitud: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(10, 7)))
    longitud: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(10, 7)))
    estado: Optional[str] = Field(default="activo", sa_column=Column(sa.String(20)))
    fecha_creacion_tb: Optional[date] = Field(default=None)
    temporada_inicio: Optional[str] = Field(default=None, sa_column=Column(sa.String(10)))
    notas: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    poligono_coords: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    zoom_nivel: Optional[int] = Field(default=None)
    activo: bool = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    fecha_modificacion: Optional[datetime] = Field(default=None)


class TestBlockHilera(SQLModel, table=True):
    __tablename__ = "testblock_hileras"
    id_hilera: Optional[int] = Field(default=None, primary_key=True)
    id_cuartel: int = Field(foreign_key="cuarteles.id_cuartel")
    numero_hilera: int
    total_posiciones: int
    portainjerto_default_id: Optional[int] = Field(default=None, foreign_key="portainjertos.id_portainjerto")
    conduccion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    marco_plantacion: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))


class PosicionTestBlock(SQLModel, table=True):
    __tablename__ = "posiciones_testblock"
    id_posicion: Optional[int] = Field(default=None, primary_key=True)
    codigo_unico: str = Field(sa_column=Column(sa.String(30), unique=True, nullable=False))
    id_cuartel: Optional[int] = Field(default=None, foreign_key="cuarteles.id_cuartel")
    id_testblock: Optional[int] = Field(default=None, foreign_key="testblocks.id_testblock")
    id_variedad: Optional[int] = Field(default=None, foreign_key="variedades.id_variedad")
    id_portainjerto: Optional[int] = Field(default=None, foreign_key="portainjertos.id_portainjerto")
    id_pmg: Optional[int] = Field(default=None, foreign_key="pmg.id_pmg")
    id_lote: Optional[int] = Field(default=None, foreign_key="inventario_vivero.id_inventario")
    hilera: int
    posicion: int
    fecha_plantacion: Optional[date] = Field(default=None)
    fecha_alta: Optional[date] = Field(default=None)
    fecha_baja: Optional[date] = Field(default=None)
    estado: Optional[str] = Field(default="vacia", sa_column=Column(sa.String(20)))
    cluster_actual: Optional[int] = Field(default=None)
    motivo_baja: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    observaciones: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    codigo_qr: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    usuario_alta: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    usuario_baja: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    protegida: bool = Field(default=False)
    conduccion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    marco_plantacion: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    fecha_modificacion: Optional[datetime] = Field(default=None)


class Planta(SQLModel, table=True):
    __tablename__ = "plantas"
    id_planta: Optional[int] = Field(default=None, primary_key=True)
    codigo: Optional[str] = Field(default=None, sa_column=Column(sa.String(50), unique=True))
    id_posicion: Optional[int] = Field(default=None, foreign_key="posiciones_testblock.id_posicion")
    id_variedad: Optional[int] = Field(default=None, foreign_key="variedades.id_variedad")
    id_portainjerto: Optional[int] = Field(default=None, foreign_key="portainjertos.id_portainjerto")
    id_especie: Optional[int] = Field(default=None, foreign_key="especies.id_especie")
    id_pmg: Optional[int] = Field(default=None, foreign_key="pmg.id_pmg")
    id_lote_origen: Optional[int] = Field(default=None, foreign_key="inventario_vivero.id_inventario")
    condicion: Optional[str] = Field(default="EN_EVALUACION", sa_column=Column(sa.String(30)))
    activa: bool = Field(default=True)
    ano_plantacion: Optional[int] = Field(default=None)
    ano_injertacion: Optional[int] = Field(default=None)
    metodo_injertacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    tipo_patron: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    conduccion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    marco_plantacion: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    color_cubrimiento: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    color_pulpa: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    fecha_alta: Optional[date] = Field(default=None)
    fecha_baja: Optional[date] = Field(default=None)
    motivo_baja: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    observaciones: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))


class HistorialPosicion(SQLModel, table=True):
    __tablename__ = "historial_posicion"
    id_historial: Optional[int] = Field(default=None, primary_key=True)
    id_posicion: int = Field(foreign_key="posiciones_testblock.id_posicion")
    id_planta: Optional[int] = Field(default=None, foreign_key="plantas.id_planta")
    id_planta_anterior: Optional[int] = Field(
        default=None,
        sa_column=Column(sa.Integer, sa.ForeignKey("plantas.id_planta"), nullable=True),
    )
    accion: str = Field(sa_column=Column(sa.String(20), nullable=False))
    estado_anterior: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    estado_nuevo: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    motivo: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    usuario: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    fecha: Optional[datetime] = Field(default_factory=datetime.utcnow)
