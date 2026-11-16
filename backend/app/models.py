"""Модель данных по разделу 5 CLAUDE.md."""

from datetime import datetime

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, UTCDateTime, utcnow

STAGES = ["topic", "plan", "draft", "final"]


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20))  # student | teacher


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    deadline: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)  # информационно
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Work(Base):
    """Работа одного студента по одному заданию."""

    __tablename__ = "works"
    __table_args__ = (UniqueConstraint("assignment_id", "student_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    current_stage: Mapped[str] = mapped_column(String(20), default="topic")
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    assignment: Mapped[Assignment] = relationship(lazy="joined")
    student: Mapped[User] = relationship(lazy="joined")


class Submission(Base):
    """Одна сданная версия на этапе. Версии не редактируются, только добавляются."""

    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("work_id", "stage", "version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    work_id: Mapped[int] = mapped_column(ForeignKey("works.id"), index=True)
    stage: Mapped[str] = mapped_column(String(20))
    version: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    ai_declaration: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    feedback: Mapped[list["Feedback"]] = relationship(order_by="Feedback.id", lazy="selectin")


class AIHintLog(Base):
    """Каждое обращение к подсказке внутри Izden."""

    __tablename__ = "ai_hint_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_id: Mapped[int] = mapped_column(ForeignKey("works.id"), index=True)
    stage: Mapped[str] = mapped_column(String(20))
    student_question: Mapped[str] = mapped_column(Text)
    student_text_snapshot: Mapped[str] = mapped_column(Text, default="")
    hint: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id"), index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class DefenseQuestions(Base):
    """Одна запись на работу, перегенерация её перезаписывает."""

    __tablename__ = "defense_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_id: Mapped[int] = mapped_column(ForeignKey("works.id"), unique=True)
    questions: Mapped[list] = mapped_column(JSON)  # [{"question": str, "why": str}]
    edited_by_teacher: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Grade(Base):
    """Оценку ставит только преподаватель. ИИ сюда не пишет."""

    __tablename__ = "grades"

    id: Mapped[int] = mapped_column(primary_key=True)
    work_id: Mapped[int] = mapped_column(ForeignKey("works.id"), unique=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    score: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
