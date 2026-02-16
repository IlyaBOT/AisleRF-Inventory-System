from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import (
    Category,
    Lot,
    LotCategory,
    LotTag,
    Tag,
    Transaction,
    User,
    Warehouse,
)
from app.db.session import get_session

router = APIRouter(prefix="/system", tags=["system"])
MAX_IMPORT_BYTES = 50 * 1024 * 1024


def _to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _from_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def _as_list(raw: Any, key: str) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail=f"'{key}' must be a list")
    for item in raw:
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail=f"'{key}' contains invalid items")
    return raw


async def _sync_sequences(session: AsyncSession) -> None:
    bind = session.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return

    queries = [
        "SELECT setval(pg_get_serial_sequence('users','id'), COALESCE((SELECT MAX(id) FROM users), 1), COALESCE((SELECT MAX(id) FROM users), 0) > 0)",
        "SELECT setval(pg_get_serial_sequence('warehouses','id'), COALESCE((SELECT MAX(id) FROM warehouses), 1), COALESCE((SELECT MAX(id) FROM warehouses), 0) > 0)",
        "SELECT setval(pg_get_serial_sequence('categories','id'), COALESCE((SELECT MAX(id) FROM categories), 1), COALESCE((SELECT MAX(id) FROM categories), 0) > 0)",
        "SELECT setval(pg_get_serial_sequence('tags','id'), COALESCE((SELECT MAX(id) FROM tags), 1), COALESCE((SELECT MAX(id) FROM tags), 0) > 0)",
        "SELECT setval(pg_get_serial_sequence('lots','uid'), COALESCE((SELECT MAX(uid) FROM lots), 1), COALESCE((SELECT MAX(uid) FROM lots), 0) > 0)",
        "SELECT setval(pg_get_serial_sequence('transactions','id'), COALESCE((SELECT MAX(id) FROM transactions), 1), COALESCE((SELECT MAX(id) FROM transactions), 0) > 0)",
    ]
    for q in queries:
        await session.execute(text(q))


