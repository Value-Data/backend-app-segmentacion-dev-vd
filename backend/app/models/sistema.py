"""Sistema models: usuarios, roles, audit_log."""

from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class Usuario(SQLModel, table=True):
    __tablename__ = "usuarios"
    id_usuario: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(sa_column=Column(sa.String(50), unique=True, nullable=False))
    nombre_completo: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    email: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    password_hash: Optional[str] = Field(default=None, sa_column=Column(sa.String(64)))
    rol: str = Field(sa_column=Column(sa.String(30), nullable=False))
    campos_asignados: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    activo: Optional[bool] = Field(default=True)
    ultimo_acceso: Optional[datetime] = Field(default=None)
    fecha_creacion: Optional[datetime] = Field(default_factory=datetime.utcnow)


class Rol(SQLModel, table=True):
    __tablename__ = "roles"
    id_rol: Optional[int] = Field(default=None, primary_key=True)
    nombre: str = Field(sa_column=Column(sa.String(50), unique=True, nullable=False))
    descripcion: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(200)))
    permisos: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(None)))
    activo: bool = Field(default=True)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"
    id: Optional[int] = Field(default=None, primary_key=True)
    contratista_rut: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(20)))
    accion: str = Field(sa_column=Column(sa.NVARCHAR(100), nullable=False))
    detalle: str = Field(sa_column=Column(sa.NVARCHAR(None), nullable=False))
    usuario: str = Field(sa_column=Column(sa.NVARCHAR(200), nullable=False))
    created_at: datetime = Field(sa_column=Column(sa.DateTime, nullable=False))


class JWTBlacklist(SQLModel, table=True):
    """S-10: JWT revocation list.

    Populated by POST /auth/logout with the token's jti claim.
    Checked on every auth'd request. Entries past `expires_at` can be
    purged lazily (no cron needed — JWT validation already rejects
    expired tokens).
    """
    __tablename__ = "jwt_blacklist"
    jti: str = Field(sa_column=Column(sa.String(64), primary_key=True))
    usuario: Optional[str] = Field(default=None, sa_column=Column(sa.NVARCHAR(100)))
    expires_at: datetime = Field(sa_column=Column(sa.DateTime, nullable=False))
    revoked_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(sa.DateTime, nullable=False),
    )
