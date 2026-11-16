"""Генерация подсказок и вопросов в формате раздела 7 CLAUDE.md."""

import json
from dataclasses import asdict, dataclass, field
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

from . import prompts, provider


@dataclass(frozen=True)
class HintContext:
    stage_kind: str
    question: str
    draft: str = ""


@dataclass(frozen=True)
class Declaration:
    stage_kind: str
    version: int
    used_ai: bool
    tools: list[str]
    purpose: list[str]
    description: str


@dataclass(frozen=True)
class HintRecord:
    stage_kind: str
    question: str
    hint: str


@dataclass(frozen=True)
class DefenseContext:
    final_text: str
    previous_stages: dict[str, str] = field(default_factory=dict)
    declarations: list[Declaration] = field(default_factory=list)
    hints: list[HintRecord] = field(default_factory=list)


NonBlank = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: NonBlank
    why: NonBlank


class DefenseOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    questions: list[Question] = Field(min_length=3, max_length=4)


def generate_hint(ctx: HintContext) -> str:
    system = f"{prompts.HINT}\nЭтап {ctx.stage_kind}. {prompts.STAGE_GUIDANCE[ctx.stage_kind]}"
    data = "\n\n".join(
        [
            prompts.data_tag("student_text", ctx.draft),
            prompts.data_tag("student_question", ctx.question),
        ]
    )
    hint = provider.complete(system, data)
    if len(hint.split()) > 150:
        raise provider.AIUnavailable("Сервис ИИ вернул слишком длинную подсказку")
    return hint


def generate_defense_questions(ctx: DefenseContext) -> list[Question]:
    texts = {"final": ctx.final_text}
    for stage in ("topic", "plan", "draft"):
        if stage in ctx.previous_stages:
            texts[stage] = ctx.previous_stages[stage][:3000]
    hints = [dict(asdict(hint), number=index) for index, hint in enumerate(ctx.hints, start=1)]
    data = "\n\n".join(
        prompts.data_tag(tag, json.dumps(value, ensure_ascii=False))
        for tag, value in (
            ("student_text", texts),
            ("ai_declaration", [asdict(declaration) for declaration in ctx.declarations]),
            ("hint_log", hints),
        )
    )
    response = provider.complete(prompts.DEFENSE, data, json_output=True)
    try:
        return DefenseOutput.model_validate_json(response, strict=True).questions
    except ValidationError:
        raise provider.AIUnavailable("Сервис ИИ вернул некорректные вопросы") from None
