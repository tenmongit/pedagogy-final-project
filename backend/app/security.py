import hashlib
import hmac
import secrets
from datetime import timedelta

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import config
from .db import get_db, utcnow
from .models import Assignment, Stage, User

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt, _, digest = stored.partition("$")
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000)
    return hmac.compare_digest(check.hex(), digest)


def create_token(user: User) -> str:
    payload = {"sub": str(user.id), "exp": utcnow() + timedelta(hours=config.TOKEN_TTL_HOURS)}
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    if creds is None:
        raise HTTPException(401, "Требуется авторизация")
    try:
        payload = jwt.decode(creds.credentials, config.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Недействительный токен")
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(401, "Пользователь не найден")
    return user


def require_teacher(user: User = Depends(current_user)) -> User:
    if user.role != "teacher":
        raise HTTPException(403, "Доступно только преподавателю")
    return user


def require_student(user: User = Depends(current_user)) -> User:
    if user.role != "student":
        raise HTTPException(403, "Доступно только студенту")
    return user


# --- Правила видимости ---------------------------------------------------------
# Студент видит все задания, но работы, логи ИИ, фидбэк и оценку — только свои.
# Преподаватель видит всё по своим заданиям и ничего по чужим.


def get_assignment(db: Session, assignment_id: int, user: User) -> Assignment:
    assignment = db.get(Assignment, assignment_id)
    if assignment is None:
        raise HTTPException(404, "Задание не найдено")
    if user.role == "teacher" and assignment.teacher_id != user.id:
        raise HTTPException(403, "Это задание другого преподавателя")
    return assignment


def get_stage(db: Session, stage_id: int, user: User) -> tuple[Stage, Assignment]:
    stage = db.get(Stage, stage_id)
    if stage is None:
        raise HTTPException(404, "Этап не найден")
    return stage, get_assignment(db, stage.assignment_id, user)


def resolve_student(db: Session, user: User, student_id: int | None) -> User:
    """Чьи данные запрашиваются: студент — всегда свои, преподаватель обязан указать student_id."""
    if user.role == "student":
        if student_id is not None and student_id != user.id:
            raise HTTPException(403, "Нельзя смотреть данные другого студента")
        return user
    if student_id is None:
        raise HTTPException(422, "Укажите student_id")
    student = db.get(User, student_id)
    if student is None or student.role != "student":
        raise HTTPException(404, "Студент не найден")
    return student
