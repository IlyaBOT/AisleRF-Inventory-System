from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import Warehouse
from app.db.session import get_session
from app.schemas.warehouse import WarehouseCreate, WarehousePublic

router = APIRouter(prefix="/warehouses", tags=["warehouses"])


@router.get("", response_model=list[WarehousePublic])
async def list_warehouses(
    _user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[WarehousePublic]:
    res = await session.execute(select(Warehouse).order_by(Warehouse.name))
    items = res.scalars().all()
    return [WarehousePublic(id=w.id, name=w.name) for w in items]


@router.post("", response_model=WarehousePublic)
async def create_warehouse(
    payload: WarehouseCreate,
    _user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WarehousePublic:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Warehouse name required")
    res = await session.execute(select(Warehouse).where(Warehouse.name == name))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Warehouse already exists")
    wh = Warehouse(name=name)
    session.add(wh)
    await session.commit()
    await session.refresh(wh)
    return WarehousePublic(id=wh.id, name=wh.name)
