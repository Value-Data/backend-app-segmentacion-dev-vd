"""Auth service: login, token creation."""

from datetime import datetime
from app.core.utils import utcnow

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

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

    # Update last access
    user.ultimo_acceso = utcnow()
    db.commit()

    token = create_access_token({"sub": user.username, "rol": user.rol})

    return TokenResponse(
        access_token=token,
        user=UserInfo.model_validate(user),
    )
