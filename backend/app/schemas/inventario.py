"""Schemas for inventario and despacho."""

from pydantic import BaseModel
from typing import Optional
from datetime import date


class InventarioCreate(BaseModel):
    codigo_lote: str
    id_variedad: int
    id_portainjerto: Optional[int] = None
    id_vivero: Optional[int] = None
    id_especie: Optional[int] = None
    id_pmg: Optional[int] = None
    id_bodega: Optional[int] = None
    tipo_planta: Optional[str] = None
    tipo_injertacion: Optional[str] = None
    tipo_patron: Optional[str] = None
    ubicacion: Optional[str] = None
    cantidad_inicial: int
    cantidad_actual: int
    cantidad_minima: int = 0
    fecha_ingreso: date
    ano_plantacion: Optional[int] = None
    origen: Optional[str] = None
    observaciones: Optional[str] = None


class InventarioUpdate(BaseModel):
    id_portainjerto: Optional[int] = None
    id_vivero: Optional[int] = None
    id_especie: Optional[int] = None
    id_pmg: Optional[int] = None
    id_bodega: Optional[int] = None
    tipo_planta: Optional[str] = None
    tipo_injertacion: Optional[str] = None
    tipo_patron: Optional[str] = None
    ubicacion: Optional[str] = None
    cantidad_minima: Optional[int] = None
    ano_plantacion: Optional[int] = None
    origen: Optional[str] = None
    estado: Optional[str] = None
    observaciones: Optional[str] = None


class MovimientoCreate(BaseModel):
    tipo: str  # ingreso, retiro, ajuste_positivo, ajuste_negativo, envio_testblock
    cantidad: int
    motivo: Optional[str] = None
    referencia_destino: Optional[str] = None


class DestinoDespacho(BaseModel):
    id_cuartel: int
    cantidad: int


class DespachoCreate(BaseModel):
    id_inventario: int
    id_bodega_origen: Optional[int] = None
    id_testblock_destino: Optional[int] = None
    destinos: list[DestinoDespacho]
    responsable: Optional[str] = None
    motivo: Optional[str] = None
