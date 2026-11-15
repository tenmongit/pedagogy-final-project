"""Демо-данные: создаются при первом запуске на пустой базе (SEED_DEMO=1)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import STAGE_KINDS, STAGE_TITLES, Assignment, Stage, User
from .security import hash_password

DEMO_USERS = [
    ("Преподаватель Демо", "teacher@izden.kz", "teacher123", "teacher"),
    ("Айгерим Студент", "student1@izden.kz", "student123", "student"),
    ("Данияр Студент", "student2@izden.kz", "student123", "student"),
    ("Алия Студент", "student3@izden.kz", "student123", "student"),
]


def seed(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(User)):
        return
    users = [
        User(name=name, email=email, password_hash=hash_password(password), role=role)
        for name, email, password, role in DEMO_USERS
    ]
    db.add_all(users)
    db.flush()
    db.add(
        Assignment(
            title="СРСП: Эссе «ИИ в высшем образовании»",
            description="Аргументированное эссе на 800–1000 слов с опорой минимум на 3 источника.",
            teacher_id=users[0].id,
            stages=[
                Stage(kind=kind, position=i, title=STAGE_TITLES[kind])
                for i, kind in enumerate(STAGE_KINDS)
            ],
        )
    )
    db.commit()
