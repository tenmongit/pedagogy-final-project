import os

ENV = os.getenv("ENV", "development")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./izden.db")
DEV_SECRET = "dev-secret-change-me-before-deploying"
JWT_SECRET = os.getenv("JWT_SECRET") or DEV_SECRET
TOKEN_TTL_HOURS = int(os.getenv("TOKEN_TTL_HOURS", "72"))
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
    if o.strip()
]
# Ключ ИИ-провайдера живёт только в окружении сервера и никогда не отдаётся клиенту.
AI_API_KEY = os.getenv("AI_API_KEY", "")
# openai — любой сервис Chat Completions по AI_BASE_URL; anthropic — Claude через SDK anthropic.
AI_PROVIDER = os.getenv("AI_PROVIDER", "openai").strip().lower()
AI_BASE_URL = os.getenv("AI_BASE_URL", "https://api.openai.com/v1")
AI_MODEL = os.getenv("AI_MODEL", "")
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "800"))
AI_DAILY_LIMIT = int(os.getenv("AI_DAILY_LIMIT", "100"))
AI_QUOTA_DB = os.getenv("AI_QUOTA_DB", "")
# Только для AI_PROVIDER=anthropic: глубина размышлений (low | medium | high).
AI_EFFORT = os.getenv("AI_EFFORT", "low")
SEED_DEMO = os.getenv("SEED_DEMO", "1") == "1"

if ENV == "production" and JWT_SECRET == DEV_SECRET:
    raise RuntimeError("JWT_SECRET must be set in production")
