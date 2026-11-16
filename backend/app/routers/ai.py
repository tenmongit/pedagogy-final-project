"""Эндпоинты ИИ: права доступа, сбор контекста и хранение. Генерация — в app/ai/service.py."""

from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..ai import service
from ..ai.provider import AIUnavailable
from ..db import get_db
from ..models import AIUsageLog, DefenseQuestion, Grade, Submission, User
from ..schemas import DefenseQuestionOut, HintIn, HintOut
from ..security import get_assignment, get_stage, require_student, require_teacher, resolve_student

ERROR_CODES = {
    400: "VALIDATION_ERROR",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    502: "AI_UNAVAILABLE",
}
HINTS_PER_STAGE = 10
HINT_LOCKS = [Lock() for _ in range(64)]


def _error(status: int, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": ERROR_CODES[status], "message": message}}, status)


class AIRoute(APIRoute):
    def get_route_handler(self):
        handle = super().get_route_handler()

        async def handle_ai(request: Request):
            try:
                return await handle(request)
            except RequestValidationError:
                return _error(400, "Проверьте параметры запроса и длину текста")
            except AIUnavailable as exc:
                return _error(502, str(exc))
            except HTTPException as exc:
                status = 400 if exc.status_code == 422 else exc.status_code
                if status not in ERROR_CODES:
                    raise
                return _error(status, exc.detail)

        return handle_ai


router = APIRouter(prefix="/api", tags=["ai"], route_class=AIRoute)


@router.post("/stages/{stage_id}/hint", response_model=HintOut)
def request_hint(
    stage_id: int,
    body: HintIn,
    user: User = Depends(require_student),
    db: Session = Depends(get_db),
):
    """Подсказка студенту на этапе. Каждый запрос автоматически попадает в лог ИИ."""
    stage, assignment = get_stage(db, stage_id, user)
    if not body.question.strip():
        raise HTTPException(400, "Введите вопрос для подсказки")
    # TODO(spec): проверять Work.current_stage и сохранять student_text_snapshot после перехода на Work.
    # В Docker работает один процесс. Не даём двум запросам на один этап пройти проверку одновременно.
    lock = HINT_LOCKS[hash((stage.id, user.id)) % len(HINT_LOCKS)]
    with lock:
        graded = db.scalar(
            select(Grade.id).where(Grade.assignment_id == assignment.id, Grade.student_id == user.id)
        )
        if graded is not None:
            raise HTTPException(409, "Работа уже оценена, подсказки закрыты")
        count = db.scalar(
            select(func.count()).select_from(AIUsageLog).where(
                AIUsageLog.stage_id == stage.id,
                AIUsageLog.student_id == user.id,
                AIUsageLog.source == "platform_hint",
            )
        )
        if count >= HINTS_PER_STAGE:
            raise HTTPException(409, "Доступно не больше 10 подсказок на этап")
        hint = service.generate_hint(service.HintContext(stage.kind, body.question, body.draft))
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
        .order_by(Submission.version)
    ).all()
    latest = {stages[submission.stage_id].kind: submission.content for submission in submissions}
    if "final" not in latest:
        raise HTTPException(409, "Сначала студент должен сдать финальную версию")

    logs = db.scalars(
        select(AIUsageLog)
        .where(
            AIUsageLog.assignment_id == assignment.id,
            AIUsageLog.student_id == student.id,
            AIUsageLog.source == "platform_hint",
        )
        .order_by(AIUsageLog.id)
    ).all()

    questions = service.generate_defense_questions(
        service.DefenseContext(
            final_text=latest.pop("final"),
            previous_stages=latest,
            declarations=[
                service.Declaration(
                    stage_kind=stages[submission.stage_id].kind,
                    version=submission.version,
                    used_ai=submission.used_ai,
                    tools=[item.tool for item in submission.ai_usage],
                    purpose=[item.purpose for item in submission.ai_usage],
                    description="\n".join(item.details for item in submission.ai_usage),
                )
                for submission in submissions
            ],
            hints=[
                service.HintRecord(
                    stage_kind=stages[log.stage_id].kind,
                    question=log.prompt,
                    hint=log.response,
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
    # TODO(spec): сохранять why и edited_by_teacher, когда появится модель DefenseQuestions с work_id.
    db.add_all(
        DefenseQuestion(
            assignment_id=assignment.id, student_id=student.id, position=i, text=item.question
        )
        for i, item in enumerate(questions)
    )
    db.commit()
    return _questions(db, assignment.id, student.id)
