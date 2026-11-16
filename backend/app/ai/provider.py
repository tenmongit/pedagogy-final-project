"""Серверный клиент модели (Chat Completions или Claude) и общий суточный лимит вызовов."""

import asyncio
import logging
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

import anthropic
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


# Модели, которые принимают серверный фолбэк при отказе по правилам безопасности.
_CLAUDE_FALLBACK_MODELS = {
    "claude-opus-5-5",
    "claude-opus-5",
    "claude-sonnet-5-5",
    "claude-fable-5-2",
    "claude-fable-5-1",
}


def _strip_code_fence(text: str) -> str:
    if text.startswith("```") and text.endswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rsplit("```", 1)[0]
    return text.strip()


async def _complete_claude(system: str, data: str, *, json_output: bool) -> str:
    extra = {}
    if config.AI_MODEL in _CLAUDE_FALLBACK_MODELS:
        extra = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}
    async with asyncio.timeout(TIMEOUT_SECONDS), anthropic.AsyncAnthropic(
        api_key=config.AI_API_KEY,
        timeout=TIMEOUT_SECONDS,
        max_retries=0,
    ) as client:
        response = await client.beta.messages.create(
            model=config.AI_MODEL,
            max_tokens=config.AI_MAX_TOKENS,
            system=system,
            messages=[{"role": "user", "content": data}],
            output_config={"effort": config.AI_EFFORT},
            **extra,
        )
    text = "".join(block.text for block in response.content if block.type == "text").strip()
    if response.stop_reason != "end_turn" or not text:
        # refusal, max_tokens и т. п. считаем неполным ответом, как finish_reason != stop.
        raise ValueError(f"Incomplete or empty model output: {response.stop_reason}")
    return _strip_code_fence(text) if json_output else text


def complete(system: str, data: str, *, json_output: bool = False) -> str:
    if (
        not config.AI_API_KEY.strip()
        or not config.AI_MODEL.strip()
        or config.AI_MAX_TOKENS < 1
        or config.AI_DAILY_LIMIT < 1
        or config.AI_PROVIDER not in {"openai", "anthropic"}
    ):
        raise AIUnavailable("Сервис ИИ временно недоступен")

    if config.AI_PROVIDER == "anthropic":
        _reserve_call()
        try:
            return asyncio.run(_complete_claude(system, data, json_output=json_output))
        except anthropic.APIStatusError as exc:
            logger.warning("Claude API returned HTTP %d", exc.status_code)
        except anthropic.APIConnectionError as exc:
            logger.warning("Claude API connection failed: %s", type(exc.__cause__).__name__)
        except (anthropic.APIError, TimeoutError, ValueError) as exc:
            logger.warning("Claude API request failed: %s", type(exc).__name__)
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
