from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import Lot, Transaction, Warehouse
from app.db.session import get_session
from app.schemas.dashboard import DashboardLot, DashboardOverview

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _dl(lot: Lot, last_action_at=None) -> DashboardLot:
    return DashboardLot(
        uid=lot.uid,
        name=lot.name,
        quantity=lot.quantity,
        price=float(lot.price) if lot.price is not None else None,
        currency=lot.currency,
        last_action_at=last_action_at,
    )


@router.get("/overview", response_model=DashboardOverview)
async def overview(
    warehouse_id: int = Query(...),
    _user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DashboardOverview:
    res = await session.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    wh = res.scalar_one_or_none()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # last added (lots created within week)
    res = await session.execute(
        select(Lot).where(Lot.warehouse_id == warehouse_id).order_by(Lot.created_at.desc()).limit(10)
    )
    last_added_lots = res.scalars().all()
    last_added = [_dl(l) for l in last_added_lots]

    # last used (consume transactions within week)
    res = await session.execute(
        select(Transaction.lot_uid, func.max(Transaction.created_at).label("ts"))
        .join(Lot, Lot.uid == Transaction.lot_uid)
        .where(Lot.warehouse_id == warehouse_id)
        .where(Transaction.action == "consume")
        .where(Transaction.created_at >= week_ago)
        .group_by(Transaction.lot_uid)
        .order_by(desc("ts"))
        .limit(10)
    )
    used_pairs = res.all()
    last_used: list[DashboardLot] = []
    if used_pairs:
        uids = [p[0] for p in used_pairs]
        res2 = await session.execute(select(Lot).where(Lot.uid.in_(uids)))
        lots_by_uid = {l.uid: l for l in res2.scalars().all()}
        for uid, ts in used_pairs:
            lot = lots_by_uid.get(uid)
            if lot:
                last_used.append(_dl(lot, last_action_at=ts))

    # top by quantity
    res = await session.execute(
        select(Lot).where(Lot.warehouse_id == warehouse_id).order_by(Lot.quantity.desc(), Lot.uid.desc()).limit(15)
    )
    top_by_quantity = [_dl(l) for l in res.scalars().all()]

    # most used (by sum of consume in last 30 days)
    month_ago = datetime.now(timezone.utc) - timedelta(days=30)
    res = await session.execute(
        select(Transaction.lot_uid, func.sum(func.abs(Transaction.delta)).label("used"))
        .join(Lot, Lot.uid == Transaction.lot_uid)
        .where(Lot.warehouse_id == warehouse_id)
        .where(Transaction.action == "consume")
        .where(Transaction.created_at >= month_ago)
        .group_by(Transaction.lot_uid)
        .order_by(desc("used"))
        .limit(15)
    )
    pairs = res.all()
    most_used: list[DashboardLot] = []
    if pairs:
        uids = [p[0] for p in pairs]
        res2 = await session.execute(select(Lot).where(Lot.uid.in_(uids)))
        lots_by_uid = {l.uid: l for l in res2.scalars().all()}
        for uid, _used in pairs:
            lot = lots_by_uid.get(uid)
            if lot:
                most_used.append(_dl(lot))

    return DashboardOverview(
        warehouse_id=wh.id,
        warehouse_name=wh.name,
        last_added=last_added,
        last_used=last_used,
        top_by_quantity=top_by_quantity,
        most_used=most_used,
    )
