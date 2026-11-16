from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from . import config
from .ai.provider import AIUnavailable
from .db import Base, SessionLocal, engine
from .routers import ai, assignments, auth, works
from .seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    if config.SEED_DEMO:
        with SessionLocal() as db:
            seed(db)
    yield


app = FastAPI(title="Izden API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, assignments, works, ai):
    app.include_router(module.router)


# --- Единый формат ошибок (раздел 6): {"error": {"code", "message"}} -------------

ERROR_CODES = {
    400: "VALIDATION_ERROR",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    502: "AI_UNAVAILABLE",
}


def _error(status: int, message: str) -> JSONResponse:
    code = ERROR_CODES.get(status, "VALIDATION_ERROR" if status < 500 else "INTERNAL_ERROR")
    return JSONResponse({"error": {"code": code, "message": message}}, status)


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    return _error(exc.status_code, str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    first = exc.errors()[0]
    field = ".".join(str(part) for part in first["loc"] if part != "body")
    message = first["msg"].removeprefix("Value error, ")
    return _error(400, f"{field}: {message}" if field else message)


@app.exception_handler(AIUnavailable)
async def ai_unavailable(request: Request, exc: AIUnavailable):
    return _error(502, str(exc))


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}
