from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class LotPublic(BaseModel):
    uid: int
    warehouse_id: int
    name: str
    categories: list[str] = []
    tags: list[str] = []
    quantity: int
    price: Optional[float] = None
    currency: str = "RUB"
    description: Optional[str] = None
    purchase_url: Optional[str] = None
    documentation_url: Optional[str] = None
    purchase_label: Optional[str] = None
    image_base64: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class LotCreate(BaseModel):
    warehouse_id: int
    name: str = Field(min_length=1, max_length=200)
    categories: list[str] = []
    tags: list[str] = []
    quantity: int = Field(ge=0, le=10_000_000)
    price: Optional[float] = Field(default=None, ge=0)
    currency: str = Field(default="RUB", max_length=8)
    description: Optional[str] = Field(default=None, max_length=10_000)
    purchase_url: Optional[str] = Field(default=None, max_length=2048)
    documentation_url: Optional[str] = Field(default=None, max_length=2048)
    image_base64: Optional[str] = None  # base64 WITHOUT data: prefix


class LotUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    categories: Optional[list[str]] = None
    tags: Optional[list[str]] = None
    quantity: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    price: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, max_length=8)
    description: Optional[str] = Field(default=None, max_length=10_000)
    purchase_url: Optional[str] = Field(default=None, max_length=2048)
    documentation_url: Optional[str] = Field(default=None, max_length=2048)
    image_base64: Optional[str] = None


class ConsumeRequest(BaseModel):
    amount: int = Field(gt=0, le=10_000_000)
    note: Optional[str] = Field(default=None, max_length=255)
