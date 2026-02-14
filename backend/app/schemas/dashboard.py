from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class DashboardLot(BaseModel):
    uid: int
    name: str
    quantity: int
    price: Optional[float] = None
    currency: str = "RUB"
    last_action_at: Optional[datetime] = None


class DashboardOverview(BaseModel):
    warehouse_id: int
    warehouse_name: str

    last_added: list[DashboardLot]
    last_used: list[DashboardLot]
    top_by_quantity: list[DashboardLot]
    most_used: list[DashboardLot]
