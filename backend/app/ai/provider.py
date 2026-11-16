"""Серверный клиент Chat Completions и общий суточный лимит вызовов."""

import asyncio
import logging
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

import httpx
from sqlalchemy.engine import make_url

from .. import config

logger = logging.getLogger(__name__)
TIMEOUT_SECONDS = 30


class AIUnavailable(Exception):
    """Провайдер недоступен, лимит исчерпан или ответ модели невалиден."""


def _quota_path() -> Path:
    if config.AI_QUOTA_DB:
        return Path(config.AI_QUOTA_DB)
    db_url = make_url(config.DATABASE_URL)
    if db_url.get_backend_name() == "sqlite" and db_url.database not in (None, "", ":memory:"):
        return Path(db_url.database).with_name("izden-ai-quota.db")
    return Path("izden-ai-quota.db")


def _reserve_call() -> None:
    """Считаем попытки до отправки запроса, включая таймауты провайдера."""
    day = datetime.now(timezone.utc).date().isoformat()
    try:
        with closing(sqlite3.connect(_quota_path(), timeout=2)) as db, db:
            db.execute("CREATE TABLE IF NOT EXISTS quota (day TEXT PRIMARY KEY, calls INTEGER NOT NULL)")
            cursor = db.execute(
                """
                INSERT INTO quota (day, calls) VALUES (?, 1)
                ON CONFLICT(day) DO UPDATE SET calls = calls + 1 WHERE calls < ?
                """,
                (day, config.AI_DAILY_LIMIT),
            )
            if cursor.rowcount != 1:
                raise AIUnavailable("Суточный лимит вызовов ИИ исчерпан")
    except sqlite3.Error:
        logger.warning("AI quota storage is unavailable")
        raise AIUnavailable("Сервис ИИ временно недоступен") from None


async def _post_completion(payload: dict) -> str:
    async with asyncio.timeout(TIMEOUT_SECONDS), httpx.AsyncClient() as client:
        response = await client.post(
            f"{config.AI_BASE_URL.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {config.AI_API_KEY}"},
            json=payload,
            timeout=TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        choice = response.json()["choices"][0]
        content = choice["message"]["content"]
        if choice.get("finish_reason") != "stop" or not isinstance(content, str) or not content.strip():
            raise ValueError("Incomplete or empty model output")
        return content.strip()


def complete(system: str, data: str, *, json_output: bool = False) -> str:
    if (
        not config.AI_API_KEY.strip()
        or not config.AI_MODEL.strip()
        or config.AI_MAX_TOKENS < 1
        or config.AI_DAILY_LIMIT < 1
    ):
        raise AIUnavailable("Сервис ИИ временно недоступен")

    payload = {
        "model": config.AI_MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": data}],
        "max_completion_tokens": config.AI_MAX_TOKENS,
    }
    if json_output:
        payload["response_format"] = {"type": "json_object"}

    _reserve_call()
    try:
        return asyncio.run(_post_completion(payload))
    except httpx.HTTPStatusError as exc:
        logger.warning("AI provider returned HTTP %d", exc.response.status_code)
    except (httpx.HTTPError, httpx.InvalidURL, TimeoutError, ValueError, KeyError, IndexError, TypeError) as exc:
        logger.warning("AI provider request failed: %s", type(exc).__name__)
    raise AIUnavailable("Сервис ИИ временно недоступен")
