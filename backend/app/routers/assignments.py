from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (
    STAGE_KINDS,
    STAGE_TITLES,
    AIUsageLog,
    Assignment,
    DefenseQuestion,
    Grade,
    Stage,
    Submission,
    User,
)
from ..schemas import (
    AssignmentIn,
    AssignmentOut,
    GradeIn,
    GradeOut,
    StudentProgressOut,
    TimelineOut,
)
from ..security import current_user, get_assignment, require_teacher, resolve_student

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.get("", response_model=list[AssignmentOut])
def list_assignments(user: User = Depends(current_user), db: Session = Depends(get_db)):
    query = select(Assignment).order_by(Assignment.created_at.desc())
    if user.role == "teacher":
        query = query.where(Assignment.teacher_id == user.id)
    return db.scalars(query).all()


@router.post("", response_model=AssignmentOut, status_code=201)
def create_assignment(
    body: AssignmentIn, user: User = Depends(require_teacher), db: Session = Depends(get_db)
):
    """Создаёт задание сразу с четырьмя этапами: тема → план → черновик → финал."""
    assignment = Assignment(title=body.title, description=body.description, teacher_id=user.id)
    assignment.stages = [
        Stage(kind=kind, position=i, title=STAGE_TITLES[kind], due_at=body.due_dates.get(kind))
        for i, kind in enumerate(STAGE_KINDS)
    ]
    db.add(assignment)
    db.commit()
    return assignment


@router.get("/{assignment_id}", response_model=AssignmentOut)
def read_assignment(
    assignment_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    return get_assignment(db, assignment_id, user)


@router.get("/{assignment_id}/timeline", response_model=TimelineOut)
def timeline(
    assignment_id: int,
    student_id: int | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Весь путь одного студента по заданию: этапы, версии, декларации ИИ, подсказки, фидбэк, оценка.

    Студент получает свой таймлайн, преподаватель передаёт ?student_id=.
    """
    assignment = get_assignment(db, assignment_id, user)
    student = resolve_student(db, user, student_id)
    stage_ids = [s.id for s in assignment.stages]

    submissions = db.scalars(
        select(Submission)
        .where(Submission.stage_id.in_(stage_ids), Submission.student_id == student.id)
        .order_by(Submission.version)
    ).all()
    hints = db.scalars(
        select(AIUsageLog)
        .where(
            AIUsageLog.assignment_id == assignment.id,
            AIUsageLog.student_id == student.id,
            AIUsageLog.source == "platform_hint",
        )
        .order_by(AIUsageLog.id)
    ).all()

    questions = None
    if user.role == "teacher":
        questions = db.scalars(
            select(DefenseQuestion)
            .where(
                DefenseQuestion.assignment_id == assignment.id,
                DefenseQuestion.student_id == student.id,
            )
            .order_by(DefenseQuestion.position)
        ).all()

    return {
        "assignment": assignment,
        "student": student,
        "stages": [
            {
                "id": s.id,
                "assignment_id": s.assignment_id,
                "kind": s.kind,
                "position": s.position,
                "title": s.title,
                "due_at": s.due_at,
                "submissions": [x for x in submissions if x.stage_id == s.id],
                "hints": [h for h in hints if h.stage_id == s.id],
            }
            for s in assignment.stages
        ],
        "grade": _grade(db, assignment.id, student.id),
        "defense_questions": questions,
    }


@router.get("/{assignment_id}/students", response_model=list[StudentProgressOut])
def students_progress(
    assignment_id: int, user: User = Depends(require_teacher), db: Session = Depends(get_db)
):
    """Сводка для преподавателя: кто на каком этапе и кому уже выставлена оценка."""
    assignment = get_assignment(db, assignment_id, user)
    kinds = {s.id: s.kind for s in assignment.stages}
    submissions = db.scalars(select(Submission).where(Submission.stage_id.in_(kinds))).all()
    grades = {
        g.student_id: g
        for g in db.scalars(select(Grade).where(Grade.assignment_id == assignment.id))
    }
    result = []
    for student in db.scalars(select(User).where(User.role == "student").order_by(User.name)):
        own = [s for s in submissions if s.student_id == student.id]
        done = {kinds[s.stage_id] for s in own}
        result.append(
            {
                "student": student,
                "submitted_stages": [k for k in STAGE_KINDS if k in done],
                "last_submission_at": max((s.created_at for s in own), default=None),
                "grade": grades.get(student.id),
            }
        )
    return result


def _grade(db: Session, assignment_id: int, student_id: int) -> Grade | None:
    return db.scalar(
        select(Grade).where(Grade.assignment_id == assignment_id, Grade.student_id == student_id)
    )


@router.get("/{assignment_id}/grade", response_model=GradeOut | None)
def read_grade(
    assignment_id: int,
    student_id: int | None = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    assignment = get_assignment(db, assignment_id, user)
    student = resolve_student(db, user, student_id)
    return _grade(db, assignment.id, student.id)


@router.put("/{assignment_id}/grade", response_model=GradeOut)
def set_grade(
    assignment_id: int,
    student_id: int,
    body: GradeIn,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Оценку ставит только преподаватель. После оценки сдача новых версий закрыта."""
    assignment = get_assignment(db, assignment_id, user)
    student = resolve_student(db, user, student_id)
    final_stage = assignment.stages[-1]
    has_final = db.scalar(
        select(Submission.id).where(
            Submission.stage_id == final_stage.id, Submission.student_id == student.id
        )
    )
    if has_final is None:
        raise HTTPException(409, "Нельзя оценить: студент ещё не сдал финальную версию")
    grade = _grade(db, assignment.id, student.id)
    if grade is None:
        grade = Grade(assignment_id=assignment.id, student_id=student.id)
        db.add(grade)
    grade.teacher_id = user.id
    grade.score = body.score
    grade.comment = body.comment
    db.commit()
    return grade
