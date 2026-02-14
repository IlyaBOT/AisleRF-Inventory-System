from fastapi import APIRouter

from app.api.routers import auth, dashboard, lots, users, warehouses

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(warehouses.router)
api_router.include_router(lots.router)
api_router.include_router(dashboard.router)
