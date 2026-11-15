from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, UTCDateTime, utcnow

STAGE_KINDS = ["topic", "plan", "draft", "final"]
STAGE_TITLES = {"topic": "Тема", "plan": "План", "draft": "Черновик", "final": "Финал"}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(20))  # student | teacher


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    stages: Mapped[list["Stage"]] = relationship(
        order_by="Stage.position", cascade="all, delete-orphan", lazy="selectin"
    )


class Stage(Base):
    __tablename__ = "stages"
    __table_args__ = (UniqueConstraint("assignment_id", "kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # topic | plan | draft | final
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(100))
    due_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)


class Submission(Base):
    """Версия работы студента на этапе. Версии не редактируются, только добавляются."""

    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("stage_id", "student_id", "version"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    stage_id: Mapped[int] = mapped_column(ForeignKey("stages.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    used_ai: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    ai_usage: Mapped[list["AIUsageLog"]] = relationship(order_by="AIUsageLog.id", lazy="selectin")
    feedback: Mapped[list["Feedback"]] = relationship(order_by="Feedback.id", lazy="selectin")


class AIUsageLog(Base):
    """Лог использования ИИ.

    source = self_report   — студент сам задекларировал при сдаче версии (submission_id задан);
    source = platform_hint — подсказка, выданная ИИ-модулем платформы (prompt/response заполнены).
    """

    __tablename__ = "ai_usage_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id"), index=True)
    stage_id: Mapped[int] = mapped_column(ForeignKey("stages.id"))
    submission_id: Mapped[int | None] = mapped_column(ForeignKey("submissions.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(20))
    tool: Mapped[str] = mapped_column(String(100), default="")
    purpose: Mapped[str] = mapped_column(String(300), default="")
    details: Mapped[str] = mapped_column(Text, default="")
    prompt: Mapped[str] = mapped_column(Text, default="")
    response: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id"), index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class DefenseQuestion(Base):
    __tablename__ = "defense_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Grade(Base):
    """Оценку ставит только преподаватель. ИИ сюда не пишет."""

    __tablename__ = "grades"
    __table_args__ = (UniqueConstraint("assignment_id", "student_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    score: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
