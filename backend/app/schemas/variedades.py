"""Schemas for variedades and variedad_susceptibilidades."""

from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal


class VariedadCreate(BaseModel):
    id_especie: Optional[int] = None
    id_pmg: Optional[int] = None
    id_origen: Optional[int] = None
    codigo: str
    nombre: str
    nombre_corto: Optional[str] = None
    nombre_comercial: Optional[str] = None
    tipo: Optional[str] = "plantada"
    origen: Optional[str] = None
    anio_introduccion: Optional[int] = None
    epoca_cosecha: Optional[str] = None
    epoca: Optional[str] = None
    vigor: Optional[str] = None
    req_frio_horas: Optional[int] = None
    req_frio: Optional[str] = None
    color_fruto: Optional[str] = None
    color_pulpa: Optional[str] = None
    id_color_fruto: Optional[int] = None
    id_color_pulpa: Optional[int] = None
    id_color_cubrimiento: Optional[int] = None
    calibre_esperado: Optional[str] = None
    firmeza_esperada: Optional[str] = None
    susceptibilidad: Optional[str] = None
    estado: Optional[str] = "prospecto"
    fecha_ultima_visita: Optional[date] = None
    proxima_accion: Optional[str] = None
    observaciones: Optional[str] = None
    alelos: Optional[str] = None
    auto_fertil: Optional[bool] = None


class VariedadUpdate(BaseModel):
    id_especie: Optional[int] = None
    id_pmg: Optional[int] = None
    id_origen: Optional[int] = None
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    nombre_corto: Optional[str] = None
    nombre_comercial: Optional[str] = None
    tipo: Optional[str] = None
    origen: Optional[str] = None
    anio_introduccion: Optional[int] = None
    epoca_cosecha: Optional[str] = None
    epoca: Optional[str] = None
    vigor: Optional[str] = None
    req_frio_horas: Optional[int] = None
    req_frio: Optional[str] = None
    color_fruto: Optional[str] = None
    color_pulpa: Optional[str] = None
    id_color_fruto: Optional[int] = None
    id_color_pulpa: Optional[int] = None
    id_color_cubrimiento: Optional[int] = None
    calibre_esperado: Optional[str] = None
    firmeza_esperada: Optional[str] = None
    susceptibilidad: Optional[str] = None
    estado: Optional[str] = None
    fecha_ultima_visita: Optional[date] = None
    proxima_accion: Optional[str] = None
    observaciones: Optional[str] = None
    alelos: Optional[str] = None
    auto_fertil: Optional[bool] = None
    activo: Optional[bool] = None


class VarSusceptCreate(BaseModel):
    id_variedad: int
    id_suscept: int
    nivel: Optional[str] = "media"
    notas: Optional[str] = None


class VarSusceptUpdate(BaseModel):
    nivel: Optional[str] = None
    notas: Optional[str] = None
