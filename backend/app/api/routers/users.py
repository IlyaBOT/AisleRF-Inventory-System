from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.db.models import User
from app.db.session import get_session
from app.schemas.user import AvatarUpdate, PasswordUpdate, UserPublic, UserUpdate
from app.services.image import normalize_avatar_or_lot_image

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic(id=user.id, username=user.username, is_admin=user.is_admin, avatar_base64=user.avatar_base64)


@router.patch("/me", response_model=UserPublic)
async def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserPublic:
    # unique username
    res = await session.execute(select(User).where(User.username == payload.username))
    exists = res.scalar_one_or_none()
    if exists and exists.id != user.id:
        raise HTTPException(status_code=409, detail="Username already used")

    user.username = payload.username
    await session.commit()
    await session.refresh(user)
    return UserPublic(id=user.id, username=user.username, is_admin=user.is_admin, avatar_base64=user.avatar_base64)


@router.patch("/me/password")
async def change_password(
    payload: PasswordUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Old password is wrong")
    user.password_hash = hash_password(payload.new_password)
    await session.commit()
    return {"ok": True}


@router.patch("/me/avatar", response_model=UserPublic)
async def change_avatar(
    payload: AvatarUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserPublic:
    user.avatar_base64 = normalize_avatar_or_lot_image(payload.avatar_base64)
    await session.commit()
    await session.refresh(user)
    return UserPublic(id=user.id, username=user.username, is_admin=user.is_admin, avatar_base64=user.avatar_base64)
