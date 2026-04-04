"""Auth routes: login, logout, me."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.sistema import Usuario
from app.schemas.auth import LoginRequest, TokenResponse, UserInfo
from app.services.auth_service import authenticate

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    return authenticate(db, req)


@router.post("/logout")
def logout():
    return {"ok": True}


@router.get("/me", response_model=UserInfo)
def me(user: Usuario = Depends(get_current_user)):
    return UserInfo.model_validate(user)
