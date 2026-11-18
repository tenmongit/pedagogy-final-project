"""Получить ответы модели для сида и записать их в app/seed_hints.json.

1. Подсказки: вопросы и снимки текста из app.seed.HINTS идут в тот же generate_hint, что и
   POST /api/works/{id}/ai/hint.
2. Вопросы защиты для оценённых работ: сид поднимается на временной базе, и преподаватель
   вызывает настоящий POST /api/works/{id}/ai/defense-questions.

По умолчанию запрашивается только то, чего ещё нет в файле; --all перегенерирует всё.
Ответы не правятся вручную. Запуск из каталога backend:

    python -m scripts.seed_hints --env-file .env
"""

import argparse
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ATTEMPTS = 5


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", default=".env")
    parser.add_argument("--all", action="store_true", help="перегенерировать и уже готовые подсказки")
    args = parser.parse_args()
    load_dotenv(args.env_file)
    tmp = Path(tempfile.mkdtemp(prefix="izden-seed-"))
    # База и счётчик лимита ИИ — временные, рабочая база не трогается.
    os.environ["DATABASE_URL"] = f"sqlite:///{(tmp / 'seed.db').as_posix()}"
    os.environ["AI_QUOTA_DB"] = str(tmp / "quota.db")
    os.environ["SEED_DEMO"] = "1"

    from app import config, seed
    from app.ai.provider import AIUnavailable
    from app.ai.service import HintContext, generate_hint

    if not config.AI_API_KEY.strip() or not config.AI_MODEL.strip():
        parser.error("Заполните AI_API_KEY и AI_MODEL в окружении или .env")

    path = seed.AI_ANSWERS
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    known = {} if args.all else {item["question"]: item for item in data.get("hints", [])}

    def save(hints: list[dict], defense: dict) -> None:
        payload = {
            "model": config.AI_MODEL,
            "provider": config.AI_PROVIDER,
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "hints": hints,
            "defense": defense,
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    hints = []
    for number, (work, stage, question, snapshot, _) in enumerate(seed.HINTS, start=1):
        if question in known:
            hints.append({**known[question], "work": work})
            continue
        for attempt in range(1, ATTEMPTS + 1):
            try:
                hint = generate_hint(HintContext(stage_kind=stage, question=question, draft=snapshot))
                break
            except AIUnavailable as exc:
                print(f"[{number}] попытка {attempt}: {exc}", file=sys.stderr)
        else:
            sys.exit(f"[{number}] не удалось получить подсказку: {question}")
        print(f"[{number}] work {work} · {stage} · {question} · {len(hint.split())} слов, попытка {attempt}\n{hint}\n")
        hints.append({"work": work, "stage": stage, "question": question, "hint": hint})
    save(hints, {})

    from fastapi.testclient import TestClient

    from app import main as app_main

    seed.REQUIRE_DEFENSE = False
    defense = {} if args.all else dict(data.get("defense", {}))
    missing = [work for work, *_ in seed.GRADES if str(work) not in defense]
    if not missing:
        save(hints, defense)
        print(f"Вопросы защиты уже есть. Записано: {path}")
        return
    with TestClient(app_main.app) as client:
        users = client.get("/api/users/demo").json()
        teacher = next(u for u in users if u["role"] == "teacher")
        token = client.post("/api/auth/login", json={"user_id": teacher["id"]}).json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        # Работы создаются в порядке seed.WORKS, поэтому id = позиция ключа + 1.
        work_ids = {key: index for index, key in enumerate(seed.WORKS, start=1)}
        for work in missing:
            for attempt in range(1, ATTEMPTS + 1):
                r = client.post(f"/api/works/{work_ids[work]}/ai/defense-questions", headers=headers)
                if r.status_code == 200:
                    break
                print(f"[defense {work}] попытка {attempt}: {r.status_code} {r.text}", file=sys.stderr)
            else:
                sys.exit(f"[defense {work}] не удалось получить вопросы")
            defense[str(work)] = r.json()["questions"]
            print(f"[defense {work}]")
            for item in defense[str(work)]:
                print(f"Q: {item['question']}\n   why: {item['why']}")
            print()
    save(hints, defense)
    print(f"Записано: {path}")


if __name__ == "__main__":
    main()
