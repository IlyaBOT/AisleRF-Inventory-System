from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_session

router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/status")
async def status(
    _user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    # Dev-only; router подключается только в dev
    counts = {}
    for table in ["users", "warehouses", "lots", "categories", "tags", "transactions"]:
        r = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
        counts[table] = int(r.scalar_one())
    return {"app_name": settings.app_name, "mode": settings.app_mode, "db_counts": counts}
