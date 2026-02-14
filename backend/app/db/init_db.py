from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.models import User, Warehouse
from app.db.session import engine


async def create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def ensure_defaults(session: AsyncSession) -> None:
    # default warehouse
    res = await session.execute(select(Warehouse).where(Warehouse.name == "default"))
    wh = res.scalar_one_or_none()
    if not wh:
        session.add(Warehouse(name="default"))

    # admin user if no users exist
    res = await session.execute(select(User).limit(1))
    user = res.scalar_one_or_none()
    if not user:
        session.add(
            User(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_password),
                is_admin=True,
            )
        )

    await session.commit()
