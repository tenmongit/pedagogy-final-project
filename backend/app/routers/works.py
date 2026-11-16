"""Работа студента: просмотр, переход по этапам, версии, фидбэк, оценка (раздел 6)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import STAGES, AIHintLog, Feedback, Grade, Submission, User
from ..schemas import (
    FeedbackIn,
    FeedbackOut,
    GradeIn,
    GradeOut,
    SubmissionIn,
    SubmissionOut,
    WorkDetail,
    WorkOut,
)
from ..security import (
    current_user,
    get_open_work,
    get_submission,
    get_work,
    require_student,
    require_teacher,
)

router = APIRouter(prefix="/api", tags=["works"])


def _versions(db: Session, work_id: int, stage: str) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Submission)
        .where(Submission.work_id == work_id, Submission.stage == stage)
    )


@router.get("/works/{work_id}", response_model=WorkDetail, response_model_exclude_unset=True)
def read_work(work_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    work = get_work(db, work_id, user)
    submissions = db.scalars(
        select(Submission).where(Submission.work_id == work.id).order_by(Submission.version)
    ).all()
    return {
        "id": work.id,
        "assignment": work.assignment,
        "student": work.student,
        "current_stage": work.current_stage,
        "status": work.status,
        "stages": [
            {"stage": stage, "submissions": [s for s in submissions if s.stage == stage]}
            for stage in STAGES
        ],
        "hints": db.scalars(
            select(AIHintLog).where(AIHintLog.work_id == work.id).order_by(AIHintLog.id)
        ).all(),
        "grade": db.scalar(select(Grade).where(Grade.work_id == work.id)),
    }


@router.post("/works/{work_id}/advance", response_model=WorkOut)
def advance(work_id: int, user: User = Depends(require_student), db: Session = Depends(get_db)):
    """Перейти к следующему этапу. Вернуться на прошлый нельзя."""
    work = get_open_work(db, work_id, user)
    if work.current_stage == "final":
        raise HTTPException(409, "Финал — последний этап")
    if _versions(db, work.id, work.current_stage) == 0:
        raise HTTPException(409, "Сначала сдайте хотя бы одну версию на этом этапе")
    work.current_stage = STAGES[STAGES.index(work.current_stage) + 1]
    db.commit()
    return work


@router.post("/works/{work_id}/submissions", response_model=SubmissionOut, status_code=201)
def submit_version(
    work_id: int,
    body: SubmissionIn,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Сдать версию на текущем этапе. Номер версии считается автоматически."""
    work = get_open_work(db, work_id, user)
    submission = Submission(
        work_id=work.id,
        stage=work.current_stage,
        version=_versions(db, work.id, work.current_stage) + 1,
        text=body.text,
        ai_declaration=body.ai_declaration.model_dump(),
    )
    db.add(submission)
    if work.current_stage == "final":
        work.status = "awaiting_defense"
    db.commit()
    db.refresh(submission)
    return submission


@router.post("/submissions/{submission_id}/feedback", response_model=FeedbackOut, status_code=201)
def add_feedback(
    submission_id: int,
    body: FeedbackIn,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    submission = get_submission(db, submission_id, user)
    feedback = Feedback(submission_id=submission.id, teacher_id=user.id, text=body.text)
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


@router.put("/works/{work_id}/grade", response_model=GradeOut)
def set_grade(
    work_id: int,
    body: GradeIn,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Оценку ставит только преподаватель. Повторный вызов обновляет оценку."""
    work = get_work(db, work_id, user)
    if work.status == "in_progress":
        raise HTTPException(409, "Оценку можно поставить после сдачи финальной версии")
    grade = db.scalar(select(Grade).where(Grade.work_id == work.id))
    if grade is None:
        grade = Grade(work_id=work.id)
        db.add(grade)
    grade.teacher_id = user.id
    grade.score = body.score
    grade.comment = body.comment
    work.status = "graded"
    db.commit()
    db.refresh(grade)
    return grade
