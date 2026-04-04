"""Auth request/response schemas."""

from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserInfo"


class UserInfo(BaseModel):
    id_usuario: int
    username: str
    nombre_completo: Optional[str] = None
    email: Optional[str] = None
    rol: Optional[str] = None
    campos_asignados: Optional[str] = None

    model_config = {"from_attributes": True}


class PasswordChange(BaseModel):
    new_password: str
