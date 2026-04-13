"""Auth routes: login, logout, me."""

import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.sistema import Usuario
from app.schemas.auth import LoginRequest, TokenResponse, UserInfo
from app.services.auth_service import authenticate

router = APIRouter(prefix="/auth", tags=["Auth"])

# Simple in-memory rate limiter for login (per username, 5-min window)
_login_attempts: dict[str, list[float]] = defaultdict(list)
_LOGIN_WINDOW = 300  # seconds
_LOGIN_MAX_ATTEMPTS = 10


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
def logout():
    return {"ok": True}


@router.get("/me", response_model=UserInfo)
def me(user: Usuario = Depends(get_current_user)):
    return UserInfo.model_validate(user)
