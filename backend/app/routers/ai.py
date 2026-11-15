"""Эндпоинты ИИ: права доступа, сбор контекста и хранение. Генерация — в app/ai/service.py."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..ai import service
from ..db import get_db
from ..models import AIUsageLog, DefenseQuestion, Submission, User
from ..schemas import DefenseQuestionOut, HintIn, HintOut
from ..security import get_assignment, get_stage, require_student, require_teacher, resolve_student

router = APIRouter(prefix="/api", tags=["ai"])


@router.post("/stages/{stage_id}/hint", response_model=HintOut)
def request_hint(
    stage_id: int,
    body: HintIn,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Подсказка студенту на этапе. Каждый запрос автоматически попадает в лог ИИ."""
    stage, assignment = get_stage(db, stage_id, user)
    hint = service.generate_hint(
        service.HintContext(
            assignment_title=assignment.title,
            assignment_description=assignment.description,
            stage_kind=stage.kind,
            question=body.question,
            draft=body.draft,
        )
    )
    log = AIUsageLog(
        student_id=user.id,
        assignment_id=assignment.id,
        stage_id=stage.id,
        source="platform_hint",
        tool="Izden",
        purpose="Подсказка на этапе",
        prompt=body.question,
        response=hint,
    )
    db.add(log)
    db.commit()
    return HintOut(hint=hint, log_id=log.id)


def _questions(db: Session, assignment_id: int, student_id: int) -> list[DefenseQuestion]:
    return db.scalars(
        select(DefenseQuestion)
        .where(
            DefenseQuestion.assignment_id == assignment_id,
            DefenseQuestion.student_id == student_id,
        )
        .order_by(DefenseQuestion.position)
    ).all()


@router.get(
    "/assignments/{assignment_id}/defense-questions", response_model=list[DefenseQuestionOut]
)
def read_defense_questions(
    assignment_id: int,
    student_id: int,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    assignment = get_assignment(db, assignment_id, user)
    student = resolve_student(db, user, student_id)
    return _questions(db, assignment.id, student.id)


@router.post(
    "/assignments/{assignment_id}/defense-questions", response_model=list[DefenseQuestionOut]
)
def generate_defense_questions(
    assignment_id: int,
    student_id: int,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Сгенерировать (или перегенерировать) вопросы для устной защиты. Видит только преподаватель."""
    assignment = get_assignment(db, assignment_id, user)
    student = resolve_student(db, user, student_id)
    stages = {s.id: s for s in assignment.stages}

    submissions = db.scalars(
        select(Submission).where(
            Submission.stage_id.in_(stages), Submission.student_id == student.id
        )
    ).all()
    if not submissions:
        raise HTTPException(409, "У студента ещё нет сданных версий")
    latest = max(submissions, key=lambda s: (stages[s.stage_id].position, s.version))

    logs = db.scalars(
        select(AIUsageLog)
        .where(AIUsageLog.assignment_id == assignment.id, AIUsageLog.student_id == student.id)
        .order_by(AIUsageLog.id)
    ).all()

    texts = service.generate_defense_questions(
        service.DefenseContext(
            assignment_title=assignment.title,
            assignment_description=assignment.description,
            final_text=latest.content,
            ai_usage=[
                service.UsageRecord(
                    stage_kind=stages[log.stage_id].kind,
                    source=log.source,
                    tool=log.tool,
                    purpose=log.purpose,
                    details=log.details,
                    prompt=log.prompt,
                    response=log.response,
                )
                for log in logs
            ],
        )
    )

    db.execute(
        delete(DefenseQuestion).where(
            DefenseQuestion.assignment_id == assignment.id,
            DefenseQuestion.student_id == student.id,
        )
    )
    db.add_all(
        DefenseQuestion(
            assignment_id=assignment.id, student_id=student.id, position=i, text=text
        )
        for i, text in enumerate(texts)
    )
    db.commit()
    return _questions(db, assignment.id, student.id)
