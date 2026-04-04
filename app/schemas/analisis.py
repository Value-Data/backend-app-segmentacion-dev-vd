"""Schemas for analisis / alertas."""

from pydantic import BaseModel
from typing import Optional


class AlertaResolverRequest(BaseModel):
    notas: Optional[str] = None
    usuario: Optional[str] = None


class ReglaAlertaCreate(BaseModel):
    codigo: str
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    condicion: Optional[str] = None
    prioridad_resultado: Optional[str] = None
    activo: bool = True


class ReglaAlertaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    condicion: Optional[str] = None
    prioridad_resultado: Optional[str] = None
    activo: Optional[bool] = None
