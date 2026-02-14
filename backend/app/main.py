from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.init_db import create_tables, ensure_defaults
from app.db.session import AsyncSessionLocal

app = FastAPI(title=settings.app_name)

# CORS: dev only
if settings.app_mode == "dev":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router)

# Dev-only debug router
if settings.app_mode == "dev":
    from app.api.routers import debug

    app.include_router(debug.router, prefix="/api")


@app.on_event("startup")
async def _startup() -> None:
    await create_tables()
    async with AsyncSessionLocal() as session:
        await ensure_defaults(session)


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "mode": settings.app_mode}
