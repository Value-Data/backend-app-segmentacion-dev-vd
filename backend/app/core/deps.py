"""FastAPI dependencies: DB session, current user, role checks."""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.sistema import Usuario

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido o expirado")

    # S-10: rechazar tokens revocados (logout).
    jti = payload.get("jti")
    if jti:
        from app.models.sistema import JWTBlacklist
        revoked = db.query(JWTBlacklist).filter(JWTBlacklist.jti == jti).first()
        if revoked is not None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token revocado (logout). Inicia sesión de nuevo.",
            )

    username: str | None = payload.get("sub")
    if username is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido")
    user = db.query(Usuario).filter(Usuario.username == username, Usuario.activo == True).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado o inactivo")
    return user


def require_role(*roles: str):
    """Dependency factory that checks user role."""
    def checker(user: Usuario = Depends(get_current_user)) -> Usuario:
        if user.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rol '{user.rol}' no tiene permiso para esta operacion",
            )
        return user
    return checker


def require_non_production():
    """EF-4: block destructive seed/bulk endpoints in production.

    Settings.ENV must be 'dev' or 'staging'. Any other value (e.g.
    'production' or 'prod') → 403.
    """
    settings = get_settings()
    if settings.ENV.lower() not in ("dev", "staging", "development", "test"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Operación bloqueada en entorno '{settings.ENV}'. "
                "Seed/bulk re-population sólo está permitido en dev/staging."
            ),
        )
    return True
