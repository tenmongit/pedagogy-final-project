from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

StageKind = Literal["topic", "plan", "draft", "final"]
Role = Literal["student", "teacher"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(ORM):
    id: int
    name: str
    email: str
    role: Role


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class StageOut(ORM):
    id: int
    assignment_id: int
    kind: StageKind
    position: int
    title: str
    due_at: datetime | None


class AssignmentIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = ""
    # Дедлайны по этапам, например {"topic": "2026-11-20T18:00:00+05:00"}. Все необязательны.
    due_dates: dict[StageKind, datetime] = {}


class AssignmentOut(ORM):
    id: int
    title: str
    description: str
    teacher_id: int
    created_at: datetime
    stages: list[StageOut]


class AIUsageItemIn(BaseModel):
    tool: str = Field(min_length=1, max_length=100)  # например "ChatGPT"
    purpose: str = Field(min_length=1, max_length=300)  # зачем использовал
    details: str = ""  # что именно взял из ответа / как переработал


class AILogOut(ORM):
    id: int
    stage_id: int
    submission_id: int | None
    source: Literal["self_report", "platform_hint"]
    tool: str
    purpose: str
    details: str
    prompt: str
    response: str
    created_at: datetime


class SubmissionIn(BaseModel):
    content: str = Field(min_length=1)
    used_ai: bool
    ai_usage: list[AIUsageItemIn] = []

    @model_validator(mode="after")
    def declaration_is_consistent(self):
        if self.used_ai and not self.ai_usage:
            raise ValueError("used_ai=true требует хотя бы одной записи в ai_usage")
        if not self.used_ai and self.ai_usage:
            raise ValueError("ai_usage должен быть пустым при used_ai=false")
        return self


class FeedbackIn(BaseModel):
    text: str = Field(min_length=1)


class FeedbackOut(ORM):
    id: int
    submission_id: int
    teacher_id: int
    text: str
    created_at: datetime


class SubmissionOut(ORM):
    id: int
    stage_id: int
    student_id: int
    version: int
    content: str
    used_ai: bool
    created_at: datetime
    ai_usage: list[AILogOut]
    feedback: list[FeedbackOut]


class GradeIn(BaseModel):
    score: int = Field(ge=0, le=100)
    comment: str = ""


class GradeOut(ORM):
    assignment_id: int
    student_id: int
    teacher_id: int
    score: int
    comment: str
    updated_at: datetime


class DefenseQuestionOut(ORM):
    id: int
    position: int
    text: str
    created_at: datetime


class StageTimeline(StageOut):
    submissions: list[SubmissionOut]
    hints: list[AILogOut]  # подсказки платформы на этом этапе


class TimelineOut(BaseModel):
    assignment: AssignmentOut
    student: UserOut
    stages: list[StageTimeline]
    grade: GradeOut | None
    # Только для преподавателя; студенту всегда null.
    defense_questions: list[DefenseQuestionOut] | None


class StudentProgressOut(BaseModel):
    student: UserOut
    submitted_stages: list[StageKind]
    last_submission_at: datetime | None
    grade: GradeOut | None


class HintIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    draft: str = ""  # текущий текст студента, если он хочет подсказку по нему


class HintOut(BaseModel):
    hint: str
    log_id: int
