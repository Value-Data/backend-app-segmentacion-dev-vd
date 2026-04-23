"""Auth service: login, token creation."""

from datetime import datetime, timedelta
from app.core.utils import utcnow

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import verify_password, create_access_token
from app.models.sistema import Usuario
from app.schemas.auth import LoginRequest, TokenResponse, UserInfo


def authenticate(db: Session, req: LoginRequest) -> TokenResponse:
    user = db.query(Usuario).filter(
        Usuario.username == req.username,
        Usuario.activo == True,
    ).first()

    if user is None or not verify_password(req.password, user.password_hash or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contrasena incorrectos",
        )

    user.ultimo_acceso = utcnow()
    db.commit()

    # S-10: TTL por rol. Admin más corto; resto default.
    settings = get_settings()
    minutes = (
        settings.JWT_EXPIRE_MINUTES_ADMIN
        if user.rol == "admin"
        else settings.JWT_EXPIRE_MINUTES_DEFAULT
    )
    ttl = timedelta(minutes=minutes)

    token = create_access_token({
        "sub": user.username,
        "rol": user.rol,
        "id_usuario": user.id_usuario,
        "email": user.email,
        "campos_asignados": user.campos_asignados,
    }, expires_delta=ttl)

    return TokenResponse(
        access_token=token,
        user=UserInfo.model_validate(user),
    )
