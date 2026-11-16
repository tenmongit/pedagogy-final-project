"""Схемы запросов и ответов по разделам 5 и 6 CLAUDE.md."""

from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

Stage = Literal["topic", "plan", "draft", "final"]
Role = Literal["student", "teacher"]
WorkStatus = Literal["in_progress", "awaiting_defense", "graded"]
AITool = Literal["izden_hints", "chatgpt", "claude", "gemini", "other"]
AIPurpose = Literal[
    "ideas", "structure", "sources", "grammar", "translation", "generated_text", "other"
]

TEXT_MAX = 20_000
QUESTION_MAX = 1_000


def _not_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("не может быть пустым")
    return value


def _as_utc(value: datetime) -> datetime:
    # Время без часового пояса считаем UTC, чтобы в ответе всегда был суффикс Z.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


NonBlank = Annotated[str, AfterValidator(_not_blank)]
UTC = Annotated[datetime, AfterValidator(_as_utc)]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORM):
    id: int
    name: str
    role: Role


class LoginIn(BaseModel):
    user_id: int


class LoginOut(BaseModel):
    token: str
    user: UserOut


class AssignmentIn(BaseModel):
    title: NonBlank = Field(max_length=300)
    description: str = ""
    deadline: UTC | None = None


class AssignmentOut(ORM):
    id: int
    teacher_id: int
    title: str
    description: str
    deadline: UTC | None
    created_at: UTC
    # Заполняется только студенту в GET /api/assignments.
    my_work_id: int | None = None


class WorkOut(ORM):
    id: int
    assignment_id: int
    student_id: int
    current_stage: Stage
    status: WorkStatus
    created_at: UTC


class WorkSummary(BaseModel):
    id: int
    student: UserOut
    current_stage: Stage
    status: WorkStatus
    submissions_count: int
    hints_count: int
    score: int | None


class AIDeclaration(BaseModel):
    used_ai: bool
    tools: list[AITool] = []
    purpose: list[AIPurpose] = []
    description: str = ""

    @model_validator(mode="after")
    def consistent(self):
        if self.used_ai:
            if not self.tools:
                raise ValueError("Укажите хотя бы один инструмент ИИ")
            if not self.description.strip():
                raise ValueError("Опишите своими словами, что вы взяли от ИИ")
        elif self.tools or self.purpose:
            raise ValueError("Если ИИ не использовался, инструменты и цели должны быть пустыми")
        return self


class SubmissionIn(BaseModel):
    text: NonBlank = Field(max_length=TEXT_MAX)
    ai_declaration: AIDeclaration


class FeedbackIn(BaseModel):
    text: NonBlank


class FeedbackOut(ORM):
    id: int
    submission_id: int
    teacher_id: int
    text: str
    created_at: UTC


class SubmissionOut(ORM):
    id: int
    work_id: int
    stage: Stage
    version: int
    text: str
    ai_declaration: AIDeclaration
    created_at: UTC


class SubmissionWithFeedback(SubmissionOut):
    feedback: list[FeedbackOut]


class HintIn(BaseModel):
    question: NonBlank = Field(max_length=QUESTION_MAX)
    current_text: str = Field(default="", max_length=TEXT_MAX)


class AIHintLogOut(ORM):
    id: int
    work_id: int
    stage: Stage
    student_question: str
    student_text_snapshot: str
    hint: str
    created_at: UTC


class DefenseQuestion(BaseModel):
    question: NonBlank
    why: str = ""


class DefenseQuestionsIn(BaseModel):
    questions: list[DefenseQuestion] = Field(min_length=3, max_length=4)


class DefenseQuestionsOut(ORM):
    id: int
    work_id: int
    questions: list[DefenseQuestion]
    edited_by_teacher: bool
    created_at: UTC


class GradeIn(BaseModel):
    score: int = Field(ge=0, le=100)
    comment: str = ""


class GradeOut(ORM):
    id: int
    work_id: int
    teacher_id: int
    score: int
    comment: str
    created_at: UTC


class StageBlock(BaseModel):
    stage: Stage
    submissions: list[SubmissionWithFeedback]


class WorkDetail(BaseModel):
    id: int
    assignment: AssignmentOut
    student: UserOut
    current_stage: Stage
    status: WorkStatus
    stages: list[StageBlock]
    hints: list[AIHintLogOut]
    grade: GradeOut | None
