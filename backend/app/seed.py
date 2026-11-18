"""Демо-данные (раздел 8): создаются при первом запуске на пустой базе (SEED_DEMO=1).

1 преподаватель, 3 студента, 1 задание. У Daniyar работа на финале с историей версий
и подсказок, у Aigerim — на черновике, у Aliya работы нет. Данные совпадают с моками фронта.
Тексты работ на английском: защита проходит на английском, а ИИ отвечает на языке работы.

Ответы подсказок лежат в seed_hints.json: это настоящие ответы модели на эти вопросы и тексты,
полученные скриптом scripts/seed_hints.py через app.ai.service.generate_hint с промптами из
app/ai/prompts.py. Вручную не правились. Модель и время генерации записаны в том же файле.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import AIHintLog, Assignment, Feedback, Submission, User, Work

NONE = {"used_ai": False, "tools": [], "purpose": [], "description": ""}

FINAL_TEXT = (
    "Banning AI at university does not solve the problem, it hides it. Students use ChatGPT "
    "anyway, only without feedback and without any trace in their work. So the question is not "
    "whether to allow AI, but how to make its use visible.\n\n"
    "The main objection is that AI takes away the skill of writing. But that is true only if AI "
    "writes instead of the student. Formative feedback, where AI asks questions and points out "
    "weak spots, leaves the work on the text to the student.\n\n"
    "Seeing the process is more reliable than guessing from the result. Versions, hints and the "
    "declaration show the teacher how the work came about, without detectors that make mistakes."
)

# (work, stage, version, text, declaration, created_at)
SUBMISSIONS = [
    (1, "topic", 1, "AI in education", NONE, "2026-11-05T08:10"),
    (
        1, "topic", 2,
        "Open AI use at university instead of a ban: the case of supervised independent work (SRSP)",
        NONE, "2026-11-06T12:30",
    ),
    (
        1, "plan", 1,
        "1. Introduction: students already use AI\n2. The writing skill argument and a counterargument\n"
        "3. The academic integrity argument\n4. Conclusion: a visible process instead of a ban",
        {
            "used_ai": True, "tools": ["izden_hints"], "purpose": ["structure"],
            "description": "After an Izden hint I added a separate point to the plan for the counterargument.",
        },
        "2026-11-09T15:00",
    ),
    (
        1, "draft", 1,
        "Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway…",
        NONE, "2026-11-11T17:20",
    ),
    (
        1, "draft", 2,
        "Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway, "
        "only without feedback and without any trace in their work. At a debate tournament this question "
        "was discussed as the most important one for education…",
        {
            "used_ai": True, "tools": ["izden_hints", "chatgpt"], "purpose": ["structure", "grammar"],
            "description": "ChatGPT suggested swapping paragraphs 2 and 3, and I agreed. "
            "I checked the grammar and made the corrections myself.",
        },
        "2026-11-13T09:05",
    ),
    (1, "final", 1, FINAL_TEXT, NONE, "2026-11-15T04:30"),
    (2, "topic", 1, "AI and students", NONE, "2026-11-07T11:00"),
    (
        2, "topic", 2, "Why open AI use is better than a ban in supervised independent work (SRSP)",
        NONE, "2026-11-08T11:00",
    ),
    (
        2, "plan", 1,
        "1. Introduction\n2. The writing skill argument\n3. The integrity argument\n4. Conclusion",
        NONE, "2026-11-10T11:00",
    ),
    (
        2, "draft", 1,
        "Artificial intelligence has become part of almost every student's studies. The question is no "
        "longer whether to ban AI, but how to make its use open.\n\n"
        "Supporters of a ban believe that AI takes away a student's ability to put their thoughts into "
        "words on their own.",
        NONE, "2026-11-14T13:20",
    ),
]

# (номер версии в SUBMISSIONS с 1, text, created_at)
FEEDBACK = [
    (1, "Too broad. What exactly do you want to prove about AI in education?", "2026-11-05T10:00"),
    (4, "The thesis is clear, but the integrity argument still rests on a feeling. You need a source.", "2026-11-12T06:00"),
    (
        5,
        "The logic is better now. The debate tournament example is not connected to the thesis: "
        "either connect it or remove it.",
        "2026-11-14T05:15",
    ),
    (
        10,
        "The thesis is clear. In the second paragraph the counterargument is named but not addressed: "
        "why is the writing skill preserved after all? You need at least one source.",
        "2026-11-15T04:40",
    ),
]

# Текст в поле студента на момент запроса подсказки (student_text_snapshot).
PLAN_SNAPSHOT = (
    "1. Introduction: students already use AI\n2. The writing skill argument\n"
    "3. The academic integrity argument\n4. Conclusion: a visible process instead of a ban"
)
DRAFT_SNAPSHOT = (
    "Banning AI at university does not solve the problem, it hides it. Students use ChatGPT anyway, "
    "only without feedback and without any trace in their work.\n\n"
    "It is fairer for the teacher to see the process than to check the work with a detector: "
    "detectors make mistakes.\n\n"
    "AI takes away the skill of writing only if it writes instead of the student. At a debate "
    "tournament this question was discussed as the most important one for education."
)

HINT_ANSWERS = Path(__file__).with_name("seed_hints.json")

# (work, stage, question, snapshot, created_at); ответ берётся из HINT_ANSWERS по вопросу
HINTS = [
    (1, "plan", "Does my plan have all the parts?", PLAN_SNAPSHOT, "2026-11-08T14:00"),
    (
        1, "plan", "What is it called when AI helps by asking questions?", PLAN_SNAPSHOT,
        "2026-11-08T14:20",
    ),
    (1, "draft", "Is my main thesis clear?", DRAFT_SNAPSHOT, "2026-11-10T16:00"),
    (1, "draft", "How can I strengthen the integrity argument?", DRAFT_SNAPSHOT, "2026-11-12T16:10"),
    (1, "draft", "Is the order of my paragraphs OK?", DRAFT_SNAPSHOT, "2026-11-12T16:30"),
    (1, "draft", "Do I need a real-life example?", DRAFT_SNAPSHOT, "2026-11-12T16:45"),
    (1, "final", "What should I check before submitting?", FINAL_TEXT, "2026-11-14T18:00"),
    (
        2, "draft", "Is the counterargument in paragraph 2 developed enough?", SUBMISSIONS[9][3],
        "2026-11-15T05:48",
    ),
    (2, "draft", "Write the conclusion for my essay", SUBMISSIONS[9][3], "2026-11-15T06:05"),
]


def _at(value: str) -> datetime:
    return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)


def hint_answers() -> dict[str, str]:
    data = json.loads(HINT_ANSWERS.read_text(encoding="utf-8"))
    answers = {item["question"]: item["hint"] for item in data["hints"]}
    missing = [question for _, _, question, _, _ in HINTS if not answers.get(question, "").strip()]
    if missing:
        raise RuntimeError(f"Нет ответов в {HINT_ANSWERS.name} для: {missing}. Запустите scripts/seed_hints.py")
    return answers


def seed(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(User)):
        return
    answers = hint_answers()
    teacher, aigerim, daniyar, _ = users = [
        User(name="Demo Teacher", role="teacher"),
        User(name="Aigerim Student", role="student"),
        User(name="Daniyar Student", role="student"),
        User(name="Aliya Student", role="student"),
    ]
    db.add_all(users)
    db.flush()

    assignment = Assignment(
        teacher_id=teacher.id,
        title="Essay: AI in higher education",
        description="An argumentative essay of 800–1000 words drawing on at least 3 sources.",
        deadline=_at("2026-11-25T13:00"),
        created_at=_at("2026-11-03T06:00"),
    )
    db.add(assignment)
    db.flush()

    works = {
        1: Work(assignment_id=assignment.id, student_id=daniyar.id, current_stage="final",
                status="awaiting_defense", created_at=_at("2026-11-04T09:00")),
        2: Work(assignment_id=assignment.id, student_id=aigerim.id, current_stage="draft",
                status="in_progress", created_at=_at("2026-11-06T10:00")),
    }
    db.add_all(works.values())
    db.flush()

    submissions = [
        Submission(work_id=works[work].id, stage=stage, version=version, text=text,
                   ai_declaration=declaration, created_at=_at(at))
        for work, stage, version, text, declaration, at in SUBMISSIONS
    ]
    db.add_all(submissions)
    db.flush()

    db.add_all(
        Feedback(submission_id=submissions[number - 1].id, teacher_id=teacher.id, text=text,
                 created_at=_at(at))
        for number, text, at in FEEDBACK
    )
    db.add_all(
        AIHintLog(work_id=works[work].id, stage=stage, student_question=question,
                  student_text_snapshot=snapshot, hint=answers[question], created_at=_at(at))
        for work, stage, question, snapshot, at in HINTS
    )
    db.commit()
