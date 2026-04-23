"""Auth routes: login, logout, me."""

import time
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import decode_access_token
from app.models.sistema import Usuario, JWTBlacklist
from app.schemas.auth import LoginRequest, TokenResponse, UserInfo
from app.services.auth_service import authenticate

router = APIRouter(prefix="/auth", tags=["Auth"])

# Simple in-memory rate limiter for login (per username, 5-min window)
_login_attempts: dict[str, list[float]] = defaultdict(list)
_LOGIN_WINDOW = 300  # seconds
_LOGIN_MAX_ATTEMPTS = 10

_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    now = time.time()
    # Clean old attempts outside the window
    _login_attempts[req.username] = [
        t for t in _login_attempts[req.username] if now - t < _LOGIN_WINDOW
    ]
    if len(_login_attempts[req.username]) >= _LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos. Espere 5 minutos.",
        )
    _login_attempts[req.username].append(now)
    return authenticate(db, req)


@router.post("/logout")
def logout(
    token: str | None = Depends(_oauth2),
    db: Session = Depends(get_db),
):
    """S-10: revoca el token añadiendo su jti a jwt_blacklist.

    Idempotente: si el token ya está blacklisted o es inválido, retorna
    ok. El middleware de get_current_user rechazará cualquier uso futuro
    del mismo token.
    """
    if not token:
        return {"ok": True}
    payload = decode_access_token(token)
    if not payload:
        # Token inválido o expirado — no hay nada que revocar.
        return {"ok": True}
    jti = payload.get("jti")
    if not jti:
        return {"ok": True}

    existing = db.query(JWTBlacklist).filter(JWTBlacklist.jti == jti).first()
    if existing:
        return {"ok": True, "already_revoked": True}

    exp_ts = payload.get("exp")
    if isinstance(exp_ts, (int, float)):
        expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc).replace(tzinfo=None)
    else:
        expires_at = datetime.utcnow()

    db.add(JWTBlacklist(
        jti=jti,
        usuario=payload.get("sub"),
        expires_at=expires_at,
    ))
    db.commit()
    return {"ok": True}


@router.get("/me", response_model=UserInfo)
def me(user: Usuario = Depends(get_current_user)):
    return UserInfo.model_validate(user)
