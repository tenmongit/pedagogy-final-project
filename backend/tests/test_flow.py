"""Сквозной сценарий и права доступа по разделам 4–6 и чек-листу QA (раздел 9) CLAUDE.md."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import db, main

NO_AI = {"used_ai": False, "tools": [], "purpose": [], "description": ""}


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("flow") / "test.db"
    engine = create_engine(f"sqlite:///{db_path.as_posix()}", connect_args={"check_same_thread": False})
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    try:
        with pytest.MonkeyPatch.context() as patch:
            patch.setattr(db, "SessionLocal", session_factory)
            patch.setattr(main, "SessionLocal", session_factory)
            patch.setattr(main, "engine", engine)
            with TestClient(main.app) as c:
                yield c
    finally:
        engine.dispose()


@pytest.fixture
def demo_ai(monkeypatch):
    from app.ai import provider

    def complete(system, data, *, json_output=False):
        if not json_output:
            return "Какой тезис требует доказательства?"
        return """{"questions":[
          {"question":"На какие данные вы опирались?", "why":"Этот вопрос касается финала."},
          {"question":"Как менялся ваш план?", "why":"В работе есть предыдущие версии."},
          {"question":"Что осталось от подсказки?", "why":"Подсказка есть в логе."}
        ]}"""

    monkeypatch.setattr(provider, "complete", complete)


def login(client, name):
    users = client.get("/api/users/demo").json()
    user = next(u for u in users if u["name"].startswith(name))
    r = client.post("/api/auth/login", json={"user_id": user["id"]})
    assert r.status_code == 200, r.text
    assert r.json()["user"] == user
    return {"Authorization": f"Bearer {r.json()['token']}"}, user


def error(response, status, code):
    assert response.status_code == status, response.text
    assert response.json()["error"]["code"] == code
    assert response.json()["error"]["message"]


def test_seed_matches_section_8(client):
    users = client.get("/api/users/demo").json()
    assert [u["role"] for u in users] == ["teacher"] + ["student"] * 8
    teacher, _ = login(client, "Demo Teacher")
    daniyar, _ = login(client, "Daniyar")

    [assignment] = client.get("/api/assignments", headers=teacher).json()
    assert "my_work_id" not in assignment
    assert assignment["deadline"] == "2026-11-25T13:00:00Z"

    summaries = client.get(f"/api/assignments/{assignment['id']}/works", headers=teacher).json()
    assert [(s["current_stage"], s["status"], s["score"]) for s in summaries] == [
        ("final", "awaiting_defense", None),
        ("draft", "in_progress", None),
        ("final", "graded", 86),
        ("final", "graded", 74),
        ("final", "graded", 91),
        ("draft", "in_progress", None),
        ("plan", "in_progress", None),
        ("topic", "in_progress", None),
    ]
    assert summaries[0]["submissions_count"] == 6 and summaries[0]["hints_count"] == 7

    [mine] = client.get("/api/assignments", headers=daniyar).json()
    work = client.get(f"/api/works/{mine['my_work_id']}", headers=daniyar).json()
    assert [s["stage"] for s in work["stages"]] == ["topic", "plan", "draft", "final"]
    assert [len(s["submissions"]) for s in work["stages"]] == [2, 1, 2, 1]
    assert work["stages"][0]["submissions"][0]["feedback"][0]["text"].startswith("Too broad")
    assert len(work["hints"]) == 7 and work["grade"] is None
    # Вопросы защиты для Daniyar генерируются на демо, у оценённых работ они уже есть.
    assert client.get(f"/api/works/{mine['my_work_id']}/ai/defense-questions", headers=teacher).json() is None
    graded = summaries[2]["id"]
    questions = client.get(f"/api/works/{graded}/ai/defense-questions", headers=teacher).json()
    assert 3 <= len(questions["questions"]) <= 4 and not questions["edited_by_teacher"]
    assert client.get(f"/api/works/{graded}", headers=teacher).json()["grade"]["score"] == 86


def test_full_flow_and_access_rules(client, demo_ai, monkeypatch):
    teacher, teacher_user = login(client, "Demo Teacher")
    s1, s1_user = login(client, "Aliya")
    s2, _ = login(client, "Aigerim")

    error(client.get("/api/assignments"), 401, "UNAUTHORIZED")
    error(client.get("/api/me", headers={"Authorization": "Bearer nope"}), 401, "UNAUTHORIZED")
    error(client.post("/api/auth/login", json={"user_id": 999}), 404, "NOT_FOUND")
    assert client.get("/api/me", headers=s1).json() == s1_user

    # задание создаёт только преподаватель
    body = {"title": "Эссе", "description": "Описание", "deadline": "2026-11-20T18:00:00+05:00"}
    error(client.post("/api/assignments", json=body, headers=s1), 403, "FORBIDDEN")
    error(client.post("/api/assignments", json={"title": " "}, headers=teacher), 400, "VALIDATION_ERROR")
    r = client.post("/api/assignments", json=body, headers=teacher)
    assert r.status_code == 201, r.text
    a = r.json()
    assert a["deadline"] == "2026-11-20T13:00:00Z" and a["teacher_id"] == teacher_user["id"]
    aid = a["id"]
    assert client.get(f"/api/assignments/{aid}", headers=s1).json()["title"] == "Эссе"
    error(client.get("/api/assignments/999", headers=s1), 404, "NOT_FOUND")
    error(client.get(f"/api/assignments/{aid}/works", headers=s1), 403, "FORBIDDEN")
    assert client.get(f"/api/assignments/{aid}/works", headers=teacher).json() == []

    # начать работу
    mine = next(x for x in client.get("/api/assignments", headers=s1).json() if x["id"] == aid)
    assert mine["my_work_id"] is None
    error(client.post(f"/api/assignments/{aid}/works", headers=teacher), 403, "FORBIDDEN")
    r = client.post(f"/api/assignments/{aid}/works", headers=s1)
    assert r.status_code == 201, r.text
    work = r.json()
    wid = work["id"]
    assert (work["current_stage"], work["status"]) == ("topic", "in_progress")
    assert work["created_at"].endswith("Z")
    error(client.post(f"/api/assignments/{aid}/works", headers=s1), 409, "CONFLICT")
    mine = next(x for x in client.get("/api/assignments", headers=s1).json() if x["id"] == aid)
    assert mine["my_work_id"] == wid

    # чужую работу студент не видит
    error(client.get(f"/api/works/{wid}", headers=s2), 403, "FORBIDDEN")
    error(client.get(f"/api/works/{wid}/ai/log", headers=s2), 403, "FORBIDDEN")
    error(client.post(f"/api/works/{wid}/submissions", json={"text": "x", "ai_declaration": NO_AI}, headers=s2), 403, "FORBIDDEN")
    error(client.get("/api/works/999", headers=s1), 404, "NOT_FOUND")

    # нельзя перейти без версии
    error(client.post(f"/api/works/{wid}/advance", headers=s1), 409, "CONFLICT")

    # валидация версии и декларации
    sub = f"/api/works/{wid}/submissions"
    used = {"used_ai": True, "tools": ["chatgpt"], "purpose": ["ideas"], "description": "Взял идею"}
    for bad in (
        {"text": "", "ai_declaration": NO_AI},
        {"text": "a" * 20_001, "ai_declaration": NO_AI},
        {"text": "Тема"},
        {"text": "Тема", "ai_declaration": {**used, "description": "  "}},
        {"text": "Тема", "ai_declaration": {**used, "tools": []}},
        {"text": "Тема", "ai_declaration": {**used, "tools": ["copilot"]}},
        {"text": "Тема", "ai_declaration": {**NO_AI, "tools": ["chatgpt"]}},
        {"text": "Тема", "ai_declaration": {**NO_AI, "purpose": ["ideas"]}},
    ):
        error(client.post(sub, json=bad, headers=s1), 400, "VALIDATION_ERROR")
    error(client.post(sub, json={"text": "Тема", "ai_declaration": NO_AI}, headers=teacher), 403, "FORBIDDEN")

    r = client.post(sub, json={"text": "Тема v1", "ai_declaration": used}, headers=s1)
    assert r.status_code == 201, r.text
    first = r.json()
    assert (first["stage"], first["version"], first["work_id"]) == ("topic", 1, wid)
    assert first["ai_declaration"] == used
    r = client.post(sub, json={"text": "a" * 20_000, "ai_declaration": NO_AI}, headers=s1)
    assert r.json()["version"] == 2

    # фидбэк даёт только преподаватель, студент его видит
    fb = f"/api/submissions/{first['id']}/feedback"
    error(client.post(fb, json={"text": "Сузьте тему"}, headers=s1), 403, "FORBIDDEN")
    error(client.post(fb, json={"text": ""}, headers=teacher), 400, "VALIDATION_ERROR")
    error(client.post("/api/submissions/999/feedback", json={"text": "x"}, headers=teacher), 404, "NOT_FOUND")
    assert client.post(fb, json={"text": "Сузьте тему"}, headers=teacher).status_code == 201

    # подсказка: сбой ИИ не попадает в лог и не считается в лимит
    from app.ai import provider

    hint = f"/api/works/{wid}/ai/hint"
    with monkeypatch.context() as patch:
        def unavailable(*args, **kwargs):
            raise provider.AIUnavailable("Сервис ИИ временно недоступен")

        patch.setattr(provider, "complete", unavailable)
        error(client.post(hint, json={"question": "Сбой", "current_text": ""}, headers=s1), 502, "AI_UNAVAILABLE")
    assert client.get(f"/api/works/{wid}/ai/log", headers=s1).json() == []

    r = client.post(hint, json={"question": "С чего начать?", "current_text": "Мой текст"}, headers=s1)
    assert r.status_code == 200, r.text
    log = r.json()
    assert (log["stage"], log["student_question"], log["student_text_snapshot"]) == (
        "topic", "С чего начать?", "Мой текст",
    )
    assert log["hint"] and log["work_id"] == wid
    error(client.post(hint, json={"question": "?"}, headers=teacher), 403, "FORBIDDEN")
    for bad in ({"question": "a" * 1001}, {"question": "  "}, {"question": "?", "current_text": "a" * 20_001}):
        error(client.post(hint, json=bad, headers=s1), 400, "VALIDATION_ERROR")
    for _ in range(9):
        assert client.post(hint, json={"question": "?"}, headers=s1).status_code == 200
    error(client.post(hint, json={"question": "?"}, headers=s1), 409, "CONFLICT")  # 11-я
    assert len(client.get(f"/api/works/{wid}/ai/log", headers=teacher).json()) == 10

    # работа целиком
    detail = client.get(f"/api/works/{wid}", headers=s1).json()
    assert detail["assignment"]["id"] == aid and detail["student"] == s1_user
    assert "my_work_id" not in detail["assignment"]
    assert [len(s["submissions"]) for s in detail["stages"]] == [2, 0, 0, 0]
    assert detail["stages"][0]["submissions"][0]["feedback"][0]["text"] == "Сузьте тему"
    assert len(detail["hints"]) == 10 and detail["grade"] is None
    assert client.get(f"/api/works/{wid}", headers=teacher).json() == detail

    # вопросы защиты и оценка недоступны до финала
    dq = f"/api/works/{wid}/ai/defense-questions"
    grade = f"/api/works/{wid}/grade"
    for method in (client.get, client.post):
        error(method(dq, headers=s1), 403, "FORBIDDEN")
    error(client.put(dq, json={"questions": []}, headers=s1), 403, "FORBIDDEN")
    error(client.post(dq, headers=teacher), 409, "CONFLICT")
    assert client.get(dq, headers=teacher).json() is None
    error(client.put(grade, json={"score": 90, "comment": ""}, headers=s1), 403, "FORBIDDEN")
    error(client.put(grade, json={"score": 90, "comment": ""}, headers=teacher), 409, "CONFLICT")

    # этапы по порядку; на новом этапе лимит подсказок свой
    for stage in ("plan", "draft", "final"):
        r = client.post(f"/api/works/{wid}/advance", headers=s1)
        assert r.status_code == 200 and r.json()["current_stage"] == stage
        if stage == "plan":
            assert client.post(hint, json={"question": "?"}, headers=s1).json()["stage"] == "plan"
        r = client.post(sub, json={"text": f"Текст {stage}", "ai_declaration": NO_AI}, headers=s1)
        assert (r.json()["stage"], r.json()["version"]) == (stage, 1)
    error(client.post(f"/api/works/{wid}/advance", headers=s1), 409, "CONFLICT")  # уже финал
    assert client.get(f"/api/works/{wid}", headers=s1).json()["status"] == "awaiting_defense"
    assert client.post(sub, json={"text": "Финал v2", "ai_declaration": NO_AI}, headers=s1).json()["version"] == 2

    # вопросы для защиты: генерация, правка, перегенерация
    questions = [{"question": f"Вопрос {i}?", "why": "Факт"} for i in range(3)]
    error(client.put(dq, json={"questions": questions}, headers=teacher), 404, "NOT_FOUND")
    r = client.post(dq, headers=teacher)
    assert r.status_code == 200, r.text
    record = r.json()
    assert len(record["questions"]) == 3 and record["questions"][0]["why"]
    assert record["edited_by_teacher"] is False and record["work_id"] == wid
    for bad in (questions[:2], questions + questions, [*questions[:2], {"question": " ", "why": ""}]):
        error(client.put(dq, json={"questions": bad}, headers=teacher), 400, "VALIDATION_ERROR")
    edited = client.put(dq, json={"questions": questions}, headers=teacher).json()
    assert edited["edited_by_teacher"] is True and edited["id"] == record["id"]
    assert client.get(dq, headers=teacher).json() == edited
    again = client.post(dq, headers=teacher).json()
    assert again["edited_by_teacher"] is False and again["id"] == record["id"]
    assert again["questions"] == record["questions"]

    # оценка
    error(client.put(grade, json={"score": 101, "comment": ""}, headers=teacher), 400, "VALIDATION_ERROR")
    r = client.put(grade, json={"score": 90, "comment": "Хорошо"}, headers=teacher)
    assert r.status_code == 200 and r.json()["score"] == 90
    assert client.put(grade, json={"score": 85, "comment": "Итог"}, headers=teacher).json()["id"] == r.json()["id"]
    detail = client.get(f"/api/works/{wid}", headers=s1).json()
    assert detail["status"] == "graded"
    assert (detail["grade"]["score"], detail["grade"]["comment"]) == (85, "Итог")

    # после оценки студент только смотрит, преподаватель продолжает работать
    error(client.post(sub, json={"text": "ещё", "ai_declaration": NO_AI}, headers=s1), 409, "CONFLICT")
    error(client.post(hint, json={"question": "?"}, headers=s1), 409, "CONFLICT")
    error(client.post(f"/api/works/{wid}/advance", headers=s1), 409, "CONFLICT")
    assert client.post(fb, json={"text": "После защиты"}, headers=teacher).status_code == 201
    assert client.post(dq, headers=teacher).status_code == 200

    summary = client.get(f"/api/assignments/{aid}/works", headers=teacher).json()
    assert summary == [
        {
            "id": wid, "student": s1_user, "current_stage": "final", "status": "graded",
            "submissions_count": 6, "hints_count": 11, "score": 85,
        }
    ]


def test_teacher_sees_only_own_assignments(client):
    from app.models import User

    with db.SessionLocal() as session:
        other = User(name="Другой преподаватель", role="teacher")
        session.add(other)
        session.commit()
    other, _ = login(client, "Другой")
    daniyar, _ = login(client, "Daniyar")
    mine = client.get("/api/assignments", headers=daniyar).json()[-1]
    aid, wid = mine["id"], mine["my_work_id"]
    submission = client.get(f"/api/works/{wid}", headers=daniyar).json()["stages"][0]["submissions"][0]

    assert client.get("/api/assignments", headers=other).json() == []
    for method, path, body in (
        ("get", f"/api/assignments/{aid}", None),
        ("get", f"/api/assignments/{aid}/works", None),
        ("get", f"/api/works/{wid}", None),
        ("get", f"/api/works/{wid}/ai/log", None),
        ("get", f"/api/works/{wid}/ai/defense-questions", None),
        ("post", f"/api/works/{wid}/ai/defense-questions", None),
        ("post", f"/api/submissions/{submission['id']}/feedback", {"text": "x"}),
        ("put", f"/api/works/{wid}/grade", {"score": 1, "comment": ""}),
    ):
        error(client.request(method, path, json=body, headers=other), 403, "FORBIDDEN")
