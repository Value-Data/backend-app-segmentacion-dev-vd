"""Inventario vivero, movimientos, guias despacho, inventario_testblock models."""

from datetime import datetime, date
from typing import Optional
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class InventarioVivero(SQLModel, table=True):
    __tablename__ = "inventario_vivero"
    id_inventario: Optional[int] = Field(default=None, primary_key=True)
    codigo_lote: str = Field(sa_column=Column(sa.String(50), unique=True, nullable=False))
    id_variedad: Optional[int] = Field(default=None, foreign_key="variedades.id_variedad")
    id_portainjerto: Optional[int] = Field(default=None, foreign_key="portainjertos.id_portainjerto")
    id_vivero: Optional[int] = Field(default=None, foreign_key="viveros.id_vivero")
    id_especie: Optional[int] = Field(default=None, foreign_key="especies.id_especie")
    id_pmg: Optional[int] = Field(default=None, foreign_key="pmg.id_pmg")
    id_bodega: Optional[int] = Field(default=None, foreign_key="bodegas.id_bodega")
    tipo_planta: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    tipo_injertacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    tipo_patron: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    ubicacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    cantidad_inicial: int
    cantidad_actual: int
    cantidad_minima: int = Field(default=0)
    cantidad_comprometida: int = Field(default=0)
    fecha_ingreso: date
    ano_plantacion: Optional[int] = Field(default=None)
    origen: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    estado: Optional[str] = Field(default="disponible", sa_column=Column(sa.String(20)))
    observaciones: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    fecha_modificacion: Optional[datetime] = Field(default=None)


class MovimientoInventario(SQLModel, table=True):
    __tablename__ = "movimientos_inventario"
    id_movimiento: Optional[int] = Field(default=None, primary_key=True)
    id_inventario: Optional[int] = Field(default=None, foreign_key="inventario_vivero.id_inventario")
    id_planta: Optional[int] = Field(default=None, foreign_key="plantas.id_planta")
    tipo: str = Field(sa_column=Column(sa.String(30), nullable=False))
    cantidad: int
    saldo_anterior: Optional[int] = Field(default=None)
    saldo_nuevo: Optional[int] = Field(default=None)
    motivo: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    referencia_destino: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    id_evento: Optional[int] = Field(default=None)
    usuario: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    fecha_movimiento: Optional[datetime] = Field(default_factory=datetime.utcnow)


class InventarioTestBlock(SQLModel, table=True):
    __tablename__ = "inventario_testblock"
    id_inventario_tb: Optional[int] = Field(default=None, primary_key=True)
    id_inventario: Optional[int] = Field(default=None, foreign_key="inventario_vivero.id_inventario")
    id_cuartel: Optional[int] = Field(default=None, foreign_key="cuarteles.id_cuartel")
    cantidad_asignada: Optional[int] = Field(default=None)
    cantidad_plantada: int = Field(default=0)
    estado: Optional[str] = Field(default="pendiente", sa_column=Column(sa.String(20)))
    fecha_despacho: Optional[date] = Field(default=None)
    fecha_completado: Optional[date] = Field(default=None)
    observaciones: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


class GuiaDespacho(SQLModel, table=True):
    __tablename__ = "guias_despacho"
    id_guia: Optional[int] = Field(default=None, primary_key=True)
    numero_guia: str = Field(sa_column=Column(sa.String(20), nullable=False))
    id_bodega_origen: int = Field(foreign_key="bodegas.id_bodega")
    id_testblock_destino: int = Field(foreign_key="testblocks.id_testblock")
    estado: Optional[str] = Field(default="pendiente", sa_column=Column(sa.String(20)))
    total_plantas: int
    responsable: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    motivo: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    usuario: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    fecha_despacho: Optional[datetime] = Field(default=None)
    fecha_recepcion: Optional[datetime] = Field(default=None)
    notas: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    activo: Optional[bool] = Field(default=True)
