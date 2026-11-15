from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .db import Base, SessionLocal, engine
from .routers import ai, assignments, auth, submissions
from .seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    if config.SEED_DEMO:
        with SessionLocal() as db:
            seed(db)
    yield


app = FastAPI(title="Izden API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, assignments, submissions, ai):
    app.include_router(module.router)


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}
