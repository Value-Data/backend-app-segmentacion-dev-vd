"""Schemas for sistema (usuarios, roles)."""

from datetime import datetime
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


class UsuarioRead(BaseModel):
    """S-1: response schema for Usuario. NEVER includes password_hash."""
    id_usuario: int
    username: str
    nombre_completo: Optional[str] = None
    email: Optional[str] = None
    rol: str
    campos_asignados: Optional[str] = None
    activo: Optional[bool] = True
    ultimo_acceso: Optional[datetime] = None
    fecha_creacion: Optional[datetime] = None

    model_config = {"from_attributes": True}
