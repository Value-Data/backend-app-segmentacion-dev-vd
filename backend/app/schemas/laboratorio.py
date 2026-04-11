"""Schemas for laboratorio (mediciones, fenologia, labores)."""

from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date
from decimal import Decimal


def _validate_range(v, lo: float, hi: float, field_name: str):
    """Validate that an optional Decimal value is within [lo, hi]."""
    if v is not None and (float(v) < lo or float(v) > hi):
        raise ValueError(f"{field_name} debe estar entre {lo} y {hi}")
    return v


class MedicionCreate(BaseModel):
    id_posicion: Optional[int] = None
    id_planta: Optional[int] = None
    temporada: Optional[str] = None
    fecha_medicion: date
    fecha_cosecha: Optional[date] = None
    brix: Optional[Decimal] = None
    acidez: Optional[Decimal] = None
    firmeza: Optional[Decimal] = None
    calibre: Optional[Decimal] = None
    peso: Optional[Decimal] = None
    color_pct: Optional[int] = None
    cracking_pct: Optional[int] = None
    observaciones: Optional[str] = None

    # Firmeza detallada (5 puntos)
    firmeza_punta: Optional[Decimal] = None
    firmeza_quilla: Optional[Decimal] = None
    firmeza_hombro: Optional[Decimal] = None
    firmeza_mejilla_1: Optional[Decimal] = None
    firmeza_mejilla_2: Optional[Decimal] = None

    # Muestra y postcosecha
    n_muestra: Optional[int] = None
    periodo_almacenaje: Optional[int] = None
    perimetro: Optional[Decimal] = None
    pardeamiento: Optional[Decimal] = None
    traslucidez: Optional[Decimal] = None
    gelificacion: Optional[Decimal] = None
    harinosidad: Optional[Decimal] = None
    color_pulpa: Optional[str] = None

    # Agronomia y contexto de muestra
    raleo_frutos: Optional[int] = None
    rendimiento: Optional[Decimal] = None
    repeticion: Optional[int] = None

    # Color de cubrimiento (% de frutos en cada rango)
    color_0_30: Optional[int] = None
    color_30_50: Optional[int] = None
    color_50_75: Optional[int] = None
    color_75_100: Optional[int] = None
    color_total: Optional[int] = None

    # Distribucion de color (conteo o % por categoria)
    color_verde: Optional[int] = None
    color_crema: Optional[int] = None
    color_amarillo: Optional[int] = None
    color_full: Optional[int] = None
    color_dist_total: Optional[int] = None

    # Total de frutos evaluados por metrica de postcosecha
    total_frutos_pardeamiento: Optional[int] = None
    total_frutos_traslucidez: Optional[int] = None
    total_frutos_gelificacion: Optional[int] = None
    total_frutos_harinosidad: Optional[int] = None

    # FKs directas para contexto de laboratorio
    id_campo: Optional[int] = None
    id_variedad: Optional[int] = None
    id_especie: Optional[int] = None
    id_portainjerto: Optional[int] = None

    # ── Scientific measurement validators ──────────────────────────────────
    @field_validator("brix")
    @classmethod
    def validate_brix(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return _validate_range(v, 0, 50, "Brix")

    @field_validator("firmeza", "firmeza_punta", "firmeza_quilla", "firmeza_hombro",
                     "firmeza_mejilla_1", "firmeza_mejilla_2")
    @classmethod
    def validate_firmeza(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return _validate_range(v, 0, 100, "Firmeza")

    @field_validator("acidez")
    @classmethod
    def validate_acidez(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return _validate_range(v, 0, 10, "Acidez")

    @field_validator("peso")
    @classmethod
    def validate_peso(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return _validate_range(v, 0, 1000, "Peso")


class MedicionBatchRequest(BaseModel):
    """Request body for batch measurement creation."""
    mediciones: list[MedicionCreate]


class MedicionBatchRowResult(BaseModel):
    """Result for a single row in the batch."""
    index: int
    success: bool
    medicion: Optional[dict] = None
    clasificacion: Optional[dict] = None
    error: Optional[str] = None

    model_config = {"from_attributes": True}


class MedicionBatchResponse(BaseModel):
    """Response for batch measurement creation."""
    total_enviadas: int
    total_creadas: int
    total_errores: int
    resultados: list[MedicionBatchRowResult]


class FenologiaCreate(BaseModel):
    id_posicion: int
    id_planta: Optional[int] = None
    id_estado_fenol: int
    temporada: Optional[str] = None
    fecha_registro: date
    porcentaje: Optional[int] = None
    observaciones: Optional[str] = None
    foto_url: Optional[str] = None


class LaborPlanificacion(BaseModel):
    id_posicion: Optional[int] = None
    id_planta: Optional[int] = None
    id_labor: int
    temporada: Optional[str] = None
    fecha_programada: Optional[date] = None
    observaciones: Optional[str] = None


class LaborPlanificacionTestblock(BaseModel):
    id_testblock: int
    id_labor: int
    temporada: Optional[str] = None
    fecha_programada: Optional[date] = None
    observaciones: Optional[str] = None


class LaborEjecucion(BaseModel):
    fecha_ejecucion: date
    ejecutor: Optional[str] = None
    duracion_min: Optional[int] = None
    observaciones: Optional[str] = None
