"""Schemas for testblock operations."""

from pydantic import BaseModel
from typing import Optional
from decimal import Decimal


class TestBlockCreate(BaseModel):
    codigo: str
    nombre: str
    id_campo: int
    id_centro_costo: Optional[int] = None
    id_cuartel: Optional[int] = None
    id_marco: Optional[int] = None
    num_hileras: Optional[int] = None
    posiciones_por_hilera: Optional[int] = None
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    temporada_inicio: Optional[str] = None
    notas: Optional[str] = None


class TestBlockUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    id_campo: Optional[int] = None
    id_centro_costo: Optional[int] = None
    id_cuartel: Optional[int] = None
    id_marco: Optional[int] = None
    num_hileras: Optional[int] = None
    posiciones_por_hilera: Optional[int] = None
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    estado: Optional[str] = None
    temporada_inicio: Optional[str] = None
    notas: Optional[str] = None
    activo: Optional[bool] = None


class AltaPlantaRequest(BaseModel):
    id_posicion: int
    id_lote: int
    observaciones: Optional[str] = None


class AltaMasivaRequest(BaseModel):
    h_desde: int
    p_desde: int
    h_hasta: int
    p_hasta: int
    id_lote: int
    observaciones: Optional[str] = None


class BajaPlantaRequest(BaseModel):
    id_posicion: int
    motivo: str
    observaciones: Optional[str] = None


class BajaMasivaRequest(BaseModel):
    ids_posiciones: list[int]
    motivo: str
    observaciones: Optional[str] = None


class ReplantePlantaRequest(BaseModel):
    id_posicion: int
    id_lote: int
    motivo: Optional[str] = None
    observaciones: Optional[str] = None


class UpdatePosicionObservaciones(BaseModel):
    observaciones: Optional[str] = None


class AgregarHileraRequest(BaseModel):
    num_posiciones: int


class AgregarPosicionesRequest(BaseModel):
    hilera: int
    cantidad: int


class GenerarPosicionesRequest(BaseModel):
    """Optional — if not provided, uses testblock num_hileras / posiciones_por_hilera."""
    num_hileras: Optional[int] = None
    posiciones_por_hilera: Optional[int] = None
