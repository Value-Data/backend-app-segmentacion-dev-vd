"""Orden de Trabajo — groups multiple labores under a single work order."""
from datetime import datetime, date
from typing import Optional
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class OrdenTrabajo(SQLModel, table=True):
    __tablename__ = "ordenes_trabajo"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    codigo: str = Field(sa_column=Column(sa.String(30), unique=True, nullable=False))
    id_tipo_labor: Optional[int] = Field(default=None, foreign_key="tipos_labor.id_labor")
    id_testblock: Optional[int] = Field(default=None, foreign_key="testblocks.id_testblock")
    id_lote: Optional[int] = Field(default=None, foreign_key="inventario_vivero.id_inventario")
    temporada: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    fecha_plan_inicio: date
    fecha_plan_fin: date
    id_responsable: Optional[int] = Field(default=None, foreign_key="usuarios.id_usuario")
    equipo: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    prioridad: Optional[str] = Field(default="media", sa_column=Column(sa.String(10)))
    estado: Optional[str] = Field(default="planificada", sa_column=Column(sa.String(20)))
    posiciones_total: Optional[int] = Field(default=0)
    observaciones_plan: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    # Execution/closure fields
    cumplimiento: Optional[str] = Field(default=None, sa_column=Column(sa.String(20)))
    motivo_desviacion: Optional[str] = Field(default=None, sa_column=Column(sa.String(50)))
    motivo_desviacion_detalle: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    posiciones_ejecutadas: Optional[int] = Field(default=0)
    fecha_ejecucion_real: Optional[date] = Field(default=None)
    ejecutor_real: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    duracion_real_min: Optional[int] = Field(default=None)
    observaciones_ejecucion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    fecha_cierre: Optional[datetime] = Field(default=None)
    # Audit
    usuario_creacion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(50)))
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)
    fecha_modificacion: Optional[datetime] = Field(default=None)
