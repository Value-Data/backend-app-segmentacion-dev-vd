"""Schemas for sistema (usuarios, roles)."""

from pydantic import BaseModel
from typing import Optional


class UsuarioCreate(BaseModel):
    username: str
    nombre_completo: Optional[str] = None
    email: Optional[str] = None
    password: str
    rol: Optional[str] = "visualizador"
    campos_asignados: Optional[str] = None


class UsuarioUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    email: Optional[str] = None
    rol: Optional[str] = None
    campos_asignados: Optional[str] = None
    activo: Optional[bool] = None