@router.get("/db/export")
async def export_database(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> JSONResponse:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    users = (await session.execute(select(User).order_by(User.id))).scalars().all()
    warehouses = (await session.execute(select(Warehouse).order_by(Warehouse.id))).scalars().all()
    categories = (await session.execute(select(Category).order_by(Category.id))).scalars().all()
    tags = (await session.execute(select(Tag).order_by(Tag.id))).scalars().all()
    lots = (await session.execute(select(Lot).order_by(Lot.uid))).scalars().all()
    lot_categories = (await session.execute(select(LotCategory).order_by(LotCategory.lot_uid, LotCategory.category_id))).scalars().all()
    lot_tags = (await session.execute(select(LotTag).order_by(LotTag.lot_uid, LotTag.tag_id))).scalars().all()
    transactions = (await session.execute(select(Transaction).order_by(Transaction.id))).scalars().all()

    payload = {
        "version": 1,
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "data": {
            "users": [
                {
                    "id": x.id,
                    "username": x.username,
                    "password_hash": x.password_hash,
                    "is_admin": x.is_admin,
                    "avatar_base64": x.avatar_base64,
                    "created_at": _to_iso(x.created_at),
                }
                for x in users
            ],
            "warehouses": [
                {"id": x.id, "name": x.name, "created_at": _to_iso(x.created_at)}
                for x in warehouses
            ],
            "categories": [{"id": x.id, "name": x.name} for x in categories],
            "tags": [{"id": x.id, "name": x.name} for x in tags],
            "lots": [
                {
                    "uid": x.uid,
                    "warehouse_id": x.warehouse_id,
                    "name": x.name,
                    "quantity": x.quantity,
                    "price": float(x.price) if x.price is not None else None,
                    "currency": x.currency,
                    "description": x.description,
                    "purchase_url": x.purchase_url,
                    "documentation_url": x.documentation_url,
                    "image_base64": x.image_base64,
                    "created_at": _to_iso(x.created_at),
                    "updated_at": _to_iso(x.updated_at),
                }
                for x in lots
            ],
            "lot_categories": [{"lot_uid": x.lot_uid, "category_id": x.category_id} for x in lot_categories],
            "lot_tags": [{"lot_uid": x.lot_uid, "tag_id": x.tag_id} for x in lot_tags],
            "transactions": [
                {
                    "id": x.id,
                    "lot_uid": x.lot_uid,
                    "user_id": x.user_id,
                    "action": x.action,
                    "delta": x.delta,
                    "note": x.note,
                    "created_at": _to_iso(x.created_at),
                }
                for x in transactions
            ],
        },
    }

    filename = f"aislerf_db_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return JSONResponse(content=payload, headers=headers)


@router.post("/db/import")
async def import_database(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    raw = await file.read(MAX_IMPORT_BYTES + 1)
    if len(raw) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail="Import file is too large (max 50 MB)")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON file") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid import payload")
    data = payload.get("data")
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Missing 'data' section")

    users = _as_list(data.get("users", []), "users")
    warehouses = _as_list(data.get("warehouses", []), "warehouses")
    categories = _as_list(data.get("categories", []), "categories")
    tags = _as_list(data.get("tags", []), "tags")
    lots = _as_list(data.get("lots", []), "lots")
    lot_categories = _as_list(data.get("lot_categories", []), "lot_categories")
    lot_tags = _as_list(data.get("lot_tags", []), "lot_tags")
    transactions = _as_list(data.get("transactions", []), "transactions")

    try:
        await session.execute(text("DELETE FROM transactions"))
        await session.execute(text("DELETE FROM lot_tags"))
        await session.execute(text("DELETE FROM lot_categories"))
        await session.execute(text("DELETE FROM lots"))
        await session.execute(text("DELETE FROM tags"))
        await session.execute(text("DELETE FROM categories"))
        await session.execute(text("DELETE FROM warehouses"))
        await session.execute(text("DELETE FROM users"))

        for item in users:
            session.add(
                User(
                    id=int(item["id"]),
                    username=str(item["username"]),
                    password_hash=str(item["password_hash"]),
                    is_admin=bool(item.get("is_admin", False)),
                    avatar_base64=item.get("avatar_base64"),
                    created_at=_from_iso(item.get("created_at")),
                )
            )

        for item in warehouses:
            session.add(
                Warehouse(
                    id=int(item["id"]),
                    name=str(item["name"]),
                    created_at=_from_iso(item.get("created_at")),
                )
            )

        for item in categories:
            session.add(Category(id=int(item["id"]), name=str(item["name"])))

        for item in tags:
            session.add(Tag(id=int(item["id"]), name=str(item["name"])))

        for item in lots:
            session.add(
                Lot(
                    uid=int(item["uid"]),
                    warehouse_id=int(item["warehouse_id"]),
                    name=str(item["name"]),
                    quantity=int(item.get("quantity", 0)),
                    price=item.get("price"),
                    currency=str(item.get("currency") or "RUB"),
                    description=item.get("description"),
                    purchase_url=item.get("purchase_url"),
                    documentation_url=item.get("documentation_url"),
                    image_base64=item.get("image_base64"),
                    created_at=_from_iso(item.get("created_at")),
                    updated_at=_from_iso(item.get("updated_at")),
                )
            )

        for item in lot_categories:
            session.add(
                LotCategory(
                    lot_uid=int(item["lot_uid"]),
                    category_id=int(item["category_id"]),
                )
            )

        for item in lot_tags:
            session.add(
                LotTag(
                    lot_uid=int(item["lot_uid"]),
                    tag_id=int(item["tag_id"]),
                )
            )

        for item in transactions:
            session.add(
                Transaction(
                    id=int(item["id"]),
                    lot_uid=int(item["lot_uid"]),
                    user_id=int(item["user_id"]) if item.get("user_id") is not None else None,
                    action=str(item["action"]),
                    delta=int(item["delta"]),
                    note=item.get("note"),
                    created_at=_from_iso(item.get("created_at")),
                )
            )

        await _sync_sequences(session)
        await session.commit()
    except (KeyError, TypeError, ValueError) as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail=f"Invalid import data: {exc}") from exc

    return {
        "ok": True,
        "imported": {
            "users": len(users),
            "warehouses": len(warehouses),
            "categories": len(categories),
            "tags": len(tags),
            "lots": len(lots),
            "lot_categories": len(lot_categories),
            "lot_tags": len(lot_tags),
            "transactions": len(transactions),
        },
    }
