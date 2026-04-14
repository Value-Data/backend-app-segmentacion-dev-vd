"""Reglas de clustering configurables por especie."""

from datetime import datetime
from typing import Optional
from decimal import Decimal

from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class ReglaCluster(SQLModel, table=True):
    __tablename__ = "reglas_cluster"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    codigo_regla: str = Field(sa_column=Column(sa.String(50), unique=True, nullable=False))
    nombre: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    id_especie: Optional[int] = Field(default=None, foreign_key="especies.id_especie")

    # Thresholds — 3 per metric (band boundaries)
    brix_b1: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    brix_b2: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    brix_b3: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    mejillas_b1: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    mejillas_b2: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    mejillas_b3: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    punto_b1: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    punto_b2: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    punto_b3: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 2)))
    acidez_b1: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 3)))
    acidez_b2: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 3)))
    acidez_b3: Optional[Decimal] = Field(default=None, sa_column=Column(sa.DECIMAL(5, 3)))

    # Cluster sum ranges (default: 4-5, 6-8, 9-11, 12-16)
    cluster1_max: Optional[int] = Field(default=5)
    cluster2_max: Optional[int] = Field(default=8)
    cluster3_max: Optional[int] = Field(default=11)

    activo: Optional[bool] = Field(default=True)
    notas: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(500)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    fecha_modificacion: Optional[datetime] = Field(default=None)
    usuario_modificacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
