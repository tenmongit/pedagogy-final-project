"""Сгенерировать ответы подсказок для сида настоящей моделью и записать их в app/seed_hints.json.

Берёт вопросы и снимки текста из app.seed.HINTS и вызывает тот же generate_hint, что и
POST /api/works/{id}/ai/hint. Ответы не правятся вручную. Запуск из каталога backend:

    python -m scripts.seed_hints --env-file .env
"""

import argparse
import json
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

ATTEMPTS = 5


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", default=".env")
    args = parser.parse_args()
    load_dotenv(args.env_file)
    from app import config, seed
    from app.ai.provider import AIUnavailable
    from app.ai.service import HintContext, generate_hint

    if not config.AI_API_KEY.strip() or not config.AI_MODEL.strip():
        parser.error("Заполните AI_API_KEY и AI_MODEL в окружении или .env")

    hints = []
    for number, (_, stage, question, snapshot, _) in enumerate(seed.HINTS, start=1):
        for attempt in range(1, ATTEMPTS + 1):
            try:
                hint = generate_hint(HintContext(stage_kind=stage, question=question, draft=snapshot))
                break
            except AIUnavailable as exc:
                print(f"[{number}] попытка {attempt}: {exc}", file=sys.stderr)
        else:
            sys.exit(f"[{number}] не удалось получить подсказку: {question}")
        print(f"[{number}] {stage} · {question} · {len(hint.split())} слов, попытка {attempt}\n{hint}\n")
        hints.append({"stage": stage, "question": question, "hint": hint})

    payload = {
        "model": config.AI_MODEL,
        "provider": config.AI_PROVIDER,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "hints": hints,
    }
    seed.HINT_ANSWERS.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Записано: {seed.HINT_ANSWERS}")


if __name__ == "__main__":
    main()
