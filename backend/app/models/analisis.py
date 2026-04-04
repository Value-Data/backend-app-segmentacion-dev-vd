"""Analisis models: paquete_tecnologico, alertas, reglas_alerta."""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class PaqueteTecnologico(SQLModel, table=True):
    __tablename__ = "paquete_tecnologico"
    id_paquete: Optional[int] = Field(default=None, primary_key=True)
    id_variedad: int = Field(foreign_key="variedades.id_variedad")
    temporada: str = Field(sa_column=Column(sa.String(50), nullable=False))
    total_posiciones: Optional[int] = Field(default=None)
    posiciones_evaluadas: Optional[int] = Field(default=None)
    cluster_predominante: Optional[int] = Field(default=None)
    brix_promedio: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    brix_min: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    brix_max: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    firmeza_promedio: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    acidez_promedio: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 3)))
    calibre_promedio: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    score_promedio: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    recomendacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    decision: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    fecha_generacion: Optional[datetime] = Field(default=None)


class Alerta(SQLModel, table=True):
    __tablename__ = "alertas"
    id_alerta: Optional[int] = Field(default=None, primary_key=True)
    id_posicion: Optional[int] = Field(default=None, foreign_key="posiciones_testblock.id_posicion")
    tipo_alerta: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    prioridad: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    titulo: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    descripcion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    valor_detectado: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    umbral_violado: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    estado: Optional[str] = Field(default="activa", sa_column=Column(sa.String(20)))
    usuario_resolucion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    fecha_resolucion: Optional[datetime] = Field(default=None)
    notas_resolucion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


class ReglaAlerta(SQLModel, table=True):
    __tablename__ = "reglas_alerta"
    id_regla: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(20), unique=True, nullable=False))
    nombre: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    descripcion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    tipo: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    condicion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    prioridad_resultado: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    activo: bool = Field(default=True)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
