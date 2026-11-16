import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


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


def login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}, r.json()["user"]


def test_full_flow_and_access_rules(client, demo_ai, monkeypatch):
    teacher, _ = login(client, "teacher@izden.kz", "teacher123")
    s1, s1_user = login(client, "student1@izden.kz", "student123")
    s2, _ = login(client, "student2@izden.kz", "student123")

    assert client.get("/api/assignments").status_code == 401
    assert client.post("/api/auth/login", json={"email": "x", "password": "y"}).status_code == 401

    # студент не может создавать задания
    assert client.post("/api/assignments", json={"title": "x"}, headers=s1).status_code == 403

    r = client.post(
        "/api/assignments",
        json={"title": "Эссе", "due_dates": {"final": "2026-11-20T18:00:00+05:00"}},
        headers=teacher,
    )
    assert r.status_code == 201, r.text
    a = r.json()
    assert [s["kind"] for s in a["stages"]] == ["topic", "plan", "draft", "final"]
    due = client.get(f"/api/assignments/{a['id']}", headers=s1).json()["stages"][3]["due_at"]
    assert datetime.fromisoformat(due) == datetime.fromisoformat("2026-11-20T13:00:00+00:00")
    topic, plan, draft, final = (s["id"] for s in a["stages"])
    aid, sid = a["id"], s1_user["id"]

    # этапы идут по порядку
    body = {"content": "План", "used_ai": False}
    assert client.post(f"/api/stages/{plan}/submissions", json=body, headers=s1).status_code == 409

    # декларация ИИ должна быть согласованной
    bad = {"content": "Тема", "used_ai": True, "ai_usage": []}
    assert client.post(f"/api/stages/{topic}/submissions", json=bad, headers=s1).status_code == 422

    ok = {
        "content": "Тема v1",
        "used_ai": True,
        "ai_usage": [{"tool": "ChatGPT", "purpose": "Сузить тему", "details": "взял 1 идею"}],
    }
    r = client.post(f"/api/stages/{topic}/submissions", json=ok, headers=s1)
    assert r.status_code == 201, r.text
    sub = r.json()
    assert sub["version"] == 1 and sub["ai_usage"][0]["source"] == "self_report"
    r = client.post(
        f"/api/stages/{topic}/submissions", json={"content": "Тема v2", "used_ai": False}, headers=s1
    )
    assert r.json()["version"] == 2

    # преподаватель не сдаёт работы, студент не даёт фидбэк
    assert client.post(f"/api/stages/{topic}/submissions", json=ok, headers=teacher).status_code == 403
    fb = {"text": "Сузьте тему"}
    assert client.post(f"/api/submissions/{sub['id']}/feedback", json=fb, headers=s1).status_code == 403
    assert client.post(f"/api/submissions/{sub['id']}/feedback", json=fb, headers=teacher).status_code == 201

    # чужую работу студент не видит
    assert client.get(f"/api/submissions/{sub['id']}", headers=s2).status_code == 403
    assert client.get(f"/api/assignments/{aid}/timeline?student_id={sid}", headers=s2).status_code == 403
    assert client.get(f"/api/stages/{topic}/submissions", headers=s2).json() == []

    # подсказка попадает в лог
    from app.ai import provider

    with monkeypatch.context() as patch:
        def unavailable(*args, **kwargs):
            raise provider.AIUnavailable("Сервис ИИ временно недоступен")

        patch.setattr(provider, "complete", unavailable)
        r = client.post(f"/api/stages/{topic}/hint", json={"question": "Сбой"}, headers=s1)
        assert r.status_code == 502 and r.json()["error"]["code"] == "AI_UNAVAILABLE"

    r = client.post(f"/api/stages/{topic}/hint", json={"question": "С чего начать?"}, headers=s1)
    assert r.status_code == 200 and r.json()["hint"]
    assert client.post(f"/api/stages/{topic}/hint", json={"question": "?"}, headers=teacher).status_code == 403

    # таймлайн студента: без вопросов защиты
    t = client.get(f"/api/assignments/{aid}/timeline", headers=s1).json()
    assert t["defense_questions"] is None
    assert len(t["stages"][0]["submissions"]) == 2
    assert t["stages"][0]["submissions"][0]["feedback"][0]["text"] == "Сузьте тему"
    assert t["stages"][0]["hints"][0]["prompt"] == "С чего начать?"
    assert len(t["stages"][0]["hints"]) == 1
    for body in ({"question": "a" * 1001}, {"question": "?", "draft": "a" * 20_001}):
        r = client.post(f"/api/stages/{topic}/hint", json=body, headers=s1)
        assert r.status_code == 400 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    for _ in range(9):
        assert client.post(f"/api/stages/{topic}/hint", json={"question": "?"}, headers=s1).status_code == 200
    assert client.post(f"/api/stages/{topic}/hint", json={"question": "?"}, headers=s1).status_code == 409

    # вопросы защиты — только преподавателю
    q = f"/api/assignments/{aid}/defense-questions?student_id={sid}"
    assert client.post(q, headers=s1).status_code == 403
    assert client.get(q, headers=s1).status_code == 403
    assert client.post(q, headers=teacher).status_code == 409

    # оценка: только преподаватель и только после финала
    g = f"/api/assignments/{aid}/grade?student_id={sid}"
    assert client.put(g, json={"score": 90}, headers=s1).status_code == 403
    assert client.put(g, json={"score": 90}, headers=teacher).status_code == 409
    for stage in (plan, draft, final):
        r = client.post(
            f"/api/stages/{stage}/submissions", json={"content": "текст", "used_ai": False}, headers=s1
        )
        assert r.status_code == 201, r.text
    r = client.post(q, headers=teacher)
    assert r.status_code == 200 and 3 <= len(r.json()) <= 4
    assert len(client.post(q, headers=teacher).json()) == len(r.json())  # перегенерация заменяет
    t = client.get(f"/api/assignments/{aid}/timeline?student_id={sid}", headers=teacher).json()
    assert len(t["defense_questions"]) == len(r.json())
    assert client.put(g, json={"score": 101}, headers=teacher).status_code == 422
    assert client.put(g, json={"score": 90, "comment": "Хорошо"}, headers=teacher).status_code == 200
    assert client.put(g, json={"score": 85}, headers=teacher).json()["score"] == 85
    assert client.get(f"/api/assignments/{aid}/grade", headers=s1).json()["score"] == 85
    assert client.get(f"/api/assignments/{aid}/grade", headers=s2).json() is None

    # после оценки сдача закрыта
    r = client.post(
        f"/api/stages/{final}/submissions", json={"content": "ещё", "used_ai": False}, headers=s1
    )
    assert r.status_code == 409
    assert client.post(f"/api/stages/{final}/hint", json={"question": "?"}, headers=s1).status_code == 409

    # сводка для преподавателя
    rows = client.get(f"/api/assignments/{aid}/students", headers=teacher).json()
    row = next(x for x in rows if x["student"]["id"] == sid)
    assert row["submitted_stages"] == ["topic", "plan", "draft", "final"]
    assert row["grade"]["score"] == 85
    assert client.get(f"/api/assignments/{aid}/students", headers=s1).status_code == 403


def test_teacher_sees_only_own_assignments(client):
    from app.db import SessionLocal
    from app.models import User
    from app.security import hash_password

    with SessionLocal() as db:
        db.add(User(name="T2", email="t2@izden.kz", password_hash=hash_password("pw"), role="teacher"))
        db.commit()
    t2, _ = login(client, "t2@izden.kz", "pw")
    teacher, _ = login(client, "teacher@izden.kz", "teacher123")
    aid = client.get("/api/assignments", headers=teacher).json()[0]["id"]

    assert client.get("/api/assignments", headers=t2).json() == []
    assert client.get(f"/api/assignments/{aid}", headers=t2).status_code == 403
    assert client.get(f"/api/assignments/{aid}/students", headers=t2).status_code == 403
