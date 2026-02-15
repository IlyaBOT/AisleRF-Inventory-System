from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.db.base import Base
from app.db.session import engine
from app.core.settings import settings
from app.db.models import User, Warehouse
from app.core.security import hash_password

INIT_LOCK_ID = 91234567  # Р»СЋР±РѕРµ РїРѕСЃС‚РѕСЏРЅРЅРѕРµ С‡РёСЃР»Рѕ

async def create_tables():
    async with engine.begin() as conn:
        await conn.execute(text("SELECT pg_advisory_lock(:id)"), {"id": INIT_LOCK_ID})
        try:
            await conn.run_sync(Base.metadata.create_all)
            # Lightweight schema sync for existing databases started before new Lot fields.
            await conn.execute(text("ALTER TABLE lots ADD COLUMN IF NOT EXISTS description TEXT"))
            await conn.execute(text("ALTER TABLE lots ADD COLUMN IF NOT EXISTS documentation_url VARCHAR(2048)"))
        finally:
            await conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": INIT_LOCK_ID})

async def ensure_defaults(session: AsyncSession):
    # Р’РђР–РќРћ: РІСЃС‘ С‚РѕР¶Рµ РїРѕРґ lock, РёРЅР°С‡Рµ РІРѕСЂРєРµСЂС‹ РјРѕРіСѓС‚ РѕРґРЅРѕРІСЂРµРјРµРЅРЅРѕ СЃРѕР·РґР°РІР°С‚СЊ admin/default
    await session.execute(text("SELECT pg_advisory_lock(:id)"), {"id": INIT_LOCK_ID})
    try:
        # admin user
        exists = await session.execute(text("SELECT 1 FROM users WHERE username=:u LIMIT 1"), {"u": settings.admin_username})
        if exists.first() is None:
            # РїР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ <=72 bytes; РµСЃР»Рё СЃРѕРјРЅРµРІР°РµС€СЊСЃСЏ вЂ” Р·Р°РґР°Р№ РєРѕСЂРѕС‚РєРёР№ РІ .env
            session.add(User(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_password),
                is_admin=True,
                avatar_base64=None,
            ))

        # default warehouse
        w_exists = await session.execute(text("SELECT 1 FROM warehouses WHERE name='default' LIMIT 1"))
        if w_exists.first() is None:
            session.add(Warehouse(name="default"))

        await session.commit()
    finally:
        await session.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": INIT_LOCK_ID})

