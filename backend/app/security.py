from datetime import timedelta

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import config
from .db import get_db, utcnow
from .models import Assignment, Submission, User, Work

bearer = HTTPBearer(auto_error=False)


def create_token(user: User) -> str:
    payload = {"sub": str(user.id), "exp": utcnow() + timedelta(hours=config.TOKEN_TTL_HOURS)}
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    if creds is None:
        raise HTTPException(401, "Требуется вход")
    try:
        payload = jwt.decode(creds.credentials, config.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Сессия недействительна, войдите заново")
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


# --- Видимость (раздел 5) --------------------------------------------------------
# Студент видит все задания, но только свои работы и всё, что к ним относится.
# Преподаватель видит только свои задания и всё по ним. Нарушение → 403.


def get_assignment(db: Session, assignment_id: int, user: User) -> Assignment:
    assignment = db.get(Assignment, assignment_id)
    if assignment is None:
        raise HTTPException(404, "Задание не найдено")
    if user.role == "teacher" and assignment.teacher_id != user.id:
        raise HTTPException(403, "Это задание другого преподавателя")
    return assignment


def get_work(db: Session, work_id: int, user: User) -> Work:
    work = db.get(Work, work_id)
    if work is None:
        raise HTTPException(404, "Работа не найдена")
    if user.role == "student" and work.student_id != user.id:
        raise HTTPException(403, "Нельзя смотреть чужую работу")
    if user.role == "teacher" and work.assignment.teacher_id != user.id:
        raise HTTPException(403, "Это работа по заданию другого преподавателя")
    return work


def get_open_work(db: Session, work_id: int, user: User) -> Work:
    """Работа студента, в которую ещё можно писать (не оценена)."""
    work = get_work(db, work_id, user)
    if work.status == "graded":
        raise HTTPException(409, "Работа уже оценена: сдача и подсказки закрыты")
    return work


def get_submission(db: Session, submission_id: int, user: User) -> Submission:
    submission = db.get(Submission, submission_id)
    if submission is None:
        raise HTTPException(404, "Версия не найдена")
    get_work(db, submission.work_id, user)
    return submission
