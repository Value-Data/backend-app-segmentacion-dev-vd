"""Schemas for variedades and variedad_susceptibilidades."""

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional
from datetime import date
from decimal import Decimal

from app.core.sanitize import clean_text


class VariedadCreate(BaseModel):
    id_especie: Optional[int] = None
    id_pmg: Optional[int] = None
    id_origen: Optional[int] = None
    codigo: str
    nombre: str
    nombre_comercial: Optional[str] = None
    tipo: Optional[str] = "plantada"
    origen: Optional[str] = None
    anio_introduccion: Optional[int] = None
    epoca_cosecha: Optional[str] = None
    epoca: Optional[str] = None
    req_frio_horas: Optional[int] = None
    req_frio: Optional[str] = None
    color: Optional[str] = None
    color_fruto: Optional[str] = None
    color_pulpa: Optional[str] = None
    id_color_fruto: Optional[int] = None
    id_color_pulpa: Optional[int] = None
    id_color_cubrimiento: Optional[int] = None
    calibre_esperado: Optional[str] = None
    requerimiento_frio: Optional[str] = None
    susceptibilidad: Optional[str] = None
    estado: Optional[str] = "prospecto"
    fecha_ultima_visita: Optional[date] = None
    proxima_accion: Optional[str] = None
    observaciones: Optional[str] = None
    alelos: Optional[str] = None
    auto_fertil: Optional[bool] = None
    autofertil: Optional[bool] = None


class VariedadUpdate(BaseModel):
    id_especie: Optional[int] = None
    id_pmg: Optional[int] = None
    id_origen: Optional[int] = None
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    nombre_comercial: Optional[str] = None
    tipo: Optional[str] = None
    origen: Optional[str] = None
    anio_introduccion: Optional[int] = None
    epoca_cosecha: Optional[str] = None
    epoca: Optional[str] = None
    req_frio_horas: Optional[int] = None
    req_frio: Optional[str] = None
    color: Optional[str] = None
    color_fruto: Optional[str] = None
    color_pulpa: Optional[str] = None
    id_color_fruto: Optional[int] = None
    id_color_pulpa: Optional[int] = None
    id_color_cubrimiento: Optional[int] = None
    calibre_esperado: Optional[str] = None
    requerimiento_frio: Optional[str] = None
    susceptibilidad: Optional[str] = None
    estado: Optional[str] = None
    fecha_ultima_visita: Optional[date] = None
    proxima_accion: Optional[str] = None
    observaciones: Optional[str] = None
    alelos: Optional[str] = None
    auto_fertil: Optional[bool] = None
    autofertil: Optional[bool] = None
    activo: Optional[bool] = None


class VarSusceptCreate(BaseModel):
    id_variedad: int
    id_suscept: int
    nivel: Optional[str] = "media"
    notas: Optional[str] = None


class VarSusceptUpdate(BaseModel):
    nivel: Optional[str] = None
    notas: Optional[str] = None


# ── Polinizantes ───────────────────────────────────────────────────────────
class PolinizanteCreate(BaseModel):
    """POL-4: strict schema for POST /variedades/{id}/polinizantes.

    Requires exactly one of polinizante_variedad_id (FK) or polinizante_nombre
    (free text, sanitized). Cross-especie + self-ref guards are enforced in
    the route handler against live DB state.
    """
    model_config = ConfigDict(extra="forbid")

    polinizante_variedad_id: Optional[int] = None
    polinizante_nombre: Optional[str] = Field(None, max_length=200)

    @field_validator("polinizante_nombre", mode="before")
    @classmethod
    def _sanitize_nombre(cls, v):
        return clean_text(v) if isinstance(v, str) else v

    @model_validator(mode="after")
    def _require_one(self):
        if not self.polinizante_variedad_id and not self.polinizante_nombre:
            raise ValueError("Requiere polinizante_variedad_id o polinizante_nombre")
        return self


class PolinizanteRead(BaseModel):
    """Response schema for polinizantes — explicit to guarantee all fields serialize."""
    id: int
    id_variedad: int
    polinizante_variedad_id: Optional[int] = None
    polinizante_nombre: Optional[str] = None
    activo: Optional[bool] = True

    model_config = ConfigDict(from_attributes=True)
