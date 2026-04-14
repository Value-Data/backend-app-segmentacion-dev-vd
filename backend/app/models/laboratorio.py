"""Laboratorio models: mediciones, clasificacion_cluster, umbrales_calidad,
registros_fenologicos, ejecucion_labores.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class MedicionLaboratorio(SQLModel, table=True):
    __tablename__ = "mediciones_laboratorio"
    id_medicion: Optional[int] = Field(default=None, primary_key=True)
    id_posicion: Optional[int] = Field(default=None, foreign_key="posiciones_testblock.id_posicion")
    id_planta: Optional[int] = Field(default=None, foreign_key="plantas.id_planta")
    temporada: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    fecha_medicion: date
    fecha_cosecha: Optional[date] = Field(default=None)
    brix: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    acidez: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 3)))
    firmeza: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 1)))
    calibre: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    peso: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(6, 2)))
    color_pct: Optional[int] = Field(default=None)
    cracking_pct: Optional[int] = Field(default=None)
    observaciones: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    usuario_registro: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)

    # Firmeza detallada (5 puntos de medicion)
    firmeza_punta: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(8, 2)))
    firmeza_quilla: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(8, 2)))
    firmeza_hombro: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(8, 2)))
    firmeza_mejilla_1: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(8, 2)))
    firmeza_mejilla_2: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(8, 2)))

    # Muestra y postcosecha
    n_muestra: Optional[int] = Field(default=None)
    periodo_almacenaje: Optional[int] = Field(default=None)
    perimetro: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(8, 2)))
    pardeamiento: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    traslucidez: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    gelificacion: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    harinosidad: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    color_pulpa: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))

    # Agronomia y contexto de muestra
    raleo_frutos: Optional[int] = Field(default=None)
    rendimiento: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(10, 2)))
    repeticion: Optional[int] = Field(default=None)

    # Color de cubrimiento (% de frutos en cada rango)
    color_0_30: Optional[int] = Field(default=None)
    color_30_50: Optional[int] = Field(default=None)
    color_50_75: Optional[int] = Field(default=None)
    color_75_100: Optional[int] = Field(default=None)
    color_total: Optional[int] = Field(default=None)

    # Distribucion de color (conteo o % de frutos por categoria)
    color_verde: Optional[int] = Field(default=None)
    color_crema: Optional[int] = Field(default=None)
    color_amarillo: Optional[int] = Field(default=None)
    color_full: Optional[int] = Field(default=None)
    color_dist_total: Optional[int] = Field(default=None)

    # Total de frutos evaluados por metrica de postcosecha
    total_frutos_pardeamiento: Optional[int] = Field(default=None)
    total_frutos_traslucidez: Optional[int] = Field(default=None)
    total_frutos_gelificacion: Optional[int] = Field(default=None)
    total_frutos_harinosidad: Optional[int] = Field(default=None)

    # FKs directas para contexto de laboratorio
    id_campo: Optional[int] = Field(default=None, foreign_key="campos.id_campo")
    id_variedad: Optional[int] = Field(default=None, foreign_key="variedades.id_variedad")
    id_especie: Optional[int] = Field(default=None, foreign_key="especies.id_especie")
    id_portainjerto: Optional[int] = Field(default=None, foreign_key="portainjertos.id_portainjerto")


class ClasificacionCluster(SQLModel, table=True):
    __tablename__ = "clasificacion_cluster"
    id_clasificacion: Optional[int] = Field(default=None, primary_key=True)
    id_medicion: Optional[int] = Field(default=None, foreign_key="mediciones_laboratorio.id_medicion")
    cluster: Optional[int] = Field(default=None)
    banda_brix: Optional[int] = Field(default=None)
    banda_firmeza: Optional[int] = Field(default=None)
    banda_acidez: Optional[int] = Field(default=None)
    banda_calibre: Optional[int] = Field(default=None)
    score_total: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    metodo: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    fecha_calculo: Optional[datetime] = Field(default_factory=datetime.utcnow)


class UmbralCalidad(SQLModel, table=True):
    __tablename__ = "umbrales_calidad"
    id_umbral: Optional[int] = Field(default=None, primary_key=True)
    id_especie: int = Field(foreign_key="especies.id_especie")
    metrica: str = Field(sa_column=Column(sa.String(30), nullable=False))
    banda: int
    valor_min: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(10, 3)))
    valor_max: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(10, 3)))
    peso_ponderacion: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    activo: Optional[bool] = Field(default=True)
    fecha_modificacion: Optional[datetime] = Field(default=None)


class RegistroFenologico(SQLModel, table=True):
    __tablename__ = "registros_fenologicos"
    id_registro: Optional[int] = Field(default=None, primary_key=True)
    id_posicion: Optional[int] = Field(default=None, foreign_key="posiciones_testblock.id_posicion")
    id_planta: Optional[int] = Field(default=None, foreign_key="plantas.id_planta")
    id_estado_fenol: Optional[int] = Field(default=None, foreign_key="estados_fenologicos.id_estado")
    temporada: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    fecha_registro: date
    porcentaje: Optional[int] = Field(default=None)
    observaciones: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    foto_url: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    usuario_registro: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


class DetalleLabor(SQLModel, table=True):
    """Sub-items / instructions for each tipo_labor, optionally filtered by species."""
    __tablename__ = "detalles_labor"
    id_detalle: Optional[int] = Field(default=None, primary_key=True)
    id_labor: int = Field(foreign_key="tipos_labor.id_labor")
    descripcion: str = Field(sa_column=Column(sa.NVARCHAR(500), nullable=False))
    aplica_especie: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    orden: Optional[int] = Field(default=0)
    es_checklist: Optional[bool] = Field(default=True)
    activo: Optional[bool] = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))


class EjecucionLabor(SQLModel, table=True):
    __tablename__ = "ejecucion_labores"
    __table_args__ = {"extend_existing": True}

    id_ejecucion: Optional[int] = Field(default=None, primary_key=True)
    id_posicion: Optional[int] = Field(default=None, foreign_key="posiciones_testblock.id_posicion")
    id_planta: Optional[int] = Field(default=None, foreign_key="plantas.id_planta")
    id_labor: Optional[int] = Field(default=None, foreign_key="tipos_labor.id_labor")
    temporada: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    fecha_programada: Optional[date] = Field(default=None)
    fecha_ejecucion: Optional[date] = Field(default=None)
    estado: Optional[str] = Field(default="ejecutada", sa_column=Column(sa.String(20)))
    ejecutor: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    duracion_min: Optional[int] = Field(default=None)
    observaciones: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    id_orden_trabajo: Optional[int] = Field(default=None, foreign_key="ordenes_trabajo.id")
    id_lote: Optional[int] = Field(default=None, foreign_key="inventario_vivero.id_inventario")
    usuario_registro: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
