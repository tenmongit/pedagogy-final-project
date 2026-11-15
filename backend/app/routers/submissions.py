from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AIUsageLog, Feedback, Grade, Stage, Submission, User
from ..schemas import FeedbackIn, FeedbackOut, SubmissionIn, SubmissionOut
from ..security import current_user, get_stage, require_student, require_teacher, resolve_student

router = APIRouter(prefix="/api", tags=["submissions"])


def _count(db: Session, stage_id: int, student_id: int) -> int:
    return db.scalar(
        select(func.count())
        .select_from(Submission)
        .where(Submission.stage_id == stage_id, Submission.student_id == student_id)
    )


@router.post("/stages/{stage_id}/submissions", response_model=SubmissionOut, status_code=201)
def submit_version(
    stage_id: int,
    body: SubmissionIn,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Сдать новую версию на этапе. Декларация об использовании ИИ обязательна в каждой версии."""
    stage, assignment = get_stage(db, stage_id, user)

    graded = db.scalar(
        select(Grade.id).where(Grade.assignment_id == assignment.id, Grade.student_id == user.id)
    )
    if graded is not None:
        raise HTTPException(409, "Работа уже оценена, сдача закрыта")

    if stage.position > 0:
        previous = db.scalar(
            select(Stage).where(
                Stage.assignment_id == assignment.id, Stage.position == stage.position - 1
            )
        )
        if _count(db, previous.id, user.id) == 0:
            raise HTTPException(409, f"Сначала сдайте этап «{previous.title}»")

    submission = Submission(
        stage_id=stage.id,
        student_id=user.id,
        version=_count(db, stage.id, user.id) + 1,
        content=body.content,
        used_ai=body.used_ai,
    )
    submission.ai_usage = [
        AIUsageLog(
            student_id=user.id,
            assignment_id=assignment.id,
            stage_id=stage.id,
            source="self_report",
            tool=item.tool,
            purpose=item.purpose,
            details=item.details,
        )
        for item in body.ai_usage
    ]
    db.add(submission)
    db.commit()
    return submission


@router.get("/stages/{stage_id}/submissions", response_model=list[SubmissionOut])
def list_versions(
    stage_id: int,
    student_id: int | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    stage, _ = get_stage(db, stage_id, user)
    student = resolve_student(db, user, student_id)
    return db.scalars(
        select(Submission)
        .where(Submission.stage_id == stage.id, Submission.student_id == student.id)
        .order_by(Submission.version)
    ).all()


def _get_submission(db: Session, submission_id: int, user: User) -> Submission:
    submission = db.get(Submission, submission_id)
    if submission is None:
        raise HTTPException(404, "Версия не найдена")
    get_stage(db, submission.stage_id, user)  # преподаватель — только свои задания
    if user.role == "student" and submission.student_id != user.id:
        raise HTTPException(403, "Нельзя смотреть работу другого студента")
    return submission


@router.get("/submissions/{submission_id}", response_model=SubmissionOut)
def read_submission(
    submission_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    return _get_submission(db, submission_id, user)


@router.post("/submissions/{submission_id}/feedback", response_model=FeedbackOut, status_code=201)
def add_feedback(
    submission_id: int,
    body: FeedbackIn,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    submission = _get_submission(db, submission_id, user)
    feedback = Feedback(submission_id=submission.id, teacher_id=user.id, text=body.text)
    db.add(feedback)
    db.commit()
    return feedback
