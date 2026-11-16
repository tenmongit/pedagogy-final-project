from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AIHintLog, Assignment, Grade, Submission, User, Work
from ..schemas import AssignmentIn, AssignmentOut, WorkOut, WorkSummary
from ..security import current_user, get_assignment, require_student, require_teacher

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.get("", response_model=list[AssignmentOut], response_model_exclude_unset=True)
def list_assignments(user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = select(Assignment).order_by(Assignment.created_at.desc(), Assignment.id.desc())
    if user.role == "teacher":
        return db.scalars(query.where(Assignment.teacher_id == user.id)).all()
    my_works = dict(
        db.execute(select(Work.assignment_id, Work.id).where(Work.student_id == user.id)).all()
    )
    result = []
    for assignment in db.scalars(query):
        item = AssignmentOut.model_validate(assignment)
        item.my_work_id = my_works.get(assignment.id)
        result.append(item)
    return result


@router.post("", response_model=AssignmentOut, response_model_exclude_unset=True, status_code=201)
def create_assignment(
    body: AssignmentIn, user: User = Depends(require_teacher), db: Session = Depends(get_db)
):
    assignment = Assignment(teacher_id=user.id, **body.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("/{assignment_id}", response_model=AssignmentOut, response_model_exclude_unset=True)
def read_assignment(
    assignment_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    return get_assignment(db, assignment_id, user)


@router.get("/{assignment_id}/works", response_model=list[WorkSummary])
def list_works(
    assignment_id: int, user: User = Depends(require_teacher), db: Session = Depends(get_db)
):
    """Только начатые работы: у кого есть Work."""
    assignment = get_assignment(db, assignment_id, user)
    works = db.scalars(
        select(Work).where(Work.assignment_id == assignment.id).order_by(Work.id)
    ).all()
    ids = [w.id for w in works]

    def counts(model):
        return dict(
            db.execute(
                select(model.work_id, func.count()).where(model.work_id.in_(ids)).group_by(model.work_id)
            ).all()
        )

    submissions, hints = counts(Submission), counts(AIHintLog)
    scores = dict(db.execute(select(Grade.work_id, Grade.score).where(Grade.work_id.in_(ids))).all())
    return [
        WorkSummary(
            id=w.id,
            student=w.student,
            current_stage=w.current_stage,
            status=w.status,
            submissions_count=submissions.get(w.id, 0),
            hints_count=hints.get(w.id, 0),
            score=scores.get(w.id),
        )
        for w in works
    ]


@router.post("/{assignment_id}/works", response_model=WorkOut, status_code=201)
def start_work(
    assignment_id: int, user: User = Depends(require_student), db: Session = Depends(get_db)
):
    assignment = get_assignment(db, assignment_id, user)
    work = Work(assignment_id=assignment.id, student_id=user.id)
    db.add(work)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Работа по этому заданию уже начата")
    db.refresh(work)
    return work
