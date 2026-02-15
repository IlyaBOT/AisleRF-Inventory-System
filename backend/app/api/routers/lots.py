from __future__ import annotations

import hashlib
import re
from pathlib import Path
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models import Category, Lot, Tag, Transaction, Warehouse
from app.db.session import get_session
from app.schemas.lot import ConsumeRequest, LotCreate, LotPublic, LotUpdate
from app.services.image import normalize_avatar_or_lot_image
from app.services.purchase import purchase_label

router = APIRouter(prefix="/lots", tags=["lots"])
UPLOADS_DIR = Path(__file__).resolve().parents[3] / "uploads"
MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
ALLOWED_DOCUMENT_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".md",
    ".rtf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
}


def _safe_filename(filename: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", filename).strip("._")
    return safe or "document"


def _public_base_url(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto")
    forwarded_host = request.headers.get("x-forwarded-host")
    if forwarded_proto and forwarded_host:
        return f"{forwarded_proto}://{forwarded_host}"
    return str(request.base_url).rstrip("/")


async def _save_document_file(file: UploadFile) -> str:
    original_name = _safe_filename(file.filename or "document")
    extension = Path(original_name).suffix.lower()
    if extension and extension not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type for documentation")

    blob = await file.read(MAX_DOCUMENT_BYTES + 1)
    if not blob:
        raise HTTPException(status_code=400, detail="File is empty")
    if len(blob) > MAX_DOCUMENT_BYTES:
        raise HTTPException(status_code=413, detail="File is too large (max 10 MB)")

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(blob).hexdigest()

    # Reuse existing file with the same content to avoid duplicate storage.
    existing = next((p.name for p in UPLOADS_DIR.glob(f"{digest}_*") if p.is_file()), None)
    if existing:
        return existing

    # Backward compatibility: old uploads used random prefixes.
    # If we find same-size + same-hash file, reuse it too.
    for path in UPLOADS_DIR.iterdir():
        if not path.is_file():
            continue
        try:
            if path.stat().st_size != len(blob):
                continue
            if hashlib.sha256(path.read_bytes()).hexdigest() == digest:
                return path.name
        except OSError:
            continue

    stored_name = f"{digest}_{original_name}"
    (UPLOADS_DIR / stored_name).write_bytes(blob)
    return stored_name


async def _get_or_create_categories(session: AsyncSession, names: list[str]) -> list[Category]:
    out: list[Category] = []
    for raw in names:
        name = raw.strip()
        if not name:
            continue
        res = await session.execute(select(Category).where(func.lower(Category.name) == name.lower()))
        cat = res.scalar_one_or_none()
        if not cat:
            cat = Category(name=name)
            session.add(cat)
            await session.flush()
        out.append(cat)
    return out


async def _get_or_create_tags(session: AsyncSession, names: list[str]) -> list[Tag]:
    out: list[Tag] = []
    for raw in names:
        name = raw.strip()
        if not name:
            continue
        res = await session.execute(select(Tag).where(func.lower(Tag.name) == name.lower()))
        tag = res.scalar_one_or_none()
        if not tag:
            tag = Tag(name=name)
            session.add(tag)
            await session.flush()
        out.append(tag)
    return out


def _lot_to_public(lot: Lot) -> LotPublic:
    return LotPublic(
        uid=lot.uid,
        warehouse_id=lot.warehouse_id,
        name=lot.name,
        categories=[c.name for c in lot.categories],
        tags=[t.name for t in lot.tags],
        quantity=lot.quantity,
        price=float(lot.price) if lot.price is not None else None,
        currency=lot.currency,
        description=lot.description,
        purchase_url=lot.purchase_url,
        documentation_url=lot.documentation_url,
        purchase_label=purchase_label(lot.purchase_url),
        image_base64=lot.image_base64,
        created_at=lot.created_at,
        updated_at=lot.updated_at,
    )


@router.get("", response_model=list[LotPublic])
async def list_lots(
    warehouse_id: int = Query(..., description="Warehouse id"),
    q: Optional[str] = Query(default=None, description="Text search"),
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    categories: list[str] = Query(default=[]),
    tags: list[str] = Query(default=[]),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[LotPublic]:
    # ensure warehouse exists
    res = await session.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Warehouse not found")

    stmt = select(Lot).where(Lot.warehouse_id == warehouse_id)

    if q:
        qq = f"%{q.strip().lower()}%"
        stmt = stmt.where(func.lower(Lot.name).like(qq))

    if price_min is not None:
        stmt = stmt.where(Lot.price.is_not(None)).where(Lot.price >= price_min)
    if price_max is not None:
        stmt = stmt.where(Lot.price.is_not(None)).where(Lot.price <= price_max)

    # category/tag filters: require lot has ALL selected categories/tags.
    # Implemented via EXISTS subqueries.
    for c in categories:
        c = c.strip()
        if not c:
            continue
        stmt = stmt.where(
            Lot.categories.any(func.lower(Category.name) == c.lower())  # type: ignore[attr-defined]
        )
    for t in tags:
        t = t.strip()
        if not t:
            continue
        stmt = stmt.where(
            Lot.tags.any(func.lower(Tag.name) == t.lower())  # type: ignore[attr-defined]
        )

    stmt = stmt.order_by(Lot.uid.desc()).limit(limit).offset(offset)
    res = await session.execute(stmt)
    lots = res.scalars().unique().all()
    return [_lot_to_public(l) for l in lots]


@router.post("", response_model=LotPublic)
async def create_lot(
    payload: LotCreate,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LotPublic:
    res = await session.execute(select(Warehouse).where(Warehouse.id == payload.warehouse_id))
    wh = res.scalar_one_or_none()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    lot = Lot(
        warehouse_id=payload.warehouse_id,
        name=payload.name.strip(),
        quantity=payload.quantity,
        price=payload.price,
        currency=payload.currency,
        description=payload.description.strip() if payload.description else None,
        purchase_url=payload.purchase_url,
        documentation_url=payload.documentation_url,
        image_base64=normalize_avatar_or_lot_image(payload.image_base64),
    )
    lot.categories = await _get_or_create_categories(session, payload.categories)
    lot.tags = await _get_or_create_tags(session, payload.tags)

    session.add(lot)
    await session.flush()  # get uid

    session.add(Transaction(lot_uid=lot.uid, user_id=user.id, action="add", delta=payload.quantity))
    await session.commit()
    await session.refresh(lot)
    return _lot_to_public(lot)


@router.get("/{uid}", response_model=LotPublic)
async def get_lot(
    uid: int,
    _user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LotPublic:
    res = await session.execute(select(Lot).where(Lot.uid == uid))
    lot = res.scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    return _lot_to_public(lot)


@router.patch("/{uid}", response_model=LotPublic)
async def update_lot(
    uid: int,
    payload: LotUpdate,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LotPublic:
    res = await session.execute(select(Lot).where(Lot.uid == uid))
    lot = res.scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    fields_set = payload.model_fields_set

    if "name" in fields_set and payload.name is not None:
        lot.name = payload.name.strip()
    if "quantity" in fields_set and payload.quantity is not None:
        delta = payload.quantity - lot.quantity
        lot.quantity = payload.quantity
        session.add(Transaction(lot_uid=lot.uid, user_id=user.id, action="adjust", delta=delta, note="manual"))
    if "price" in fields_set:
        lot.price = payload.price
    if "currency" in fields_set and payload.currency is not None:
        lot.currency = payload.currency
    if "description" in fields_set:
        lot.description = payload.description.strip() if payload.description else None
    if "purchase_url" in fields_set:
        lot.purchase_url = payload.purchase_url.strip() if payload.purchase_url else None
    if "documentation_url" in fields_set:
        lot.documentation_url = payload.documentation_url.strip() if payload.documentation_url else None
    if "image_base64" in fields_set:
        lot.image_base64 = normalize_avatar_or_lot_image(payload.image_base64)

    if "categories" in fields_set and payload.categories is not None:
        lot.categories = await _get_or_create_categories(session, payload.categories)
    if "tags" in fields_set and payload.tags is not None:
        lot.tags = await _get_or_create_tags(session, payload.tags)

    await session.commit()
    await session.refresh(lot)
    return _lot_to_public(lot)


@router.delete("/{uid}")
async def delete_lot(
    uid: int,
    _user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, bool]:
    res = await session.execute(select(Lot).where(Lot.uid == uid))
    lot = res.scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    await session.delete(lot)
    await session.commit()
    return {"ok": True}


@router.post("/documentation/upload")
async def upload_documentation(
    request: Request,
    file: UploadFile = File(...),
    _user=Depends(get_current_user),
) -> dict[str, str]:
    stored_name = await _save_document_file(file)
    file_url = _public_base_url(request) + f"/uploads/{quote(stored_name)}"
    return {"url": file_url, "filename": file.filename or stored_name}


@router.post("/{uid}/consume", response_model=LotPublic)
async def consume_lot(
    uid: int,
    payload: ConsumeRequest,
    user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LotPublic:
    res = await session.execute(select(Lot).where(Lot.uid == uid))
    lot = res.scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    if lot.quantity < payload.amount:
        raise HTTPException(status_code=400, detail="Not enough quantity")

    lot.quantity -= payload.amount
    session.add(Transaction(lot_uid=lot.uid, user_id=user.id, action="consume", delta=-payload.amount, note=payload.note))
    await session.commit()
    await session.refresh(lot)
    return _lot_to_public(lot)


@router.get("/meta/categories", response_model=list[str])
async def list_categories(
    _user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[str]:
    res = await session.execute(select(Category.name).order_by(Category.name))
    return [r[0] for r in res.all()]


@router.get("/meta/tags", response_model=list[str])
async def list_tags(
    _user=Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[str]:
    res = await session.execute(select(Tag.name).order_by(Tag.name))
    return [r[0] for r in res.all()]
