"""Эндпоинты ИИ: права доступа, сбор контекста и хранение. Генерация — в app/ai/service.py."""

from threading import Lock

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..ai import service
from ..db import get_db, utcnow
from ..models import AIHintLog, DefenseQuestions, Submission, User
from ..schemas import AIHintLogOut, DefenseQuestionsIn, DefenseQuestionsOut, HintIn
from ..security import current_user, get_open_work, get_work, require_student, require_teacher

HINTS_PER_STAGE = 10
HINT_LOCKS = [Lock() for _ in range(64)]

router = APIRouter(prefix="/api/works/{work_id}/ai", tags=["ai"])


@router.post("/hint", response_model=AIHintLogOut)
def request_hint(
    work_id: int,
    body: HintIn,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Подсказка на текущем этапе. Успешный запрос попадает в лог, неуспешный (502) — нет."""
    # В Docker работает один процесс. Не даём двум запросам на один этап пройти проверку одновременно.
    with HINT_LOCKS[work_id % len(HINT_LOCKS)]:
        work = get_open_work(db, work_id, user)
        used = db.scalar(
            select(func.count())
            .select_from(AIHintLog)
            .where(AIHintLog.work_id == work.id, AIHintLog.stage == work.current_stage)
        )
        if used >= HINTS_PER_STAGE:
            advice = (
                "Сдайте финальную версию."
                if work.current_stage == "final"
                else "Сдайте версию и переходите к следующему этапу."
            )
            raise HTTPException(
                409,
                f"На этом этапе подсказки закончились ({HINTS_PER_STAGE} из {HINTS_PER_STAGE}). {advice}",
            )
        hint = service.generate_hint(
            service.HintContext(work.current_stage, body.question, body.current_text)
        )
        log = AIHintLog(
            work_id=work.id,
            stage=work.current_stage,
            student_question=body.question,
            student_text_snapshot=body.current_text,
            hint=hint,
        )
        db.add(log)
        db.commit()
        db.refresh(log)
    return log


@router.get("/log", response_model=list[AIHintLogOut])
def hint_log(work_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    work = get_work(db, work_id, user)
    return db.scalars(
        select(AIHintLog).where(AIHintLog.work_id == work.id).order_by(AIHintLog.id)
    ).all()


def _record(db: Session, work_id: int) -> DefenseQuestions | None:
    return db.scalar(select(DefenseQuestions).where(DefenseQuestions.work_id == work_id))


@router.get("/defense-questions", response_model=DefenseQuestionsOut | None)
def read_defense_questions(
    work_id: int, user: User = Depends(require_teacher), db: Session = Depends(get_db)
):
    return _record(db, get_work(db, work_id, user).id)


@router.post("/defense-questions", response_model=DefenseQuestionsOut)
def generate_defense_questions(
    work_id: int, user: User = Depends(require_teacher), db: Session = Depends(get_db)
):
    """Сгенерировать или перегенерировать вопросы для устной защиты. Видит только преподаватель."""
    work = get_work(db, work_id, user)
    submissions = db.scalars(
        select(Submission).where(Submission.work_id == work.id).order_by(Submission.version)
    ).all()
    latest = {submission.stage: submission.text for submission in submissions}
    if "final" not in latest:
        raise HTTPException(409, "Вопросы можно сгенерировать после сдачи финальной версии")
    hints = db.scalars(
        select(AIHintLog).where(AIHintLog.work_id == work.id).order_by(AIHintLog.id)
    ).all()

    # В ИИ уходят только тексты, декларации и лог: без имени и id студента (раздел 7).
    questions = service.generate_defense_questions(
        service.DefenseContext(
            final_text=latest.pop("final"),
            previous_stages=latest,
            declarations=[
                service.Declaration(
                    stage_kind=s.stage,
                    version=s.version,
                    used_ai=s.ai_declaration["used_ai"],
                    tools=s.ai_declaration["tools"],
                    purpose=s.ai_declaration["purpose"],
                    description=s.ai_declaration["description"],
                )
                for s in submissions
            ],
            hints=[
                service.HintRecord(stage_kind=h.stage, question=h.student_question, hint=h.hint)
                for h in hints
            ],
        )
    )

    record = _record(db, work.id)
    if record is None:
        record = DefenseQuestions(work_id=work.id)
        db.add(record)
    record.questions = [item.model_dump() for item in questions]
    record.edited_by_teacher = False
    record.created_at = utcnow()
    db.commit()
    db.refresh(record)
    return record


@router.put("/defense-questions", response_model=DefenseQuestionsOut)
def update_defense_questions(
    work_id: int,
    body: DefenseQuestionsIn,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    record = _record(db, get_work(db, work_id, user).id)
    if record is None:
        raise HTTPException(404, "Вопросы ещё не сгенерированы")
    record.questions = [item.model_dump() for item in body.questions]
    record.edited_by_teacher = True
    db.commit()
    db.refresh(record)
    return record
