"""Упрощённый вход для демо (раздел 4): без паролей, выбор сид-пользователя."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import LoginIn, LoginOut, UserOut
from ..security import create_token, current_user

router = APIRouter(prefix="/api", tags=["auth"])


@router.get("/users/demo", response_model=list[UserOut])
def demo_users(db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.id)).all()


@router.post("/auth/login", response_model=LoginOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.get(User, body.user_id)
    if user is None:
        raise HTTPException(404, "Пользователь не найден")
    return LoginOut(token=create_token(user), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user
