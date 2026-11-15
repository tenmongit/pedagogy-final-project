"""Шов между основным API и ИИ-модулем (зона Мерей).

Основное API вызывает только эти две функции. Хранение, права доступа и логирование
уже сделаны в routers/ai.py — здесь нужна только генерация текста.
Сейчас это заглушки, чтобы фронт мог интегрироваться до готовности промптов.

Ключ провайдера брать из config.AI_API_KEY (переменная окружения на сервере).
"""

from dataclasses import dataclass, field


@dataclass
class HintContext:
    assignment_title: str
    assignment_description: str
    stage_kind: str  # topic | plan | draft | final
    question: str
    draft: str = ""


@dataclass
class UsageRecord:
    stage_kind: str
    source: str  # self_report | platform_hint
    tool: str = ""
    purpose: str = ""
    details: str = ""
    prompt: str = ""
    response: str = ""


@dataclass
class DefenseContext:
    assignment_title: str
    assignment_description: str
    final_text: str  # последняя версия самого позднего сданного этапа
    ai_usage: list[UsageRecord] = field(default_factory=list)


def generate_hint(ctx: HintContext) -> str:
    """Подсказка на этапе: наводящие вопросы и направления, без готового текста работы."""
    return (
        f"[заглушка ИИ-модуля] Этап «{ctx.stage_kind}». Подумайте: какой главный вопрос "
        "вы хотите раскрыть и какие источники его подтверждают?"
    )


def generate_defense_questions(ctx: DefenseContext) -> list[str]:
    """3–4 вопроса для устной защиты по конкретной работе и логу ИИ. Без оценки работы."""
    return [
        "[заглушка ИИ-модуля] Объясните своими словами главный тезис вашей работы.",
        "[заглушка ИИ-модуля] Почему вы выбрали именно такую структуру плана?",
        "[заглушка ИИ-модуля] Какую часть вы изменили после использования ИИ и почему?",
    ]
